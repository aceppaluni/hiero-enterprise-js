/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/timeseries.ts
 *
 * Build TIME SERIES from mirror node data — the analytics pattern the
 * point-in-time and timestamp-window filters exist for. No operator
 * credentials required.
 *
 * What it shows, in order:
 *   1. Released supply over the last 6 months — snapshot the same query at
 *      successive `{ timestamp }` points.
 *   2. An account's balance over the last 8 weeks — same pattern on the
 *      account endpoint.
 *   3. Daily transaction counts — one bounded `[gte, lt)` window per day
 *      via `timestampRange`, the bucketing building block.
 *
 * Each series renders as a small ASCII chart so the shape is visible.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_ACCOUNT_ID      default: 0.0.98
 */
import {
    MirrorNodeClient,
    NetworkRepository,
    AccountRepository,
    TransactionRepository,
    tinybarToHbar,
    toConsensusTimestamp,
    timestampRange,
} from "@hiero-enterprise/mirror";

const DAY_MS = 24 * 3600 * 1000;

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const accountId = process.env["EXAMPLE_ACCOUNT_ID"] ?? "0.0.98";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const network = new NetworkRepository(mirror);
const accounts = new AccountRepository(mirror);
const transactions = new TransactionRepository(mirror);

/** Render values as a right-aligned ASCII bar chart. */
function chart(
    rows: Array<{ label: string; value: number }>,
    decimals = 0,
): void {
    const max = Math.max(...rows.map((row) => row.value), 1);
    for (const row of rows) {
        const bar = "█".repeat(Math.max(1, Math.round((row.value / max) * 32)));
        console.log(
            `    ${row.label}  ${bar} ${row.value.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}`,
        );
    }
}

console.log(`\nTime-series example — ${mirrorUrl}\n`);

// ── 1 · released supply, monthly for 6 months ────────────────────
// The same findNetworkSupplies() call with a different { timestamp } per
// point. Requests fire concurrently and the client's rate limiter paces
// them.
console.log(`1 · released supply, monthly snapshots (6 months)`);
const months = [5, 4, 3, 2, 1, 0]; // months ago, oldest first
const supplies = await Promise.all(
    months.map((monthsAgo) =>
        network.findNetworkSupplies({
            timestamp: toConsensusTimestamp(
                Date.now() - monthsAgo * 30 * DAY_MS,
            ),
        }),
    ),
);
chart(
    supplies.map((supply, i) => ({
        label: `${String(months.at(i) ?? 0).padStart(2)}mo ago`,
        value: tinybarToHbar(Number(supply.releasedSupply)) / 1e9, // billions ℏ
    })),
    2,
);
console.log(`    (values in billions of ℏ)`);

// ── 2 · account balance, weekly for 8 weeks ──────────────────────
console.log(`\n2 · balance of ${accountId}, weekly snapshots (8 weeks)`);
const weeks = [7, 6, 5, 4, 3, 2, 1, 0];
const snapshots = await Promise.all(
    weeks.map((weeksAgo) =>
        accounts.findByAccountId(accountId, {
            timestamp: toConsensusTimestamp(Date.now() - weeksAgo * 7 * DAY_MS),
        }),
    ),
);
chart(
    snapshots.map((snapshot, i) => ({
        label: `${String(weeks.at(i) ?? 0).padStart(2)}wk ago`,
        value: tinybarToHbar(snapshot.balance),
    })),
);
console.log(`    (values in ℏ)`);

// ── 3 · daily transaction counts via bucketed windows ────────────
// One bounded [gte, lt) window per bucket — timestampRange() builds the
// window from plain Dates. Counting a page of up to 100 per day keeps the
// example fast; drain with paginate()/collectAll() for exact totals.
console.log(
    `\n3 · transactions per day for ${accountId} (last 5 days, first page counted)`,
);
const days = [4, 3, 2, 1, 0];
const counts = await Promise.all(
    days.map(async (daysAgo) => {
        const start = Date.now() - (daysAgo + 1) * DAY_MS;
        const end = Date.now() - daysAgo * DAY_MS;
        const page = await transactions.findByAccount(accountId, {
            timestamp: timestampRange({ from: start, to: end }),
            limit: 100,
        });
        return page.data.length;
    }),
);
chart(
    counts.map((count, i) => ({
        label: `${String(days.at(i) ?? 0).padStart(2)}d ago`,
        value: count,
    })),
);
console.log();
