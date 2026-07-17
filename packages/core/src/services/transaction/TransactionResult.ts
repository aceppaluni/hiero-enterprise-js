import type {
    TransactionReceipt,
    TransactionRecord,
    TransactionResponse,
} from "@hiero-ledger/sdk";

/**
 * The baseline result of an executed write operation: what the network
 * assigned and decided, in the two fields every downstream consumer needs.
 *
 * This is the shared base the built-in operations chose: operations whose
 * receipt carries nothing operation-specific (transfers, updates, deletes,
 * freezes, …) return exactly this, and the richer built-in results (see
 * {@link MintResult}, {@link ContractExecuteResult}, …) `extend` it so the
 * transaction reference stays available alongside their extra fields.
 * Entity-creating operations return their entity instead (`createToken` →
 * token ID), and scheduled variants return a {@link ScheduledResult}.
 *
 * The transaction ID is the natural correlator between "I sent this" and
 * what an explorer or the mirror node shows — without it a caller must
 * re-query and guess which transaction was theirs.
 *
 * **A convention, not a constraint.** `TransactionExecutor.run` is generic
 * over its mapper's return type — nothing requires a result to be (or
 * extend) this interface. Each operation processes its receipt (or record,
 * via {@link TransactionOutcome.getRecord}) however it wants and may
 * return something else entirely: the raw receipt, record fields, a
 * bespoke object. This is simply the base the built-in operations share
 * so that every write returns at least the transaction reference.
 *
 * @example Pay and hand the caller a reference they can look up:
 * ```ts
 * const { transactionId } = await accounts.transferHbar(
 *     payeeId, amount, operatorId, { transactionMemo: reference },
 * );
 * console.log(`paid — https://hashscan.io/testnet/transaction/${transactionId}`);
 * ```
 */
export interface TransactionResult {
    /** Transaction ID, e.g. `"0.0.1234@1783012345.000000000"`. */
    readonly transactionId: string;
    /** Consensus status from the receipt, e.g. `"SUCCESS"`. */
    readonly status: string;
}

/**
 * Everything an operation's result mapper may need from a completed
 * transaction. Handed to the `processOutcome` callback of
 * `TransactionExecutor.run` — each operation decides what its result is.
 *
 * Simple operations return the floor: `(o) => o.toResult()` (or pass
 * {@link toTransactionResult} point-free). Rich operations spread it and
 * add their receipt fields:
 * `(o) => ({ ...o.toResult(), serials: o.receipt.serials.map((s) => s.toNumber()) })`.
 * Record-needing operations `await o.getRecord()`.
 */
export interface TransactionOutcome {
    /** Transaction ID, e.g. `"0.0.1234@1783012345.000000000"`. */
    readonly transactionId: string;
    /** The SDK receipt — free, always fetched, status-checked. */
    readonly receipt: TransactionReceipt;
    /**
     * The raw SDK `TransactionResponse`, untouched — the escape hatch for
     * anything this outcome doesn't surface (`transactionHash`, `nodeId`,
     * custom follow-up queries). Prefer {@link receipt} and
     * {@link getRecord}: those are fetch-once guaranteed, while follow-up
     * queries made through `response` are the caller's own cost.
     */
    readonly response: TransactionResponse;
    /** Ready-made floor result: `{ transactionId, status }`. */
    toResult(): TransactionResult;
    /**
     * The transaction record — consensus timestamp, actual fee charged,
     * transfer list, `contractFunctionResult`. **Lazy and memoized**:
     * fetching a record is a separate, paid query, so it costs nothing
     * unless called and is never fetched twice.
     */
    getRecord(): Promise<TransactionRecord>;
}

/**
 * The `processOutcome` mapper for operations whose result *is* the
 * transaction itself — pass it point-free to `TransactionExecutor.run`.
 */
export function toTransactionResult(
    outcome: TransactionOutcome,
): TransactionResult {
    return outcome.toResult();
}

/** Result of `mintToken`. */
export interface MintResult extends TransactionResult {
    /**
     * Serial numbers minted, in mint order. Populated for NFT mints;
     * empty for fungible mints.
     */
    readonly serials: number[];
    /**
     * Total supply after the mint, as a decimal string — token amounts
     * can exceed 2^53 (smallest units).
     */
    readonly totalSupply: string;
}

/** Result of `burnToken` / `wipeToken` — operations that shrink supply. */
export interface SupplyChangeResult extends TransactionResult {
    /** Total supply after the operation, as a decimal string. */
    readonly totalSupply: string;
}

/** Result of `ScheduleService.sign`. */
export interface ScheduleSignResult extends TransactionResult {
    /**
     * The id of the *scheduled* (inner) transaction — use it to query that
     * transaction's own receipt or record. The network reports it on a
     * successful sign whether or not the schedule has executed yet, so its
     * presence is **not** an "it executed" signal; check the schedule's
     * info (`executedAt`) for that.
     */
    readonly scheduledTransactionId?: string;
}

/** Result of `autoCreateEvmAccount`. */
export interface AutoCreateResult extends TransactionResult {
    /**
     * The hollow account the transfer created, e.g. `"0.0.1234"` — reported
     * by the child receipt of the triggering transfer.
     *
     * **Absent when the EVM address was already backed by an account**: the
     * transfer still succeeded (the HBAR moved to the existing account),
     * but nothing was created. The transaction is never thrown away or
     * retried for this — check `accountId === undefined` to detect it.
     */
    readonly accountId?: string;
}

/**
 * The EVM-level outcome of a contract call, distilled from the transaction
 * record's `contractFunctionResult`.
 */
export interface ContractFunctionOutcome {
    /** Hex-encoded return data (`0x…`), ABI-encoded by the contract. */
    readonly returnDataHex: string;
    /** Gas actually consumed by the EVM. */
    readonly gasUsed: number;
    /** EVM revert/error message, when the call failed inside the EVM. */
    readonly errorMessage?: string;
}

/** Result of `executeContract`. */
export interface ContractExecuteResult extends TransactionResult {
    /**
     * The function's EVM outcome. Populated only when the call opts in via
     * `withFunctionResult: true` — it requires the transaction *record*,
     * which is an additional paid query.
     */
    readonly functionResult?: ContractFunctionOutcome;
}
