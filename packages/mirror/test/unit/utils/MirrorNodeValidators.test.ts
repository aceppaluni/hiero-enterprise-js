import { describe, it, expect } from "vitest";
import {
    assertPageResponse,
    assertAccountResponse,
    assertNftResponse,
    assertTokenResponse,
    assertTopicMessageResponse,
    assertTransactionListResponse,
    assertTransactionResponse,
    assertExchangeRatesResponse,
    assertNetworkSupplyResponse,
    assertNetworkStakeResponse,
} from "../../../src/utils/MirrorNodeValidators.js";
import { MirrorError } from "../../../src/errors/MirrorError.js";

describe("mirror node response validators", () => {
    it("accept well-formed payloads", () => {
        expect(() => assertPageResponse({ items: [] }, "/p")).not.toThrow();
        expect(() =>
            assertAccountResponse({ account: "0.0.1" }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertNftResponse({ token_id: "0.0.5", serial_number: 1 }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertTokenResponse({ token_id: "0.0.5" }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertTopicMessageResponse(
                { topic_id: "0.0.7", sequence_number: 1 },
                "/p",
            ),
        ).not.toThrow();
        expect(() =>
            assertTransactionListResponse({ transactions: [] }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertTransactionResponse({ transaction_id: "x" }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertExchangeRatesResponse(
                { current_rate: {}, next_rate: {} },
                "/p",
            ),
        ).not.toThrow();
        expect(() =>
            assertNetworkSupplyResponse(
                { released_supply: "1", total_supply: "2" },
                "/p",
            ),
        ).not.toThrow();
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: 1 }, "/p"),
        ).not.toThrow();
    });

    it("reject malformed payloads with MirrorError schema mismatches", () => {
        const cases: Array<() => void> = [
            () => assertPageResponse({ links: {} }, "/p"),
            () => assertPageResponse(null, "/p"),
            () => assertAccountResponse({}, "/p"),
            () => assertNftResponse({ token_id: "0.0.5" }, "/p"),
            () => assertTokenResponse({ name: "T" }, "/p"),
            () => assertTopicMessageResponse({ topic_id: "0.0.7" }, "/p"),
            () => assertTransactionListResponse({}, "/p"),
            () => assertTransactionResponse({}, "/p"),
            () => assertExchangeRatesResponse({ current_rate: {} }, "/p"),
            () => assertNetworkSupplyResponse({ released_supply: "1" }, "/p"),
            () => assertNetworkStakeResponse({}, "/p"),
            () => assertAccountResponse([1, 2], "/p"),
        ];
        for (const attempt of cases) {
            expect(attempt).toThrow(MirrorError);
        }
    });
});
