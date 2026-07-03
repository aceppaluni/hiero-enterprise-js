/**
 * Shared primitives used across the domain type modules.
 */

/**
 * A timestamp range as reported by the mirror node — `to` is null while
 * the record is still current.
 */
export interface EffectiveTimestampRange {
    from: string;
    to: string | null;
}
