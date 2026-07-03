import type { EffectiveTimestampRange } from "./common.js";

/**
 * A block (record file) on the network, from `/api/v1/blocks`. Block
 * numbers count record files from network start; each block spans the
 * consensus-timestamp range in `timestamp`.
 */
export interface Block {
    /** Number of transactions in the block */
    count: number;
    /** Total gas used in the block, or null for gas-free blocks */
    gasUsed: number | null;
    /** HAPI version that produced the block */
    hapiVersion: string | null;
    /** The block's keccak hash (0x-prefixed hex) */
    hash: string;
    /** Hex encoded 256-byte logs bloom filter */
    logsBloom: string | null;
    /** The record file name */
    name: string;
    /** The block height (record files since network start) */
    number: number;
    /** The previous block's hash */
    previousHash: string;
    /** The record file size in bytes */
    size: number | null;
    /** Consensus-timestamp span of the block */
    timestamp: EffectiveTimestampRange;
}
