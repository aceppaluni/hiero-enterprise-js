import { AccountId, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";

/**
 * Options for auto-creating a Hollow Account by transferring HBAR to an
 * EVM address that does not yet have a Hiero account ID.
 *
 * Extends `TransactionOptions` for full control over fees, validity window,
 * additional signers, and scheduling.
 */
export interface AutoCreateEvmAccountOptions extends TransactionOptions {
    /** The EVM address to seed (e.g., `"0x1234..."`). */
    evmAddress: string;
    /** HBAR amount to transfer. Accepts a number (HBAR) or an `Hbar` instance. */
    amount: number | Hbar;
}

export class AutoCreateEvmAccountOperation {
    private readonly executor: TransactionExecutor;

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
    }

    /**
     * Auto-create EVM account execute handler.
     *
     * @returns The executor's shared fields plus `accountId` from the
     *   transfer's *child* receipt when the address was cold. A warm
     *   address leaves `accountId` `null` — the transfer landed, nothing
     *   was created.
     */
    async execute(options: AutoCreateEvmAccountOptions) {
        const results = await this.executor.run(this.build(options), options, {
            type: "AccountAutoCreate",
            serviceName: "AccountService",
            methodName: "autoCreateEvmAccount",
            timestamp: new Date(),
        });

        // The new hollow account id lives on the
        // transfer's child receipt — not populated on the base receipt
        // the executor already fetched.
        const withChildren = await results.response
            .getReceiptQuery(this.context.client)
            .setIncludeChildren(true)
            .execute(this.context.client);
        return {
            ...results,
            // A transfer to a *cold* 0x address yields a child create
            // receipt carrying the new account id. A warm address leaves
            // this null — the transfer still landed but created nothing.
            accountId: withChildren.children[0]?.accountId
                ? withChildren.children[0].accountId.toString()
                : null,
        };
    }

    /** Schedule the hollow-account transfer. */
    async schedule(
        options: AutoCreateEvmAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.executor.scheduleRun(
            this.build(options),
            options,
            {
                type: "AccountAutoCreate",
                serviceName: "AccountService",
                methodName: "autoCreateEvmAccount",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Constructs the `TransferTransaction` that seeds the EVM address.
     */
    private build(options: AutoCreateEvmAccountOptions): TransferTransaction {
        const hbarAmount =
            options.amount instanceof Hbar
                ? options.amount
                : new Hbar(options.amount);

        return new TransferTransaction()
            .addHbarTransfer(
                this.context.operatorAccountId,
                hbarAmount.negated(),
            )
            .addHbarTransfer(
                AccountId.fromEvmAddress(0, 0, options.evmAddress),
                hbarAmount,
            );
    }
}
