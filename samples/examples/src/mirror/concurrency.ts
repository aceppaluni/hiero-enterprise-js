/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/concurrency.ts
 *
 * Concurrent FAN-OUT through the rate limiter — where `maxConcurrent`
 * actually earns its keep. A single pagination is sequential (each page
 * yields the next cursor), but fetching many accounts' balances at once is
 * embarrassingly parallel: fire them all and let the client's gate bound
 * how many are in flight. No operator credentials required.
 *
 * What it shows, in order:
 *   1. Discover a work list (30 high-balance accounts) with one threshold
 *      scan.
 *   2. Fetch all 30 balances with `maxConcurrent: 1` (fully serialized).
 *   3. Fetch the same 30 with `maxConcurrent: 10` — same code, same
 *      `Promise.all`, faster (bounded by the slowest response), still
 *      polite to the mirror node.
 *
 * The takeaway: always fire the natural amount of parallelism and let the
 * gate enforce the ceiling — never hand-roll batching loops.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 */
import {
    MirrorNodeClient,
    AccountRepository,
    hbarToTinybar,
    tinybarToHbar,
} from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";

console.log(`\nConcurrent fan-out example — ${mirrorUrl}\n`);

// ── 1 · discover a work list ─────────────────────────────────────
const discovery = new AccountRepository(
    new MirrorNodeClient(mirrorUrl, { maxConcurrent: 5 }),
);
const scan = await discovery.list({
    balance: { gte: hbarToTinybar(1_000_000) },
    limit: 30,
});
const targets = scan.data.map((account) => account.accountId);
console.log(`1 · threshold scan found ${targets.length} accounts to check\n`);

/** Fetch every target's balance concurrently through a gated client. */
async function fanOut(maxConcurrent: number): Promise<number> {
    const accounts = new AccountRepository(
        new MirrorNodeClient(mirrorUrl, {
            maxConcurrent,
            maxRequestsPerSecond: 50,
        }),
    );
    const start = Date.now();
    // Fire everything at once — the gate queues the excess.
    const balances = await Promise.all(
        targets.map((accountId) => accounts.getBalance(accountId)),
    );
    const elapsed = Date.now() - start;
    const total = balances.reduce(
        (sum, balance) => sum + Number(balance.hbars),
        0,
    );
    console.log(
        `    maxConcurrent=${String(maxConcurrent).padStart(2)} → ` +
            `${targets.length} balances in ${String(elapsed).padStart(5)}ms ` +
            `(sum ${tinybarToHbar(total).toLocaleString(undefined, { maximumFractionDigits: 0 })} ℏ)`,
    );
    return elapsed;
}

// ── 2 · serialized: one request in flight at a time ─────────────
console.log(`2 · same fan-out, different concurrency ceilings:`);
const serial = await fanOut(1);

// ── 3 · gated parallelism: ten in flight ─────────────────────────
const parallel = await fanOut(10);

console.log(
    `\n    speed-up: ${(serial / parallel).toFixed(1)}× — identical calling ` +
        `code, the gate did the scheduling.\n` +
        `    (The gain is bounded by the slowest single response — accounts\n` +
        `     with huge token lists dominate both runs.)`,
);
console.log(
    `    (the 50 req/s ceiling still applies in both runs, so neither can\n` +
        `     stampede the mirror node no matter how many calls you fire)\n`,
);
