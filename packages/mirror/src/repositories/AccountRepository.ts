import type {
    MirrorAccountInfo,
    Balance,
    TokenBalance,
    Page,
    AccountQuery,
    AccountTokensQuery,
    StakingReward,
    StakingRewardsQuery,
    AccountListQuery,
    BalancesQuery,
    AirdropsQuery,
    AllowancesQuery,
    NftAllowancesQuery,
    HooksQuery,
    HookStorageQuery,
    AccountBalanceSnapshot,
    Airdrop,
    CryptoAllowance,
    TokenAllowance,
    NftAllowance,
    Hook,
    HookStorageSlot,
} from "../types/index.js";
import type { MirrorNodeClient } from "../MirrorNodeClient.js";
import { MirrorError, MirrorErrorCodes } from "../MirrorError.js";

/**
 * Repository for querying account data from the mirror node.
 */
export class AccountRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find account information by account ID. Pass `{ timestamp }` to read
     * the account's state — including its balance — as of a point in time.
     *
     * @example
     * // Balance snapshot at a past moment (balance-over-time series):
     * repo.findByAccountId("0.0.98", { timestamp: "1700000000.000000000" });
     */
    findByAccountId(
        accountId: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        return this.mirrorNodeClient.queryAccount(accountId, options);
    }

    /**
     * Find account information by EVM alias (0x-prefixed address).
     *
     * @param alias - An EVM address (e.g. `0x1234...abcd`)
     */
    findByAlias(
        alias: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        const isValidEvmAddress =
            alias.startsWith("0x") &&
            alias.length === 42 &&
            /^[0-9a-fA-F]+$/.test(alias.slice(2));

        if (!isValidEvmAddress) {
            // Reject rather than throw so callers see a consistent
            // promise-based failure mode from every repository method.
            return Promise.reject(
                new MirrorError(
                    `Invalid EVM alias: expected a 0x-prefixed 20-byte hex address, got "${alias}".`,
                    { code: MirrorErrorCodes.ConfigInvalid },
                ),
            );
        }
        return this.mirrorNodeClient.queryAccount(alias, options);
    }

    /**
     * Get the balance of an account, optionally as of a point in time via
     * `{ timestamp }`.
     */
    getBalance(accountId: string, options?: AccountQuery): Promise<Balance> {
        return this.mirrorNodeClient.queryAccountBalance(accountId, options);
    }

    /**
     * List the token balances held by an account — amounts per token,
     * unlike `TokenRepository.findByAccountId` which returns token metadata.
     */
    findTokens(
        accountId: string,
        options?: AccountTokensQuery,
    ): Promise<Page<TokenBalance>> {
        return this.mirrorNodeClient.queryAccountTokens(accountId, options);
    }

    /**
     * The account's staking-reward payment history.
     */
    findRewards(
        accountId: string,
        options?: StakingRewardsQuery,
    ): Promise<Page<StakingReward>> {
        return this.mirrorNodeClient.queryStakingRewards(accountId, options);
    }

    /**
     * List accounts, optionally filtered by HBAR balance threshold. Balances are in tinybars.
     *
     * @example
     * // Accounts holding at least 1,000 ℏ:
     * repo.list({ balance: { gte: 100_000_000_000 } });
     */
    list(options?: AccountListQuery): Promise<Page<MirrorAccountInfo>> {
        return this.mirrorNodeClient.queryAccounts(options);
    }

    /**
     * Network-wide balance snapshot — unlike `list`, this supports
     * historical `{ timestamp }` queries: "how many accounts held ≥ X ℏ
     * on date D".
     *
     * @example
     * repo.listBalances({
     *   balance: { gte: 100_000_000_000 },
     *   timestamp: "1652531199.999999999",
     * });
     */
    listBalances(
        options?: BalancesQuery,
    ): Promise<Page<AccountBalanceSnapshot>> {
        return this.mirrorNodeClient.queryBalances(options);
    }

    /**
     * Airdrops waiting for the account to claim them — the read-side of
     * core's `claimAirdrop`.
     */
    findPendingAirdrops(
        accountId: string,
        options?: AirdropsQuery,
    ): Promise<Page<Airdrop>> {
        return this.mirrorNodeClient.queryPendingAirdrops(accountId, options);
    }

    /**
     * Airdrops the account has sent that remain unclaimed — the read-side
     * of core's `cancelAirdrop`.
     */
    findOutstandingAirdrops(
        accountId: string,
        options?: AirdropsQuery,
    ): Promise<Page<Airdrop>> {
        return this.mirrorNodeClient.queryOutstandingAirdrops(
            accountId,
            options,
        );
    }

    /**
     * Live HBAR allowances granted by the account.
     */
    findCryptoAllowances(
        accountId: string,
        options?: AllowancesQuery,
    ): Promise<Page<CryptoAllowance>> {
        return this.mirrorNodeClient.queryCryptoAllowances(accountId, options);
    }

    /**
     * Live fungible-token allowances granted by the account.
     */
    findTokenAllowances(
        accountId: string,
        options?: AllowancesQuery,
    ): Promise<Page<TokenAllowance>> {
        return this.mirrorNodeClient.queryTokenAllowances(accountId, options);
    }

    /**
     * Live approved-for-all NFT allowances involving the account.
     */
    findNftAllowances(
        accountId: string,
        options?: NftAllowancesQuery,
    ): Promise<Page<NftAllowance>> {
        return this.mirrorNodeClient.queryNftAllowances(accountId, options);
    }

    /**
     * List the hooks attached to the account.
     */
    findHooks(accountId: string, options?: HooksQuery): Promise<Page<Hook>> {
        return this.mirrorNodeClient.queryHooks(accountId, options);
    }

    /**
     * List a hook's storage slots.
     */
    findHookStorage(
        accountId: string,
        hookId: number,
        options?: HookStorageQuery,
    ): Promise<Page<HookStorageSlot>> {
        return this.mirrorNodeClient.queryHookStorage(
            accountId,
            hookId,
            options,
        );
    }
}
