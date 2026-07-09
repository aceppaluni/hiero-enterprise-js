import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { jsonResponse } from "../../utils/http.js";

describe("MirrorNodeClient limit/order query params", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(
                jsonResponse({ nfts: [], links: { next: null } }),
            );
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls[0][0]);

    it("appends limit and order with `?` when the path has no query string", async () => {
        await client.queryNftsByAccount("0.0.1", { limit: 10, order: "desc" });
        expect(url()).toBe(
            "https://x/api/v1/accounts/0.0.1/nfts?limit=10&order=desc",
        );
    });

    it("appends with `&` when the path already has a query string", async () => {
        await client.queryTokensByAccountId("0.0.1", { limit: 25 });
        expect(url()).toBe("https://x/api/v1/tokens?account.id=0.0.1&limit=25");
    });

    it("preserves existing params when filtering transactions by type", async () => {
        await client.queryTransactionsByAccount("0.0.1", {
            transactionType: "CRYPTOTRANSFER",
            order: "asc",
        });
        expect(url()).toBe(
            "https://x/api/v1/transactions?account.id=0.0.1&transactiontype=CRYPTOTRANSFER&order=asc",
        );
    });

    it("omits params that are not provided", async () => {
        await client.queryNftsByAccount("0.0.1", { order: "asc" });
        expect(url()).toBe("https://x/api/v1/accounts/0.0.1/nfts?order=asc");
    });

    it("adds no query string when options are omitted", async () => {
        await client.queryNftsByAccount("0.0.1");
        expect(url()).toBe("https://x/api/v1/accounts/0.0.1/nfts");
    });
});
