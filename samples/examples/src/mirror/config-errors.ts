/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/config-errors.ts
 *
 * CONFIGURATION and ERROR HANDLING for the mirror package — the
 * operational surface you lean on in production. No operator credentials
 * required.
 *
 * What it shows, in order:
 *   1. Three ways to build a client: explicit URL, network name, and
 *      environment variables via `createMirrorNodeClient()`.
 *   2. Invalid configuration fails fast at construction with a typed
 *      `MirrorError` (no silent deadlocks or ignored typos).
 *   3. Runtime failures carry machine-readable codes — branch on
 *      `error.code` instead of parsing messages, and use `instanceof
 *      MirrorError` to tell mirror failures apart from anything else.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 */
import {
    MirrorNodeClient,
    createMirrorNodeClient,
    resolveMirrorNodeUrl,
    AccountRepository,
    MirrorError,
    MirrorErrorCodes,
} from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";

console.log(`\nConfig & error handling example — ${mirrorUrl}\n`);

// ── 1 · three ways to construct a client ─────────────────────────
console.log(`1 · construction`);

// (a) explicit base URL + tuning
const explicit = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
console.log(`    explicit URL          → ok`);

// (b) network name, URL auto-resolved
console.log(
    `    resolveMirrorNodeUrl("mainnet") → ${resolveMirrorNodeUrl("mainnet")}`,
);

// (c) everything from HIERO_* environment variables
process.env["HIERO_NETWORK"] = process.env["HIERO_NETWORK"] ?? "mainnet";
const fromEnv = createMirrorNodeClient();
console.log(
    `    createMirrorNodeClient() from env → ${fromEnv instanceof MirrorNodeClient ? "ok" : "??"}`,
);

// ── 2 · invalid config fails fast, not silently ──────────────────
console.log(`\n2 · invalid configuration throws at construction`);
const invalidConfigs: Array<[string, () => unknown]> = [
    [
        `maxConcurrent: 0 (would deadlock)`,
        () => new MirrorNodeClient(mirrorUrl, { maxConcurrent: 0 }),
    ],
    [
        `maxRequestsPerSecond: -5`,
        () => new MirrorNodeClient(mirrorUrl, { maxRequestsPerSecond: -5 }),
    ],
    [`unknown network name`, () => resolveMirrorNodeUrl("devnet")],
];
for (const [label, attempt] of invalidConfigs) {
    try {
        attempt();
        console.log(`    ${label} → UNEXPECTEDLY SUCCEEDED`);
    } catch (error) {
        const code = error instanceof MirrorError ? error.code : "?";
        console.log(`    ${label} → MirrorError(${code})`);
    }
}

// ── 3 · runtime errors carry machine-readable codes ──────────────
console.log(`\n3 · runtime failures: branch on error.code`);
const accounts = new AccountRepository(explicit);

// A well-formed but non-existent account → HTTP 404 from the mirror node.
try {
    await accounts.findByAccountId("0.0.999999999999");
    console.log(`    lookup of non-existent account → UNEXPECTEDLY SUCCEEDED`);
} catch (error) {
    if (
        error instanceof MirrorError &&
        error.code === MirrorErrorCodes.MirrorNodeHttpError
    ) {
        console.log(
            `    non-existent account → MirrorError(${error.code})` +
                ` — treat as "not found", e.g. return null to callers`,
        );
    } else {
        throw error; // anything else is a real problem — surface it
    }
}

// Malformed input is rejected client-side before any request is made.
try {
    await accounts.findByAlias("not-an-evm-address");
} catch (error) {
    if (error instanceof MirrorError) {
        console.log(`    malformed alias      → MirrorError(${error.code})`);
    }
}

console.log(`\n    all codes: ${Object.values(MirrorErrorCodes).join(", ")}\n`);
