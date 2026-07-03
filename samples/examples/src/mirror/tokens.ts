/**
 * Run this example with:
 * npx tsx samples/examples/src/mirror/tokens.ts
 *
 * End-to-end tour of TOKEN and NFT queries against the mirror node — no
 * operator credentials required.
 *
 * What it shows, in order:
 *   1. Token metadata — name, symbol, decimals, supply (and how to interpret
 *      raw supply with decimals).
 *   2. Holder threshold scan — `{ accountBalance: { gte } }` on the token
 *      balances endpoint, drained with `collectAll` and ranked client-side.
 *   3. Tokens held by an account.
 *   4. NFTs — a collection's serials, one specific serial, and (chained from
 *      that serial's owner) every NFT that owner holds.
 *   5. Provenance — that serial's full transaction history, from mint to
 *      its latest transfer or approval.
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL    default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_TOKEN_ID         default: 0.0.456858
 *   EXAMPLE_NFT_TOKEN_ID     default: 0.0.4054027
 */
import {
    MirrorNodeClient,
    TokenRepository,
    NftRepository,
    AccountRepository,
    collectAll,
} from "@hiero-enterprise/mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const tokenId = process.env["EXAMPLE_TOKEN_ID"] ?? "0.0.456858";
const nftTokenId = process.env["EXAMPLE_NFT_TOKEN_ID"] ?? "0.0.4054027";

const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 25,
});
const tokens = new TokenRepository(mirror);
const nfts = new NftRepository(mirror);

console.log(`\nToken & NFT queries example — ${mirrorUrl}\n`);

// ── 1 · token metadata ───────────────────────────────────────────
const token = await tokens.findById(tokenId);
const unit = 10 ** token.decimals;
console.log(`1 · findById("${tokenId}")`);
console.log(`    ${token.name} (${token.symbol}), type ${token.type}`);
console.log(
    `    decimals ${token.decimals} → raw total_supply ${token.totalSupply} ` +
        `= ${(Number(token.totalSupply) / unit).toLocaleString()} ${token.symbol}`,
);
console.log(`    treasury: ${token.treasuryAccountId}`);

// ── 2 · holder threshold scan + client-side ranking ─────────────
// `accountBalance` is in the token's smallest unit (here 10^decimals per
// whole token). `order` sorts by account ID, so rank by balance ourselves.
const holderQuery = {
    accountBalance: { gte: 10_000 * unit }, // holders with ≥ 10,000 tokens
    limit: 100,
} as const;
console.log(`\n2 · findHolders("${tokenId}", ${JSON.stringify(holderQuery)})`);
const holders = await collectAll(
    await tokens.findHolders(tokenId, holderQuery),
    { maxPages: 3 },
);
const ranked = [...holders].sort(
    (a, b) => Number(b.balance) - Number(a.balance),
);
console.log(
    `    scanned ${holders.length} holders ≥ 10,000 ${token.symbol} (3 pages); top 5:`,
);
for (const holder of ranked.slice(0, 5)) {
    console.log(
        `      ${holder.accountId.padEnd(14)} ${(Number(holder.balance) / unit).toLocaleString()} ${token.symbol}`,
    );
}

// ── 3 · tokens held by an account (chained from the scan) ────────
// Two complementary views: TokenRepository.findByAccountId returns token
// *metadata*; AccountRepository.findTokens returns the *amounts* held.
const accounts = new AccountRepository(mirror);
const sampleHolder = ranked[0]?.accountId ?? token.treasuryAccountId;
const held = await tokens.findByAccountId(sampleHolder, { limit: 5 });
console.log(`\n3 · findByAccountId("${sampleHolder}", { limit: 5 })`);
console.log(
    `    first ${held.data.length} tokens associated with that account:`,
);
for (const t of held.data) {
    console.log(`      ${t.tokenId.padEnd(12)} ${t.symbol}`);
}
const amounts = await accounts.findTokens(sampleHolder, { limit: 5 });
console.log(
    `    findTokens("${sampleHolder}") — amounts per token (smallest unit):`,
);
for (const t of amounts.data) {
    console.log(
        `      ${t.tokenId.padEnd(12)} ${t.balance} (${t.decimals} decimals)`,
    );
}

// ── 4 · NFTs: collection → serial → owner (all chained) ─────────
const collection = await nfts.findByType(nftTokenId, { limit: 5 });
console.log(`\n4 · findByType("${nftTokenId}", { limit: 5 })`);
console.log(
    `    ${collection.data.length} serials on the first page; more pages: ${collection.next !== null}`,
);

// `accountId` is null for burned serials — pick one that's still owned.
const first = collection.data.find(
    (serial) => !serial.deleted && serial.accountId !== null,
);
if (first?.accountId) {
    const ownerId = first.accountId;
    const nft = await nfts.findBySerial(nftTokenId, first.serialNumber);
    console.log(
        `    findBySerial(#${nft.serialNumber}) → owner ${nft.accountId ?? ownerId}, ` +
            `minted ${nft.createdTimestamp ?? "n/a"}`,
    );

    const ownerNfts = await nfts.findByOwner(ownerId, { limit: 5 });
    console.log(
        `    findByOwner("${ownerId}", { limit: 5 }) → that owner holds ` +
            `${ownerNfts.data.length}+ NFTs (more pages: ${ownerNfts.next !== null})`,
    );

    const inCollection = await nfts.findByOwnerAndType(ownerId, nftTokenId, {
        limit: 5,
    });
    console.log(
        `    findByOwnerAndType(owner, collection) → ${inCollection.data.length} of them from this collection`,
    );

    // ── 5 · provenance: the serial's transaction history ─────────
    // Oldest-first shows the lifecycle: TOKENMINT, then every transfer
    // and approval since.
    const history = await nfts.findTransactions(nftTokenId, nft.serialNumber, {
        order: "asc",
        limit: 5,
    });
    console.log(
        `\n5 · findTransactions("${nftTokenId}", ${nft.serialNumber}, { order: "asc" })`,
    );
    for (const event of history.data) {
        console.log(
            `    ${event.consensusTimestamp}  ${event.type.padEnd(16)} ` +
                `→ ${event.receiverAccountId}`,
        );
    }
} else {
    console.log(`    (collection is empty — set EXAMPLE_NFT_TOKEN_ID)`);
}
console.log();
