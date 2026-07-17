import type BigNumber from "bignumber.js";
import type { TokenId, Long } from "@hiero-ledger/sdk";
import { TokenMintTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { MintResult } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TokenMintValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenMintTransaction` SDK transaction.
 *
 * Mirrors SDK props while extending `TransactionOptions`.
 */
export interface TokenMintOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    amount?: Long | number | BigNumber | bigint;
    metadata?: Uint8Array[];
}

export class TokenMintOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenMintValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenMintValidator();
    }

    /**
     * Submit a `TokenMintTransaction`.
     *
     * @returns The transaction id/status, the serials minted (NFTs; empty
     *   for fungible mints), and the total supply after the mint.
     */
    async execute(options: TokenMintOperationOptions): Promise<MintResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenMint",
                serviceName: "TokenService",
                methodName: "mintToken",
                timestamp: new Date(),
            },
            (outcome) => {
                // Same contract as burn/wipe: refuse to fabricate a supply
                // figure if the receipt ever lacked one.
                if (outcome.receipt.totalSupply == null) {
                    throw new Error(
                        "TokenMint receipt did not include totalSupply.",
                    );
                }
                return {
                    ...outcome.toResult(),
                    // Serials are sequential per token — far below 2^53, so
                    // plain numbers are exact and keep the SDK's Long off
                    // the public surface.
                    serials: outcome.receipt.serials.map((serial) =>
                        serial.toNumber(),
                    ),
                    totalSupply: outcome.receipt.totalSupply.toString(),
                };
            },
        );
    }

    /** Schedule a `TokenMintTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenMintOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TokenMint",
                serviceName: "TokenService",
                methodName: "mintToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private build(options: TokenMintOperationOptions): TokenMintTransaction {
        const tx = new TokenMintTransaction().setTokenId(options.tokenId);

        if (options.amount != null) {
            tx.setAmount(options.amount);
        }

        if (options.metadata != null && options.metadata.length > 0) {
            tx.setMetadata(options.metadata);
        }

        return tx;
    }
}
