import { describe, it, expect } from "vitest";
import {
    TINYBAR_PER_HBAR,
    tinybarToHbar,
    hbarToTinybar,
    formatUnits,
    parseUnits,
    toConsensusTimestamp,
    fromConsensusTimestamp,
    timestampRange,
} from "../../src/units.js";

describe("HBAR conversions", () => {
    it("converts tinybars to HBAR (number and string input)", () => {
        expect(tinybarToHbar(100_000_000)).toBe(1);
        expect(tinybarToHbar("250000000")).toBe(2.5);
        expect(tinybarToHbar(0)).toBe(0);
    });

    it("converts HBAR to tinybars, rounding to whole tinybars", () => {
        expect(hbarToTinybar(1)).toBe(TINYBAR_PER_HBAR);
        expect(hbarToTinybar(2.5)).toBe(250_000_000);
        // 0.1 ℏ is not exactly representable in binary floating point;
        // rounding still lands on the exact tinybar amount.
        expect(hbarToTinybar(0.1)).toBe(10_000_000);
    });

    it("round-trips", () => {
        expect(tinybarToHbar(hbarToTinybar(1234.56789))).toBeCloseTo(
            1234.56789,
            8,
        );
    });
});

describe("token unit conversions", () => {
    it("formats a raw amount using decimals", () => {
        expect(formatUnits("2500000", 6)).toBe(2.5); // 2.5 USDC
        expect(formatUnits(7, 0)).toBe(7);
    });

    it("parses a display amount to the smallest unit", () => {
        expect(parseUnits(2.5, 6)).toBe(2_500_000);
        expect(parseUnits(0.1, 2)).toBe(10);
    });
});

describe("consensus timestamps", () => {
    it("converts a Date to seconds.nanoseconds", () => {
        expect(toConsensusTimestamp(new Date(1_700_000_000_000))).toBe(
            "1700000000.000000000",
        );
        expect(toConsensusTimestamp(1_700_000_000_123)).toBe(
            "1700000000.123000000",
        );
    });

    it("converts a consensus timestamp back to a Date", () => {
        expect(fromConsensusTimestamp("1700000000.123456789").getTime()).toBe(
            1_700_000_000_123,
        );
        // Missing nanos segment defaults to zero
        expect(fromConsensusTimestamp("1700000000").getTime()).toBe(
            1_700_000_000_000,
        );
    });

    it("round-trips at millisecond precision", () => {
        const ms = 1_712_345_678_901;
        expect(fromConsensusTimestamp(toConsensusTimestamp(ms)).getTime()).toBe(
            ms,
        );
    });
});

describe("timestampRange", () => {
    it("builds a half-open [gte, lt) window", () => {
        expect(
            timestampRange({
                from: 1_700_000_000_000,
                to: 1_700_086_400_000,
            }),
        ).toEqual({
            gte: "1700000000.000000000",
            lt: "1700086400.000000000",
        });
    });

    it("emits only the provided bounds", () => {
        expect(timestampRange({ from: 1_700_000_000_000 })).toEqual({
            gte: "1700000000.000000000",
        });
        expect(timestampRange({})).toEqual({});
    });
});
