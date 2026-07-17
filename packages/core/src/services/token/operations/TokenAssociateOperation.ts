import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenAssociateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import {
    TransactionExecutor,
    toTransactionResult,
} from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
    TransactionResult,
} from "../../transaction/index.js";
import { TokenAssociateValidator } from "../validation/index.js";

/**
 * Low-level options for token association.
 *
 * Keeps SDK prop types as-is while extending `TransactionOptions`.
 */
export interface TokenAssociateOperationOptions extends TransactionOptions {
    accountId: AccountId | string;
    tokenId: TokenId | string;
}

export class TokenAssociateOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenAssociateValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenAssociateValidator();
    }

    /** Submit a `TokenAssociateTransaction`. */
    async execute(
        options: TokenAssociateOperationOptions,
    ): Promise<TransactionResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenAssociate",
                serviceName: "TokenService",
                methodName: "associateToken",
                timestamp: new Date(),
            },
            toTransactionResult,
        );
    }

    /** Schedule a `TokenAssociateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenAssociateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TokenAssociate",
                serviceName: "TokenService",
                methodName: "associateToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private build(
        options: TokenAssociateOperationOptions,
    ): TokenAssociateTransaction {
        return new TokenAssociateTransaction()
            .setAccountId(options.accountId)
            .setTokenIds([options.tokenId]);
    }
}
