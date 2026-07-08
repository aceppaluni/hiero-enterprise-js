/**
 * Maintainer tool: validate the mirror node's OWN golden test fixtures
 * against the vendored OpenAPI spec — reality vs contract.
 *
 *   node spec/check-fixtures.mjs <dir-of-fixture-jsons>
 *
 * The fixtures are the upstream REST implementation's canned
 * request→response pairs (rest/__tests__/specs/**.json in
 * hiero-ledger/hiero-mirror-node) — exact JSON the server is tested to
 * produce, including nulls and edge cases. Any place they disagree with
 * the spec is a documented-vs-actual bug of the `expiry_timestamp`
 * class: either the spec lies (fix our raw types + report upstream) or
 * the fixture reveals drift.
 *
 * Fetch the corpus (flattening paths into file names):
 *
 *   curl -s "https://api.github.com/repos/hiero-ledger/hiero-mirror-node/git/trees/main?recursive=1" |
 *     jq -r '.tree[].path | select(startswith("rest/__tests__/specs/") and endswith(".json"))' |
 *     while read -r p; do
 *       curl -sfL "https://raw.githubusercontent.com/hiero-ledger/hiero-mirror-node/main/$p" \
 *         -o "fixtures/$(echo "${p#rest/__tests__/specs/}" | tr / _)"
 *     done
 *
 * Reported classes:
 *   type-mismatch     value's JSON type differs from the schema's
 *   null-not-allowed  null where the schema is not nullable
 *   undocumented      field present in reality, absent from the schema
 *
 * Informational (exit 0 unless --strict): the point is a reviewable
 * report, not a gate — fixtures also contain deliberately weird setups.
 */
import { parse } from "yaml";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = process.argv[2];
const strict = process.argv.includes("--strict");
if (!fixturesDir) {
    console.error("usage: node spec/check-fixtures.mjs <fixtures-dir>");
    process.exit(2);
}

const spec = parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
    readFileSync(
        fileURLToPath(new URL("./openapi.yml", import.meta.url)),
        "utf8",
    ),
);
const schemas = spec.components.schemas;

// ── Path matching ───────────────────────────────────────────────────

const templates = Object.keys(spec.paths).map((template) => ({
    template,
    segments: template.split("/").filter(Boolean),
}));

/** "/api/v1/accounts/0.0.3?limit=1" → best-matching spec path template. */
function matchTemplate(url) {
    const path = url.split("?")[0].replace(/\/$/, "");
    const segments = path.split("/").filter(Boolean);
    let best = null;
    let bestScore = -1;
    for (const t of templates) {
        if (t.segments.length !== segments.length) continue;
        let score = 0;
        let ok = true;
        for (const [i, seg] of t.segments.entries()) {
            if (seg.startsWith("{")) continue;
            if (seg !== segments[i]) {
                ok = false;
                break;
            }
            score += 1;
        }
        if (ok && score > bestScore) {
            best = t.template;
            bestScore = score;
        }
    }
    return best;
}

function responseSchema(template, status) {
    const item = spec.paths[template]?.get;
    const response =
        item?.responses?.[String(status)] ?? item?.responses?.default;
    return response?.content?.["application/json"]?.schema ?? null;
}

// ── Structural validation ───────────────────────────────────────────

const deref = (node) =>
    node?.$ref ? schemas[node.$ref.split("/").pop()] : node;

/** allOf-merge: collect properties/required/nullable across branches. */
function flatten(node) {
    node = deref(node);
    if (!node) return null;
    if (!node.allOf) return node;
    const merged = { ...node, properties: { ...(node.properties ?? {}) } };
    for (const branch of node.allOf) {
        const flat = flatten(branch);
        if (!flat) continue;
        Object.assign(merged.properties, flat.properties ?? {});
        if (flat.type && !merged.type) merged.type = flat.type;
        if (flat.items && !merged.items) merged.items = flat.items;
    }
    return merged;
}

const jsType = (v) =>
    v === null ? "null" : Array.isArray(v) ? "array" : typeof v;

