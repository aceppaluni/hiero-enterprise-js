import { MirrorError, MirrorErrorCodes } from "../errors/MirrorError.js";
import type { SortOrder } from "../types/index.js";

/**
 * Bidirectional (prev/next) pagination over the mirror node REST API.
 *
 * The mirror node paginates forward only — every list response carries an
 * opaque `links.next`, but never a `links.prev`. {@link Page.next} follows
 * that link, which is all a forward drain (`collectAll` / `paginate` in
 * `./Pagination.ts`) needs. An interactive table, though, must also step
 * **backward** — and there is no link to follow.
 *
 * `KeysetPaginator` reconstructs the missing direction with keyset (a.k.a.
 * cursor) pagination, the same technique the Hiero explorer's table
 * controllers use:
 *
 * - **Next page** — query for rows whose key is strictly past the last row
 *   shown, in the display order (`desc` → `key<last`, `asc` → `key>last`).
 * - **Previous page** — query for rows strictly before the first row shown,
 *   in the *inverted* order (`desc` → `key>first` fetched ascending), then
 *   reverse the result back into display order.
 *
 * Because it drives the query with a `{ key, operator }` bound rather than an
 * opaque link, it composes with the ordinary repository methods and their
 * {@link RangeFilter} params — you supply a thin `load` adapter that maps the
 * bound onto whichever keyset parameter the endpoint sorts by
 * (`timestamp`, `serialnumber`, `token.id`, …) and a `keyOf` that reads that
 * same field back off an item. The paginator owns the operator/order algebra;
 * you own the one-line endpoint mapping.
 *
 * Keyset pagination assumes the sort key is **unique and monotonic** per row.
 * Every mirror node pagination key is (consensus timestamp, entity ID, serial
 * number, sequence number, block height), so strict `gt`/`lt` bounds neither
 * skip nor duplicate a row across a page boundary.
 *
 * @example Bidirectional table over an account's transactions (keyed on
 * consensus timestamp):
 * ```ts
 * import { TransactionRepository, KeysetPaginator } from '@hiero-hackers/enterprise-mirror';
 *
 * const transactions = new TransactionRepository(mirror);
 * const pager = new KeysetPaginator({
 *   order: 'desc',
 *   limit: 25,
 *   keyOf: (t) => t.consensusTimestamp,
 *   load: (bound, order, limit) =>
 *     transactions
 *       .findByAccount('0.0.98', {
 *         order,
 *         limit,
 *         timestamp: bound ? { [bound.operator]: bound.key } : undefined,
 *       })
 *       .then((page) => page.data),
 * });
 *
 * const first = await pager.first();     // newest 25
 * const older = await pager.next();      // next 25, older
 * const back  = await pager.previous();  // ← back to `first` (the §3.2 gap)
 * pager.hasPrevious; // false again — we're on the first page
 * ```
 */

/** A keyset comparison operator (the strict/non-strict range bounds). */
export type KeyOperator = "gt" | "gte" | "lt" | "lte";

/**
 * A keyset cursor: fetch rows whose sort key satisfies `operator` relative to
 * `key`. Handed to a {@link KeysetLoad} adapter, which maps it onto the
 * endpoint's keyset parameter (e.g. `{ timestamp: { [operator]: key } }`).
 */
export interface KeysetBound<K extends string | number = string | number> {
    /** The boundary row's sort-key value. */
    readonly key: K;
    /** How the requested rows compare to {@link key}. */
    readonly operator: KeyOperator;
}

/**
 * Fetches up to `limit` items matching `bound` (or the first page when
 * `bound` is `null`), sorted by the endpoint's keyset field in `order`.
 * Typically a one-liner over a repository method — see the class example.
 */
export type KeysetLoad<T, K extends string | number = string | number> = (
    bound: KeysetBound<K> | null,
    order: SortOrder,
    limit: number,
) => Promise<readonly T[]>;

/** Construction options for {@link KeysetPaginator}. */
export interface KeysetPaginatorOptions<
    T,
    K extends string | number = string | number,
> {
    /** Adapter that runs one keyset query against the mirror node. */
    readonly load: KeysetLoad<T, K>;
    /**
     * Reads the keyset cursor (the value the endpoint sorts by) off an item —
     * it must be the *same* field the `load` adapter filters on.
     */
    readonly keyOf: (item: T) => K;
    /** Display sort order, fixed for the paginator's life. Default `"desc"`. */
    readonly order?: SortOrder;
    /** Page size, an integer >= 1. Default `25`. */
    readonly limit?: number;
}

const DEFAULT_LIMIT = 25;

/**
 * Stateful bidirectional cursor over one mirror node listing. Not
 * concurrency-safe: `first`/`next`/`previous` mutate the current window, so
 * await each call before the next (an interactive table clicks them serially
 * anyway).
 */
