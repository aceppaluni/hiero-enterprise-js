# Hiero Enterprise JS

[![CI](../../actions/workflows/build.yml/badge.svg)](../../actions/workflows/build.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Jexsie/4a3c4fd2dae12f95e6177ae3bc807403/raw/hiero-enterprise-js-coverage.json)](../../actions/workflows/build.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hiero-hackers/hiero-enterprise-js/badge)](https://scorecard.dev/viewer/?uri=github.com/hiero-hackers/hiero-enterprise-js)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

Integrating the Hiero SDK into a production Node.js service has historically meant a lot of glue code that has nothing to do with your actual business logic: instantiating clients, managing config, plumbing operator keys, handling errors. 
Similarly, reading data from the mirror node has meant hand-rolling REST calls, pagination, and rate limiting.

Hiero Enterprise JS does that work for you. 

Drop in the middleware or module for your framework of choice and your routes get typed access to accounts, tokens, NFTs, smart contracts, topics, and mirror node queries — without any of the setup code.

It gives each major Node.js framework a native integration that matches how developers already think about that framework — middleware for Express/Fastify, dependency injection for NestJS. Write operations (creating accounts, minting tokens) go through the network client directly. Read operations (looking up balances, browsing NFTs) go through the mirror node REST API, which is faster and doesn't carry transaction fees. Both are exposed through a consistent interface so you don't have to think about which path to use.

## Packages

| Package | Description |
|---------|-------------|
| [`@hiero-enterprise/core`](./packages/core) | SDK write-side: services, transactions, operator keys — use directly or with any framework |
| [`@hiero-enterprise/mirror`](./packages/mirror) | Mirror node read-side: repositories, pagination, rate limiting, filters, unit helpers — **zero dependencies, no credentials** |
| [`@hiero-enterprise/express`](./packages/express) | Express middleware — `req.hiero.*` (composes core + mirror) |
| [`@hiero-enterprise/fastify`](./packages/fastify) | Fastify plugin — `fastify.hiero.*` (composes core + mirror) |
| [`@hiero-enterprise/nest`](./packages/nest) | NestJS module — `HieroModule.forRoot()` with full DI (composes core + mirror) |

Each package README documents its full surface — the adapter READMEs
list everything available on `req.hiero` / `app.hiero` / via DI, so you
never have to guess what arrived pre-composed.

### Which package do I install?

| You are building… | Install / import | Reads | Writes |
|---|---|---|---|
| An Express / Fastify / NestJS service | **the adapter only** — repositories and services arrive pre-composed on `req.hiero.*` / `app.hiero.*` / DI; you never import core or mirror directly | ✓ | ✓ |
| A read-only tool, dashboard, or indexer | `@hiero-enterprise/mirror` only — no credentials needed ([smallest possible project](./samples/mirror-standalone-sample)) | ✓ | — |
| A script or worker that submits transactions | `@hiero-enterprise/core` (add `mirror` if it also reads) | opt-in | ✓ |

## Quick Start

> **Note:** These packages are not yet published to npm. The guide below shows how installation will work once they are. To run the project locally for development, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Standalone (no framework)

```bash
npm install @hiero-enterprise/core
```

```bash
npm install @hiero-enterprise/mirror   # read-only? this is the only package you need
```

Reads need no credentials at all:

```ts
import { createMirrorNodeClient, AccountRepository } from '@hiero-enterprise/mirror';

const mirror = createMirrorNodeClient({ network: 'mainnet' });
const account = await new AccountRepository(mirror).findByAccountId('0.0.800');
```

Writes go through core, with an operator account:

```ts
import { HieroContext, AccountService } from '@hiero-enterprise/core';

const context = new HieroContext({
  network: 'testnet',
  operatorId: '0.0.12345',
  operatorKey: 'your_private_key_here',
  operatorKeyType: 'ed25519',
});

const accounts = new AccountService(context);
const account = await accounts.createAccount({ publicKey: '...', initialBalance: 10 });
console.log(account.accountId);

context.close();
```

### With a framework

```bash
# Install your framework adapter 
npm install @hiero-enterprise/express
npm install @hiero-enterprise/fastify
npm install @hiero-enterprise/nest
```

Set your operator credentials as environment variables:

```bash
HIERO_NETWORK=testnet
HIERO_OPERATOR_ID=0.0.12345
HIERO_OPERATOR_KEY=your_private_key_here
HIERO_OPERATOR_KEY_TYPE=ECDSA
```

`HIERO_OPERATOR_KEY_TYPE` is **required** and tells the SDK how to parse your private key. Hiero supports multiple key algorithms and there is no reliable way to auto-detect the format from the raw key string alone. Accepted values:

| Value | Description |
|-------|-------------|
| `ECDSA` | ECDSA secp256k1 key — compatible with EVM wallets and most providers |
| `ED25519` | Ed25519 key — native Hiero key type |
| `DER` | DER-encoded key (hex with ASN.1 headers, e.g. `302e020100...`) |

Or pass config directly when registering the integration.

**Express**

```ts
import express from 'express';
import { hieroMiddleware } from '@hiero-enterprise/express';

const app = express();
app.use(hieroMiddleware());

app.get('/balance', async (req, res) => {
  const balance = await req.hiero.accountService.getOperatorAccountBalance();
  res.json(balance);
});
```

**Fastify**

```ts
import Fastify from 'fastify';
import { hieroPlugin } from '@hiero-enterprise/fastify';

const app = Fastify();
await app.register(hieroPlugin);

app.get('/balance', async () => {
  return app.hiero.accountService.getOperatorAccountBalance();
});
```

**NestJS**

```ts
import { Module } from '@nestjs/common';
import { HieroModule, AccountService } from '@hiero-enterprise/nest';

@Module({ imports: [HieroModule.forRoot()] })
export class AppModule {}

@Controller('balance')
export class BalanceController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  getBalance() {
    return this.accounts.getOperatorAccountBalance();
  }
}
```

## Architecture

```
          Express / Fastify / NestJS adapters
     req.hiero.* | fastify.hiero.* | @Inject()
              │ compose both packages │
       ┌──────┴──────────┐  ┌─────────┴──────────┐
       ▼                 ▼  ▼                    ▼
┌───────────────────────┐  ┌────────────────────────┐
│ @hiero-enterprise/core│  │@hiero-enterprise/mirror│
│  SDK write-side       │  │  REST read-side        │
│  Account / File /     │  │  9 repositories        │
│  Token / Contract /   │  │  pagination + filters  │
│  Topic / Schedule /   │  │  rate limiting, units  │
│  Network services     │  │                        │
│  HieroContext         │  │  MirrorNodeClient      │
│  deps: @hiero-ledger  │  │  deps: none (fetch)    │
└──────────┬────────────┘  └───────────┬────────────┘
           ▼ gRPC (signed txns)        ▼ REST (free reads)
                      Hiero Network
                   (testnet / mainnet)
```

`@hiero-enterprise/core` owns the SDK write-side (services, transactions, operator keys).

`@hiero-enterprise/mirror` owns the REST read-side and has **zero dependencies** — analytics consumers can install it alone, with no SDK and no credentials. 

Framework adapters compose both behind one surface. Either package also works standalone.

Writes go through the Hiero SDK — transactions that go on-chain, signed by the operator. Reads go through the mirror node, which doesn't cost fees and returns historical or indexed data.

## Services

| Service | What it covers |
|--------|---------------|
| `AccountService` | Create, update, delete, approve allowances, check balances |
| `FileService` | Store and retrieve file content on-chain |
| `TokenService` | Create, mint, burn, and transfer fungible tokens and NFTs |
| `ContractService` | Deploy and call EVM-compatible smart contracts |
| `TopicService` | Create topics, manage keys, submit messages |
| `ScheduleService` | Create and sign scheduled transactions |
| `NetworkService` | Network-level queries via the SDK client |

## Mirror Node Queries — `@hiero-enterprise/mirror`

All mirror node REST reads live in the standalone, **dependency-free**
[`@hiero-enterprise/mirror`](./packages/mirror) package — no SDK, no
operator keys, just `fetch`. It covers the **complete mirror node REST
API** (all 47 paths and 48 operations of the OpenAPI spec, including the
contracts/EVM family, `contracts/call`, and HIP-1313 fee estimation) with
typed repositories for accounts, blocks, contracts, NFTs, tokens, topics,
transactions, schedules and network state, plus:

- **Continuable pagination** — every list returns a `Page` with a bound
  `next()`; `collectAll` / `paginate` drain or stream any listing.
- **Pro-active rate limiting** — `maxConcurrent` + `maxRequestsPerSecond`
  keep large pulls under the mirror node's limits before any 429.
- **Rich filters** — `limit`/`order`, transaction type + consensus-timestamp
  windows (time-series), point-in-time reads, and balance thresholds.
- **Unit helpers** — tinybar⇄ℏ, token decimals, `Date`⇄consensus timestamps.

```ts
import { createMirrorNodeClient, TransactionRepository, collectAll } from '@hiero-enterprise/mirror';

const mirror = createMirrorNodeClient({ network: 'mainnet', mirrorNodeMaxRequestsPerSecond: 50 });
const transfers = await collectAll(
  await new TransactionRepository(mirror).find({
    transactionType: 'CRYPTOTRANSFER',
    timestamp: { gte: '1700000000.0', lt: '1700086400.0' },
  }),
  { maxPages: 10 },
);
```

See the [mirror package README](./packages/mirror/README.md) for the full
guide. Framework adapters compose core + mirror automatically, so
`req.hiero.accountRepository` etc. keep working unchanged.

## Samples

Working examples are in [`samples/`](./samples). Each one is a minimal but real service you can run against testnet.

| Sample | Framework |
|--------|-----------|
| [examples](./samples/examples) | Standalone `@hiero-enterprise/core` scripts |
| [mirror-standalone](./samples/mirror-standalone-sample) | Minimal-footprint proof: a project whose only dependency is `@hiero-enterprise/mirror` — no credentials, no build step |
| [express-sample](./samples/express-sample) | Express |
| [fastify-sample](./samples/fastify-sample) | Fastify |
| [nest-sample](./samples/nest-sample) | NestJS |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report bugs, request features, and submit pull requests. All commits require a DCO sign-off (`git commit -s`) and GPG signing.

## License

[Apache-2.0](./LICENSE)
