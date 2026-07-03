/**
 * Maintainer tool: diff the vendored spec's RESPONSE schemas against the
 * raw wire types in src/types/mirror-node.ts.
 *
 *   node spec/diff-response-fields.mjs        (from packages/mirror)
 *
 * Complements the request-side guarantee of test/unit/spec-coverage.test.ts:
 * that test proves every query parameter is expressible; this script reports
 * response fields the spec defines that the raw types don't carry (converters
 * silently drop unknown fields, so gaps here mean data consumers can't reach).
 *
 * Three checks:
 *  1. Reachability — every structural schema reachable from a 200/206
 *     response must be mapped, a known wrapper, or explicitly ignored.
 *  2. Named-pair field diff (spec schema ↔ raw interface).
 *  3. Inline-schema diff for item shapes the spec doesn't name
 *     (transaction transfer legs).
 */
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const spec = parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
    readFileSync(
        fileURLToPath(new URL("./openapi.yml", import.meta.url)),
        "utf8",
    ),
);
const schemas = new Map(Object.entries(spec.components.schemas));
// eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
const source = readFileSync(
    fileURLToPath(new URL("../src/types/mirror-node.ts", import.meta.url)),
    "utf8",
);

/** Flatten a schema node's property names, resolving $ref and allOf. */
function props(node) {
    const out = new Set();
    const walk = (n) => {
        if (!n) return;
        if (n.$ref) return walk(schemas.get(n.$ref.split("/").pop()));
        for (const sub of n.allOf ?? []) walk(sub);
        for (const key of Object.keys(n.properties ?? {})) out.add(key);
    };
    walk(node);
    return out;
}

/** Every raw interface's keys, with `extends` chains resolved. */
const parsed = new Map(
    source
        .split(/\binterface /)
        .slice(1)
        .map((chunk) => {
            const body = chunk.slice(0, chunk.indexOf("\n}"));
            const name = /^(\w+)/.exec(body);
            const parent = / extends (\w+)/.exec(body);
            return [
                name[1],
                {
                    parent: parent?.[1],
                    own: new Set(
                        [...body.matchAll(/^\s{4}([a-z_0-9]+)\??:/gm)].map(
                            (key) => key[1],
                        ),
                    ),
                },
            ];
        }),
);
const interfaces = new Map(
    [...parsed.keys()].map((name) => {
        const keys = new Set();
        for (let cur = name; cur; cur = parsed.get(cur)?.parent)
            for (const key of parsed.get(cur)?.own ?? []) keys.add(key);
        return [name, keys];
    }),
);

