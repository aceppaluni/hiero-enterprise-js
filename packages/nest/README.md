# @hiero-hackers/enterprise-nest

NestJS module for Hiero. **This is the only package you install** — it
composes `@hiero-hackers/enterprise-core` (write-side SDK services) and
`@hiero-hackers/enterprise-mirror` (read-side REST repositories) and registers
everything as injectable providers. You never import core or mirror
directly; every class you inject is re-exported from this package.

```bash
npm install @hiero-hackers/enterprise-nest
```

> **Note:** not yet published to npm — see [CONTRIBUTING](../../CONTRIBUTING.md) to run from the repo.

```ts
import { Module, Controller, Get, Param } from "@nestjs/common";
import {
    HieroModule,
    AccountService,
    AccountRepository,
} from "@hiero-hackers/enterprise-nest";

@Module({ imports: [HieroModule.forRoot()] }) // env config; forRoot(config) / forRootAsync also available
export class AppModule {}

@Controller("accounts")
export class AccountsController {
    constructor(
        private readonly accounts: AccountService, //   core: writes
        private readonly accountReads: AccountRepository, // mirror: reads
    ) {}

    @Get(":id")
    get(@Param("id") id: string) {
        // mirror read: free, no credentials used
        return this.accountReads.findByAccountId(id);
    }
}
```

## Everything you can inject

**Write-side services** (from core — signed transactions, need operator
credentials, cost fees):

| Injectable class | Purpose |
| --- | --- |
| `AccountService` | Create/update/delete accounts, allowances, operator balance |
| `TokenService` | Create, mint, burn, transfer fungible tokens and NFTs |
| `TopicService` | Create topics, manage keys, submit messages |
| `FileService` | Store and retrieve file content on-chain |
| `ContractService` | Deploy and call smart contracts |
| `ScheduleService` | Create and sign scheduled transactions |

**Read-side repositories** (from mirror — REST queries, free, work
without any credentials):

| Injectable class | Covers |
| --- | --- |
| `AccountRepository` | Accounts, balances, allowances, rewards, airdrops |
| `TransactionRepository` | Transactions, transfers, time-window queries |
| `TokenRepository` | Tokens, balances, custom fees, relationships |
| `NftRepository` | NFTs by owner/collection/serial, transaction history |
| `TopicRepository` | Topics and topic messages |
| `ContractRepository` | Contracts, results, logs, state, `contracts/call` |
| `BlockRepository` | Blocks by number/hash |
| `ScheduleRepository` | Scheduled transactions |
| `NetworkRepository` | Supply, exchange rates, fees, nodes, staking |

**Plumbing tokens:** `MirrorNodeClient` (the raw REST client, for
anything the repositories don't wrap), plus the string tokens
`HIERO_CONFIG` (resolved configuration) and `HIERO_CONTEXT` (the core
`HieroContext`). Shutdown is handled via Nest's lifecycle hooks.

Method-level documentation lives with the underlying packages:
[core](../core) for services, [mirror](../mirror) for repositories —
but you inject all of it from this package; the split is an
implementation detail.

## Configuration

`HieroModule.forRoot()` with no arguments reads `HIERO_NETWORK`,
`HIERO_OPERATOR_ID`, `HIERO_OPERATOR_KEY`, `HIERO_OPERATOR_KEY_TYPE`
(and optional `HIERO_MIRROR_NODE_URL`, timeout/rate-limit variables)
from the environment. `forRoot(config)` takes one flat config object;
`forRootAsync({...})` supports factory-based configuration — the same
shape feeds both the SDK and mirror sides.

Only using reads? The repositories work without operator credentials —
but if your service never writes, consider depending on
`@hiero-hackers/enterprise-mirror` alone instead
([smallest possible project](../../samples/mirror-standalone-sample)).

A runnable service using this adapter:
[`samples/nest-sample`](../../samples/nest-sample).
