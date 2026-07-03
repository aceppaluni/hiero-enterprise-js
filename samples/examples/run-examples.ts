import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "src");

const excludedFiles: string[] = [];

/**
 * Comma-separated list of path prefixes to skip, e.g.
 * `EXAMPLES_SKIP=mirror/` — used by CI to skip the mirror-node query
 * examples, which showcase real public-network data (busy accounts,
 * USDC, long-lived topics) that does not exist on a fresh solo network.
 * They still run locally via `pnpm examples mirror` or `npx tsx`.
 */
const skipPrefixes = (process.env["EXAMPLES_SKIP"] ?? "")
    .split(",")
    .map((prefix) => prefix.trim())
    .filter(Boolean);

/**
 * Recursively finds all .ts files under a directory.
 */
function findExamples(dir: string, base = ""): string[] {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- recursion rooted at the constant examples directory, no user input
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const relative = path.join(base, entry.name);
        const relativePosix = relative.split(path.sep).join("/");
        if (entry.isDirectory()) {
            files.push(...findExamples(path.join(dir, entry.name), relative));
        } else if (
            entry.isFile() &&
            entry.name.endsWith(".ts") &&
            !excludedFiles.includes(relative) &&
            !skipPrefixes.some((prefix) => relativePosix.startsWith(prefix))
        ) {
            files.push(relative);
        }
    }

    return files;
}

interface RunResult {
    file: string;
    code: number;
    durationMs: number;
}

function runExample(file: string): Promise<RunResult> {
    const filePath = path.join(srcDir, file);
    const start = Date.now();

    return new Promise((resolve, reject) => {
        const child = spawn("npx", ["tsx", filePath], {
            stdio: "pipe",
            env: { ...process.env },
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {
            const durationMs = Date.now() - start;
            if (code !== 0 && stderr) {
                console.error(`  stderr: ${stderr.trim()}`);
            }
            if (stdout) {
                console.log(`  ${stdout.trim().replace(/\n/g, "\n  ")}`);
            }
            resolve({ file, code: code ?? -1, durationMs });
        });

        child.on("error", reject);
    });
}

async function runSequential(examples: string[]): Promise<void> {
    const total = examples.length;
    let passed = 0;
    let failed = 0;
    const failures: string[] = [];

    console.log(`\nRunning ${total} examples against network...\n`);
    console.log("─".repeat(60));

    for (const [i, file] of examples.entries()) {
        console.log(`\n⏳ [${i + 1}/${total}] ${file}`);

        const result = await runExample(file);

        if (result.code === 0) {
            passed++;
            console.log(`✅ passed (${result.durationMs}ms)`);
        } else {
            failed++;
            failures.push(file);
            console.log(
                `❌ failed with exit code ${result.code} (${result.durationMs}ms)`,
            );
        }
    }

    console.log("\n" + "─".repeat(60));
    console.log(
        `\nResults: ${total} total, ${passed} passed, ${failed} failed`,
    );

    if (failures.length > 0) {
        console.log("\nFailed examples:");
        for (const f of failures) {
            console.log(`  ❌ ${f}`);
        }
        process.exit(1);
    } else {
        console.log("\n🎉 All examples passed!");
    }
}

// Main execution

const examples = findExamples(srcDir);

if (examples.length === 0) {
    console.error("No example files found in src/");
    process.exit(1);
}

// Optional: filter by folder via CLI arg (e.g., `tsx run-examples.ts account`)
const filter = process.argv[2];
const filtered = filter
    ? examples.filter((f) => f.startsWith(filter))
    : examples;

if (filtered.length === 0) {
    console.error(`No examples match filter: "${filter}"`);
    console.error(`Available: ${examples.join(", ")}`);
    process.exit(1);
}

await runSequential(filtered);
