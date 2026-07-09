import type {
    ExchangeRates,
    ExchangeRateQuery,
    NetworkStake,
    NetworkNode,
    NetworkNodesQuery,
    NetworkSupplies,
    NetworkSupplyQuery,
    NetworkFees,
    NetworkFeesQuery,
    FeeEstimate,
    FeeEstimateQuery,
    RegisteredNode,
    RegisteredNodesQuery,
    Page,
} from "../types/index.js";
import type { MirrorNodeClient } from "../MirrorNodeClient.js";

/**
 * Repository for querying network-level data from the mirror node.
 */
export class NetworkRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Get current and next exchange rates, optionally as of a point in
     * time via `{ timestamp }` (historical HBAR/cent price series).
     */
    findExchangeRates(options?: ExchangeRateQuery): Promise<ExchangeRates> {
        return this.mirrorNodeClient.queryExchangeRates(options);
    }

    /**
     * Get network supply information, optionally as of a point in time via
     * `{ timestamp }` (historical supply series).
     */
    findNetworkSupplies(
        options?: NetworkSupplyQuery,
    ): Promise<NetworkSupplies> {
        return this.mirrorNodeClient.queryNetworkSupplies(options);
    }

    /**
     * Get network staking information.
     */
    findStakingRewards(): Promise<NetworkStake> {
        return this.mirrorNodeClient.queryNetworkStake();
    }

    /**
     * List consensus nodes with their per-node stake — the basis for
     * staking-distribution analytics (e.g. summing `stake` across nodes).
     */
    findNodes(options?: NetworkNodesQuery): Promise<Page<NetworkNode>> {
        return this.mirrorNodeClient.queryNetworkNodes(options);
    }

    /**
     * The network fee schedule (per-transaction-type gas costs), optionally
     * as of a point in time.
     */
    findFees(options?: NetworkFeesQuery): Promise<NetworkFees> {
        return this.mirrorNodeClient.queryNetworkFees(options);
    }

    /**
     * List registered (non-consensus) nodes.
     */
    findRegisteredNodes(
        options?: RegisteredNodesQuery,
    ): Promise<Page<RegisteredNode>> {
        return this.mirrorNodeClient.queryRegisteredNodes(options);
    }

    /**
     * Estimate the fees for a HAPI transaction without submitting it
     * (HIP-1313). Pass the protobuf-encoded transaction bytes (e.g. from
     * core's `transaction.toBytes()`); amounts are in tinycents.
     */
    estimateFees(
        transaction: Uint8Array,
        options?: FeeEstimateQuery,
    ): Promise<FeeEstimate> {
        return this.mirrorNodeClient.queryFeeEstimate(transaction, options);
    }
}
