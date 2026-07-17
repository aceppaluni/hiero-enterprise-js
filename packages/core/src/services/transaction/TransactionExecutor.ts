import type {
    Transaction,
    TransactionRecord,
    TransactionResponse,
} from "@hiero-ledger/sdk";
import { AccountId } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import type { TransactionEvent } from "../../listeners/index.js";
import {
    HieroError,
    HieroErrorCodes,
    normalizeError,
} from "../../errors/index.js";
import type { TransactionOptions } from "./TransactionOptions.js";
import type { ScheduleOptions, ScheduledResult } from "./ScheduleOptions.js";
import type { TransactionOutcome } from "./TransactionResult.js";

/** Executor-level knobs an *operation* sets — not exposed to callers. */
export interface RunOptions {
    /**
     * Fetch the receipt with child receipts included. Needed by operations
     * whose effect materialises in a child transaction (e.g. hollow-account
     * auto-create, where the new account id is on the transfer's child).
     * Child receipts are free but not populated by default.
     */
    includeChildReceipts?: boolean;
}

/**
 * Owns the full transaction lifecycle shared across all service operations:
 * applying base options, optional freeze, additional signers, execute,
 * receipt, and before/after event emission.
 *
 * Operations call `run()` or `scheduleRun()`, supplying a pre-built
 * transaction and a `processOutcome` callback that maps the
 * {@link TransactionOutcome} (receipt, raw response, transaction id, lazy
 * record) to the operation's return type. This keeps all boilerplate in
 * one place while each operation decides what its result is.
 */
export class TransactionExecutor {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Execute a pre-built transaction through the full lifecycle.
     *
     * @param tx - The built (but not yet executed) transaction.
     * @param options - Base transaction options (fees, signers, etc.).
     * @param event - Event metadata emitted before and after execution.
     * @param processOutcome - Maps the outcome (receipt + raw response +
     *   transactionId + lazy record) to the operation result. May be
     *   async — e.g. when it awaits `outcome.getRecord()`.
     * @param runOptions - Executor knobs set by the operation itself.
     */
    async run<TResult>(
        tx: Transaction,
        options: TransactionOptions,
        event: TransactionEvent,
        processOutcome: (
            outcome: TransactionOutcome,
        ) => TResult | Promise<TResult>,
        runOptions: RunOptions = {},
    ): Promise<TResult> {
        // Apply base SDK options before any signing or execution
        this.applyBaseOptions(tx, options);

        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        let response: TransactionResponse;
        let receipt: TransactionOutcome["receipt"];
        let transactionId: string;
        try {
            // Always freeze before signing or execution — the SDK requires
            // a frozen transaction for sign/signWith/_addSignatureLegacy and
            // custom networks may not auto-freeze correctly in execute().
            tx.freezeWith(this.context.client);

            // Apply offline signatures after freeze (requires stable tx hash)
            this.applyLegacySignatures(tx, options);

            await this.applySigners(tx, options);

            // execute() auto-signs with the operator key via the client
            response = await tx.execute(this.context.client);
            if (runOptions.includeChildReceipts) {
                // getReceipt first, for the SDK's full semantics — status
                // validation AND the ThrottledAtConsensus resubmission that
                // lives inside it. A bare receipt query would surface a
                // transient throttle as an error, and the child path's users
                // move funds: a surfaced error invites a double-spend retry.
                await response.getReceipt(this.context.client);
                // Consensus reached — re-fetch with children included. The
                // extra query is free, and building it only now means it
                // targets the final transaction id even after a resubmit.
                receipt = await response
                    .getReceiptQuery(this.context.client)
                    .setIncludeChildren(true)
                    .execute(this.context.client);
            } else {
                receipt = await response.getReceipt(this.context.client);
            }
            transactionId = response.transactionId.toString();
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(
                error,
                `${event.serviceName}.${event.methodName}`,
            );
        }

        // The receipt is in hand: the transaction's on-chain fate is decided.
        // Emit the after-event NOW so events always reflect the chain — a
        // failure in the result mapper below (a business rule, or a record
        // fetch under an opt-in) must never masquerade as a failed
        // transaction in listeners and metrics.
        await this.context.emitAfterTransaction({
            ...event,
            transactionId,
            status: receipt.status.toString(),
            durationMs: Date.now() - start,
        });

        try {
            return await processOutcome(
                this.buildOutcome(response, receipt, transactionId),
            );
        } catch (error) {
            // The transaction SUCCEEDED on-chain; only mapping its result
            // failed. Say so, and carry the transaction id so the caller can
            // recover the outcome (e.g. from the mirror node) without
            // retrying — a retry would re-submit a transaction that already
            // landed.
            const cause =
                error instanceof Error ? error : new Error(String(error));
            throw new HieroError(
                `Transaction ${transactionId} reached consensus with status ` +
                    `${receipt.status.toString()}, but mapping its result ` +
                    `failed: ${cause.message}`,
                {
                    code: HieroErrorCodes.ResultMappingFailed,
                    context: `${event.serviceName}.${event.methodName}`,
                    transactionId,
                    cause,
                },
            );
        }
    }

