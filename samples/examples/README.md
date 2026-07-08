# @hiero-enterprise/core examples

Runnable scripts that exercise `@hiero-enterprise/core` directly (no framework). Each file in [`src/`](./src) is an independent example; the runner discovers them automatically.

## Running

```bash
# from the repo root
pnpm --filter @hiero-enterprise/examples examples            # run every example
pnpm --filter @hiero-enterprise/examples examples mirror     # only files starting with "mirror"
```

The filter matches the start of the file path, so `mirror` runs everything under `src/mirror/`. The runner executes examples sequentially, streams each one's output live under its `[i/N]` header, and exits non-zero if any fail.

Set `EXAMPLES_SKIP=mirror/` (comma-separated prefixes) to skip the mirror query examples — CI does this because they showcase public-network data that does not exist on a fresh solo network.

To run a single example on its own (e.g. while iterating on it):

```bash
cd samples/examples
npx tsx src/mirror/pagination.ts
```

> These examples make **live network calls**. Read-only mirror-node examples work out of the box; examples that submit transactions need operator credentials (below).
> For a copy-pasteable project whose **only** dependency is `@hiero-enterprise/mirror` (plain `node`, no build step), see [`samples/mirror-standalone`](../mirror-standalone).

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
| `EXAMPLE_MAX_PAGES` | `20` | Caps how much data the pagination example pulls |
| `EXAMPLE_TOKEN_ID` | `0.0.456858` | USDC (6 decimals) — token/holder queries |
| `EXAMPLE_NFT_TOKEN_ID` | `0.0.4054027` | An actively-minted NFT collection |
| `EXAMPLE_TOPIC_ID` | `0.0.368908` | A long-lived, very active HCS topic |
| `EXAMPLE_WATCH_ACCOUNTS` | `0.0.98,0.0.800` | Comma-separated accounts for the activity monitor |

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
| [`mirror/pagination.ts`](./src/mirror/pagination.ts) | Guided tour of rate-limited reads at scale: `limit`/`order`, filters, threshold scans, and `paginate` / `collectAll` streaming through a concurrency + TPS-capped client | None (mirror read) |
| [`mirror/accounts.ts`](./src/mirror/accounts.ts) | Account queries end-to-end: profile lookup, balances, balance-band threshold scan with client-side ranking, lookup by EVM alias | None (mirror read) |
| [`mirror/tokens.ts`](./src/mirror/tokens.ts) | Token & NFT queries end-to-end: metadata + decimals interpretation, holder threshold scan, tokens by account, NFT collection → serial → owner chain | None (mirror read) |
| [`mirror/transactions.ts`](./src/mirror/transactions.ts) | Transaction queries end-to-end: newest-N, single transaction by ID with transfer legs, bundled type + timestamp filters, bounded time windows | None (mirror read) |
| [`mirror/topics.ts`](./src/mirror/topics.ts) | HCS topic messages: latest messages with decoded payloads, lookup by sequence number | None (mirror read) |
| [`mirror/network.ts`](./src/mirror/network.ts) | Network state: exchange rates in USD/ℏ, released vs total supply (now and historical), staking totals, per-node stake ranking | None (mirror read) |
| [`mirror/contracts.ts`](./src/mirror/contracts.ts) | The EVM read surface: blocks, newest contracts, an execution's detail + call frames, event logs, storage slots, opcode replay, and read-only `contracts/call` (ERC-20 read + gas estimate) | None (mirror read) |
| [`mirror/read-counterparts.ts`](./src/mirror/read-counterparts.ts) | Read-side counterparts of core's writes: schedules & their signatures, pending/outstanding airdrops, live allowances, topic metadata, the fee schedule, and historical balance snapshots | None (mirror read) |
| [`mirror/account-monitor.ts`](./src/mirror/account-monitor.ts) | Incremental activity polling: fetch each watched account's transactions since a checkpoint (parallel, rate-gated), digest the transfer legs, advance the checkpoint so nothing is processed twice | None (mirror read) |
| [`mirror/timeseries.ts`](./src/mirror/timeseries.ts) | Building time series: monthly supply snapshots, weekly balance history, daily transaction buckets via `timestampRange` — with ASCII charts | None (mirror read) |
| [`mirror/concurrency.ts`](./src/mirror/concurrency.ts) | Concurrent fan-out through the rate limiter: 30 balance lookups fired at once, `maxConcurrent: 1` vs `10` timed side by side | None (mirror read) |
| [`mirror/config-errors.ts`](./src/mirror/config-errors.ts) | Construction from URL / network name / env, fail-fast config validation, and branching on `MirrorError` codes at runtime | None (mirror read) |
