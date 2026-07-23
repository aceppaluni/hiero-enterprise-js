import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenAssociateTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setAccountId", "setTokenIds"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenAssociateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenAssociateOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("associates a token to an account", async () => {
        await service.associateToken({
            accountId: "0.0.700",
            tokenId: "0.0.500",
        });

        const tx = vi.mocked(TokenAssociateTransaction).mock.results[0].value;
        expect(tx.setAccountId).toHaveBeenCalledWith("0.0.700");
        expect(tx.setTokenIds).toHaveBeenCalledWith(["0.0.500"]);
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.associateToken({
            accountId: "0.0.700",
            tokenId: "0.0.500",
            transactionMemo: "associate memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenAssociateTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("associate memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("wraps association in ScheduleCreateTransaction", async () => {
        const result = await service.scheduleAssociateToken(
            {
                accountId: "0.0.700",
                tokenId: "0.0.500",
            },
            { scheduleMemo: "pending approval" },
        );

        expect(mocks.tx.schedule).toHaveBeenCalled();
        expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
            "pending approval",
        );
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.associateToken({
                accountId: "",
                tokenId: "0.0.500",
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.associateToken({
                accountId: "0.0.700",
                tokenId: "",
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });
});