    /**
     * Wrap a pre-built transaction in a `ScheduleCreateTransaction` and
     * submit it for deferred multi-sig execution.
     *
     * The inner transaction is stored on-chain and can collect signatures
     * from other parties before it executes automatically.
     *
     * @param tx - The inner transaction to schedule.
     * @param options - Base transaction options applied to the ScheduleCreateTransaction.
     * @param event - Event metadata emitted before and after execution.
     * @param scheduleOptions - Schedule-specific options (payer, admin key, memo).
     */
    async scheduleRun(
        tx: Transaction,
        options: TransactionOptions,
        event: TransactionEvent,
        scheduleOptions: ScheduleOptions = {},
    ): Promise<ScheduledResult> {
        // tx.schedule() wraps the inner transaction in a ScheduleCreateTransaction
        const scheduleTx = tx.schedule();

        if (scheduleOptions.payerAccountId != null) {
            const payerId =
                typeof scheduleOptions.payerAccountId === "string"
                    ? AccountId.fromString(scheduleOptions.payerAccountId)
                    : scheduleOptions.payerAccountId;
            scheduleTx.setPayerAccountId(payerId);
        }

        if (scheduleOptions.adminKey != null) {
            scheduleTx.setAdminKey(scheduleOptions.adminKey);
        }

        if (scheduleOptions.scheduleMemo != null) {
            scheduleTx.setScheduleMemo(scheduleOptions.scheduleMemo);
        }

        return await this.run(scheduleTx, options, event, (outcome) => ({
            scheduleId: outcome.receipt.scheduleId!.toString(),
            transactionId: outcome.transactionId,
        }));
    }

    /**
     * Assemble the {@link TransactionOutcome} handed to an operation's
     * result mapper. `getRecord` memoizes the *promise*, so concurrent and
     * repeated calls share one record query — records are paid. A rejected
     * record fetch is memoized too; that is fine for the one-shot mapper
     * use, and retrying belongs to the caller (via the transaction id),
     * not to a hidden second paid query.
     */
    private buildOutcome(
        response: TransactionResponse,
        receipt: TransactionOutcome["receipt"],
        transactionId: string,
    ): TransactionOutcome {
        let record: Promise<TransactionRecord> | undefined;
        return {
            transactionId,
            receipt,
            response,
            toResult: () => ({
                transactionId,
                status: receipt.status.toString(),
            }),
            // Direct record query rather than response.getRecord(): the SDK
            // method first re-fetches the receipt to await consensus, which
            // this executor has already done — skipping it saves a free but
            // pointless round-trip before the paid query.
            getRecord: () =>
                (record ??= response
                    .getRecordQuery(this.context.client)
                    .execute(this.context.client)),
        };
    }

    /**
     * Apply the base `TransactionOptions` fields to the SDK transaction before
     * it is frozen or executed.
     */
    private applyBaseOptions(
        tx: Transaction,
        options: TransactionOptions,
    ): void {
        if (options.maxTransactionFee != null) {
            tx.setMaxTransactionFee(options.maxTransactionFee);
        }

        if (options.transactionValidDuration != null) {
            tx.setTransactionValidDuration(options.transactionValidDuration);
        }

        if (options.transactionMemo != null) {
            tx.setTransactionMemo(options.transactionMemo);
        }

        if (options.regenerateTransactionId != null) {
            tx.setRegenerateTransactionId(options.regenerateTransactionId);
        }

        if (options.highVolume != null) {
            tx.setHighVolume(options.highVolume);
        }

        if (options.nodeAccountIds?.length) {
            // Convert string IDs to AccountId objects as required by the SDK
            tx.setNodeAccountIds(
                options.nodeAccountIds.map((id) => AccountId.fromString(id)),
            );
        }
    }

    /**
     * Apply pre-computed offline signatures. Must be called after freeze.
     */
    private applyLegacySignatures(
        tx: Transaction,
        options: TransactionOptions,
    ): void {
        if (options.legacySignatures) {
            for (const { publicKey, signature } of options.legacySignatures) {
                tx._addSignatureLegacy(publicKey, signature);
            }
        }
    }

    /**
     * Apply additional private key signers and external (HSM/KMS) signers.
     * Called after freeze, before execute.
     */
    private async applySigners(
        tx: Transaction,
        options: TransactionOptions,
    ): Promise<void> {
        for (const key of options.additionalSigners ?? []) {
            await tx.sign(key);
        }

        for (const { publicKey, sign } of options.externalSigners ?? []) {
            await tx.signWith(publicKey, sign);
        }
    }
}
