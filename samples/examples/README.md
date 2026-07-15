# @hiero-hackers/enterprise-core examples

Runnable scripts that exercise `@hiero-hackers/enterprise-core` directly (no framework). Each file in [`src/`](./src) is an independent example; the runner discovers them automatically.

## Running

```bash
# from the repo root
pnpm --filter @hiero-hackers/examples examples            # run every example
pnpm --filter @hiero-hackers/examples examples mirror     # only files starting with "mirror"
```

The filter matches the start of the file path, so `mirror` runs everything under `src/mirror/`. The runner executes examples sequentially, streams each one's output live under its `[i/N]` header, and exits non-zero if any fail.

To run a single example on its own (e.g. while iterating on it):

```bash
cd samples/examples
npx tsx src/mirror/queries.ts
```

> These examples make **live network calls**. Read-only mirror-node examples work out of the box; examples that submit transactions need operator credentials (below).

Each example is deliberately **self-contained** — client setup, constants, and small formatting helpers are repeated per file rather than shared, so any single file can be copied out as a complete, runnable starting point.

A few mirror repository methods have no example on purpose: account **hooks** (`findHooks` / `findHookStorage` — HIP-1195 isn't deployed to mainnet's mirror yet), **registered nodes** (`findRegisteredNodes` — the registry is empty on mainnet today), and **fee estimation** (`estimateFees` — it needs protobuf transaction bytes from core's write side, so it belongs with the credentialed examples). All four are covered by unit tests.

## Configuration

Copy the variables you need into a `.env` file in this directory (loaded automatically via `dotenv`).

### Mirror-node examples — no credentials required

Mirror-node reads don't cost fees or need keys, so these run against the public network as-is.

| Variable | Default | Notes |
|----------|---------|-------|
| `HIERO_MIRROR_NODE_URL` | `https://mainnet.mirrornode.hedera.com` | Any mirror node REST endpoint |
| `EXAMPLE_ACCOUNT_ID` | `0.0.98` | A busy, always-populated account so results aren't empty |

### Write examples — operator credentials required

Examples that submit transactions read operator credentials from the environment (see [`src/env.ts`](./src/env.ts)):

```bash
HIERO_NETWORK=testnet
HIERO_ED25519_OPERATOR_ID=0.0.12345
HIERO_ED25519_OPERATOR_KEY=your_private_key
# or the ECDSA pair:
HIERO_ECDSA_OPERATOR_ID=0.0.12345
HIERO_ECDSA_OPERATOR_KEY=your_private_key
```

## Examples

| File | What it shows | Credentials |
|------|---------------|-------------|
| [`mirror/queries.ts`](./src/mirror/queries.ts) | The two non-obvious parts of `@hiero-hackers/enterprise-mirror`: composing filter/query properties (`limit`, `order`, `transactionType`, `timestamp: { gte }`) and walking pagination three ways — manual `page.next()`, streaming `paginate(...)`, one-shot `collectAll(...)` | None (mirror read) |
