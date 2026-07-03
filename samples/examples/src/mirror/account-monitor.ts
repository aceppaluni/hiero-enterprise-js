/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/account-monitor.ts
 *
 * Incremental activity polling: watch a set of accounts and pick up every
 * transaction involving them since the last checkpoint — fetch only what
 * is new, never re-process the old. The same loop drives dashboards,
 * indexers, and bots; here it runs as a single pass. No operator
 * credentials required.
 *
 * What it shows, in order:
 *   1. A checkpoint poll — per watched account, fetch transactions with
 *      `{ timestamp: { gt: checkpoint }, order: "asc" }`, all accounts in
 *      parallel through the rate limiter.
 *   2. Digesting results — transfer legs filtered to the watched account,
 *      amounts formatted with `tinybarToHbar`.
 *   3. Advancing the checkpoint — the newest consensus timestamp seen
 *      becomes the next poll's `gt` bound, so nothing is processed twice.
 *      A second poll immediately after proves it (usually 0 new).
 *
 * In a long-running process the checkpoint would persist between runs
 * (database, file, …) and the poll would run on an interval or cron.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_WATCH_ACCOUNTS  comma-separated, default: 0.0.98,0.0.800
 */
import {
    MirrorNodeClient,
    TransactionRepository,
    collectAll,
    tinybarToHbar,
    toConsensusTimestamp,
    fromConsensusTimestamp,
    type TransactionInfo,
} from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
// The defaults see constant traffic, so a short window is guaranteed to
// have activity.
const KNOWN_ACCOUNTS = new Map([
    ["0.0.98", "network fee collection"],
    ["0.0.800", "staking reward pool"],
]);
const watched = (process.env["EXAMPLE_WATCH_ACCOUNTS"] ?? "0.0.98,0.0.800")
    .split(",")
    .map((account) => account.trim());

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const transactions = new TransactionRepository(mirror);

/** "0.0.98 (network fee collection)" — label accounts where we can. */
const describe = (account: string) => {
    const label = KNOWN_ACCOUNTS.get(account);
    return label ? `${account} (${label})` : account;
};

/** "1783101343.303000000" → "14:35:43" for readable output. */
const clock = (consensusTimestamp: string) =>
    fromConsensusTimestamp(consensusTimestamp)
        .toISOString()
        .slice(11, 19)
        .concat(" UTC");

console.log(`\nAccount monitor example — ${mirrorUrl}`);
console.log(`Monitoring ${watched.length} account(s):`);
for (const account of watched) {
    console.log(`  • ${describe(account)}`);
}
console.log();

/**
 * One poll cycle: everything involving each watched account strictly
 * after `checkpoint`, oldest first so the checkpoint can only advance.
 */
async function poll(
    checkpoint: string,
): Promise<Map<string, TransactionInfo[]>> {
    const results = await Promise.all(
        watched.map(async (account) => {
            const page = await transactions.findByAccount(account, {
                timestamp: { gt: checkpoint },
                order: "asc",
                limit: 25,
            });
            return [
                account,
                await collectAll(page, { maxItems: 100 }),
            ] as const;
        }),
    );
    return new Map(results);
}

/** The transfer leg belonging to the watched account, if any. */
function legFor(transaction: TransactionInfo, account: string) {
    return transaction.transfers.find((t) => t.accountId === account);
}

// ── 1 · first poll: the last two minutes ─────────────────────────
let checkpoint = toConsensusTimestamp(Date.now() - 2 * 60 * 1000);
console.log(
    `1 · First poll — asking the mirror node for every transaction that\n` +
        `    involved a watched account after ${clock(checkpoint)} ` +
        `(checkpoint ${checkpoint}),\n` +
        `    all ${watched.length} account(s) queried in parallel through the rate limiter.\n`,
);
const firstPass = await poll(checkpoint);

// ── 2 · digest per account ───────────────────────────────────────
for (const [account, found] of firstPass) {
    console.log(
        `    ${describe(account)} — ${found.length} new transaction(s)` +
            `${found.length > 3 ? ", first 3:" : found.length ? ":" : ""}`,
    );
    for (const transaction of found.slice(0, 3)) {
        const leg = legFor(transaction, account);
        // Dust-sized legs read better in tinybars than as "0.0000 ℏ".
        const magnitude =
            leg && Math.abs(leg.amount) < 10_000
                ? `${Math.abs(leg.amount)} tinybar`
                : leg
                  ? `${Math.abs(tinybarToHbar(leg.amount)).toFixed(4)} ℏ`
                  : "";
        const amount = leg
            ? `${leg.amount >= 0 ? "received" : "paid out"} ${magnitude}`
            : "no HBAR movement for this account";
        console.log(
            `      ${clock(transaction.consensusTimestamp)}  ` +
                `${transaction.type.padEnd(24)} ${amount}`,
        );
    }
    // Advance the checkpoint past everything we've processed.
    const newest = found.at(-1);
    if (newest && newest.consensusTimestamp > checkpoint) {
        checkpoint = newest.consensusTimestamp;
    }
}
console.log(
    `\n    Checkpoint advanced to the newest transaction seen:\n` +
        `    ${checkpoint} (${clock(checkpoint)})`,
);

// ── 3 · second poll from the advanced checkpoint ─────────────────
// Everything from the first pass is now behind the checkpoint, so only
// activity from the last few seconds (if any) shows up.
console.log(
    `\n2 · Second poll, same query but from the advanced checkpoint —\n` +
        `    everything shown above is now excluded by ` +
        `timestamp > ${clock(checkpoint)}:\n`,
);
const secondPass = await poll(checkpoint);
for (const [account, found] of secondPass) {
    console.log(
        `    ${describe(account)} — ${found.length} new` +
            `${found.length === 0 ? " (already processed, not re-fetched)" : " (arrived in the seconds since)"}`,
    );
}
console.log(
    `\n    In a long-running process: persist the checkpoint, repeat on an interval.`,
);
console.log();
