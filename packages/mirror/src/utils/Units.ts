import type { TimestampRange } from "../types/index.js";

/**
 * Unit and timestamp conversion helpers for mirror node data.
 *
 * The mirror node reports HBAR in tinybars, token amounts in each token's
 * smallest unit, and times as `seconds.nanoseconds` consensus timestamps.
 * These pure helpers convert to and from display-friendly values so
 * consumers stop hand-rolling `/ 100_000_000` and `10 ** decimals` math.
 *
 * Precision note: conversions go through JavaScript `number`, which is
 * exact up to 2^53 (≈ 90 petabar / amounts below ~9e15 smallest units).
 * Beyond that, favour keeping the raw string and formatting only for
 * display — the relative error stays around 1e-16.
 */

/** Tinybars per HBAR. */
export const TINYBAR_PER_HBAR = 100_000_000;

/** Convert tinybars (number or raw mirror-node string) to HBAR. */
export function tinybarToHbar(tinybar: number | string): number {
    return Number(tinybar) / TINYBAR_PER_HBAR;
}

/** Convert HBAR to tinybars (rounded to the nearest whole tinybar). */
export function hbarToTinybar(hbar: number): number {
    return Math.round(hbar * TINYBAR_PER_HBAR);
}

/**
 * Convert a raw token amount (in the token's smallest unit) to its display
 * value using the token's `decimals` — e.g. `formatUnits("2500000", 6)`
 * → `2.5` USDC.
 */
export function formatUnits(amount: number | string, decimals: number): number {
    return Number(amount) / 10 ** decimals;
}

/**
 * Convert a display value to the token's smallest unit — e.g.
 * `parseUnits(2.5, 6)` → `2500000`. Rounded to the nearest whole unit.
 */
export function parseUnits(amount: number, decimals: number): number {
    return Math.round(amount * 10 ** decimals);
}

/**
 * Convert a `Date` (or Unix epoch milliseconds) to a mirror node consensus
 * timestamp string — `"seconds.nanoseconds"` with nine nanosecond digits.
 */
export function toConsensusTimestamp(when: Date | number): string {
    const ms = when instanceof Date ? when.getTime() : when;
    const seconds = Math.floor(ms / 1000);
    const nanos = Math.round((ms - seconds * 1000) * 1_000_000);
    return `${seconds}.${String(nanos).padStart(9, "0")}`;
}

/**
 * Convert a mirror node consensus timestamp (`"seconds.nanoseconds"`) to a
 * `Date`. Sub-millisecond precision is truncated.
 */
export function fromConsensusTimestamp(timestamp: string): Date {
    const [seconds, nanos = "0"] = timestamp.split(".");
    const ms =
        Number(seconds) * 1000 +
        Math.floor(Number(nanos.padEnd(9, "0")) / 1_000_000);
    return new Date(ms);
}

/**
 * Build a half-open consensus-timestamp window `[from, to)` from `Date`s or
 * epoch milliseconds — the ergonomic way to express time-series buckets:
 *
 * @example
 * repo.find({
 *   transactionType: "CRYPTOTRANSFER",
 *   timestamp: timestampRange({ from: dayStart, to: dayEnd }),
 * });
 */
export function timestampRange(window: {
    from?: Date | number;
    to?: Date | number;
}): TimestampRange {
    return {
        ...(window.from !== undefined && {
            gte: toConsensusTimestamp(window.from),
        }),
        ...(window.to !== undefined && {
            lt: toConsensusTimestamp(window.to),
        }),
    };
}
