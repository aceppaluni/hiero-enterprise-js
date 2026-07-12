import type {
    Nft,
    NftTransaction,
    NftTransactionsQuery,
    AccountNftsQuery,
    TokenNftsQuery,
    Page,
} from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Repository for querying NFT data from the mirror node.
 *
 * List methods accept an optional {@link PageQuery} (`limit` / `order`) and
 * return a continuable {@link Page}; walk multiple pages with the
 * `collectAll` / `paginate` helpers, or `Page.next()` directly.
 */
export class NftRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find NFTs owned by an account — optionally filtered by collection,
     * serial-number range, or approved spender.
     */
    findByOwner(
        accountId: string,
        options?: AccountNftsQuery,
    ): Promise<Page<Nft>> {
        return this.mirrorNodeClient.queryNftsByAccount(accountId, options);
    }

    /**
     * Find all NFTs of a specific token type — optionally filtered by
     * owner or serial-number range.
     */
    findByType(tokenId: string, options?: TokenNftsQuery): Promise<Page<Nft>> {
        return this.mirrorNodeClient.queryNftsByTokenId(tokenId, options);
    }

    /**
     * Find a specific NFT by token ID and serial number.
     */
    findBySerial(tokenId: string, serialNumber: number): Promise<Nft> {
        return this.mirrorNodeClient.queryNftsByTokenIdAndSerial(
            tokenId,
            serialNumber,
        );
    }

    /**
     * An NFT serial's transaction history — mint, transfers, approvals
     * (provenance).
     */
    findTransactions(
        tokenId: string,
        serialNumber: number,
        options?: NftTransactionsQuery,
    ): Promise<Page<NftTransaction>> {
        return this.mirrorNodeClient.queryNftTransactions(
            tokenId,
            serialNumber,
            options,
        );
    }

    /**
     * Find NFTs owned by an account for a specific token type.
     */
    findByOwnerAndType(
        accountId: string,
        tokenId: string,
        options?: AccountNftsQuery,
    ): Promise<Page<Nft>> {
        return this.mirrorNodeClient.queryNftsByAccountAndTokenId(
            accountId,
            tokenId,
            options,
        );
    }
}
