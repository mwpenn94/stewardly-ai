#!/usr/bin/env node
/**
 * ESM wrapper — delegates to the CJS implementation.
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Re-export by running the CJS file with the same argv
import { execFileSync } from "child_process";
try {
  const result = execFileSync(
    process.execPath,
    [join(__dirname, "recursive_optimization_toolkit.cjs"), ...process.argv.slice(2)],
    { stdio: "inherit" }
  );
} catch (e) {
  process.exit(e.status || 1);
}
