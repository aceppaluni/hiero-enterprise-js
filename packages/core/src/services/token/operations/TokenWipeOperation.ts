import type BigNumber from "bignumber.js";
import type { TokenId, AccountId, Long } from "@hiero-ledger/sdk";
import { TokenWipeTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { SupplyChangeResult } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenWipeValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenWipeTransaction` SDK transaction.
 *
 * Mirrors SDK props while extending `TransactionOptions`. Exactly one of
 * `amount` (fungible) or `serials` (NFT) must be supplied. The target
 * holder is identified by `accountId` — the wipe key must sign.
 *
 * Note: `TokenWipe` is not whitelisted for scheduling on the network,
 * so no `schedule()` method is exposed.
 */
export interface TokenWipeOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
    amount?: Long | number | BigNumber | bigint;
    serials?: (Long | number)[];
}

export class TokenWipeOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenWipeValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenWipeValidator();
    }

    /**
     * Submit a `TokenWipeTransaction`.
     *
     * @returns The transaction id/status and the token's new total supply
     *   after the wipe, as a decimal string.
     */
    async execute(
        options: TokenWipeOperationOptions,
    ): Promise<SupplyChangeResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenWipe",
                serviceName: "TokenService",
                methodName: "wipeToken",
                timestamp: new Date(),
            },
            (outcome) => {
                if (outcome.receipt.totalSupply == null) {
                    throw new Error(
                        "TokenWipe receipt did not include totalSupply.",
                    );
                }
                return {
                    ...outcome.toResult(),
                    totalSupply: outcome.receipt.totalSupply.toString(),
                };
            },
        );
    }

    private build(options: TokenWipeOperationOptions): TokenWipeTransaction {
        const tx = new TokenWipeTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);

        if (options.amount != null) {
            tx.setAmount(options.amount);
        }

        if (options.serials != null && options.serials.length > 0) {
            tx.setSerials(options.serials);
        }

        return tx;
    }
}
