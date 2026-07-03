import { describe, it, expect, afterEach, vi } from "vitest";
import { RequestGate } from "../../src/request-gate.js";
import { MirrorNodeClient } from "../../src/mirror-node-client.js";
import { collectAll, paginate } from "../../src/pagination.js";
import {
    convertAccountInfo,
    convertTransactionInfo,
    convertTokenInfo,
    convertNetworkNode,
    convertContractResult,
} from "../../src/mirror-node-converters.js";
import { jsonResponse } from "../utils/http.js";

/**
 * Stress and failure-storm scenarios: high request volume through the
 * gate, bursts of 429s and timeouts, deep pagination chains, and sparse
 * payloads. These pin the properties that only show up under load —
 * concurrency caps that never overshoot, slots that never leak, retries
 * that never deadlock — deterministically (mocked fetch, fake timers
 * where timing matters), so they are fast enough for every CI run.
 */
describe("stress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("1,000 tasks through a 10-slot gate: cap never overshoots, nothing leaks", async () => {
        const gate = new RequestGate({ maxConcurrent: 10 });
        let peak = 0;
        const results = await Promise.all(
            Array.from({ length: 1_000 }, (_, index) =>
                gate.run(async () => {
                    peak = Math.max(peak, gate.inFlight);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    return index;
                }),
            ),
        );
        expect(results).toHaveLength(1_000);
        expect(new Set(results).size).toBe(1_000);
        expect(peak).toBeLessThanOrEqual(10);
        expect(gate.inFlight).toBe(0);
        expect(gate.queued).toBe(0);
    });

    it("a 50% failure storm still drains the gate completely", async () => {
        const gate = new RequestGate({ maxConcurrent: 5 });
        const settled = await Promise.allSettled(
            Array.from({ length: 200 }, (_, index) =>
                gate.run(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    if (index % 2 === 0) throw new Error(`boom ${index}`);
                    return index;
                }),
            ),
        );
        expect(settled.filter((s) => s.status === "rejected")).toHaveLength(
            100,
        );
        expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(
            100,
        );
        expect(gate.inFlight).toBe(0);
        expect(gate.queued).toBe(0);
    });

    it("200 rate-limited starts stay monotonically spaced", async () => {
        vi.useFakeTimers();
        const gate = new RequestGate({ maxRequestsPerSecond: 1_000 }); // 1ms
        const starts: number[] = [];
        const all = Promise.all(
            Array.from({ length: 200 }, () =>
                gate.run(() => {
                    starts.push(Date.now());
                    return Promise.resolve();
                }),
            ),
        );
        await vi.advanceTimersByTimeAsync(250);
        await all;
        expect(starts).toHaveLength(200);
        for (let i = 1; i < starts.length; i++) {
            expect(starts.at(i)! - starts.at(i - 1)!).toBeGreaterThanOrEqual(1);
        }
    });

    it("a 429 burst across 50 concurrent requests retries to full success", async () => {
        vi.useFakeTimers();
        const attempts = new Map<string, number>();
        let inFlightFetches = 0;
        let peakFetches = 0;
        vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            inFlightFetches++;
            peakFetches = Math.max(peakFetches, inFlightFetches);
            try {
                const url = String(input);
                const seen = (attempts.get(url) ?? 0) + 1;
                attempts.set(url, seen);
                if (seen <= 2) {
                    return Promise.resolve(
                        new Response("", {
                            status: 429,
                            headers: { "retry-after": "0" },
                        }),
                    );
                }
                return Promise.resolve(
                    jsonResponse({ account: url.split("/").pop() }),
                );
            } finally {
                inFlightFetches--;
            }
        });

        const client = new MirrorNodeClient("https://x", {
            maxConcurrent: 5,
            maxRetries: 3,
        });
        const all = Promise.all(
            Array.from({ length: 50 }, (_, index) =>
                client.queryAccount(`0.0.${index}`),
            ),
        );
        await vi.advanceTimersByTimeAsync(1_000);
        const accounts = await all;

        expect(accounts).toHaveLength(50);
        // Every request took exactly two 429s before its 200.
        expect([...attempts.values()].every((count) => count === 3)).toBe(true);
        expect(peakFetches).toBeLessThanOrEqual(5);
    });

    it("a timeout flood rejects everything without leaking slots", async () => {
        vi.useFakeTimers();
        let mode: "hang" | "healthy" = "hang";
        vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
            if (mode === "healthy") {
                return Promise.resolve(jsonResponse({ account: "0.0.98" }));
            }
            return new Promise((_, reject) => {
                init?.signal?.addEventListener("abort", () =>
                    reject(
                        Object.assign(new Error("aborted"), {
                            name: "AbortError",
                        }),
                    ),
                );
            });
        });

        const client = new MirrorNodeClient("https://x", {
            timeoutMs: 10,
            maxRetries: 1,
            maxConcurrent: 3,
        });
        const flood = Promise.allSettled(
            Array.from({ length: 30 }, (_, index) =>
                client.queryAccount(`0.0.${index}`),
            ),
        );
        // Generous budget: 30 requests × (10ms timeout + backoff) ×
        // retries, squeezed through 3 slots.
        await vi.advanceTimersByTimeAsync(60_000);
        const settled = await flood;
        expect(
            settled.every(
                (s) =>
                    s.status === "rejected" &&
                    String(s.reason.code) === "TIMED_OUT",
            ),
        ).toBe(true);

        // Slots must all be free again: a healthy request sails through.
        mode = "healthy";
        const after = client.queryAccount("0.0.98");
        await vi.advanceTimersByTimeAsync(100);
        expect((await after).accountId).toBe("0.0.98");
    });

    it("drains a 300-page chain and honors collection bounds", async () => {
        const PAGES = 300;
        const PER_PAGE = 10;
        vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            const url = String(input);
            const match = /page=(\d+)/.exec(url);
            const page = match ? Number(match[1]) : 0;
            return Promise.resolve(
                jsonResponse({
                    nfts: Array.from({ length: PER_PAGE }, (_, i) => ({
                        token_id: "0.0.9",
                        serial_number: page * PER_PAGE + i + 1,
                        account_id: "0.0.98",
                        metadata: "",
                        deleted: false,
                    })),
                    links: {
                        next:
                            page < PAGES - 1
                                ? `/api/v1/tokens/0.0.9/nfts?page=${page + 1}`
                                : null,
                    },
                }),
            );
        });
        const client = new MirrorNodeClient("https://x");

        // Full drain: every item exactly once, in order.
        const everything = await collectAll(
            await client.queryNftsByTokenId("0.0.9"),
        );
        expect(everything).toHaveLength(PAGES * PER_PAGE);
        expect(everything.at(-1)?.serialNumber).toBe(PAGES * PER_PAGE);

        // maxItems stops within one page of the threshold.
        const capped = await collectAll(
            await client.queryNftsByTokenId("0.0.9"),
            { maxItems: 1_005 },
        );
        expect(capped.length).toBeGreaterThanOrEqual(1_005);
        expect(capped.length).toBeLessThanOrEqual(1_005 + PER_PAGE);

        // Streaming visits every page exactly once.
        let pages = 0;
        for await (const page of paginate(
            await client.queryNftsByTokenId("0.0.9"),
        )) {
            pages++;
            expect(page).toHaveLength(PER_PAGE);
        }
        expect(pages).toBe(PAGES);
    });

    it("survives a sweep of minimal sparse payloads across converters", () => {
        // Rows carrying only the fields the mirror node guarantees —
        // every optional absent — must convert without throwing.
        expect(() => convertAccountInfo({ account: "0.0.1" })).not.toThrow();
        expect(() =>
            convertTransactionInfo({
                transaction_id: "0.0.1-1-1",
                name: "CRYPTOTRANSFER",
                result: "SUCCESS",
                consensus_timestamp: "1.0",
                valid_start_timestamp: "1.0",
                charged_tx_fee: 0,
                transfers: [],
                token_transfers: [],
                nft_transfers: [],
                staking_reward_transfers: [],
            }),
        ).not.toThrow();
        expect(() =>
            convertTokenInfo({
                token_id: "0.0.5",
                name: "T",
                symbol: "T",
                type: "FUNGIBLE_COMMON",
                decimals: "0",
                total_supply: "0",
                max_supply: "0",
                treasury_account_id: "0.0.2",
                deleted: false,
            }),
        ).not.toThrow();
        expect(() =>
            convertNetworkNode({
                node_id: 0,
                node_account_id: "0.0.3",
                description: "",
                stake: 0,
                min_stake: 0,
                max_stake: 0,
                stake_rewarded: 0,
                stake_not_rewarded: 0,
            }),
        ).not.toThrow();
        expect(() =>
            convertContractResult({
                amount: null,
                block_gas_used: null,
                block_hash: null,
                block_number: null,
                chain_id: null,
                contract_id: null,
                from: null,
                gas_limit: 0,
                gas_price: null,
                gas_used: null,
                hash: "",
                max_fee_per_gas: null,
                max_priority_fee_per_gas: null,
                nonce: null,
                result: "SUCCESS",
                status: "0x1",
                timestamp: "1.0",
                to: null,
                transaction_index: null,
                type: null,
            }),
        ).not.toThrow();
    });
});
