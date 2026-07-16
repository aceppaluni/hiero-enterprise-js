/**
 * Machine-readable error codes for mirror node failures.
 */
export const MirrorErrorCodes = {
    ConfigInvalid: "CONFIG_INVALID",
    MirrorNodeError: "MIRROR_NODE_ERROR",
    MirrorNodeHttpError: "MIRROR_NODE_HTTP_ERROR",
    MirrorNodeSchemaMismatch: "MIRROR_NODE_SCHEMA_MISMATCH",
    NotFound: "NOT_FOUND",
    TimedOut: "TIMED_OUT",
} as const;

export type MirrorErrorCode =
    (typeof MirrorErrorCodes)[keyof typeof MirrorErrorCodes];

/**
 * Error thrown by the mirror node client and repositories.
 *
 * Deliberately distinct from core's `HieroError`: an `instanceof` check
 * tells you which subsystem (mirror REST vs. SDK) failed.
 */
export class MirrorError extends Error {
    /** Machine-readable error code */
    public readonly code: MirrorErrorCode;
    /** Operation context, e.g. the request path */
    public readonly context?: string;
    /**
     * HTTP status, when the failure was an HTTP response. Absent for config,
     * timeout, and schema errors, which never had one.
     *
     * For the common "does it exist?" case you rarely need this: a 404 is
     * thrown with {@link MirrorErrorCodes.NotFound}, and {@link orNull} turns
     * that rejection into `null`. `status` is for the rest — distinguishing a
     * 400 (bad request) from a 409 (conflict), logging, metrics — where the
     * alternative is parsing the number back out of `message`.
     */
    public readonly status?: number;
    /** The underlying error, when one was caught */
    public override readonly cause?: Error;

    constructor(
        message: string,
        options: {
            code?: MirrorErrorCode;
            context?: string;
            status?: number;
            cause?: Error;
        } = {},
    ) {
        super(message);
        this.name = "MirrorError";
        this.code = options.code ?? MirrorErrorCodes.MirrorNodeError;
        this.context = options.context;
        this.status = options.status;
        this.cause = options.cause;
    }
}

/**
 * Resolve a lookup to `null` when the entity does not exist, instead of
 * rejecting.
 *
 * Absence is a normal answer from a mirror node, not a failure: a caller
 * asking about an entity that may not exist usually wants `null`, not a
 * throw. Every "no such entity" rejection carries
 * {@link MirrorErrorCodes.NotFound} — whether it came back as an HTTP 404 or
 * as an empty listing — so this converts exactly those, and re-throws
 * everything else (timeouts, rate limits, schema mismatches) untouched.
 *
 * Composes with any repository method rather than each repository growing an
 * `…OrNull` twin:
 *
 * @example
 * const account = await orNull(accounts.findAccount("0.0.98"));
 * if (account === null) {
 *     // never existed (or not yet imported by this mirror node)
 * }
 */
export async function orNull<T>(lookup: Promise<T>): Promise<T | null> {
    try {
        return await lookup;
    } catch (err) {
        if (
            err instanceof MirrorError &&
            err.code === MirrorErrorCodes.NotFound
        ) {
            return null;
        }
        throw err;
    }
}
