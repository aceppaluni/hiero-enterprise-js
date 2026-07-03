import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScheduleRepository } from "../../../src/repositories/schedule-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror-node-client.js";

describe("ScheduleRepository", () => {
    let repo: ScheduleRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new ScheduleRepository(
            mockClient as unknown as MirrorNodeClient,
        );
    });

    it("forwards list filters to querySchedules", async () => {
        const spy = vi.spyOn(mockClient, "querySchedules");
        await repo.list({ accountId: "0.0.11", order: "desc" });
        expect(spy).toHaveBeenCalledWith({
            accountId: "0.0.11",
            order: "desc",
        });
    });

    it("delegates findById to querySchedule", async () => {
        const spy = vi.spyOn(mockClient, "querySchedule");
        await repo.findById("0.0.777");
        expect(spy).toHaveBeenCalledWith("0.0.777");
    });
});
