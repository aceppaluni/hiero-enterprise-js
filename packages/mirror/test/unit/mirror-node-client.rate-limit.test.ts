import { describe, it, expect, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../src/MirrorNodeClient.js";
import { MirrorError } from "../../src/MirrorError.js";
import { jsonResponse } from "../utils/http.js";

function accountResponse(): Response {
    return jsonResponse({
        account: "0.0.1",
        balance: { balance: 0, tokens: [] },
    });
}

describe("MirrorNodeClient concurrency limiter (integration)", () => {
    afterEach(() => vi.restoreAllMocks());

    it("never exceeds maxConcurrent in-flight requests", async () => {
        const client = new MirrorNodeClient("https://x", { maxConcurrent: 2 });
        let active = 0;
        let maxActive = 0;
        const releasers: Array<() => void> = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            active++;
            maxActive = Math.max(maxActive, active);
            return new Promise<Response>((resolve) => {
                releasers.push(() => {
                    active--;
                    resolve(accountResponse());
                });
            });
        });

        const all = Promise.all([
            client.queryAccount("0.0.1"),
            client.queryAccount("0.0.2"),
            client.queryAccount("0.0.3"),
            client.queryAccount("0.0.4"),
        ]);

        // Only the first two may start; the rest are queued.
        await new Promise((r) => setTimeout(r, 5));
        expect(active).toBe(2);
        expect(maxActive).toBe(2);

        // Draining one slot lets the next queued request start.
        while (releasers.length > 0) {
            releasers.shift()!();
            await new Promise((r) => setTimeout(r, 1));
        }

        await all;
        expect(maxActive).toBe(2);
    });

    it("does not serialize requests under the default cap", async () => {
        // No options → default maxConcurrent 25, no rate spacing.
        const client = new MirrorNodeClient("https://x");
        let active = 0;
        let maxActive = 0;
        const releasers: Array<() => void> = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            active++;
            maxActive = Math.max(maxActive, active);
            return new Promise<Response>((resolve) => {
                releasers.push(() => {
                    active--;
                    resolve(accountResponse());
                });
            });
        });

        const all = Promise.all(
            Array.from({ length: 5 }, (_, i) =>
                client.queryAccount(`0.0.${i}`),
            ),
        );
        await new Promise((r) => setTimeout(r, 5));
        expect(maxActive).toBe(5);

        releasers.forEach((r) => r());
        await all;
    });

    it("surfaces invalid rate-limit config from the constructor", () => {
        expect(
            () => new MirrorNodeClient("https://x", { maxConcurrent: 0 }),
        ).toThrow(MirrorError);
        expect(
            () =>
                new MirrorNodeClient("https://x", {
                    maxRequestsPerSecond: -1,
                }),
        ).toThrow(MirrorError);
    });
});
