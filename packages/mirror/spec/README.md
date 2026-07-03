# Vendored mirror node OpenAPI spec

`openapi.yml` is a byte-for-byte snapshot of the official mirror node
REST API definition:

> [`hiero-ledger/hiero-mirror-node`](https://github.com/hiero-ledger/hiero-mirror-node) → `rest/api/v1/openapi.yml`

`SNAPSHOT` records the upstream commit the copy was taken from.

## Why it's vendored

The snapshot is the reference the package's coverage is *proven*
against, not just claimed: `test/unit/spec-coverage.test.ts` diffs every
operation and query parameter in this file against
`test/spec/coverage-manifest.ts` in both directions on every build. A
param in the spec that is neither covered nor a documented omission
fails the suite — and so does a manifest entry the spec no longer
defines.

The weekly [`spec-drift`](../../../.github/workflows/spec-drift.yml)
workflow diffs this snapshot against upstream `main` and opens an issue
when they diverge, so upstream changes surface as tickets instead of
surprises.

## Refreshing the snapshot

```bash
# 1. Pull the latest spec and record its commit
curl -fsSL https://raw.githubusercontent.com/hiero-ledger/hiero-mirror-node/main/rest/api/v1/openapi.yml \
  -o packages/mirror/spec/openapi.yml
gh api repos/hiero-ledger/hiero-mirror-node/commits/main --jq '.sha[0:7] + " " + (.commit.message | split("\n")[0])' \
  > packages/mirror/spec/SNAPSHOT

# 2. See exactly what changed for the client
pnpm --filter @hiero-enterprise/mirror run test:unit
```

If `spec-coverage.test.ts` fails, it prints the precise list of new or
removed operations/parameters. For each one, either extend the client
(query type + param mapping + URL test) and add it to `covered`, or add
it to `omitted` with the reasoning in the manifest header. Do not edit
the manifest to silence a failure without one of those two actions —
the manifest is the package's coverage contract.
