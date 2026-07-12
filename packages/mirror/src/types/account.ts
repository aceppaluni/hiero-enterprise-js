/**
 * Extended account information from the mirror node.
 */
export interface MirrorAccountInfo {
    /** The account ID */
    accountId: string;
    /** The EVM address */
    evmAddress?: string;
    /** EIP-7702 delegation indicator ("0x" when none) */
    delegationAddress?: string;
    /** The public key */
    key?: string;
    /** Account balance in tinybars */
    balance: number;
    /** Whether the account has been deleted */
    deleted: boolean;
    /** Auto-renewal period in seconds */
    autoRenewPeriod?: number;
    /** Memo associated with the account */
    memo?: string;
    /** Maximum automatic token associations */
    maxAutomaticTokenAssociations?: number;
    /** Staking info */
    stakedAccountId?: string;
    stakedNodeId?: number;
    stakePeriodStart?: string;
    /** Account creation timestamp */
    createdTimestamp?: string;
    /** Expiration timestamp */
    expirationTimestamp?: string;
    /** Whether the account declines staking rewards */
    declineReward?: boolean;
    /** The account's ethereum transaction nonce */
    ethereumNonce?: number | null;
    /** Pending staking reward in tinybars (updates at period end) */
    pendingReward?: number;
    /** Whether transfers into the account require its signature */
    receiverSigRequired?: boolean | null;
}
