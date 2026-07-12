import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/integration/**/*.spec.ts"],
        environment: "node",
        // Reuses core's documented Solo env file when present.
        setupFiles: ["test/integration/setup-env.ts"],
        // Mirror ingestion is eventually consistent — round-trips poll.
        testTimeout: 120_000,
        hookTimeout: 120_000,
        coverage: {
            provider: "v8",
            reporter: ["text-summary", "json-summary", "json", "lcov"],
            reportsDirectory: "./coverage/integration",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/**/*.d.ts", "src/types/**"],
            // Reporting only — the unit suite owns the coverage gates.
        },
    },
});
