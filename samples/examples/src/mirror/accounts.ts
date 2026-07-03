/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/accounts.ts
 *
 * End-to-end tour of ACCOUNT queries against the mirror node — no operator
 * credentials required (reads are free and keyless).
 *
 * What it shows, in order:
 *   1. Look up a single account by ID — full profile (balance, memo,
 *      staking, creation time).
 *   2. Fetch an account's balances — HBAR plus every token it holds.
 *   3. Threshold scan — list larger holders inside a balance band using
 *      `{ balance: { gte, lt } }`, drain a few pages with `collectAll`, and
 *      rank client-side (the mirror node's `order` sorts by account ID, not
 *      balance).
 *   4. Look up an account by its EVM alias — chained from step 3, so the
 *      example never depends on a hardcoded alias.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_ACCOUNT_ID      default: 0.0.98
 */
import {
    MirrorNodeClient,
    AccountRepository,
    collectAll,
    tinybarToHbar,
    hbarToTinybar,
    toConsensusTimestamp,
} from "@hiero-enterprise/mirror";

const hbar = (tinybar: number) =>
    tinybarToHbar(tinybar).toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const accountId = process.env["EXAMPLE_ACCOUNT_ID"] ?? "0.0.98";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const accounts = new AccountRepository(mirror);

console.log(`\nAccount queries example — ${mirrorUrl}\n`);

// ── 1 · single account profile ───────────────────────────────────
const info = await accounts.findByAccountId(accountId);
console.log(`1 · findByAccountId("${accountId}")`);
console.log(`    balance : ${hbar(info.balance)} ℏ`);
console.log(`    created : ${info.createdTimestamp ?? "n/a"}`);
console.log(`    memo    : ${info.memo || "(none)"}`);
console.log(
    `    staking : ${
        info.stakedNodeId != null
            ? `node ${info.stakedNodeId}`
            : (info.stakedAccountId ?? "not staking")
    }`,
);

// ── 2 · balances (HBAR + tokens) ─────────────────────────────────
const balance = await accounts.getBalance(accountId);
console.log(`\n2 · getBalance("${accountId}")`);
console.log(`    hbars  : ${hbar(Number(balance.hbars))} ℏ`);
console.log(`    tokens : ${balance.tokens.length} associated`);
for (const token of balance.tokens.slice(0, 3)) {
    console.log(
        `      ${token.tokenId.padEnd(12)} ${token.balance} (raw, ${token.decimals} decimals)`,
    );
}

// ── 2b · historical balance (point-in-time read) ─────────────────
// Pass `{ timestamp }` to read the account's state as it was at a past
// moment. Snapshot the same account at successive timestamps to build a
// balance-over-time series.
const thirtyDaysAgo = toConsensusTimestamp(Date.now() - 30 * 24 * 3600 * 1000);
const past = await accounts.findByAccountId(accountId, {
    timestamp: thirtyDaysAgo,
});
const delta = info.balance - past.balance;
console.log(
    `\n2b · findByAccountId("${accountId}", { timestamp: "${thirtyDaysAgo}" })`,
);
console.log(`    balance 30 days ago : ${hbar(past.balance)} ℏ`);
console.log(
    `    change since        : ${delta >= 0 ? "+" : ""}${hbar(delta)} ℏ`,
);

// ── 3 · threshold scan: balance band + client-side ranking ───────
// `balance` bounds are tinybars. `order` sorts by account ID, so to rank by
// balance we drain a bounded number of pages and sort ourselves.
const bandQuery = {
    balance: {
        gte: hbarToTinybar(1_000_000), // ≥ 1M ℏ
        lt: hbarToTinybar(100_000_000), // < 100M ℏ
    },
    limit: 100,
} as const;
console.log(
    `\n3 · list(${JSON.stringify(bandQuery)})  — larger holders in a balance band`,
);
const largeAccounts = await collectAll(await accounts.list(bandQuery), {
    maxPages: 3,
});
const ranked = [...largeAccounts].sort((a, b) => b.balance - a.balance);
console.log(
    `    scanned ${largeAccounts.length} accounts holding 1M–100M ℏ (3 pages); top 5 by balance:`,
);
for (const account of ranked.slice(0, 5)) {
    console.log(
        `      ${account.accountId.padEnd(14)} ${hbar(account.balance)} ℏ`,
    );
}

// ── 4 · lookup by EVM alias (chained from the scan) ──────────────
// Any account created from an ECDSA key exposes a 0x… EVM address; the same
// repository resolves it. We pick one from the scan so nothing is hardcoded.
const aliased = largeAccounts.find(
    (account) => account.evmAddress && account.evmAddress.length === 42,
);
if (aliased?.evmAddress) {
    const byAlias = await accounts.findByAlias(aliased.evmAddress);
    console.log(`\n4 · findByAlias("${aliased.evmAddress}")`);
    console.log(
        `    resolves to ${byAlias.accountId} (${hbar(byAlias.balance)} ℏ) — same account: ${
            byAlias.accountId === aliased.accountId
        }`,
    );
} else {
    console.log(
        `\n4 · findByAlias — skipped (no scanned account exposes an EVM alias)`,
    );
}
console.log();
