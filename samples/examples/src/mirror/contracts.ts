/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/contracts.ts
 *
 * End-to-end tour of the EVM read surface — blocks, contracts, execution
 * results, event logs, storage, and read-only calls — no operator
 * credentials required.
 *
 * What it shows, in order:
 *   1. Blocks — the latest block, then the same block fetched by height.
 *   2. Contracts — the newest contract entities on the network.
 *   3. Results — the most recent execution network-wide, its full detail
 *      (logs + state changes), the same result re-fetched by transaction
 *      hash, and its call frames (internal calls).
 *   4. Logs — the contract's latest event, with topics and block context.
 *   5. Storage — the contract's current storage slots.
 *   6. Opcodes — the execution replayed step by step on the EVM (slow;
 *      may be unavailable for older transactions).
 *   7. contracts/call — an ERC-20 `decimals()` read against USDC via the
 *      HTS facade, plus the same call as a gas estimate. POST-based, but
 *      free, keyless, and rate-gated like every other query.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 */
import {
    MirrorNodeClient,
    BlockRepository,
    ContractRepository,
} from "@hiero-enterprise/mirror";

/** USDC (0.0.456858) as a 20-byte EVM address — HTS tokens answer ERC-20 reads. */
const USDC_EVM_ADDRESS = "0x000000000000000000000000000000000006f89a";
/** The ERC-20 `decimals()` selector. */
const DECIMALS_SELECTOR = "0x313ce567";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const blocks = new BlockRepository(mirror);
const contracts = new ContractRepository(mirror);

console.log(`\nContracts (EVM) queries example — ${mirrorUrl}\n`);

// ── 1 · blocks ───────────────────────────────────────────────────
const latestBlocks = await blocks.list({ limit: 1, order: "desc" });
const tip = latestBlocks.data[0];
console.log(`1 · blocks.list({ limit: 1, order: "desc" })`);
console.log(`    height ${tip.number} — ${tip.count} transactions`);
console.log(`    span   ${tip.timestamp.from} → ${tip.timestamp.to}`);

const sameBlock = await blocks.findByHashOrNumber(tip.number);
console.log(
    `    findByHashOrNumber(${tip.number}) → hash ${sameBlock.hash.slice(0, 18)}…`,
);

// ── 2 · newest contracts ─────────────────────────────────────────
const newest = await contracts.list({ limit: 3, order: "desc" });
console.log(`\n2 · contracts.list({ limit: 3, order: "desc" })`);
for (const contract of newest.data) {
    console.log(`    ${contract.contractId}  ${contract.evmAddress}`);
}

// ── 3 · execution results, detail, and call frames ───────────────
// Network-wide results answer "what ran last on the EVM"; per-contract
// results (`findResults(id)`) scope the same query to one contract.
const recent = await contracts.listResults({ limit: 5, order: "desc" });
// `contractId` is null for failed creates — pick a result that has one.
const result = recent.data.find((entry) => entry.contractId !== null);
if (!result?.contractId) {
    console.log("    no recent execution with a contract id — try again");
    process.exit(0);
}
const executedContractId = result.contractId;
console.log(`\n3 · contracts.listResults({ limit: 5, order: "desc" })`);
console.log(
    `    ${executedContractId}  ${result.result}  gasUsed=${result.gasUsed}`,
);

const detail = await contracts.findResultByTimestamp(
    executedContractId,
    result.timestamp,
);
console.log(
    `    detail: ${detail.logs.length} logs, ${detail.stateChanges.length} state changes, hash ${detail.hash.slice(0, 14)}…`,
);

// The same query scoped to one contract:
const scoped = await contracts.findResults(executedContractId, { limit: 3 });
console.log(
    `    findResults("${executedContractId}") → ${scoped.data.length} recent execution(s) for that contract`,
);

// The same detail is addressable by transaction hash (or transaction ID):
const byHash = await contracts.findResult(detail.hash);
console.log(
    `    findResult("${detail.hash.slice(0, 14)}…") → same execution, ${byHash.result}`,
);

const actions = await contracts.findActions(detail.hash, { limit: 3 });
console.log(`    call frames (first ${actions.data.length}):`);
for (const action of actions.data) {
    console.log(
        `      ${String(action.index).padStart(2)}  ${action.callOperationType}  → ${action.recipient ?? action.to}  gasUsed=${action.gasUsed}`,
    );
}

// ── 4 · event logs ───────────────────────────────────────────────
const logs = await contracts.findLogs(executedContractId, {
    limit: 1,
});
console.log(`\n4 · contracts.findLogs("${executedContractId}", { limit: 1 })`);
if (logs.data.length > 0) {
    const log = logs.data[0];
    console.log(`    block #${log.blockNumber}  topic0 ${log.topics[0]}`);
} else {
    console.log(`    no logs emitted by this contract yet`);
}

// ── 5 · storage slots ────────────────────────────────────────────
const state = await contracts.findState(executedContractId, { limit: 2 });
console.log(`\n5 · contracts.findState("${executedContractId}", { limit: 2 })`);
if (state.data.length > 0) {
    for (const slot of state.data) {
        console.log(
            `    slot ${slot.slot.slice(0, 12)}… = ${slot.value.slice(0, 12)}…`,
        );
    }
} else {
    console.log(`    no storage slots recorded for this contract`);
}

// ── 6 · opcode replay ────────────────────────────────────────────
// The mirror node re-executes the transaction on the EVM, so this takes
// seconds and only works while the state needed for replay is available.
try {
    const trace = await contracts.findOpcodes(detail.hash);
    console.log(`\n6 · contracts.findOpcodes("${detail.hash.slice(0, 14)}…")`);
    console.log(
        `    ${trace.opcodes.length} steps, failed=${trace.failed}, ` +
            `first op ${trace.opcodes[0]?.op}, return ${trace.returnValue.slice(0, 12)}…`,
    );
} catch {
    console.log(`\n6 · findOpcodes — replay unavailable for this transaction`);
}

// ── 7 · read-only calls: contracts/call ──────────────────────────
// The one POST in the API — still free and keyless. `data` is the ABI
// selector (+ encoded args); the result comes back as hex.
const decimals = await contracts.call({
    to: USDC_EVM_ADDRESS,
    data: DECIMALS_SELECTOR,
});
console.log(`\n7 · contracts.call({ to: USDC, data: decimals() })`);
console.log(
    `    result ${decimals.result.slice(0, 10)}… = ${parseInt(decimals.result, 16)} decimals`,
);

const estimate = await contracts.call({
    to: USDC_EVM_ADDRESS,
    data: DECIMALS_SELECTOR,
    estimate: true,
});
console.log(`    same call as estimate: ${parseInt(estimate.result, 16)} gas`);
console.log();