/** Spec schema → raw interface (`extends` chains are resolved). */
const PAIRS = [
    ["AccountInfo", "MirrorAccountResponse"],
    ["AccountBalance", "MirrorAccountBalanceSnapshot"],
    ["Transaction", "MirrorTransaction"],
    ["TransactionDetail", "MirrorTransaction"],
    ["AssessedCustomFee", "MirrorAssessedCustomFee"],
    ["CustomFeeLimit", "MirrorCustomFeeLimit"],
    ["StakingRewardTransfer", "MirrorStakingRewardTransfer"],
    ["Token", "MirrorTokenResponse"],
    ["TokenInfo", "MirrorTokenResponse"],
    ["TokenBalance", "MirrorTokenBalance"],
    ["TokenRelationship", "MirrorAccountTokenBalance"],
    ["FixedFee", "MirrorFixedFeeRaw"],
    ["FractionalFee", "MirrorFractionalFeeRaw"],
    ["RoyaltyFee", "MirrorRoyaltyFeeRaw"],
    ["Nft", "MirrorNft"],
    ["NftTransactionTransfer", "MirrorNftTransaction"],
    ["TopicMessage", "MirrorTopicMessageRaw"],
    ["ChunkInfo", "MirrorChunkInfo"],
    ["Topic", "MirrorTopicResponse"],
    ["Schedule", "MirrorScheduleResponse"],
    ["ScheduleSignature", "MirrorScheduleSignature"],
    ["Block", "MirrorBlock"],
    ["Contract", "MirrorContractRaw"],
    ["ContractResponse", "MirrorContractResponse"],
    ["ContractResult", "MirrorContractResult"],
    ["ContractResultLog", "MirrorContractResultLog"],
    ["ContractResultStateChange", "MirrorContractStateChange"],
    ["ContractAction", "MirrorContractAction"],
    ["ContractState", "MirrorContractState"],
    ["ContractCallResponse", "MirrorContractCallResponse"],
    ["AccessList", "MirrorAccessListEntry"],
    ["AuthorizationList", "MirrorAuthorizationListEntry"],
    ["Opcode", "MirrorOpcode"],
    ["OpcodesResponse", "MirrorOpcodesResponse"],
    ["NetworkNode", "MirrorNetworkNode"],
    ["ServiceEndpoint", "MirrorServiceEndpoint"],
    ["RegisteredNode", "MirrorRegisteredNode"],
    ["RegisteredServiceEndpoint", "MirrorRegisteredServiceEndpoint"],
    ["RegisteredBlockNodeEndpoint", "MirrorRegisteredServiceEndpoint"],
    ["RegisteredGeneralServiceEndpoint", "MirrorRegisteredServiceEndpoint"],
    ["NetworkStakeResponse", "MirrorNetworkStakeResponse"],
    ["NetworkSupplyResponse", "MirrorNetworkSupplyResponse"],
    ["NetworkFeesResponse", "MirrorNetworkFeesResponse"],
    ["ExchangeRate", "MirrorExchangeRate"],
    ["StakingReward", "MirrorStakingReward"],
    ["TokenAirdrop", "MirrorAirdrop"],
    ["Allowance", "MirrorCryptoAllowance"],
    ["CryptoAllowance", "MirrorCryptoAllowance"],
    ["TokenAllowance", "MirrorTokenAllowance"],
    ["NftAllowance", "MirrorNftAllowance"],
    ["Hook", "MirrorHook"],
    ["HookStorage", "MirrorHookStorageSlot"],
    ["FeeEstimateResponse", "MirrorFeeEstimateResponse"],
    ["FeeExtra", "MirrorFeeExtra"],
    ["FeeEstimate", "MirrorFeeEstimateComponent"],
    ["TimestampRange", "MirrorTimestampRange"],
    ["TimestampRangeNullable", "MirrorTimestampRange"],
];

/** List/page wrappers — their items are covered by PAIRS. */
const WRAPPERS = new Set([
    "AccountsResponse",
    "BalancesResponse",
    "BlocksResponse",
    "ContractActionsResponse",
    "ContractLogsResponse",
    "ContractResultsResponse",
    "ContractStateResponse",
    "ContractsResponse",
    "CryptoAllowancesResponse",
    "HooksResponse",
    "HooksStorageResponse",
    "NetworkExchangeRateSetResponse",
    "NetworkNodesResponse",
    "Nfts",
    "NftAllowancesResponse",
    "NftTransactionHistory",
    "RegisteredNodesResponse",
    "SchedulesResponse",
    "StakingRewardsResponse",
    "TokenAirdropsResponse",
    "TokenAllowancesResponse",
    "TokenBalancesResponse",
    "TokenRelationshipResponse",
    "TokensResponse",
    "TopicMessagesResponse",
    "TransactionByIdResponse",
    "TransactionsResponse",
]);