export class KeysetPaginator<T, K extends string | number = string | number> {
    /** Display sort order. */
    readonly order: SortOrder;
    /** Page size. */
    readonly limit: number;

    private readonly load: KeysetLoad<T, K>;
    private readonly keyOf: (item: T) => K;

    private window: readonly T[] = [];
    private started = false;
    private atStart = true;
    private atEnd = false;
    /**
     * The head-of-listing key captured by `first()` — the global boundary in
     * the display order (largest key for `desc`, smallest for `asc`). Lets
     * `previous()` recognise the moment it lands back on page one exactly,
     * rather than only on the following (empty) step.
     */
    private headKey: K | null = null;

    constructor(options: KeysetPaginatorOptions<T, K>) {
        this.load = options.load;
        this.keyOf = options.keyOf;
        this.order = options.order ?? "desc";

        const limit = options.limit ?? DEFAULT_LIMIT;
        // A short fetch is how `first`/`next`/`previous` detect the end of the
        // listing, so a limit below 1 would make `rows.length < limit` never
        // true and strand the paginator's boundary flags.
        if (!Number.isInteger(limit) || limit < 1) {
            throw new MirrorError(
                `limit must be an integer >= 1, got ${limit}.`,
                { code: MirrorErrorCodes.ConfigInvalid },
            );
        }
        this.limit = limit;
    }

    /** The items on the current page, in display order (empty before `first`). */
    get items(): readonly T[] {
        return this.window;
    }

    /** Whether any page has been loaded yet. */
    get isStarted(): boolean {
        return this.started;
    }

    /**
     * Whether a previous page exists — `false` on the first page.
     * Exact for a stable listing; if data changes while paging, `hasPrevious`
     * may remain `true` until a backward fetch confirms the head.
     */
    get hasPrevious(): boolean {
        return this.started && !this.atStart;
    }

    /**
     * Whether a further page exists. Exact once the tail has been reached (a
     * short or empty forward fetch); before then it is `true`.
     */
    get hasNext(): boolean {
        return !this.started || !this.atEnd;
    }

    /**
     * Load (or reload) the first page. Resets the cursor to the head of the
     * listing.
     */
    async first(): Promise<readonly T[]> {
        const rows = await this.load(null, this.order, this.limit);
        this.window = [...rows];
        this.started = true;
        this.atStart = true;
        this.atEnd = rows.length < this.limit;
        this.headKey = rows.length > 0 ? this.keyOf(rows[0] as T) : null;
        return this.window;
    }

    /**
     * Advance to the next page. Returns the new page, or `null` when the
     * current page is already the last (the window is left unchanged).
     */
    async next(): Promise<readonly T[] | null> {
        if (!this.started) {
            return this.first();
        }
        if (this.window.length === 0) {
            this.atEnd = true;
            return null;
        }
        const last = this.window[this.window.length - 1] as T;
        const operator: KeyOperator = this.order === "desc" ? "lt" : "gt";
        const rows = await this.load(
            { key: this.keyOf(last), operator },
            this.order,
            this.limit,
        );
        if (rows.length === 0) {
            this.atEnd = true;
            return null;
        }
        this.window = [...rows];
        this.atStart = false;
        this.atEnd = rows.length < this.limit;
        return this.window;
    }

    /**
     * Step back to the previous page. Returns the new page, or `null` when the
     * current page is already the first (the window is left unchanged).
     *
     * Fetches in the inverted order and reverses the result, so the returned
     * page is contiguous with — and in the same display order as — the page it
     * replaces.
     */
    async previous(): Promise<readonly T[] | null> {
        if (!this.started || this.atStart || this.window.length === 0) {
            return null;
        }
        const firstItem = this.window[0] as T;
        const operator: KeyOperator = this.order === "desc" ? "gt" : "lt";
        const invertedOrder: SortOrder = this.order === "desc" ? "asc" : "desc";
        const rows = await this.load(
            { key: this.keyOf(firstItem), operator },
            invertedOrder,
            this.limit,
        );
        if (rows.length === 0) {
            // Nothing before the current head — we were already on page one.
            this.atStart = true;
            return null;
        }
        // `rows` came back in the inverted order; restore display order.
        this.window = [...rows].reverse();
        this.atEnd = false;
        // We're back on page one either when the head-of-listing key resurfaces
        // (exact — even for a full first page) or when the fetch fell short of a
        // full page (fewer rows exist before the old head than a page holds).
        this.atStart =
            (this.headKey !== null &&
                this.keyOf(this.window[0] as T) === this.headKey) ||
            rows.length < this.limit;
        return this.window;
    }
}
