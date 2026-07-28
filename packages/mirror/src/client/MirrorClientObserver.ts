import type { MirrorErrorCode } from "../errors/MirrorError.js";

/** Mutable per-request counters threaded through the retry loop. */
export interface RequestTelemetry {
    attempts: number;
    status: number | undefined;
}

/**
 * Read-only telemetry from the client's request pipeline (#145).
 *
 * The client owns queueing (`RequestGate`) and retry/backoff internally, so
 * a caller sees only a promise that eventually settles. An observer restores
 * visibility for UI consumers: a global loading indicator counts
 * start/end pairs (queue time included), a status banner distinguishes
 * "network busy, retrying" (`onRetry`) from a terminal failure
 * (`onRequestEnd` with an `errorCode`).
 *
 * **This is telemetry, not middleware.** Observers receive plain data and
 * cannot mutate requests; header injection or interception is explicitly
 * out of scope. Callbacks are invoked synchronously, are not awaited, and
 * are error-isolated — a throwing observer never affects the request.
 *
 * Relationship to core's `TransactionListener`: the same before/after
 * philosophy applied to reads, with two deliberate differences. Callbacks
 * here are error-isolated by contract (a listener bug cannot corrupt a
 * request), and there is a single observer configured at construction
 * rather than a mutable listener list — the client is cheap to rebuild
 * (UI apps already rebuild it per network switch), and widening to a list
 * later is non-breaking while narrowing never is.
 */
export interface MirrorClientObserver {
    /**
     * A logical request entered the client — fired before rate-limit
     * queueing and the first attempt, so "busy" state covers queue time.
     * Balanced 1:1 with {@link onRequestEnd}.
     */
    onRequestStart?(event: MirrorRequestStartEvent): void;

    /**
     * An attempt failed (429/5xx/timeout) and the client will retry after
     * `delayMs` — the signal that lets a UI say "network busy" instead of
     * showing a frozen spinner.
     */
    onRetry?(event: MirrorRetryEvent): void;

    /**
     * The logical request settled, successfully or not. Fires exactly once
     * per {@link onRequestStart}, on every **transport** outcome — success,
     * HTTP error, timeout, or an unreadable body.
     *
     * Scope: the bracket covers the transport pipeline (queueing, HTTP
     * attempts, body read and parse) and is balanced with the transport's
     * own promise. Schema validation runs *after* it, in the query
     * methods — a payload that arrives but fails validation therefore ends
     * as a transport success carrying its HTTP status, even though the
     * query method's promise then rejects. `errorCode` present means the
     * wire request itself failed, nothing more.
     */
    onRequestEnd?(event: MirrorRequestEndEvent): void;
}

/** See {@link MirrorClientObserver.onRequestStart}. */
export interface MirrorRequestStartEvent {
    /** Request path + query, e.g. `"/api/v1/accounts/0.0.2"`. */
    readonly path: string;
}

/** See {@link MirrorClientObserver.onRetry}. */
export interface MirrorRetryEvent {
    /** Request path + query. */
    readonly path: string;
    /** 1-based number of the attempt that just failed. */
    readonly attempt: number;
    /** Milliseconds the client will wait before the next attempt. */
    readonly delayMs: number;
    /** HTTP status of the failed attempt (429/5xx); absent on a timeout. */
    readonly status?: number;
}

/** See {@link MirrorClientObserver.onRequestEnd}. */
export interface MirrorRequestEndEvent {
    /** Request path + query. */
    readonly path: string;
    /** Milliseconds from {@link MirrorClientObserver.onRequestStart} to settle — includes queue time and retries. */
    readonly durationMs: number;
    /** Total HTTP attempts made (1 when nothing was retried). */
    readonly attempts: number;
    /**
     * Final HTTP status, when a response arrived — also set on failures
     * (`404`, and errors thrown after a response, e.g. an unreadable body).
     */
    readonly status?: number;
    /**
     * Present exactly when the transport promise rejected: the thrown
     * `MirrorError`'s code, or `MIRROR_NODE_ERROR` for non-`MirrorError`
     * throws. Absent ⇔ transport success.
     */
    readonly errorCode?: MirrorErrorCode;
}

/**
 * Invoke one observer callback with full error isolation: observer bugs
 * must never affect the request they are watching.
 */
export function notifyObserver<E>(
    handler: ((event: E) => void) | undefined,
    event: E,
): void {
    if (!handler) return;
    try {
        handler(event);
    } catch {
        // Deliberately swallowed — see the function contract above.
    }
}
