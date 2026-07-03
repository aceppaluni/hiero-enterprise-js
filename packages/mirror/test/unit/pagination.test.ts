import { describe, it, expect } from "vitest";
import { collectAll, paginate } from "../../src/pagination.js";
import type { Page } from "../../src/types/index.js";

/**
 * Build an in-memory chain of continuable pages from arrays of items — no
 * HTTP, so this exercises the helpers' walking logic in isolation.
 */
function makePages<T>(pages: T[][]): Page<T> {
    const build = (i: number): Page<T> => ({
        data: pages.at(i) ?? [],
        links: { next: i < pages.length - 1 ? `page-${i + 1}` : null },
        next: i < pages.length - 1 ? () => Promise.resolve(build(i + 1)) : null,
    });
    return build(0);
}

describe("collectAll", () => {
    it("flattens every page into one array", async () => {
        const first = makePages([[1, 2, 3], [4, 5], [6]]);
        expect(await collectAll(first)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("handles a single-page listing", async () => {
        const first = makePages([[1, 2]]);
        expect(await collectAll(first)).toEqual([1, 2]);
        expect(first.next).toBeNull();
    });

    it("stops at maxItems (keeping the crossing page whole)", async () => {
        const first = makePages([
            [1, 2],
            [3, 4],
            [5, 6],
        ]);
        // page1=2 <3 → page2 → 4 ≥3 → stop.
        expect(await collectAll(first, { maxItems: 3 })).toEqual([1, 2, 3, 4]);
    });

    it("stops at maxPages", async () => {
        const first = makePages([[1], [2], [3], [4]]);
        expect(await collectAll(first, { maxPages: 2 })).toEqual([1, 2]);
    });
});

describe("paginate", () => {
    it("yields each page in order", async () => {
        const first = makePages([[1, 2], [3, 4], [5]]);
        const seen: number[][] = [];
        for await (const page of paginate(first)) seen.push(page);
        expect(seen).toEqual([[1, 2], [3, 4], [5]]);
    });
});
