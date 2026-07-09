import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../src/MirrorNodeClient.js";
import { jsonResponse } from "../utils/http.js";
import { collectAll, paginate } from "../../src/pagination.js";

/**
 * Mock `fetch` that serves a synthetic, arbitrarily large NFT listing.
 * The requested page is read from a `?page=N` query param (absent ⇒ page 0),
 * and `links.next` points at the following page until `totalPages` is reached.
 */
function pagedNftFetch(totalPages: number, pageSize: number) {
    return (input: unknown) => {
        const url = String(input);
        const page = Number(/[?&]page=(\d+)/.exec(url)?.[1] ?? "0");
        const account = /accounts\/([^/?]+)/.exec(url)?.[1] ?? "0.0.0";
        const items = Array.from({ length: pageSize }, (_, i) => ({
            token_id: "0.0.9",
            serial_number: page * pageSize + i,
            account_id: account,
            metadata: "",
            deleted: false,
        }));
        const next =
            page < totalPages - 1
                ? `/api/v1/accounts/${account}/nfts?page=${page + 1}`
                : null;
        return Promise.resolve(jsonResponse({ nfts: items, links: { next } }));
    };
}

describe("MirrorNodeClient continuable pages", () => {
    let client: MirrorNodeClient;
    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    it("a query returns a Page whose next() fetches the following page", async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(pagedNftFetch(3, 2));

        const first = await client.queryNftsByAccount("0.0.1");
        expect(first.data.map((n) => n.serialNumber)).toEqual([0, 1]);
        expect(first.next).toBeTypeOf("function");

        const second = await first.next!();
        expect(second.data.map((n) => n.serialNumber)).toEqual([2, 3]);

        const third = await second.next!();
        expect(third.data.map((n) => n.serialNumber)).toEqual([4, 5]);
        // Last page — no continuation.
        expect(third.next).toBeNull();
    });

    it("collectAll() drains a large multi-page dataset (50 × 100 = 5000)", async () => {
        const spy = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(pagedNftFetch(50, 100));

        const all = await collectAll(await client.queryNftsByAccount("0.0.1"));

        expect(all).toHaveLength(5000);
        expect(all[0].serialNumber).toBe(0);
        expect(all[4999].serialNumber).toBe(4999);
        expect(spy).toHaveBeenCalledTimes(50);
    });

    it("paginate() streams one page at a time", async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(
            pagedNftFetch(25, 100),
        );

        let pages = 0;
        let items = 0;
        for await (const page of paginate(
            await client.queryNftsByAccount("0.0.1"),
        )) {
            pages++;
            items += page.length;
        }
        expect(pages).toBe(25);
        expect(items).toBe(2500);
    });

    it("collectAll() honours maxItems and stops paging early", async () => {
        const spy = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(pagedNftFetch(50, 100));

        const capped = await collectAll(
            await client.queryNftsByAccount("0.0.1"),
            { maxItems: 250 },
        );
        // 100/page: page3 crosses 250 → kept whole → 300 items, 3 fetches.
        expect(capped).toHaveLength(300);
        expect(spy).toHaveBeenCalledTimes(3);
    });

    it("collectAll() honours maxPages", async () => {
        const spy = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(pagedNftFetch(50, 100));

        const capped = await collectAll(
            await client.queryNftsByAccount("0.0.1"),
            { maxPages: 5 },
        );
        expect(capped).toHaveLength(500);
        expect(spy).toHaveBeenCalledTimes(5);
    });
});

describe("pagination under the rate limiter", () => {
    afterEach(() => vi.restoreAllMocks());

    it("caps total in-flight requests when many paginations run at once", async () => {
        // 10 independent paginations, each 4 pages, all draining concurrently.
        const client = new MirrorNodeClient("https://x", { maxConcurrent: 3 });
        const PAGES = 4;
        const SIZE = 50;
        let active = 0;
        let maxActive = 0;

        vi.spyOn(globalThis, "fetch").mockImplementation((input: unknown) => {
            const url = String(input);
            const page = Number(/[?&]page=(\d+)/.exec(url)?.[1] ?? "0");
            const account = /accounts\/([^/?]+)/.exec(url)?.[1] ?? "0.0.0";
            active++;
            maxActive = Math.max(maxActive, active);
            return new Promise<Response>((resolve) => {
                setTimeout(() => {
                    active--;
                    const items = Array.from({ length: SIZE }, (_, i) => ({
                        token_id: "0.0.9",
                        serial_number: page * SIZE + i,
                        account_id: account,
                        metadata: "",
                        deleted: false,
                    }));
                    const next =
                        page < PAGES - 1
                            ? `/api/v1/accounts/${account}/nfts?page=${page + 1}`
                            : null;
                    resolve(jsonResponse({ nfts: items, links: { next } }));
                }, 2);
            });
        });

        const accounts = Array.from({ length: 10 }, (_, i) => `0.0.${100 + i}`);
        const results = await Promise.all(
            accounts.map(async (a) =>
                collectAll(await client.queryNftsByAccount(a)),
            ),
        );

        expect(results).toHaveLength(10);
        for (const r of results) {
            expect(r).toHaveLength(PAGES * SIZE);
        }
        expect(maxActive).toBeLessThanOrEqual(3);
        expect(maxActive).toBe(3);
    });
});
