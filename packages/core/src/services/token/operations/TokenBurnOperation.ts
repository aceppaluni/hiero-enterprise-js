import type BigNumber from "bignumber.js";
import type { TokenId, Long } from "@hiero-ledger/sdk";
import { TokenBurnTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TokenBurnValidator } from "../validation/index.js";
import { HieroError } from "../../../errors/HieroError.js";

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

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenBurnValidator();
    }

    /**
     * Submit a `TokenBurnTransaction`.
     *
     * @returns The executor's shared fields plus the token's new total
     *   supply after the burn (a decimal string — supplies can exceed 2^53).
     */
    async execute(options: TokenBurnOperationOptions) {
        this.validator.validate(options);

        const tx = this.build(options);

        const results = await this.executor.run(tx, options, {
            type: "TokenBurn",
            serviceName: "TokenService",
            methodName: "burnToken",
            timestamp: new Date(),
        });

        if (results.receipt.totalSupply == null) {
            throw new HieroError(
                "TokenBurn receipt did not include totalSupply.",
                {
                    code: "SDK_ERROR",
                    context: "TokenBurnOperation.execute",
                    transactionId: results.transactionId,
                },
            );
        }

        return {
            ...results,
            totalSupply: results.receipt.totalSupply.toString(),
        };
    }

    /** Schedule a `TokenBurnTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenBurnOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        this.validator.validate(options);

        const tx = this.build(options);

        const results = await this.executor.scheduleRun(
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
        return {
            scheduleId: results.receipt.scheduleId
                ? results.receipt.scheduleId.toString()
                : null,
        };
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
