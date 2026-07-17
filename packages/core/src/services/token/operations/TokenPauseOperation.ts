import type { TokenId } from "@hiero-ledger/sdk";
import { TokenPauseTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import {
    TransactionExecutor,
    toTransactionResult,
} from "../../transaction/index.js";
import type {
    TransactionOptions,
    TransactionResult,
} from "../../transaction/index.js";
import { TokenPauseValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenPauseTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenPauseTransaction` 1:1. Pausing a token
 * blocks all transfers, mints, burns, wipes, freezes, unfreezes, grant /
 * revoke KYC, and other operations on that token network-wide until it
 * is unpaused. The token must have been created with a pause key, and
 * that pause key must sign — supply it via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenPause` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenPauseOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
}

export class TokenPauseOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenPauseValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenPauseValidator();
    }

    /** Submit a `TokenPauseTransaction`. */
    async execute(
        options: TokenPauseOperationOptions,
    ): Promise<TransactionResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenPause",
                serviceName: "TokenService",
                methodName: "pauseToken",
                timestamp: new Date(),
            },
            toTransactionResult,
        );
    }

    private build(options: TokenPauseOperationOptions): TokenPauseTransaction {
        return new TokenPauseTransaction().setTokenId(options.tokenId);
    }
}
