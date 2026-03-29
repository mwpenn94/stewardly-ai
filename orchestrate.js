#!/usr/bin/env node
/**
 * Stewardly AI — Workflow Orchestrator
 *
 * A CLI tool that tracks task status in .workflow/_status.json.
 * Persists within the Claude Code session. Periodically download
 * _status.json to mitigate session resets.
 *
 * Usage:
 *   node orchestrate.js init                      — Initialize workflow directory
 *   node orchestrate.js add <task> [--phase P]    — Add a task
 *   node orchestrate.js start <id>                — Mark task in-progress
 *   node orchestrate.js done <id> [--note "..."]  — Mark task completed
 *   node orchestrate.js fail <id> [--note "..."]  — Mark task failed
 *   node orchestrate.js block <id> [--note "..."] — Mark task blocked
 *   node orchestrate.js list [--phase P] [--status S] — List tasks
 *   node orchestrate.js summary                   — Print status summary
 *   node orchestrate.js export                    — Export status to stdout
 *   node orchestrate.js import <file>             — Import status from file
 *   node orchestrate.js log <message>             — Append to activity log
 *   node orchestrate.js reset                     — Reset all tasks to pending
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_DIR = join(__dirname, ".workflow");
const STATUS_FILE = join(WORKFLOW_DIR, "_status.json");
const LOG_FILE = join(WORKFLOW_DIR, "_activity.log");

// ─── State Management ────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(WORKFLOW_DIR)) {
    mkdirSync(WORKFLOW_DIR, { recursive: true });
  }
}

function loadStatus() {
  if (!existsSync(STATUS_FILE)) {
    return { tasks: [], meta: { createdAt: new Date().toISOString(), updatedAt: null } };
  }
  return JSON.parse(readFileSync(STATUS_FILE, "utf-8"));
}

function saveStatus(state) {
  ensureDir();
  state.meta.updatedAt = new Date().toISOString();
  writeFileSync(STATUS_FILE, JSON.stringify(state, null, 2));
}

function appendLog(message) {
  ensureDir();
  const ts = new Date().toISOString();
  appendFileSync(LOG_FILE, `[${ts}] ${message}\n`);
}

function nextId(tasks) {
  if (tasks.length === 0) return 1;
  return Math.max(...tasks.map(t => t.id)) + 1;
}

// ─── Commands ────────────────────────────────────────────────────

function init() {
  ensureDir();
  if (existsSync(STATUS_FILE)) {
    const state = loadStatus();
    console.log(`Workflow already initialized (${state.tasks.length} tasks).`);
    return;
  }
  const state = {
    tasks: [],
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: null,
      project: "stewardly-ai",
      description: "Codebase audit & remediation workflow",
    },
  };
  saveStatus(state);
  appendLog("Workflow initialized");
  console.log("Initialized .workflow/ directory.");
}

function add(description, phase) {
  const state = loadStatus();
  const task = {
    id: nextId(state.tasks),
    description,
    phase: phase || null,
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    notes: [],
  };
  state.tasks.push(task);
  saveStatus(state);
  appendLog(`Added task #${task.id}: ${description}`);
  console.log(`Added task #${task.id}: ${description}`);
}

function setStatus(id, status, note) {
  const state = loadStatus();
  const task = state.tasks.find(t => t.id === id);
  if (!task) {
    console.error(`Task #${id} not found.`);
    process.exit(1);
  }
  task.status = status;
  const now = new Date().toISOString();
  if (status === "in-progress") task.startedAt = now;
  if (status === "done" || status === "failed") task.completedAt = now;
  if (note) task.notes.push({ text: note, at: now });
  saveStatus(state);
  appendLog(`Task #${id} → ${status}${note ? ": " + note : ""}`);
  console.log(`Task #${id} → ${status}`);
}

function list(filterPhase, filterStatus) {
  const state = loadStatus();
  let tasks = state.tasks;
  if (filterPhase) tasks = tasks.filter(t => t.phase === filterPhase);
  if (filterStatus) tasks = tasks.filter(t => t.status === filterStatus);

  if (tasks.length === 0) {
    console.log("No tasks match the filter.");
    return;
  }

  const statusIcon = { pending: "○", "in-progress": "◐", done: "●", failed: "✗", blocked: "◫" };
  for (const t of tasks) {
    const icon = statusIcon[t.status] || "?";
    const phase = t.phase ? `[${t.phase}]` : "";
    console.log(`  ${icon} #${t.id} ${phase} ${t.description} (${t.status})`);
    for (const n of t.notes) {
      console.log(`      └─ ${n.text}`);
    }
  }
}

function summary() {
  const state = loadStatus();
  const counts = { pending: 0, "in-progress": 0, done: 0, failed: 0, blocked: 0 };
  for (const t of state.tasks) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  const total = state.tasks.length;
  const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;

  console.log(`\n  Workflow Status — ${state.meta.project || "project"}`);
  console.log(`  ${"─".repeat(40)}`);
  console.log(`  Total:       ${total}`);
  console.log(`  ● Done:      ${counts.done}`);
  console.log(`  ◐ In-progress: ${counts["in-progress"]}`);
  console.log(`  ○ Pending:   ${counts.pending}`);
  console.log(`  ◫ Blocked:   ${counts.blocked}`);
  console.log(`  ✗ Failed:    ${counts.failed}`);
  console.log(`  Progress:    ${pct}%`);
  if (state.meta.updatedAt) {
    console.log(`  Last update: ${state.meta.updatedAt}`);
  }
  console.log();

  // Phase breakdown
  const phases = [...new Set(state.tasks.map(t => t.phase).filter(Boolean))];
  if (phases.length > 0) {
    console.log("  By phase:");
    for (const p of phases) {
      const pTasks = state.tasks.filter(t => t.phase === p);
      const pDone = pTasks.filter(t => t.status === "done").length;
      console.log(`    ${p}: ${pDone}/${pTasks.length}`);
    }
    console.log();
  }
}

function exportStatus() {
  const state = loadStatus();
  console.log(JSON.stringify(state, null, 2));
}

function importStatus(file) {
  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  const state = JSON.parse(readFileSync(file, "utf-8"));
  saveStatus(state);
  appendLog(`Imported status from ${file}`);
  console.log(`Imported ${state.tasks.length} tasks from ${file}`);
}

function log(message) {
  appendLog(message);
  console.log(`Logged: ${message}`);
}

function reset() {
  const state = loadStatus();
  for (const t of state.tasks) {
    t.status = "pending";
    t.startedAt = null;
    t.completedAt = null;
  }
  saveStatus(state);
  appendLog("All tasks reset to pending");
  console.log(`Reset ${state.tasks.length} tasks to pending.`);
}

// ─── CLI Router ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

switch (cmd) {
  case "init":
    init();
    break;
  case "add":
    add(args.slice(1).filter(a => !a.startsWith("--")).join(" "), getFlag("--phase"));
    break;
  case "start":
    setStatus(parseInt(args[1]), "in-progress", getFlag("--note"));
    break;
  case "done":
    setStatus(parseInt(args[1]), "done", getFlag("--note"));
    break;
  case "fail":
    setStatus(parseInt(args[1]), "failed", getFlag("--note"));
    break;
  case "block":
    setStatus(parseInt(args[1]), "blocked", getFlag("--note"));
    break;
  case "list":
    list(getFlag("--phase"), getFlag("--status"));
    break;
  case "summary":
    summary();
    break;
  case "export":
    exportStatus();
    break;
  case "import":
    importStatus(args[1]);
    break;
  case "log":
    log(args.slice(1).join(" "));
    break;
  case "reset":
    reset();
    break;
  default:
    console.log("Usage: node orchestrate.js <command> [args]");
    console.log("Commands: init, add, start, done, fail, block, list, summary, export, import, log, reset");
    process.exit(1);
}
