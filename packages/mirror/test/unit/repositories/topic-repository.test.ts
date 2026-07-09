import { describe, it, expect, beforeEach, vi } from "vitest";
import { TopicRepository } from "../../../src/repositories/TopicRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/MirrorNodeClient.js";

describe("TopicRepository", () => {
    let repo: TopicRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new TopicRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findByTopicId to queryTopicMessages", async () => {
        const spy = vi.spyOn(mockClient, "queryTopicMessages");
        await repo.findByTopicId("0.0.100");
        expect(spy).toHaveBeenCalledWith("0.0.100", undefined);
    });

    it("delegates findByTopicIdAndSequenceNumber to queryTopicMessageBySequence", async () => {
        const spy = vi.spyOn(mockClient, "queryTopicMessageBySequence");
        await repo.findByTopicIdAndSequenceNumber("0.0.100", 5);
        expect(spy).toHaveBeenCalledWith("0.0.100", 5);
    });
    it("delegates findById to queryTopic", async () => {
        const spy = vi.spyOn(mockClient, "queryTopic");
        await repo.findById("0.0.100");
        expect(spy).toHaveBeenCalledWith("0.0.100");
    });
    it("delegates findMessageByTimestamp to queryTopicMessageByTimestamp", async () => {
        const spy = vi.spyOn(mockClient, "queryTopicMessageByTimestamp");
        await repo.findMessageByTimestamp("1234.000000001");
        expect(spy).toHaveBeenCalledWith("1234.000000001");
    });
});
