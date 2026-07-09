import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../src/MirrorNodeClient.js";
import { jsonResponse } from "../utils/http.js";

describe("MirrorNodeClient point-in-time and network-wide queries", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls[0][0]);

    describe("historical account state", () => {
        beforeEach(() => {
            spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
                jsonResponse({
                    account: "0.0.98",
                    balance: { balance: 123, tokens: [] },
                }),
            );
        });

        it("queryAccount passes a point-in-time timestamp", async () => {
            await client.queryAccount("0.0.98", {
                timestamp: "1700000000.000000000",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98?timestamp=1700000000.000000000",
            );
        });

        it("queryAccountBalance passes a timestamp bound", async () => {
            await client.queryAccountBalance("0.0.98", {
                timestamp: { lte: "1700000000.000000000" },
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98?timestamp=lte:1700000000.000000000",
            );
        });

        it("adds no params when options are omitted", async () => {
            await client.queryAccount("0.0.98");
            expect(url()).toBe("https://x/api/v1/accounts/0.0.98");
        });
    });

    describe("account token balances", () => {
        it("queryAccountTokens converts amounts per token", async () => {
            spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
                jsonResponse({
                    tokens: [
                        {
                            token_id: "0.0.456858",
                            balance: 2500000,
                            decimals: 6,
                        },
                        { token_id: "0.0.111", balance: 7 },
                    ],
                    links: { next: null },
                }),
            );
            const page = await client.queryAccountTokens("0.0.98", {
                limit: 50,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98/tokens?limit=50",
            );
            expect(page.data).toEqual([
                { tokenId: "0.0.456858", balance: "2500000", decimals: 6 },
                { tokenId: "0.0.111", balance: "7", decimals: 0 },
            ]);
        });
    });

    describe("network-wide transactions", () => {
        beforeEach(() => {
            spy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(
                    jsonResponse({ transactions: [], links: { next: null } }),
                );
        });

        it("queryTransactions omits account.id when no account is given", async () => {
            await client.queryTransactions({
                transactionType: "CRYPTOTRANSFER",
                timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
                limit: 100,
                order: "desc",
            });
            expect(url()).toBe(
                "https://x/api/v1/transactions" +
                    "?transactiontype=CRYPTOTRANSFER" +
                    "&timestamp=gte:1700000000.0&timestamp=lt:1700086400.0" +
                    "&limit=100&order=desc",
            );
        });

        it("queryTransactions includes account.id when provided", async () => {
            await client.queryTransactions({
                accountId: "0.0.98",
                transactionType: "TOKENMINT",
            });
            expect(url()).toBe(
                "https://x/api/v1/transactions?account.id=0.0.98&transactiontype=TOKENMINT",
            );
        });

        it("queryTransactionsByAccount still anchors to the account", async () => {
            await client.queryTransactionsByAccount("0.0.98", {
                order: "asc",
            });
            expect(url()).toBe(
                "https://x/api/v1/transactions?account.id=0.0.98&order=asc",
            );
        });
    });

    describe("historical network supply", () => {
        it("queryNetworkSupplies passes a timestamp", async () => {
            spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
                jsonResponse({
                    released_supply: "1",
                    total_supply: "2",
                    timestamp: "1700000000.000000000",
                }),
            );
            await client.queryNetworkSupplies({
                timestamp: "1700000000.000000000",
            });
            expect(url()).toBe(
                "https://x/api/v1/network/supply?timestamp=1700000000.000000000",
            );
        });
    });
});
