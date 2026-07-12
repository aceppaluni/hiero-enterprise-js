import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Load the same `packages/core/test/.env` the core integration suite
 * documents (CONTRIBUTING → "Running Integration Tests"), so one Solo
 * env file drives both suites. Shell variables take precedence; without
 * either, the round-trip specs skip themselves.
 */
const envFile = fileURLToPath(
    new URL("../../../core/test/.env", import.meta.url),
);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
if (existsSync(envFile)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
        const match = /^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (Reflect.has(process.env, key)) continue;
        Reflect.set(process.env, key, rawValue.replace(/^["']|["']$/g, ""));
    }
}
