import type { ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleSignTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { ScheduleSignValidator } from "../validation/index.js";

/**
 * Options for adding a signature to a pending scheduled transaction.
 *
 * Extends `TransactionOptions` so every signing pattern is available:
 * local keys (`additionalSigners`), external signers (`externalSigners`),
 * and pre-computed offline signatures (`legacySignatures`).
 */
export interface ScheduleSignOptions extends TransactionOptions {
    /** The ID of the schedule entity to sign (e.g., `"0.0.12345"`). */
    scheduleId: string | ScheduleId;
}

export class ScheduleSignOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: ScheduleSignValidator;

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new ScheduleSignValidator();
    }

    /**
     * Schedule sign execute handler.
     *
     * @returns The executor's shared fields plus `scheduledTransactionId`
     *   — the id for querying the *scheduled* (inner) transaction's own
     *   receipt or record when the network reports it.
     */
    async execute(options: ScheduleSignOptions) {
        // Validate options before any SDK construction
        this.validator.validate(options);
        const tx = new ScheduleSignTransaction().setScheduleId(
            options.scheduleId,
        );
        const results = await this.executor.run(tx, options, {
            type: "ScheduleSign",
            serviceName: "ScheduleService",
            methodName: "sign",
            timestamp: new Date(),
        });
        return {
            ...results,
            scheduledTransactionId: results.receipt.scheduledTransactionId
                ? results.receipt.scheduledTransactionId.toString()
                : null,
        };
    }
}
