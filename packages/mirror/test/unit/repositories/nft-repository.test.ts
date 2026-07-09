import { describe, it, expect, beforeEach, vi } from "vitest";
import { NftRepository } from "../../../src/repositories/NftRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/MirrorNodeClient.js";

describe("NftRepository", () => {
    let repo: NftRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new NftRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findByOwner to queryNftsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByAccount");
        await repo.findByOwner("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123", undefined);
    });

    it("forwards limit/order options to queryNftsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByAccount");
        await repo.findByOwner("0.0.123", { limit: 10, order: "desc" });
        expect(spy).toHaveBeenCalledWith("0.0.123", {
            limit: 10,
            order: "desc",
        });
    });

    it("delegates findBySerial to queryNftsByTokenIdAndSerial", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByTokenIdAndSerial");
        await repo.findBySerial("0.0.99", 5);
        expect(spy).toHaveBeenCalledWith("0.0.99", 5);
    });

    it("delegates findByType to queryNftsByTokenId", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByTokenId");
        await repo.findByType("0.0.99", { limit: 3 });
        expect(spy).toHaveBeenCalledWith("0.0.99", { limit: 3 });
    });

    it("delegates findByOwnerAndType to queryNftsByAccountAndTokenId", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByAccountAndTokenId");
        await repo.findByOwnerAndType("0.0.123", "0.0.99", { order: "asc" });
        expect(spy).toHaveBeenCalledWith("0.0.123", "0.0.99", {
            order: "asc",
        });
    });
    it("forwards findTransactions to queryNftTransactions", async () => {
        const spy = vi.spyOn(mockClient, "queryNftTransactions");
        await repo.findTransactions("0.0.99", 7, { limit: 3 });
        expect(spy).toHaveBeenCalledWith("0.0.99", 7, { limit: 3 });
    });
});
