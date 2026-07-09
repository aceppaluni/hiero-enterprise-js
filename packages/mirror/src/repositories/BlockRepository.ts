import type { Block, BlocksQuery, Page } from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Repository for querying blocks (record files) from the mirror node.
 */
export class BlockRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * List blocks, optionally filtered by height or consensus-timestamp
     * window.
     */
    list(options?: BlocksQuery): Promise<Page<Block>> {
        return this.mirrorNodeClient.queryBlocks(options);
    }

    /**
     * Look up one block by its hash (eth or hedera format) or height.
     */
    findByHashOrNumber(hashOrNumber: string | number): Promise<Block> {
        return this.mirrorNodeClient.queryBlock(hashOrNumber);
    }
}
