import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountId,
    Hbar,
    PrivateKey,
    TokenId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "addHbarTransfer",
        "addTokenTransfer",
        "addTokenTransferWithDecimals",
        "addNftTransfer",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TransferTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TransferOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

    // HBAR transfers
    describe("transferHbar", () => {
        it("returns the transaction id and status (#134)", async () => {
            const result = await service.transferHbar("0.0.200", 5, "0.0.100");

            expect(result).toEqual({
                transactionId: expect.any(String),
                status: "SUCCESS",
            });
        });

        it("emits two addHbarTransfer calls: negated sender, positive receiver", async () => {
            await service.transferHbar("0.0.200", 5, "0.0.100");

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addHbarTransfer).toHaveBeenCalledTimes(2);

            const senderCall = tx.addHbarTransfer.mock.calls[0];
            expect(senderCall[0]).toBe("0.0.100");
            expect(senderCall[1]).toBeInstanceOf(Hbar);
            expect(senderCall[1].toBigNumber().toNumber()).toBe(-5);

            const receiverCall = tx.addHbarTransfer.mock.calls[1];
            expect(receiverCall[0]).toBe("0.0.200");
            expect(receiverCall[1]).toBeInstanceOf(Hbar);
            expect(receiverCall[1].toBigNumber().toNumber()).toBe(5);
        });

        it("forwards a caller-supplied Hbar amount untouched", async () => {
            const amount = new Hbar(7);
            await service.transferHbar("0.0.200", amount, "0.0.100");

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addHbarTransfer.mock.calls[1][1]).toBeInstanceOf(Hbar);
            expect(
                tx.addHbarTransfer.mock.calls[1][1].toBigNumber().toNumber(),
            ).toBe(7);
        });

        it("accepts AccountId instances for sender and receiver", async () => {
            const sender = AccountId.fromString("0.0.100");
            const receiver = AccountId.fromString("0.0.200");
            await service.transferHbar(receiver, 1, sender);

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addHbarTransfer.mock.calls[0][0]).toBe(sender);
            expect(tx.addHbarTransfer.mock.calls[1][0]).toBe(receiver);
        });

        it("forwards additionalSigners to tx.sign", async () => {
            const senderKey = PrivateKey.generateED25519();
            await service.transferHbar("0.0.200", 5, "0.0.100", {
                additionalSigners: [senderKey],
            });

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(senderKey);
        });

        it("rejects when sender equals receiver", async () => {
            await expect(
                service.transferHbar("0.0.100", 5, "0.0.100"),
            ).rejects.toThrow(/must be different/);
        });

        it("rejects when amount is zero", async () => {
            await expect(
                service.transferHbar("0.0.200", 0, "0.0.100"),
            ).rejects.toThrow(/amount must be positive/);
        });

        it("rejects when amount is negative", async () => {
            await expect(
                service.transferHbar("0.0.200", -1, "0.0.100"),
            ).rejects.toThrow(/amount must be positive/);
        });
    });

    describe("scheduleTransferHbar", () => {
        it("returns the scheduleId from the receipt", async () => {
            const result = await service.scheduleTransferHbar(
                "0.0.200",
                5,
                "0.0.100",
            );

            expect(mocks.tx.schedule).toHaveBeenCalledTimes(1);
            expect(result.scheduleId).toBe("0.0.777");
        });

        it("forwards schedule-specific options (payer, adminKey, memo)", async () => {
            const adminKey = PrivateKey.generateED25519();
            await service.scheduleTransferHbar("0.0.200", 5, "0.0.100", {
                payerAccountId: "0.0.999",
                adminKey,
                scheduleMemo: "rent",
            });

            expect(mocks.scheduleTx.setPayerAccountId).toHaveBeenCalledTimes(1);
            const payerArg =
                mocks.scheduleTx.setPayerAccountId.mock.calls[0][0];
            expect(payerArg.toString()).toBe("0.0.999");
            expect(mocks.scheduleTx.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "rent",
            );
        });

        it("does not pass schedule options into the inner transaction", async () => {
            await service.scheduleTransferHbar("0.0.200", 5, "0.0.100", {
                payerAccountId: "0.0.999",
                scheduleMemo: "rent",
                maxTransactionFee: 3,
            });

            // The base setTransactionMemo on the inner tx should NOT receive
            // the schedule memo — that goes to setScheduleMemo on scheduleTx.
            expect(mocks.tx.setTransactionMemo).not.toHaveBeenCalledWith(
                "rent",
            );
        });
    });

    // Fungible token transfers
    describe("transferToken", () => {
        it("uses addTokenTransfer (no decimals) by default", async () => {
            await service.transferToken("0.0.456", "0.0.200", 100, "0.0.100");

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addTokenTransfer).toHaveBeenCalledTimes(2);
            expect(tx.addTokenTransfer).toHaveBeenNthCalledWith(
                1,
                "0.0.456",
                "0.0.100",
                -100,
            );
            expect(tx.addTokenTransfer).toHaveBeenNthCalledWith(
                2,
                "0.0.456",
                "0.0.200",
                100,
            );
            expect(tx.addTokenTransferWithDecimals).not.toHaveBeenCalled();
        });

        it("uses addTokenTransferWithDecimals when expectedDecimals is set", async () => {
            await service.transferToken("0.0.456", "0.0.200", 100, "0.0.100", {
                expectedDecimals: 6,
            });

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addTokenTransferWithDecimals).toHaveBeenCalledTimes(2);
            expect(tx.addTokenTransferWithDecimals).toHaveBeenNthCalledWith(
                1,
                "0.0.456",
                "0.0.100",
                -100,
                6,
            );
            expect(tx.addTokenTransferWithDecimals).toHaveBeenNthCalledWith(
                2,
                "0.0.456",
                "0.0.200",
                100,
                6,
            );
            expect(tx.addTokenTransfer).not.toHaveBeenCalled();
        });

        it("accepts TokenId and AccountId instances", async () => {
            const tokenId = TokenId.fromString("0.0.456");
            const sender = AccountId.fromString("0.0.100");
            const receiver = AccountId.fromString("0.0.200");

            await service.transferToken(tokenId, receiver, 50, sender);

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addTokenTransfer).toHaveBeenNthCalledWith(
                1,
                tokenId,
                sender,
                -50,
            );
            expect(tx.addTokenTransfer).toHaveBeenNthCalledWith(
                2,
                tokenId,
                receiver,
                50,
            );
        });

        it("rejects non-integer amount", async () => {
            await expect(
                service.transferToken("0.0.456", "0.0.200", 1.5, "0.0.100"),
            ).rejects.toThrow(/amount must be a safe integer/);
        });

        it("rejects when sender equals receiver", async () => {
            await expect(
                service.transferToken("0.0.456", "0.0.100", 100, "0.0.100"),
            ).rejects.toThrow(/must be different/);
        });

        it("rejects when expectedDecimals is negative", async () => {
            await expect(
                service.transferToken("0.0.456", "0.0.200", 100, "0.0.100", {
                    expectedDecimals: -1,
                }),
            ).rejects.toThrow(/expectedDecimals cannot be negative/);
        });
    });

    describe("scheduleTransferToken", () => {
        it("returns the scheduleId and forwards schedule options", async () => {
            const result = await service.scheduleTransferToken(
                "0.0.456",
                "0.0.200",
                100,
                "0.0.100",
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "subscription",
                },
            );

            expect(result.scheduleId).toBe("0.0.777");
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "subscription",
            );
        });

        it("preserves expectedDecimals in the scheduled inner transaction", async () => {
            await service.scheduleTransferToken(
                "0.0.456",
                "0.0.200",
                100,
                "0.0.100",
                { expectedDecimals: 8 },
            );

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addTokenTransferWithDecimals).toHaveBeenCalledTimes(2);
        });
    });

    // NFT transfers
    describe("transferNft", () => {
        it("calls addNftTransfer with NftId built from tokenId and serial", async () => {
            await service.transferNft("0.0.789", 7, "0.0.200", "0.0.100");

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.addNftTransfer).toHaveBeenCalledTimes(1);

            const [nftIdArg, sender, receiver] =
                tx.addNftTransfer.mock.calls[0];
            expect(nftIdArg.tokenId.toString()).toBe("0.0.789");
            expect(nftIdArg.serial.toNumber()).toBe(7);
            expect(sender).toBe("0.0.100");
            expect(receiver).toBe("0.0.200");
        });

        it("accepts a TokenId instance for tokenId", async () => {
            const tokenId = TokenId.fromString("0.0.789");
            await service.transferNft(tokenId, 1, "0.0.200", "0.0.100");

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            const [nftIdArg] = tx.addNftTransfer.mock.calls[0];
            expect(nftIdArg.tokenId.toString()).toBe("0.0.789");
        });

        it("forwards additionalSigners to tx.sign", async () => {
            const senderKey = PrivateKey.generateED25519();
            await service.transferNft("0.0.789", 1, "0.0.200", "0.0.100", {
                additionalSigners: [senderKey],
            });

            const tx = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(tx.sign).toHaveBeenCalledWith(senderKey);
        });

        it("rejects when serial is zero", async () => {
            await expect(
                service.transferNft("0.0.789", 0, "0.0.200", "0.0.100"),
            ).rejects.toThrow(/serial must be positive/);
        });

        it("rejects when serial is fractional", async () => {
            await expect(
                service.transferNft("0.0.789", 1.5, "0.0.200", "0.0.100"),
            ).rejects.toThrow(/serial must be a safe integer/);
        });

        it("rejects when sender equals receiver", async () => {
            await expect(
                service.transferNft("0.0.789", 1, "0.0.100", "0.0.100"),
            ).rejects.toThrow(/must be different/);
        });
    });

    describe("scheduleTransferNft", () => {
        it("returns the scheduleId and forwards schedule options", async () => {
            const result = await service.scheduleTransferNft(
                "0.0.789",
                1,
                "0.0.200",
                "0.0.100",
                { scheduleMemo: "nft handoff" },
            );

            expect(result.scheduleId).toBe("0.0.777");
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "nft handoff",
            );
        });
    });
});
