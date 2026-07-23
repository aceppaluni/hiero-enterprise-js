import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenMintTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTokenId", "setAmount", "setMetadata"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenMintTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenMintOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("mints fungible supply with amount", async () => {
        await service.mintToken({
            tokenId: "0.0.500",
            amount: 1_000,
        });

        const tx = vi.mocked(TokenMintTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setAmount).toHaveBeenCalledWith(1_000);
        expect(tx.setMetadata).not.toHaveBeenCalled();
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("mints NFTs with metadata entries", async () => {
        const metadata = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];

        await service.mintToken({
            tokenId: "0.0.500",
            metadata,
        });

        const tx = vi.mocked(TokenMintTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setMetadata).toHaveBeenCalledWith(metadata);
        expect(tx.setAmount).not.toHaveBeenCalled();
    });

    it("refuses to fabricate totalSupply when the receipt lacks it", async () => {
        mocks.receipt.totalSupply = null;

        try {
            await expect(
                service.mintToken({
                    tokenId: "0.0.500",
                    metadata: [new Uint8Array([1])],
                }),
            ).rejects.toThrow(/did not include totalSupply/);
        } finally {
            // The hoisted mock receipt is shared across tests — restore it.
            mocks.receipt.totalSupply = { toString: () => "1000" };
        }
    });

    it("returns the floor, plain-number serials, and total supply", async () => {
        mocks.receipt.serials = [{ toNumber: () => 7 }, { toNumber: () => 8 }];
        try {
            const result = await service.mintToken({
                tokenId: "0.0.500",
                metadata: [new Uint8Array([1])],
            });

            expect(result).toMatchObject({
                transactionId: "0.0.123@1234567890.000000000",
                status: "SUCCESS",
                serials: [7, 8],
                totalSupply: "1000",
            });
        } finally {
            // The bundle is shared across this file — don't leak serials
            // into later tests.
            mocks.receipt.serials = [];
        }
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.mintToken({
            tokenId: "0.0.500",
            amount: 5,
            transactionMemo: "mint memo",
            transactionValidDuration: 120,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenMintTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("mint memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(120);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("wraps mint in ScheduleCreateTransaction", async () => {
        const result = await service.scheduleMintToken(
            {
                tokenId: "0.0.500",
                amount: 10,
            },
            { scheduleMemo: "pending approval" },
        );

        expect(mocks.tx.schedule).toHaveBeenCalled();
        expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
            "pending approval",
        );
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("throws when both amount and metadata are missing", async () => {
        await expect(
            service.mintToken({
                tokenId: "0.0.500",
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or metadata/i);
    });

    it("throws when both amount and metadata are provided", async () => {
        const metadata = [new Uint8Array([1, 2, 3])];

        await expect(
            service.mintToken({
                tokenId: "0.0.500",
                amount: 100,
                metadata,
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or metadata/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.mintToken({
                tokenId: "",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });
});
