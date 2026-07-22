import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenAssociateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
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

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenAssociateValidator();
    }

    /** Submit a `TokenAssociateTransaction`. */
    async execute(options: TokenAssociateOperationOptions) {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(tx, options, {
            type: "TokenAssociate",
            serviceName: "TokenService",
            methodName: "associateToken",
            timestamp: new Date(),
        });
    }

    /** Schedule a `TokenAssociateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenAssociateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        this.validator.validate(options);

        const tx = this.build(options);

        const results = await this.executor.scheduleRun(
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
        return {
            scheduleId: results.receipt.scheduleId
                ? results.receipt.scheduleId.toString()
                : null,
        };
    }

    private build(
        options: TokenAssociateOperationOptions,
    ): TokenAssociateTransaction {
        return new TokenAssociateTransaction()
            .setAccountId(options.accountId)
            .setTokenIds([options.tokenId]);
    }
}
