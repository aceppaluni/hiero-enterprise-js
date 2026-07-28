import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Structural guard: the client has exactly ONE transport choke point.
 *
 * Rate limiting (`RequestGate`), retry/backoff, observer telemetry (#145),
 * and response parsing are all applied inside `request()`/`fetchWithRetry`.
 * An endpoint that called `fetch` directly would silently bypass all of
 * them — no type error, no failing behavior test, just a method that
 * ignores the gate and emits no telemetry. This test makes that mistake
 * loud: it fails with instructions instead of shipping the bypass.
 */
describe("MirrorNodeClient transport choke point", () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
    const source = readFileSync(
        fileURLToPath(
            new URL("../../src/client/MirrorNodeClient.ts", import.meta.url),
        ),
        "utf8",
    );

    it("calls fetch in exactly one place (fetchWithRetry)", () => {
        const fetchCalls = source.match(/\bfetch\(/g) ?? [];
        expect(
            fetchCalls,
            "every mirror request must flow through request() → fetchWithRetry — " +
                "see CONTRIBUTING 'Adding a mirror endpoint' step 5",
        ).toHaveLength(1);
    });

    it("fetchWithRetry is invoked only by request() and its own retries", () => {
        // Why a structural count and not a behavior test: the behavioral
        // suite (MirrorNodeClient.observer.test.ts) proves the bracket
        // WORKS for methods that route through it — but no behavior test
        // can cover a future method that bypasses it, because a bypass
        // produces no observable event to assert on. This count is the
        // tripwire for exactly that case. Expected sites: 2 in request()
        // (observer + bare path) and 2 self-recursive retry sites — if
        // request()'s own shape changes, update the count; if the count
        // grew because a query method called fetchWithRetry directly,
        // route it through this.request()/this.getPage() instead.
        const calls = source.match(/\bthis\.fetchWithRetry\b/g) ?? [];
        expect(
            calls,
            "query methods must call this.request()/this.getPage(), " +
                "never fetchWithRetry directly",
        ).toHaveLength(4);
    });
});
