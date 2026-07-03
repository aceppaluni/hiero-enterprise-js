import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../src/mirror-node-client.js";
import { jsonResponse } from "../utils/http.js";

describe("MirrorNodeClient transaction query bundling", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(
                jsonResponse({ transactions: [], links: { next: null } }),
            );
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls[0][0]);

    it("bundles transactionType, timestamp range, limit and order in one query", async () => {
        await client.queryTransactionsByAccount("0.0.123", {
            transactionType: "TOKENMINT",
            timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
            limit: 50,
            order: "desc",
        });
        expect(url()).toBe(
            "https://x/api/v1/transactions?account.id=0.0.123" +
                "&transactiontype=TOKENMINT" +
                "&timestamp=gte:1700000000.0&timestamp=lt:1700086400.0" +
                "&limit=50&order=desc",
        );
    });

    it("supports a point-in-time timestamp string", async () => {
        await client.queryTransactionsByAccount("0.0.123", {
            timestamp: "1700000000.000000000",
        });
        expect(url()).toBe(
            "https://x/api/v1/transactions?account.id=0.0.123" +
                "&timestamp=1700000000.000000000",
        );
    });

    it("emits only the provided timestamp bounds", async () => {
        await client.queryTransactionsByAccount("0.0.123", {
            timestamp: { gte: "1700000000.0" },
        });
        expect(url()).toBe(
            "https://x/api/v1/transactions?account.id=0.0.123" +
                "&timestamp=gte:1700000000.0",
        );
    });

    it("adds no filter params when options are omitted", async () => {
        await client.queryTransactionsByAccount("0.0.123");
        expect(url()).toBe("https://x/api/v1/transactions?account.id=0.0.123");
    });
});
