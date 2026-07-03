/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/read-counterparts.ts
 *
 * Tour of the read-side counterparts of core's write services: core
 * creates schedules, sends airdrops and grants allowances — these queries
 * are how you see them. No operator credentials required.
 *
 * What it shows, in order:
 *   1. Schedules — recent scheduled transactions, then one schedule's
 *      state: signatures collected, executed or still waiting.
 *   2. Airdrops — what's waiting for an account to claim (read-side of
 *      `claimAirdrop`) and what it has sent that remains unclaimed.
 *   3. Allowances — live HBAR and token allowances an account has granted
 *      (read-side of `approve*Allowance`).
 *   4. Topic metadata — memo, keys and HIP-991 fees for a topic, free
 *      (core's getTopicInfo costs a consensus query).
 *   5. Fee schedule — per-transaction-type gas costs from /network/fees.
 *   6. Historical balance snapshots — accounts holding ≥ 1M ℏ on a past
 *      date via /balances, a query current-state endpoints can't answer.
 *   7. Staking-reward history — find an account that just received a
 *      reward, then list its recent reward payments.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 */
import {
    MirrorNodeClient,
    ScheduleRepository,
    AccountRepository,
    TopicRepository,
    NetworkRepository,
    TransactionRepository,
    collectAll,
    tinybarToHbar,
    hbarToTinybar,
} from "@hiero-enterprise/mirror";

/** A busy public topic (mirror node test topic). */
const TOPIC_ID = "0.0.368908";
/** An account to inspect for airdrops/allowances. */
const ACCOUNT_ID = "0.0.98";
/** Snapshot moment for the historical balance query: 14 May 2022. */
const SNAPSHOT_TIMESTAMP = "1652531199.999999999";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const schedules = new ScheduleRepository(mirror);
const accounts = new AccountRepository(mirror);
const topics = new TopicRepository(mirror);
const network = new NetworkRepository(mirror);

console.log(`\nRead-side counterparts example — ${mirrorUrl}\n`);

// ── 1 · schedules ────────────────────────────────────────────────
const recentSchedules = await schedules.list({ limit: 3, order: "desc" });
console.log(`1 · schedules.list({ limit: 3, order: "desc" })`);
for (const schedule of recentSchedules.data) {
    const state = schedule.executedTimestamp
        ? `executed @ ${schedule.executedTimestamp}`
        : schedule.deleted
          ? "deleted"
          : "waiting";
    console.log(
        `    ${schedule.scheduleId}  ${schedule.signatures.length} sig(s)  ${state}`,
    );
}
const first = recentSchedules.data[0];
if (first) {
    const one = await schedules.findById(first.scheduleId);
    console.log(
        `    findById("${one.scheduleId}") → creator ${one.creatorAccountId}, waitForExpiry=${one.waitForExpiry}`,
    );
}

// ── 2 · airdrops ─────────────────────────────────────────────────
const pending = await accounts.findPendingAirdrops(ACCOUNT_ID, { limit: 5 });
const outstanding = await accounts.findOutstandingAirdrops(ACCOUNT_ID, {
    limit: 5,
});
console.log(`\n2 · airdrops for ${ACCOUNT_ID}`);
console.log(`    pending (to claim)      : ${pending.data.length}`);
console.log(`    outstanding (unclaimed) : ${outstanding.data.length}`);

// ── 3 · allowances ───────────────────────────────────────────────
const cryptoAllowances = await accounts.findCryptoAllowances(ACCOUNT_ID, {
    limit: 5,
});
const tokenAllowances = await accounts.findTokenAllowances(ACCOUNT_ID, {
    limit: 5,
});
const nftAllowances = await accounts.findNftAllowances(ACCOUNT_ID, {
    limit: 5,
});
console.log(`\n3 · allowances granted by ${ACCOUNT_ID}`);
console.log(`    HBAR  : ${cryptoAllowances.data.length}`);
console.log(`    token : ${tokenAllowances.data.length}`);
console.log(`    NFT   : ${nftAllowances.data.length} (approved-for-all)`);
for (const allowance of cryptoAllowances.data) {
    console.log(
        `      spender ${allowance.spender}: ${tinybarToHbar(allowance.amount)} ℏ left of ${tinybarToHbar(allowance.amountGranted)} ℏ`,
    );
}

// ── 4 · topic metadata ───────────────────────────────────────────
const topic = await topics.findById(TOPIC_ID);
console.log(`\n4 · topics.findById("${TOPIC_ID}")`);
console.log(`    memo      : "${topic.memo}"`);
console.log(`    submitKey : ${topic.submitKey ? "set" : "none (public)"}`);
console.log(`    HIP-991   : ${topic.fixedFees?.length ?? 0} fixed fee(s)`);

// ── 5 · fee schedule ─────────────────────────────────────────────
const fees = await network.findFees();
console.log(`\n5 · network.findFees()  @ ${fees.timestamp}`);
for (const fee of fees.fees) {
    console.log(
        `    ${fee.transactionType.padEnd(16)} ${fee.gas.toLocaleString()} gas`,
    );
}

// ── 6 · historical balance snapshot ──────────────────────────────
// /balances is the only endpoint that answers "who held ≥ X ℏ on date D".
// Amounts are tinybars; `order` sorts by account ID, so rank client-side.
const threshold = hbarToTinybar(1_000_000);
const snapshot = await accounts.listBalances({
    balance: { gte: threshold },
    timestamp: SNAPSHOT_TIMESTAMP,
    limit: 3,
});
console.log(
    `\n6 · listBalances({ balance: { gte: 1M ℏ }, timestamp: 2022-05-14 })`,
);
for (const entry of snapshot.data) {
    console.log(
        `    ${entry.accountId.padEnd(12)} ${tinybarToHbar(entry.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })} ℏ`,
    );
}

// ── 7 · staking-reward history ───────────────────────────────────
// Any transaction can trigger a reward payment; scan recent ones for a
// recipient, then list that account's payment history.
const transactions = new TransactionRepository(mirror);
const recent = await collectAll(
    await transactions.find({ limit: 100, order: "desc" }),
    { maxPages: 5 },
);
const rewarded = recent.find(
    (transaction) => transaction.stakingRewardTransfers.length > 0,
);
console.log(`\n7 · staking-reward history (findRewards)`);
if (rewarded) {
    const recipient = rewarded.stakingRewardTransfers[0].accountId;
    const rewards = await accounts.findRewards(recipient, {
        limit: 3,
        order: "desc",
    });
    console.log(`    ${recipient} — last ${rewards.data.length} payment(s):`);
    for (const reward of rewards.data) {
        console.log(
            `      ${reward.timestamp}  ${tinybarToHbar(reward.amount).toFixed(4)} ℏ`,
        );
    }
} else {
    console.log(`    no reward payment in the last 500 transactions`);
}
console.log();
