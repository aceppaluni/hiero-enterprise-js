# @hiero-enterprise/express

Express middleware for Hiero. **This is the only package you install** —
it composes `@hiero-enterprise/core` (write-side SDK services) and
`@hiero-enterprise/mirror` (read-side REST repositories) and hands you
the finished object on `req.hiero`. You never import core or mirror
directly.

```bash
npm install @hiero-enterprise/express
```

> **Note:** not yet published to npm — see [CONTRIBUTING](../../CONTRIBUTING.md) to run from the repo.

```ts
import express from "express";
import { hieroMiddleware } from "@hiero-enterprise/express";

const app = express();
app.use(hieroMiddleware()); // config from HIERO_* env vars, or pass a config object

app.get("/accounts/:id", async (req, res) => {
    // mirror read: free, no credentials used
    res.json(await req.hiero.accountRepository.findByAccountId(req.params.id));
});

app.post("/accounts", async (req, res) => {
    // core write: signed by the operator, costs fees
    res.json(await req.hiero.accountService.createAccount(req.body));
});
```

## Everything on `req.hiero`

**Write-side services** (from core — signed transactions, need operator
credentials, cost fees):

| Property | Purpose |
| --- | --- |
| `accountService` | Create/update/delete accounts, allowances, operator balance |
| `tokenService` | Create, mint, burn, transfer fungible tokens and NFTs |
| `topicService` | Create topics, manage keys, submit messages |
| `fileService` | Store and retrieve file content on-chain |
| `contractService` | Deploy and call smart contracts |
| `scheduleService` | Create and sign scheduled transactions |

**Read-side repositories** (from mirror — REST queries, free, work
without any credentials):

| Property | Covers |
| --- | --- |
| `accountRepository` | Accounts, balances, allowances, rewards, airdrops |
| `transactionRepository` | Transactions, transfers, time-window queries |
| `tokenRepository` | Tokens, balances, custom fees, relationships |
| `nftRepository` | NFTs by owner/collection/serial, transaction history |
| `topicRepository` | Topics and topic messages |
| `contractRepository` | Contracts, results, logs, state, `contracts/call` |
| `blockRepository` | Blocks by number/hash |
| `scheduleRepository` | Scheduled transactions |
| `networkRepository` | Supply, exchange rates, fees, nodes, staking |

**Plumbing:** `context` (the core `HieroContext`), `mirrorNodeClient`
(the raw REST client, for anything the repositories don't wrap), and
`close()` (release SDK channels on shutdown).

Method-level documentation lives with the underlying packages:
[core](../core) for services, [mirror](../mirror) for repositories —
but you consume all of it through `req.hiero`; the split is an
implementation detail.

## Configuration

Zero-argument `hieroMiddleware()` reads `HIERO_NETWORK`,
`HIERO_OPERATOR_ID`, `HIERO_OPERATOR_KEY`, `HIERO_OPERATOR_KEY_TYPE`
(and optional `HIERO_MIRROR_NODE_URL`, timeout/rate-limit variables)
from the environment. Alternatively pass one flat config object — the
same shape feeds both the SDK and mirror sides.

Only using reads? The repositories work without operator credentials —
but if your service never writes, consider depending on
`@hiero-enterprise/mirror` alone instead
([smallest possible project](../../samples/mirror-standalone-sample)).

A runnable service using this adapter:
[`samples/express-sample`](../../samples/express-sample).
