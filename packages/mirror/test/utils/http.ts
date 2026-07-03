/**
 * Build a 200 JSON `Response` for mocking `fetch` in unit tests.
 */
export function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
