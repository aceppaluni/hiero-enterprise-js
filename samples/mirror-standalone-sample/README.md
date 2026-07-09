# mirror-standalone-sample

The smallest possible `@hiero-enterprise/mirror` project:

- **one dependency** — check [package.json](./package.json)
- **no credentials** — no operator account, no keys, no `.env`
- **no build step** — plain ES modules, `node src/main.js`

It reads live mainnet data: released supply, the network exchange
rate, the staking reward pool balance, and the latest transfers.

```bash
pnpm install
pnpm start
```

For the full tour of the mirror API (pagination, filters, time series,
rate limiting, error handling), see the typed gallery in
[`samples/examples/src/mirror/`](../examples/src/mirror) and the
[mirror package README](../../packages/mirror/README.md).
