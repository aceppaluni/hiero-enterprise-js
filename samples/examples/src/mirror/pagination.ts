/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/pagination.ts
 *
 * Analyze an account's recent on-chain activity by draining paginated
 * mirror-node data — a realistic "fetch at scale" task.
 *
 * Mirror node reads need no operator credentials, so this example talks to
 * the public mainnet mirror node directly via `MirrorNodeClient` — no keys
 * required. It streams many pages of transactions and aggregates them as it
 * goes, which is exactly the workload the built-in rate limiter exists for:
 * pulling thousands of records without tripping the mirror node's limits.
 *
 * What it shows:
 *   • a client with a concurrency cap + TPS ceiling (pro-active throttling);
 *   • `{ limit, order }` to fetch exactly what you need (the newest 10) with
 *     no pagination at all — the efficient path when you don't need everything;
 *   • `{ transactionType, timestamp }` to filter by type and a time window in
 *     one bundled call (time-series slicing);
 *   • balance thresholds (`{ balance: { gte } }` on accounts,
 *     `{ accountBalance: { gte } }` on token holders) for finding larger
 *     holders and analysing balance distribution;
 *   • `paginate(...)` to stream page-by-page and aggregate incrementally,
 *     so memory stays flat no matter how many records you scan;
 *   • `collectAll(...)` as the one-liner alternative when you want the whole
 *     set in an array.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_ACCOUNT_ID      default: 0.0.98  (a busy, always-populated account)
 *   EXAMPLE_MAX_PAGES       default: 20       (how many transaction pages to scan)
 */
import {
    MirrorNodeClient,
    collectAll,
    paginate,
    tinybarToHbar,
    hbarToTinybar,
    type TransactionInfo,
} from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const accountId = process.env["EXAMPLE_ACCOUNT_ID"] ?? "0.0.98";
const maxPages = Number(process.env["EXAMPLE_MAX_PAGES"] ?? "20");

const MAX_CONCURRENT = 5; // at most this many requests in flight
const MAX_RPS = 50; // requests/second ceiling — stay under the public node's limit

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: MAX_CONCURRENT,
    maxRequestsPerSecond: MAX_RPS,
});

// ── Config banner ────────────────────────────────────────────────
console.log(`\nMirror pagination example`);
console.log(`  mirror node : ${mirrorUrl}`);
console.log(`  account     : ${accountId}`);
console.log(`  max pages   : ${maxPages}`);
console.log(
    `  rate limit  : maxConcurrent=${MAX_CONCURRENT}, ` +
        `maxRequestsPerSecond=${MAX_RPS} ` +
        `(~${Math.round(1000 / MAX_RPS)}ms between request starts)`,
);

// ── Query 1 · targeted fetch (limit + order) ─────────────────────
// When you only need the newest few, `limit` + `order` fetch exactly that —
// one request, no pagination. Much cheaper than draining everything and
// slicing client-side.
const recentQuery = { limit: 10, order: "desc" } as const;
const recent = await mirror.queryTransactionsByAccount(accountId, recentQuery);
console.log(`\nQuery 1 · targeted fetch  →  ${JSON.stringify(recentQuery)}`);
console.log(`  most recent ${recent.data.length} transactions:`);
for (const tx of recent.data) {
    console.log(`    ${tx.consensusTimestamp}  ${tx.type}`);
}

// ── Query 2 · bundled filter (type + timestamp window) ───────────
// One call filters by transaction type AND a consensus-timestamp window —
// no separate query per type, and you can slice by time for time-series.
// The window is anchored on the newest transaction we just saw (not the
// wall clock), so the demo always covers real data even if the account has
// been quiet recently.
const anchorSeconds = recent.data[0]
    ? Math.floor(Number(recent.data[0].consensusTimestamp))
    : Math.floor(Date.now() / 1000);
const since = `${anchorSeconds - 24 * 60 * 60}.000000000`; // 24h before newest tx

// Run the same bundled query for several types to break activity down by
// group. Each is one call combining type + timestamp window + order + limit;
// only `transactionType` changes. (A fee account like 0.0.98 is almost all
// CRYPTOTRANSFER, so other types may legitimately be 0 — set
// EXAMPLE_ACCOUNT_ID to a busier contract/DEX account to see more variety.)
const typesToCheck = ["CRYPTOTRANSFER", "CONTRACTCALL", "TOKENMINT"] as const;
console.log(
    `\nQuery 2 · bundled filter  →  ` +
        `{ transactionType, timestamp: { gte: "${since}" }, order: "desc", limit: 25 }`,
);
console.log(`  activity by type in the 24h up to the newest tx:`);
for (const transactionType of typesToCheck) {
    const page = await mirror.queryTransactionsByAccount(accountId, {
        transactionType,
        timestamp: { gte: since },
        order: "desc",
        limit: 25,
    });
    console.log(`    ${transactionType.padEnd(16)} ${page.data.length}`);
}

