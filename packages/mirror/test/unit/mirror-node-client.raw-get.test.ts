import { describe, it, expect, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../src/MirrorNodeClient.js";
import { jsonResponse } from "../utils/http.js";

/**
 * The raw `get` escape hatch: arbitrary path + query, parsed JSON out,
 * with the SAME gate/retry/error semantics as the typed queries. Also
 * the contract that makes the client a drop-in transport for tooling
 * that composes its own mirror paths.
 */
describe("MirrorNodeClient.get (raw escape hatch)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("GETs the exact path and returns the parsed body untyped", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(jsonResponse({ anything: [1, 2, 3] }));

        const client = new MirrorNodeClient("https://mirror.example");
        const body = await client.get(
            "/api/v1/topics/0.0.1/messages?order=asc&limit=2",
        );

        expect(body).toEqual({ anything: [1, 2, 3] });
        expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
            "https://mirror.example/api/v1/topics/0.0.1/messages?order=asc&limit=2",
        );
    });

    it("runs through the retry loop like any typed query", async () => {
        vi.useFakeTimers();
        let attempts = 0;
        vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            attempts++;
            if (attempts === 1) {
                return Promise.resolve(
                    new Response("", {
                        status: 429,
                        headers: { "retry-after": "0" },
                    }),
                );
            }
            return Promise.resolve(jsonResponse({ ok: true }));
        });

        const client = new MirrorNodeClient("https://mirror.example", {
            maxRetries: 2,
        });
        const pending = client.get("/api/v1/network/supply");
        await vi.advanceTimersByTimeAsync(1_000);

        expect(await pending).toEqual({ ok: true });
        expect(attempts).toBe(2);
    });
});
