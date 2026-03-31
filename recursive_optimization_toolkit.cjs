#!/usr/bin/env node
/**
 * Recursive Optimization Toolkit — Ledger CLI
 *
 * Tracks optimization improvements, scores, and pass history for the
 * Stewardly-AI recursive-optimization workflow.
 *
 * Commands:
 *   add-improvement <description>   Record a new improvement
 *   score <pass> <s1,s2,...,s6>      Record scores for a pass (6 dimensions)
 *   status                           Show current ledger summary
 *   history                          Show full ledger history
 *   reset                            Clear the ledger (with confirmation flag --yes)
 *
 * Score dimensions (in order):
 *   1. Architecture  2. Security  3. Performance
 *   4. Code Quality  5. UX/DX    6. Completeness
 *
 * Ledger file: ./optimization_ledger.json (created automatically)
 */

const fs = require("fs");
const path = require("path");

const LEDGER_PATH = path.join(__dirname, "optimization_ledger.json");

// ── helpers ──────────────────────────────────────────────────────────
function loadLedger() {
  if (fs.existsSync(LEDGER_PATH)) {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf-8"));
  }
  return {
    version: "1.0.0",
    created: new Date().toISOString(),
    improvements: [],
    scores: [],
    passes: 0,
  };
}

function saveLedger(ledger) {
  ledger.updated = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
}

const DIMENSIONS = [
  "Architecture",
  "Security",
  "Performance",
  "Code Quality",
  "UX/DX",
  "Completeness",
];

// ── commands ─────────────────────────────────────────────────────────
function addImprovement(description) {
  const ledger = loadLedger();
  const entry = {
    id: ledger.improvements.length + 1,
    description,
    timestamp: new Date().toISOString(),
    pass: ledger.passes || 0,
  };
  ledger.improvements.push(entry);
  saveLedger(ledger);
  console.log(`✅  Improvement #${entry.id} recorded: ${description}`);
}

function recordScore(passNumber, rawScores) {
  const scores = rawScores.split(",").map(Number);
  if (scores.length !== 6 || scores.some((s) => isNaN(s) || s < 1 || s > 10)) {
    console.error("❌  Provide exactly 6 comma-separated scores (1-10).");
    process.exit(1);
  }

  const ledger = loadLedger();
  const avg = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);

  const entry = {
    pass: Number(passNumber),
    scores: Object.fromEntries(DIMENSIONS.map((d, i) => [d, scores[i]])),
    average: avg,
    timestamp: new Date().toISOString(),
  };

  ledger.scores.push(entry);
  ledger.passes = Math.max(ledger.passes, Number(passNumber));
  saveLedger(ledger);

  console.log(`📊  Pass ${passNumber} scored — average ${avg}/10`);
  DIMENSIONS.forEach((d, i) => console.log(`    ${d}: ${scores[i]}/10`));
}

function showStatus() {
  const ledger = loadLedger();
  const totalImprovements = ledger.improvements.length;
  const lastScore = ledger.scores.length
    ? ledger.scores[ledger.scores.length - 1]
    : null;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║       Recursive Optimization Ledger — Status     ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Improvements recorded : ${String(totalImprovements).padStart(4)}                     ║`);
  console.log(`║  Passes completed      : ${String(ledger.passes).padStart(4)}                     ║`);

  if (lastScore) {
    console.log(`║  Last score (pass ${lastScore.pass})   : ${lastScore.average}/10 avg           ║`);
    Object.entries(lastScore.scores).forEach(([dim, val]) => {
      console.log(`║    ${dim.padEnd(16)}: ${String(val).padStart(2)}/10                    ║`);
    });
  } else {
    console.log("║  Last score            : (none)                  ║");
  }

  // Suggest next pass
  let suggestion;
  if (ledger.passes === 0) {
    suggestion = "Landscape pass — establish broad coverage";
  } else if (lastScore && lastScore.average < 7) {
    suggestion = "Depth pass — strengthen weak dimensions";
  } else if (lastScore && lastScore.average < 8.5) {
    suggestion = "Adversarial pass — stress-test for hidden failures";
  } else if (lastScore && lastScore.average < 9.5) {
    suggestion = "Future-State & Synthesis — integrate and future-proof";
  } else {
    suggestion = "Convergence reached — monitor for re-entry triggers";
  }

  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Suggested next pass:                            ║`);
  console.log(`║    ${suggestion.padEnd(46)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Score trend
  if (ledger.scores.length > 1) {
    console.log("  Score trend:");
    ledger.scores.forEach((s) => {
      const bar = "█".repeat(Math.round(s.average));
      console.log(`    Pass ${s.pass}: ${bar} ${s.average}`);
    });
    console.log();
  }
}

function showHistory() {
  const ledger = loadLedger();
  console.log("\n── Improvements ─────────────────────────────────");
  if (ledger.improvements.length === 0) {
    console.log("  (none)");
  } else {
    ledger.improvements.forEach((imp) => {
      console.log(`  #${imp.id} [pass ${imp.pass}] ${imp.description}`);
    });
  }
  console.log("\n── Scores ───────────────────────────────────────");
  if (ledger.scores.length === 0) {
    console.log("  (none)");
  } else {
    ledger.scores.forEach((s) => {
      console.log(`  Pass ${s.pass}: avg ${s.average} — ${JSON.stringify(s.scores)}`);
    });
  }
  console.log();
}

function resetLedger(args) {
  if (!args.includes("--yes")) {
    console.log("⚠️  Pass --yes to confirm ledger reset.");
    process.exit(1);
  }
  if (fs.existsSync(LEDGER_PATH)) fs.unlinkSync(LEDGER_PATH);
  console.log("🗑️  Ledger reset.");
}

// ── main ─────────────────────────────────────────────────────────────
const [, , command, ...args] = process.argv;

switch (command) {
  case "add-improvement":
    if (!args.length) {
      console.error("Usage: add-improvement <description>");
      process.exit(1);
    }
    addImprovement(args.join(" "));
    break;
  case "score":
    if (args.length < 2) {
      console.error("Usage: score <pass_number> <s1,s2,s3,s4,s5,s6>");
      process.exit(1);
    }
    recordScore(args[0], args[1]);
    break;
  case "status":
    showStatus();
    break;
  case "history":
    showHistory();
    break;
  case "reset":
    resetLedger(args);
    break;
  default:
    console.log(`
Recursive Optimization Toolkit v1.0.0

Commands:
  add-improvement <description>    Record a new improvement
  score <pass> <s1,s2,...,s6>      Record scores for a pass (6 dimensions)
  status                           Show current ledger summary
  history                          Show full ledger history
  reset --yes                      Clear the ledger
`);
}