function typeOk(value, schemaType) {
    switch (schemaType) {
        case "string":
            return typeof value === "string";
        case "integer":
            return typeof value === "number" && Number.isInteger(value);
        case "number":
            return typeof value === "number";
        case "boolean":
            return typeof value === "boolean";
        case "object":
            return jsType(value) === "object";
        case "array":
            return Array.isArray(value);
        default:
            return true;
    }
}

const issues = new Map(); // dedup key → {kind, where, detail, count, example}

function report(kind, where, detail, example) {
    const key = `${kind}|${where}|${detail}`;
    const entry = issues.get(key) ?? {
        kind,
        where,
        detail,
        count: 0,
        example,
    };
    entry.count += 1;
    issues.set(key, entry);
}

function check(value, node, where) {
    node = flatten(node);
    if (!node) return;

    for (const variants of [node.oneOf, node.anyOf]) {
        if (!variants) continue;
        // Pass when any branch validates cleanly.
        const clean = variants.some((branch) => {
            const before = issues.size;
            const scratch = new Map(issues);
            check(value, branch, where);
            const grew = issues.size > before;
            if (grew) {
                issues.clear();
                for (const [k, v] of scratch) issues.set(k, v);
            }
            return !grew;
        });
        if (!clean) report("no-variant-matched", where, "", value);
        return;
    }

    if (value === null) {
        const nullable =
            node.nullable === true ||
            (Array.isArray(node.type) && node.type.includes("null"));
        if (!nullable && node.type) {
            report("null-not-allowed", where, `schema type ${node.type}`);
        }
        return;
    }

    const type = Array.isArray(node.type)
        ? node.type.find((t) => t !== "null")
        : node.type;
    if (type && !typeOk(value, type)) {
        report(
            "type-mismatch",
            where,
            `spec says ${type}, got ${jsType(value)}`,
            JSON.stringify(value).slice(0, 60),
        );
        return;
    }

    if (Array.isArray(value)) {
        for (const element of value.slice(0, 3)) {
            check(element, node.items, `${where}[]`);
        }
        return;
    }

    if (jsType(value) === "object" && node.properties) {
        for (const [key, v] of Object.entries(value)) {
            if (key in node.properties) {
                check(v, node.properties[key], `${where}.${key}`);
            } else if (node.additionalProperties === undefined) {
                report("undocumented", `${where}.${key}`, "");
            }
        }
    }
}

// ── Drive ───────────────────────────────────────────────────────────

let fixtures = 0;
let responses = 0;
let unmatched = 0;

// eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI arg from the maintainer running the tool
for (const file of readdirSync(fixturesDir)) {
    if (!file.endsWith(".json")) continue;
    let doc;
    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- same
        doc = JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
    } catch {
        continue;
    }
    fixtures += 1;
    const cases = [doc, ...(doc.tests ?? [])];
    for (const c of cases) {
        const status = c.responseStatus ?? 200;
        if (status < 200 || status >= 300 || c.responseJson === undefined) {
            continue;
        }
        for (const url of c.urls ?? (c.url ? [c.url] : [])) {
            const template = matchTemplate(url);
            if (!template) {
                unmatched += 1;
                continue;
            }
            const schema = responseSchema(template, status);
            if (!schema) continue;
            responses += 1;
            check(c.responseJson, schema, template);
        }
    }
}

const sorted = [...issues.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || b.count - a.count,
);
for (const issue of sorted) {
    console.log(
        `${issue.kind.padEnd(16)} ${issue.where}` +
            (issue.detail ? ` — ${issue.detail}` : "") +
            ` (${issue.count}×)` +
            (issue.example !== undefined ? `  e.g. ${issue.example}` : ""),
    );
}
console.log(
    `\n${fixtures} fixtures, ${responses} validated responses, ` +
        `${unmatched} unmatched urls, ${sorted.length} distinct findings`,
);
const hard = sorted.filter(
    (issue) => issue.kind === "type-mismatch" || issue.kind === "null-not-allowed",
);
console.log(
    `hard contract violations (type-mismatch / null-not-allowed): ${hard.length}`,
);
if (strict && hard.length > 0) process.exit(1);