/** Deliberately unmapped, with reasons. */
const IGNORED = new Map([
    ["Links", "pagination plumbing (handled by Page)"],
    ["Key", "flattened to its `key` string by converters"],
    ["Balance", "inline balance object inside MirrorAccountResponse"],
    ["TransactionId", "inline object inside MirrorChunkInfo"],
    ["CustomFees", "inline container inside MirrorTokenResponse"],
    ["ConsensusCustomFees", "inline container inside MirrorTopicResponse"],
    ["FixedCustomFee", "inline topic fixed-fee inside MirrorTopicResponse"],
    [
        "ContractLog",
        "extends ContractResultLog — own fields on MirrorContractLog",
    ],
    [
        "ContractResultDetails",
        "extends ContractResult — own fields on MirrorContractResultDetails",
    ],
    [
        "AccountBalanceTransactions",
        "AccountInfo + embedded transactions list (documented omission)",
    ],
    [
        "FeeEstimateNetwork",
        "inline network component inside MirrorFeeEstimateResponse",
    ],
    ["NetworkFee", "inline fees entry inside MirrorNetworkFeesResponse"],
]);

// ── 1 · reachability ────────────────────────────────────────────
const reachable = new Set();
const visitRef = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.$ref) {
        const name = node.$ref.split("/").pop();
        if (!reachable.has(name)) {
            reachable.add(name);
            visitRef(schemas.get(name));
        }
        return;
    }
    for (const variants of [node.allOf, node.oneOf, node.anyOf])
        for (const sub of variants ?? []) visitRef(sub);
    if (node.items) visitRef(node.items);
    if (node.additionalProperties) visitRef(node.additionalProperties);
    for (const prop of Object.values(node.properties ?? {})) visitRef(prop);
};
for (const ops of Object.values(spec.paths))
    for (const op of Object.values(ops))
        for (const [code, resp] of Object.entries(op.responses ?? {}))
            if (code === "200" || code === "206")
                visitRef(resp.content?.["application/json"]?.schema);

const mapped = new Set(PAIRS.map(([schema]) => schema));
const hasProps = (n) =>
    n && (n.properties || (n.allOf ?? []).some((sub) => hasProps(sub)));
const unaccounted = [...reachable]
    .filter((name) => hasProps(schemas.get(name)))
    .filter(
        (name) =>
            !mapped.has(name) && !WRAPPERS.has(name) && !IGNORED.has(name),
    )
    .sort();
if (unaccounted.length) {
    console.log(`✖ UNACCOUNTED reachable schemas: ${unaccounted.join(", ")}`);
} else {
    console.log(
        `✓ reachability: all ${reachable.size} reachable schemas mapped, wrapped, or ignored with a reason`,
    );
}

// ── 2 · named-pair field diff ───────────────────────────────────
let gaps = 0;
for (const [schema, iface] of PAIRS) {
    const specFields = props(schemas.get(schema));
    const rawFields = interfaces.get(iface);
    if (specFields.size === 0 || !rawFields) {
        console.log(`?? could not resolve ${schema} → ${iface}`);
        gaps += 1;
        continue;
    }
    const missing = [...specFields].filter((f) => !rawFields.has(f)).sort();
    if (missing.length) {
        gaps += missing.length;
        console.log(`● ${schema} → ${iface}: missing ${missing.join(", ")}`);
    }
}

// ── 3 · inline item shapes ──────────────────────────────────────
const transaction = schemas.get("Transaction").properties;
for (const [leg, items, iface] of [
    ["transfers", transaction.transfers.items, "MirrorTransfer"],
    [
        "token_transfers",
        transaction.token_transfers.items,
        "MirrorTokenTransfer",
    ],
    ["nft_transfers", transaction.nft_transfers.items, "MirrorNftTransfer"],
]) {
    const specFields = props(items);
    const rawFields = interfaces.get(iface);
    const missing = [...specFields].filter((f) => !rawFields.has(f)).sort();
    if (missing.length) {
        gaps += missing.length;
        console.log(
            `● Transaction.${leg} → ${iface}: missing ${missing.join(", ")}`,
        );
    }
}

console.log(
    gaps === 0
        ? "✓ field diff: 0 spec response fields missing from raw types"
        : `✖ ${gaps} spec response fields missing from raw types`,
);
process.exitCode = gaps === 0 && unaccounted.length === 0 ? 0 : 1;
