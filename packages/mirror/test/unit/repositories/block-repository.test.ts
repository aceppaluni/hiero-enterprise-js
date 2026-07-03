import { describe, it, expect, beforeEach, vi } from "vitest";
import { BlockRepository } from "../../../src/repositories/block-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror-node-client.js";

describe("BlockRepository", () => {
    let repo: BlockRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new BlockRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("forwards list to queryBlocks", async () => {
        const spy = vi.spyOn(mockClient, "queryBlocks");
        await repo.list({ blockNumber: { gte: 70 }, limit: 5 });
        expect(spy).toHaveBeenCalledWith({
            blockNumber: { gte: 70 },
            limit: 5,
        });
    });

    it("forwards findByHashOrNumber to queryBlock", async () => {
        const spy = vi.spyOn(mockClient, "queryBlock");
        await repo.findByHashOrNumber(77);
        expect(spy).toHaveBeenCalledWith(77);
    });
});
