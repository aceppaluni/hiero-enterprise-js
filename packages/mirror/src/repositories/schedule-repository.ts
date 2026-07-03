import type { MirrorSchedule, Page, SchedulesQuery } from "../types/index.js";
import type { MirrorNodeClient } from "../mirror-node-client.js";

/**
 * Repository for querying scheduled transactions from the mirror node —
 * the read-side counterpart of core's `ScheduleService`.
 */
export class ScheduleRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * List scheduled transactions, optionally filtered by creator account
     * or schedule ID range.
     */
    list(options?: SchedulesQuery): Promise<Page<MirrorSchedule>> {
        return this.mirrorNodeClient.querySchedules(options);
    }

    /**
     * Look up one scheduled transaction's state — signatures collected,
     * executed/deleted status, expiry.
     */
    findById(scheduleId: string): Promise<MirrorSchedule> {
        return this.mirrorNodeClient.querySchedule(scheduleId);
    }
}
