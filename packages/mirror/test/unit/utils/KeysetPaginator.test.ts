import { describe, it, expect, vi } from "vitest";
import {
    KeysetPaginator,
    type KeysetBound,
    type KeysetLoad,
} from "../../../src/utils/KeysetPaginator.js";
import type { SortOrder } from "../../../src/types/index.js";

interface Row {
    key: number;
}

/**
 * A faithful in-memory stand-in for the mirror node's keyset semantics: a
 * fixed set of rows with unique numeric keys, filtered by a `{ key, operator }`
 * bound and returned sorted in the requested order, capped at `limit`. This is
 * exactly the contract a real `load` adapter fulfils over a repository method,
 * so the paginator's operator/order algebra is exercised end-to-end.
 */
function makeStore(keys: number[]): {
    load: KeysetLoad<Row, number>;
    calls: { bound: KeysetBound<number> | null; order: SortOrder }[];
} {
    const rows: Row[] = keys.map((key) => ({ key }));
    const calls: { bound: KeysetBound<number> | null; order: SortOrder }[] = [];
    const load: KeysetLoad<Row, number> = (bound, order, limit) => {
        calls.push({ bound, order });
        let matched = rows.filter((r) => {
            if (!bound) return true;
            switch (bound.operator) {
                case "gt":
                    return r.key > bound.key;
                case "gte":
                    return r.key >= bound.key;
                case "lt":
                    return r.key < bound.key;
                case "lte":
                    return r.key <= bound.key;
            }
        });
        matched = matched.sort((a, b) =>
            order === "asc" ? a.key - b.key : b.key - a.key,
        );
        return Promise.resolve(matched.slice(0, limit));
    };
    return { load, calls };
}

const keysOf = (rows: readonly Row[] | null): number[] =>
    (rows ?? []).map((r) => r.key);

describe("KeysetPaginator — descending (mirror node default)", () => {
    it("walks forward through full and partial pages", async () => {
        const { load } = makeStore([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 3,
        });

        expect(keysOf(await pager.first())).toEqual([10, 9, 8]);
        expect(pager.hasPrevious).toBe(false);
        expect(pager.hasNext).toBe(true);

        expect(keysOf(await pager.next())).toEqual([7, 6, 5]);
        expect(pager.hasPrevious).toBe(true);

        expect(keysOf(await pager.next())).toEqual([4, 3, 2]);
        expect(keysOf(await pager.next())).toEqual([1]); // partial tail
        expect(pager.hasNext).toBe(false);

        // Past the tail: no-op, window unchanged.
        expect(await pager.next()).toBeNull();
        expect(keysOf(pager.items)).toEqual([1]);
    });

    it("steps backward onto the exact pages it came from", async () => {
        const { load } = makeStore([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 3,
        });

        await pager.first(); // [10,9,8]
        await pager.next(); // [7,6,5]
        await pager.next(); // [4,3,2]

        expect(keysOf(await pager.previous())).toEqual([7, 6, 5]);
        expect(keysOf(await pager.previous())).toEqual([10, 9, 8]);
        // Landed back on a full page one — recognised exactly.
        expect(pager.hasPrevious).toBe(false);
        expect(await pager.previous()).toBeNull();
    });

    it("round-trips first -> next -> previous to the original page", async () => {
        const { load } = makeStore([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 4,
        });
        const first = keysOf(await pager.first());
        await pager.next();
        expect(keysOf(await pager.previous())).toEqual(first);
    });
});

describe("KeysetPaginator — ascending", () => {
    it("walks forward and back with inverted operators", async () => {
        const { load, calls } = makeStore([1, 2, 3, 4, 5, 6, 7]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            order: "asc",
            limit: 3,
        });

        expect(keysOf(await pager.first())).toEqual([1, 2, 3]);
        expect(keysOf(await pager.next())).toEqual([4, 5, 6]);
        // Forward in asc uses gt.
        expect(calls.at(-1)?.bound).toEqual({ key: 3, operator: "gt" });

        expect(keysOf(await pager.previous())).toEqual([1, 2, 3]);
        // Backward in asc uses lt + a desc fetch, then reversal.
        expect(calls.at(-1)).toEqual({
            bound: { key: 4, operator: "lt" },
            order: "desc",
        });
        expect(pager.hasPrevious).toBe(false);
    });
});

describe("KeysetPaginator — edges", () => {
    it("treats an empty listing as a single empty page", async () => {
        const { load } = makeStore([]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            limit: 5,
        });
        expect(keysOf(await pager.first())).toEqual([]);
        expect(pager.hasNext).toBe(false);
        expect(pager.hasPrevious).toBe(false);
        expect(await pager.next()).toBeNull();
        expect(await pager.previous()).toBeNull();
    });

    it("handles a listing smaller than one page", async () => {
        const { load } = makeStore([1, 2]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 5,
        });
        expect(keysOf(await pager.first())).toEqual([2, 1]);
        expect(pager.hasNext).toBe(false);
        expect(pager.hasPrevious).toBe(false);
    });

    it("next() before first() loads the first page", async () => {
        const { load } = makeStore([1, 2, 3]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 2,
        });
        expect(pager.isStarted).toBe(false);
        expect(keysOf(await pager.next())).toEqual([3, 2]);
        expect(pager.isStarted).toBe(true);
    });

    it("previous() before first() is a no-op", async () => {
        const { load } = makeStore([1, 2, 3]);
        const pager = new KeysetPaginator({
            load,
            keyOf: (r: Row) => r.key,
        });
        expect(await pager.previous()).toBeNull();
    });

    it("defaults to desc order and a limit of 25", async () => {
        const { load, calls } = makeStore([1, 2, 3]);
        const pager = new KeysetPaginator({ load, keyOf: (r: Row) => r.key });
        expect(pager.order).toBe("desc");
        expect(pager.limit).toBe(25);
        await pager.first();
        expect(keysOf(pager.items)).toEqual([3, 2, 1]);
        expect(calls[0]).toEqual({ bound: null, order: "desc" });
    });

    it("recognises page one again when stepping back onto the original head", async () => {
        const store = makeStore([1, 2, 3, 4, 5, 6]);
        const pager = new KeysetPaginator({
            load: store.load,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 2,
        });
        await pager.first(); // [6,5]
        await pager.next(); // [4,3]
        expect(keysOf(await pager.previous())).toEqual([6, 5]);
        expect(pager.hasPrevious).toBe(false);
    });

    it("awaits each call serially (documented non-reentrancy)", async () => {
        const { load } = makeStore([1, 2, 3, 4]);
        const spy = vi.fn(load);
        const pager = new KeysetPaginator({
            load: spy,
            keyOf: (r: Row) => r.key,
            order: "desc",
            limit: 2,
        });
        await pager.first();
        await pager.next();
        await pager.previous();
        expect(spy).toHaveBeenCalledTimes(3);
    });
});
