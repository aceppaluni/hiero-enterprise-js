/**
 * The bare contents of one page — items plus pagination links. Returned by
 * the low-level converters; most consumers use {@link Page}.
 *
 * @template T The type of items in the page
 */
export interface PageData<T> {
    /** Items in this page */
    data: T[];
    /** Pagination links */
    links: PageLinks;
    /**
     * The snapshot's consensus timestamp, on endpoints that report one
     * (`/balances`, `/tokens/{id}/balances`) — the moment the balance
     * figures describe. Absent elsewhere.
     */
    timestamp?: string | null;
}

/**
 * A paginated result from the mirror node REST API.
 *
 * Carries a bound {@link Page.next} continuation so a listing can be walked
 * without re-declaring its path or converter — drive it with the
 * `collectAll` / `paginate` helpers, or call `next()` directly.
 *
 * @template T The type of items in the page
 */
export interface Page<T> extends PageData<T> {
    /**
     * Fetch the next page, or `null` when this is the last page.
     * (A function rather than data, so it does not survive JSON
     * serialization — persist `data` / `links.next` if you need that.)
     */
    next: (() => Promise<Page<T>>) | null;
}

/**
 * Pagination links for navigating between pages.
 */
export interface PageLinks {
    /** Link to the next page (null if no more pages) */
    next: string | null;
}

/**
 * Caps for eagerly collecting every page of a paginated query
 * (`findAll*` / `collect`). Guards against unbounded memory when a result
 * set is larger than expected. Omit both to fetch everything.
 */
export interface CollectAllOptions {
    /**
     * Stop once this many items have been collected. The returned array may
     * exceed this by up to one page (the page that crosses the threshold is
     * kept whole).
     */
    readonly maxItems?: number;
    /** Stop after fetching this many pages. */
    readonly maxPages?: number;
}