// ── Query 3 · streaming drain (paginate) ─────────────────────────
// paginate() yields one page at a time, so we fold each page into the
// running totals and never hold more than a single page in memory —
// this scales to any number of records.
const countByType = new Map<string, number>();
let scanned = 0;
let successful = 0;
let totalFeeTinybar = 0;
let pages = 0;

console.log(
    `\nQuery 3 · streaming drain  →  paginate(...), up to ${maxPages} pages`,
);
console.log(
    `  each +Nms below is mostly the mirror node round-trip; pagination is ` +
        `sequential, so the rate limiter only caps parallelism when many ` +
        `queries run at once`,
);
const start = Date.now();
let lastTick = start;
for await (const page of paginate(
    await mirror.queryTransactionsByAccount(accountId),
)) {
    for (const tx of page as TransactionInfo[]) {
        scanned++;
        if (tx.successful) successful++;
        totalFeeTinybar += tx.chargedTxFee ?? 0;
        countByType.set(tx.type, (countByType.get(tx.type) ?? 0) + 1);
    }
    pages++;
    const now = Date.now();
    console.log(
        `  page ${String(pages).padStart(2)}: ${page.length} txns ` +
            `(running ${scanned}) +${now - lastTick}ms`,
    );
    lastTick = now;
    if (pages >= maxPages) break; // lazy: no further pages are fetched
}

console.log(`\nActivity for ${accountId} (last ${pages} pages):`);
console.log(`  transactions scanned : ${scanned}`);
console.log(
    `  successful           : ${successful} (${
        scanned ? Math.round((successful / scanned) * 100) : 0
    }%)`,
);
console.log(
    `  total fees           : ${tinybarToHbar(totalFeeTinybar).toFixed(8)} ℏ`,
);
console.log(`  by type:`);
for (const [type, count] of [...countByType.entries()].sort(
    (a, b) => b[1] - a[1],
)) {
    console.log(`    ${type.padEnd(24)} ${count}`);
}
console.log(`  scanned in ${Date.now() - start}ms\n`);

// ── Query 4 · one-shot drain (collectAll) ────────────────────────
// When you just want the records in an array, collectAll() drains pages
// for you. `maxPages` bounds it so an unexpectedly huge account can't
// exhaust memory.
const collectOptions = { maxPages: 2 };
const firstPages = await collectAll(
    await mirror.queryTransactionsByAccount(accountId),
    collectOptions,
);
console.log(`\nQuery 4 · collectAll  →  ${JSON.stringify(collectOptions)}`);
console.log(`  pulled ${firstPages.length} transactions in one call`);

// ── Query 5 · balance thresholds (larger holders) ────────────────
// The list endpoints accept greater/less-than balance filters, so you can
// scan the network for accounts above a threshold instead of checking
// balances one account at a time. Amounts are in the smallest unit
// (tinybars here). Note: `order` sorts by account ID, not balance — rank
// by balance client-side after collecting.
const MIN_BALANCE_HBAR = 1_000_000; // 1M ℏ
const accountQuery = {
    balance: { gte: hbarToTinybar(MIN_BALANCE_HBAR) },
    limit: 5,
} as const;
const largeAccounts = await mirror.queryAccounts(accountQuery);
console.log(
    `\nQuery 5a · high-balance accounts  →  ${JSON.stringify(accountQuery)}`,
);
console.log(
    `  first ${largeAccounts.data.length} accounts holding ≥ ${MIN_BALANCE_HBAR.toLocaleString()} ℏ` +
        ` (more pages: ${largeAccounts.next !== null}):`,
);
for (const account of largeAccounts.data) {
    const hbar = Math.round(tinybarToHbar(account.balance));
    console.log(
        `    ${account.accountId.padEnd(14)} ${hbar.toLocaleString()} ℏ`,
    );
}

// Same idea for token holders: USDC holders with ≥ 10,000 USDC (6 decimals).
const USDC = "0.0.456858";
const holderQuery = {
    accountBalance: { gte: 10_000 * 1_000_000 },
    limit: 5,
} as const;
const holders = await mirror.queryTokenBalances(USDC, holderQuery);
console.log(
    `\nQuery 5b · holder scan (${USDC})  →  ${JSON.stringify(holderQuery)}`,
);
console.log(
    `  first ${holders.data.length} holders with ≥ 10,000 USDC` +
        ` (more pages: ${holders.next !== null}):`,
);
for (const holder of holders.data) {
    const usdc = Math.round(Number(holder.balance) / 1_000_000);
    console.log(
        `    ${holder.accountId.padEnd(14)} ${usdc.toLocaleString()} USDC`,
    );
}
