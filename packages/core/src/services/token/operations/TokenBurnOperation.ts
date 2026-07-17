import type BigNumber from "bignumber.js";
import type { TokenId, Long } from "@hiero-ledger/sdk";
import { TokenBurnTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { SupplyChangeResult } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TokenBurnValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenBurnTransaction` SDK transaction.
 *
 * Mirrors SDK props while extending `TransactionOptions`. Exactly one of
 * `amount` (fungible) or `serials` (NFT) must be supplied.
 */
export interface TokenBurnOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    amount?: Long | number | BigNumber | bigint;
    serials?: (Long | number)[];
}

export class TokenBurnOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenBurnValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenBurnValidator();
    }

    /**
     * Submit a `TokenBurnTransaction`.
     *
     * @returns The transaction id/status and the token's new total supply
     *   after the burn (a decimal string — supplies can exceed 2^53).
     */
    async execute(
        options: TokenBurnOperationOptions,
    ): Promise<SupplyChangeResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenBurn",
                serviceName: "TokenService",
                methodName: "burnToken",
                timestamp: new Date(),
            },
            (outcome) => {
                if (outcome.receipt.totalSupply == null) {
                    throw new Error(
                        "TokenBurn receipt did not include totalSupply.",
                    );
                }
                return {
                    ...outcome.toResult(),
                    totalSupply: outcome.receipt.totalSupply.toString(),
                };
            },
        );
    }

    /** Schedule a `TokenBurnTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenBurnOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TokenBurn",
                serviceName: "TokenService",
                methodName: "burnToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private build(options: TokenBurnOperationOptions): TokenBurnTransaction {
        const tx = new TokenBurnTransaction().setTokenId(options.tokenId);

        if (options.amount != null) {
            tx.setAmount(options.amount);
        }

        if (options.serials != null && options.serials.length > 0) {
            tx.setSerials(options.serials);
        }

        return tx;
    }
}
