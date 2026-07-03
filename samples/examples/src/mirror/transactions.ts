/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/transactions.ts
 *
 * End-to-end tour of TRANSACTION queries against the mirror node — no
 * operator credentials required.
 *
 * What it shows, in order:
 *   1. The newest N transactions for an account (`limit` + `order`).
 *   2. Reading one transaction in depth by its ID (chained from step 1, so
 *      no hardcoded ID) — status, fee, and the HBAR transfer legs.
 *   3. Bundled filters — transaction type + a consensus-timestamp window in
 *      a single call, the building block for time-series analysis.
 *   4. A bounded window (`gte` + `lt`) sliced from real data, with a small
 *      fee aggregation over the result.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_ACCOUNT_ID      default: 0.0.98
 */
import {
    MirrorNodeClient,
    TransactionRepository,
    tinybarToHbar,
} from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const accountId = process.env["EXAMPLE_ACCOUNT_ID"] ?? "0.0.98";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const transactions = new TransactionRepository(mirror);

console.log(`\nTransaction queries example — ${mirrorUrl}\n`);

// ── 1 · newest N (limit + order) ─────────────────────────────────
const recent = await transactions.findByAccount(accountId, {
    limit: 5,
    order: "desc",
});
console.log(`1 · findByAccount("${accountId}", { limit: 5, order: "desc" })`);
for (const tx of recent.data) {
    console.log(
        `    ${tx.consensusTimestamp}  ${tx.type.padEnd(16)} ${tx.result}`,
    );
}

// ── 2 · one transaction in depth (chained by ID) ─────────────────
// The mirror node's transaction ID format ("0.0.x-seconds-nanos") is
// accepted directly by findById.
const sample = recent.data[0];
if (sample) {
    const tx = await transactions.findById(sample.transactionId);
    console.log(`\n2 · findById("${sample.transactionId}")`);
    console.log(`    status : ${tx.result} (successful: ${tx.successful})`);
    console.log(`    fee    : ${tinybarToHbar(tx.chargedTxFee).toFixed(8)} ℏ`);
    console.log(`    transfer legs (${tx.transfers.length}):`);
    for (const leg of tx.transfers.slice(0, 4)) {
        const sign = leg.amount >= 0 ? "+" : "";
        console.log(
            `      ${leg.accountId.padEnd(12)} ${sign}${tinybarToHbar(leg.amount).toFixed(8)} ℏ`,
        );
    }
}

// ── 3 · bundled filter: type + open-ended timestamp window ───────
// One call combines type, time window, order and limit — no separate query
// per transaction type. The window anchors on the newest transaction seen
// above so the demo always covers real data.
const anchor = Math.floor(Number(recent.data[0]?.consensusTimestamp ?? 0));
const dayBefore = `${anchor - 24 * 60 * 60}.000000000`;
const bundled = {
    transactionType: "CRYPTOTRANSFER",
    timestamp: { gte: dayBefore },
    order: "desc",
    limit: 100,
} as const;
console.log(`\n3 · findByAccount("${accountId}", ${JSON.stringify(bundled)})`);
const transfers = await transactions.findByAccount(accountId, bundled);
console.log(
    `    ${transfers.data.length} CRYPTOTRANSFERs in the 24h up to the newest tx ` +
        `(more pages: ${transfers.next !== null})`,
);

// ── 4 · bounded window (gte + lt) with a fee aggregate ───────────
// A half-open window [gte, lt) is the time-series building block: run it
// per day/hour bucket to chart activity over time.
const windowQuery = {
    timestamp: { gte: dayBefore, lt: `${anchor}.000000000` },
    limit: 100,
} as const;
const windowed = await transactions.findByAccount(accountId, windowQuery);
const fees = windowed.data.reduce((sum, tx) => sum + tx.chargedTxFee, 0);
console.log(
    `\n4 · findByAccount("${accountId}", ${JSON.stringify(windowQuery)})`,
);
console.log(
    `    ${windowed.data.length} txns in the window; fees on this page: ` +
        `${tinybarToHbar(fees).toFixed(8)} ℏ`,
);

// ── 5 · network-wide query (no account) ──────────────────────────
// Omit `accountId` to search across the whole network — the basis for
// "largest transfers today" or contract-call activity scans. Here: the
// most recent contract calls anywhere on the network.
const networkWide = {
    transactionType: "CONTRACTCALL",
    order: "desc",
    limit: 5,
} as const;
const calls = await transactions.find(networkWide);
console.log(`\n5 · find(${JSON.stringify(networkWide)})  — network-wide`);
for (const tx of calls.data) {
    console.log(
        `    ${tx.consensusTimestamp}  ${tx.transactionId}  ${tx.result}`,
    );
}
console.log();
