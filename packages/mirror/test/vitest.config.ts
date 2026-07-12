import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/unit/**/*.test.ts"],
        environment: "node",
        coverage: {
            provider: "v8",
            reporter: ["text-summary", "json-summary", "json", "lcov"],
            reportOnFailure: true,
            reportsDirectory: "./coverage/node",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/**/*.d.ts", "src/types/**"],
            thresholds: {
                lines: 90,
                statements: 90,
                functions: 90,
                branches: 90,
            },
        },
    },
});
