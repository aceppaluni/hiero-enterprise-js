# @hiero-hackers/enterprise-core

The write side of Hiero for Node.js: typed services over the SDK for
transactions that go on-chain — signed by your operator account,
carrying fees. The read side (free mirror node REST queries) lives in
[`@hiero-hackers/enterprise-mirror`](../mirror); if you're building an
Express/Fastify/NestJS service, install the
[framework adapter](../../README.md#which-package-do-i-install)
instead and receive both sides pre-composed.

```bash
npm install @hiero-hackers/enterprise-core
```

> **Note:** not yet published to npm — see [CONTRIBUTING](../../CONTRIBUTING.md) to run from the repo.

```ts
import { HieroContext, AccountService } from "@hiero-hackers/enterprise-core";

const context = new HieroContext({
    network: "testnet",
    operatorId: "0.0.12345",
    operatorKey: "your_private_key_here",
    operatorKeyType: "ed25519",
});

const accounts = new AccountService(context);
const account = await accounts.createAccount({
    publicKey: "...",
    initialBalance: 10,
});

context.close();
```

## Services

| Service | What it covers |
| --- | --- |
| `AccountService` | Create, update, delete accounts; allowances; balances |
| `TokenService` | Create, mint, burn, transfer fungible tokens and NFTs |
| `TopicService` | Create topics, manage keys, submit messages |
| `FileService` | Store and retrieve file content on-chain |
| `ContractService` | Deploy and call EVM-compatible smart contracts |
| `ScheduleService` | Create and sign scheduled transactions |
| `NetworkService` | Network-level queries via the SDK client |

Every service takes the same `HieroContext`, which owns the SDK client,
operator identity, and connection lifecycle (`close()` releases gRPC
channels).

## Configuration

Construct `HieroContext` with a config object (as above) or with no
arguments to read the environment: `HIERO_NETWORK`,
`HIERO_OPERATOR_ID`, `HIERO_OPERATOR_KEY`, and `HIERO_OPERATOR_KEY_TYPE`
(`ed25519` | `ecdsa` | `der` — required, since key algorithms cannot be
reliably auto-detected from the raw key string).

Runnable examples for every service:
[`samples/examples`](../../samples/examples).
