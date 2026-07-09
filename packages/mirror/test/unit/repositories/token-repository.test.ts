import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenRepository } from "../../../src/repositories/TokenRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/MirrorNodeClient.js";

describe("TokenRepository", () => {
    let repo: TokenRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new TokenRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findById to queryTokenById", async () => {
        const spy = vi.spyOn(mockClient, "queryTokenById");
        await repo.findById("0.0.555", { timestamp: "1.0" });
        expect(spy).toHaveBeenCalledWith("0.0.555", { timestamp: "1.0" });
    });

    it("forwards list to queryTokens", async () => {
        const spy = vi.spyOn(mockClient, "queryTokens");
        await repo.list({ name: "USD", type: "FUNGIBLE_COMMON" });
        expect(spy).toHaveBeenCalledWith({
            name: "USD",
            type: "FUNGIBLE_COMMON",
        });
    });

    it("delegates findByAccountId to queryTokensByAccountId", async () => {
        const spy = vi.spyOn(mockClient, "queryTokensByAccountId");
        await repo.findByAccountId("0.0.123", { limit: 5 });
        expect(spy).toHaveBeenCalledWith("0.0.123", { limit: 5 });
    });

    it("forwards holder thresholds from findHolders to queryTokenBalances", async () => {
        const spy = vi.spyOn(mockClient, "queryTokenBalances");
        const options = {
            accountBalance: { gte: 1_000_000 },
            order: "desc" as const,
            limit: 100,
        };
        await repo.findHolders("0.0.456858", options);
        expect(spy).toHaveBeenCalledWith("0.0.456858", options);
    });
});
