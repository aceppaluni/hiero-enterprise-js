import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenUnfreezeTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import {
    TransactionExecutor,
    toTransactionResult,
} from "../../transaction/index.js";
import type {
    TransactionOptions,
    TransactionResult,
} from "../../transaction/index.js";
import { TokenUnfreezeValidator } from "../validation/index.js";

/**
 * Options for the `TokenUnfreezeTransaction` SDK transaction.

 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenUnfreeze` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenUnfreezeOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
}

export class TokenUnfreezeOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenUnfreezeValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenUnfreezeValidator();
    }

    /** Submit a `TokenUnfreezeTransaction`. */
    async execute(
        options: TokenUnfreezeOperationOptions,
    ): Promise<TransactionResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenUnfreeze",
                serviceName: "TokenService",
                methodName: "unfreezeToken",
                timestamp: new Date(),
            },
            toTransactionResult,
        );
    }

    private build(
        options: TokenUnfreezeOperationOptions,
    ): TokenUnfreezeTransaction {
        return new TokenUnfreezeTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);
    }
}
