import type { Page, CollectAllOptions } from "./types/index.js";

/**
 * Generic pagination helpers that drive any continuable {@link Page}.
 *
 * These work uniformly across every repository/client method that returns a
 * `Page` — there is no per-endpoint pagination code. Give them the first
 * page (e.g. `await nftRepository.findByOwner(id)`) and they follow
 * `Page.next()` to the end.
 */

/**
 * Collect every item across all pages into a single array, following
 * `next()` from the given first page.
 *
 * Honours optional `maxItems` / `maxPages` caps so an unexpectedly huge
 * result set can't exhaust memory; omit both to fetch everything. The first
 * page is always included, so the result may exceed `maxItems` by up to one
 * page.
 *
 * @example
 * const all = await collectAll(await nftRepository.findByOwner('0.0.5'));
 */
export async function collectAll<T>(
    first: Page<T>,
    options?: CollectAllOptions,
): Promise<T[]> {
    const out: T[] = [...first.data];
    let page: Page<T> = first;
    let pages = 1;
    while (page.next) {
        if (options?.maxItems !== undefined && out.length >= options.maxItems) {
            break;
        }
        if (options?.maxPages !== undefined && pages >= options.maxPages) {
            break;
        }
        page = await page.next();
        out.push(...page.data);
        pages++;
    }
    return out;
}

/**
 * Lazily stream pages, one page of items at a time, following `next()` from
 * the given first page. Memory-friendly for very large listings.
 *
 * @example
 * for await (const page of paginate(await topicRepository.findByTopicId(id))) {
 *   for (const msg of page) handle(msg);
 * }
 */
export async function* paginate<T>(
    first: Page<T>,
): AsyncGenerator<T[], void, unknown> {
    yield first.data;
    let page: Page<T> = first;
    while (page.next) {
        page = await page.next();
        yield page.data;
    }
}
