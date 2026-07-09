import { describe, it, expect, afterEach, vi } from "vitest";
import { RequestGate, DEFAULT_MAX_CONCURRENT } from "../../src/RequestGate.js";
import { MirrorError, MirrorErrorCodes } from "../../src/MirrorError.js";

/** Flush the microtask + macrotask queue (real timers). */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("RequestGate validation", () => {
    it("rejects maxConcurrent below 1", () => {
        const err = (() => {
            try {
                new RequestGate({ maxConcurrent: 0 });
            } catch (e) {
                return e;
            }
        })();
        expect(err).toBeInstanceOf(MirrorError);
        expect((err as MirrorError).code).toBe(MirrorErrorCodes.ConfigInvalid);
    });

    it("rejects a negative maxConcurrent", () => {
        expect(() => new RequestGate({ maxConcurrent: -1 })).toThrow(
            MirrorError,
        );
    });

    it("rejects a non-integer maxConcurrent", () => {
        expect(() => new RequestGate({ maxConcurrent: 2.5 })).toThrow(
            /maxConcurrent/,
        );
    });

    it("allows Infinity to disable the cap", () => {
        expect(
            () => new RequestGate({ maxConcurrent: Infinity }),
        ).not.toThrow();
    });

    it("rejects a non-positive maxRequestsPerSecond", () => {
        expect(() => new RequestGate({ maxRequestsPerSecond: 0 })).toThrow(
            /maxRequestsPerSecond/,
        );
        expect(() => new RequestGate({ maxRequestsPerSecond: -5 })).toThrow(
            MirrorError,
        );
    });

    it("defaults maxConcurrent to DEFAULT_MAX_CONCURRENT", () => {
        // 25 > any small burst, so nothing queues at the default.
        const gate = new RequestGate();
        expect(DEFAULT_MAX_CONCURRENT).toBe(25);
        expect(gate.queued).toBe(0);
    });
});

describe("RequestGate concurrency", () => {
    it("caps in-flight work and queues the remainder", async () => {
        const gate = new RequestGate({ maxConcurrent: 2 });
        const releasers: Array<() => void> = [];
        const task = () =>
            new Promise<void>((resolve) => releasers.push(resolve));

        const all = Promise.all([
            gate.run(task),
            gate.run(task),
            gate.run(task),
            gate.run(task),
        ]);

        await tick();
        expect(gate.inFlight).toBe(2);
        expect(gate.queued).toBe(2);

        // Finishing one lets exactly one queued task start.
        releasers.shift()!();
        await tick();
        expect(gate.inFlight).toBe(2);
        expect(gate.queued).toBe(1);

        while (releasers.length > 0) {
            releasers.shift()!();
            await tick();
        }
        await all;
        expect(gate.inFlight).toBe(0);
        expect(gate.queued).toBe(0);
    });

    it("releases the slot even when the task throws", async () => {
        const gate = new RequestGate({ maxConcurrent: 1 });
        await expect(
            gate.run(() => Promise.reject(new Error("boom"))),
        ).rejects.toThrow("boom");
        expect(gate.inFlight).toBe(0);

        // Gate is still usable after a failure.
        await expect(gate.run(() => Promise.resolve(42))).resolves.toBe(42);
        expect(gate.inFlight).toBe(0);
    });
});

describe("RequestGate rate spacing", () => {
    afterEach(() => vi.useRealTimers());

    it("spaces starts by 1000/maxRequestsPerSecond ms", async () => {
        vi.useFakeTimers();
        const gate = new RequestGate({ maxRequestsPerSecond: 100 }); // 10ms
        const starts: number[] = [];
        const runOne = () =>
            gate.run(() => {
                starts.push(Date.now());
                return Promise.resolve();
            });

        const all = Promise.all([
            runOne(),
            runOne(),
            runOne(),
            runOne(),
            runOne(),
        ]);
        await vi.advanceTimersByTimeAsync(40);
        await all;

        expect(starts).toHaveLength(5);
        const gaps = starts
            .slice(1)
            .map((start, index) => start - (starts.at(index) ?? 0));
        expect(gaps).toEqual([10, 10, 10, 10]);
    });
});
