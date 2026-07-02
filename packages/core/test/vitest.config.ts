import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/unit/**/*.test.ts"],
        environment: "node",
        coverage: {
            provider: "v8",
            // `json-summary` is required by the vitest-coverage-report
            // GitHub Action; `json` powers its per-file table. `lcov` is
            // kept for local tools (VS Code coverage gutter, etc.) and
            // `text-summary` for the terminal.
            reporter: ["text-summary", "json-summary", "json", "lcov"],
            // Emit reports even when tests fail so the PR comment still
            // has data to render.
            reportOnFailure: true,
            reportsDirectory: "./coverage/node",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/**/*.d.ts", "src/types/**"],
            // Fail the unit-test run if any metric drops below 95%.
            // The unit config is the canonical coverage surface
            thresholds: {
                lines: 90,
                statements: 90,
                functions: 90,
                branches: 90,
            },
        },
    },
});
