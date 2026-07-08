/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/network.ts
 *
 * End-to-end tour of NETWORK-level queries against the mirror node — no
 * operator credentials required.
 *
 * What it shows, in order:
 *   1. Exchange rates — current + next rate, converted to USD per ℏ.
 *   2. Supply — total vs released, plus a point-in-time read one year back.
 *   3. Staking — total stake, reward rate, and the current staking period
 *      (rendered as real dates via `fromConsensusTimestamp`).
 *   4. Per-node stake — the nodes list, ranked by stake.
 *
 * Uses the built-in unit helpers (`tinybarToHbar`, `fromConsensusTimestamp`,
 * `timestampRange`) instead of hand-rolled `/ 100_000_000` math.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 */
import {
    MirrorNodeClient,
    NetworkRepository,
    tinybarToHbar,
    fromConsensusTimestamp,
    toConsensusTimestamp,
} from "@hiero-enterprise/mirror";

const hbar = (tinybar: number | string) =>
    tinybarToHbar(tinybar).toLocaleString(undefined, {
        maximumFractionDigits: 0,
    });

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const network = new NetworkRepository(mirror);

console.log(`\nNetwork queries example — ${mirrorUrl}\n`);

// ── 1 · exchange rates ───────────────────────────────────────────
// Rates are expressed as cents per `hbarEquivalent` ℏ, so USD per ℏ is
// centEquivalent / hbarEquivalent / 100.
const rates = await network.findExchangeRates();
const usdPerHbar = (rate: { centEquivalent: number; hbarEquivalent: number }) =>
    (rate.centEquivalent / rate.hbarEquivalent / 100).toFixed(4);
console.log(`1 · findExchangeRates()`);
console.log(`    current : $${usdPerHbar(rates.currentRate)} / ℏ`);
console.log(`    next    : $${usdPerHbar(rates.nextRate)} / ℏ`);

// ── 2 · supply, now and one year ago ─────────────────────────────
const supply = await network.findNetworkSupplies();
// Supply magnitudes exceed Number.MAX_SAFE_INTEGER in tinybar, so
// arithmetic stays in BigInt; `hbar()` is display-only rounding.
const released = BigInt(supply.releasedSupply);
const total = BigInt(supply.totalSupply);
const releasedPct = Number((released * 10_000n) / total) / 100;
console.log(`\n2 · findNetworkSupplies()  @ ${supply.timestamp}`);
console.log(`    total    : ${hbar(supply.totalSupply)} ℏ`);
console.log(
    `    released : ${hbar(supply.releasedSupply)} ℏ (${releasedPct.toFixed(2)}%)`,
);

// Point-in-time read: the same query with `{ timestamp }` returns supply as
// of a past moment — the building block for released-supply-over-time charts.
// `toConsensusTimestamp` converts a Date/epoch-ms to seconds.nanoseconds.
const yearAgo = toConsensusTimestamp(Date.now() - 365 * 24 * 3600 * 1000);
const supplyThen = await network.findNetworkSupplies({ timestamp: yearAgo });
const releasedThen = BigInt(supplyThen.releasedSupply);
console.log(
    `    released one year ago: ${hbar(supplyThen.releasedSupply)} ℏ ` +
        `(+${hbar((released - releasedThen).toString())} ℏ since)`,
);

// ── 3 · staking ──────────────────────────────────────────────────
const stake = await network.findStakingRewards();
console.log(`\n3 · findStakingRewards()`);
console.log(`    total staked      : ${hbar(stake.stakeTotal)} ℏ`);
console.log(
    `    max reward rate   : ${stake.maxStakingRewardRatePerHbar} tinybar per ℏ per period`,
);
if (stake.stakingPeriod) {
    const from = fromConsensusTimestamp(stake.stakingPeriod.from);
    const to = fromConsensusTimestamp(stake.stakingPeriod.to);
    console.log(
        `    staking period    : ${from.toISOString()} → ${to.toISOString()}`,
    );
}

// ── 4 · per-node stake ───────────────────────────────────────────
// The nodes list carries each consensus node's stake — the basis for
// staking-distribution analytics. Rank by stake client-side.
const nodes = await network.findNodes({ limit: 100 });
const rankedNodes = [...nodes.data].sort((a, b) => b.stake - a.stake);
const summed = nodes.data.reduce((sum, node) => sum + node.stake, 0);
console.log(`\n4 · findNodes({ limit: 100 })`);
console.log(
    `    ${nodes.data.length} nodes on the first page, ` +
        `${hbar(summed)} ℏ staked across them; top 3:`,
);
for (const node of rankedNodes.slice(0, 3)) {
    console.log(
        `      node ${String(node.nodeId).padStart(2)} (${node.nodeAccountId})  ` +
            `${hbar(node.stake)} ℏ  — ${node.description}`,
    );
}
console.log();
