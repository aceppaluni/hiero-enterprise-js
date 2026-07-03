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
    /** The underlying error, when one was caught */
    public override readonly cause?: Error;

    constructor(
        message: string,
        options: {
            code?: MirrorErrorCode;
            context?: string;
            cause?: Error;
        } = {},
    ) {
        super(message);
        this.name = "MirrorError";
        this.code = options.code ?? MirrorErrorCodes.MirrorNodeError;
        this.context = options.context;
        this.cause = options.cause;
    }
}
