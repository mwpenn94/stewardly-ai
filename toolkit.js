#!/usr/bin/env node
/**
 * RECURSIVE OPTIMIZATION AUTOMATION TOOLKIT
 * ==========================================
 * Executable scripts for Manual, Semi-Automatic, and Automatic modes.
 * Includes divergence tracking, temperature scheduling, and branch management.
 *
 * Usage:
 *   node toolkit.js init <project>          - Initialize ledger + config for a project
 *   node toolkit.js verify                  - Pre-pass ledger verification
 *   node toolkit.js snapshot <pass-num>     - Create pre-pass snapshot
 *   node toolkit.js diff <pass-num>         - Post-pass diff against snapshot
 *   node toolkit.js score <pass-num> <dims> - Record pass scores and check convergence
 *   node toolkit.js suggest                 - Suggest next pass type (semi-auto mode)
 *   node toolkit.js diverge <branch-name>   - Create a divergence branch
 *   node toolkit.js branches                - List all active branches
 *   node toolkit.js converge <branch>       - Mark a branch for convergence
 *   node toolkit.js temperature             - Show current explore/exploit temperature
 *   node toolkit.js status                  - Full status dashboard
 *   node toolkit.js graduate                - Assess readiness for next automation tier
 *
 * Mike Penn - WealthBridge Financial Group - March 2026
 */

import fs from 'fs';
import path from 'path';

const LEDGER_FILE = 'ledger.json';
const CONFIG_FILE = 'optimization-config.json';

const DEFAULT_CONFIG = {
  project: '',
  automation_tier: 'manual',
  convergence: {
    min_improvement_delta: 0.02,
    target_quality_score: 9.0,
    max_passes: 7,
    stagnation_window: 2,
    regression_tolerance: 0,
    novelty_threshold: 3,
    cost_ratio_ceiling: 5.0
  },
  divergence: {
    enabled: true,
    max_active_branches: 3,
    temperature_schedule: 'adaptive',
    initial_temperature: 1.0,
    min_temperature: 0.1,
    cooling_rate: 0.15,
    divergence_budget: 0.3,
    auto_prune_after_passes: 3
  },
  graduation: {
    manual_to_semi: {
      min_cycles: 10,
      max_false_convergence_rate: 0.05,
      min_regression_detection_rate: 0.95,
      min_kappa: 0.70
    },
    semi_to_auto: {
      min_cycles: 20,
      max_regression_rate: 0.02,
      min_judge_kappa: 0.80,
      min_convergence_accuracy: 0.95
    }
  }
};

const DEFAULT_LEDGER = {
  project: '',
  created: new Date().toISOString(),
  last_updated: new Date().toISOString(),
  automation_tier: 'manual',
  safety_sensitive: false,
  improvements: [],
  failed_approaches: [],
  regressions: [],
  convergence_history: [],
  branches: [],
  graduation_history: {
    cycles_completed: 0,
    false_convergences: 0,
    regressions_detected: 0,
    regressions_missed: 0,
    judge_scores: []
  }
};

function loadJSON(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function log(msg, type) {
  type = type || 'info';
  const prefix = { info: '\x1b[36mINFO\x1b[0m', warn: '\x1b[33mWARN\x1b[0m',
                   error: '\x1b[31mERROR\x1b[0m', ok: '\x1b[32mOK\x1b[0m',
                   diverge: '\x1b[35mDIVERGE\x1b[0m', converge: '\x1b[32mCONVERGE\x1b[0m' };
  console.log('[' + (prefix[type] || prefix.info) + '] ' + msg);
}

function getTemperature(ledger, config) {
  const history = ledger.convergence_history;
  const schedule = config.divergence.temperature_schedule;
  const passCount = history.length;
  if (schedule === 'manual') return config.divergence.initial_temperature;
  if (schedule === 'linear_decay') {
    const temp = config.divergence.initial_temperature - (config.divergence.cooling_rate * passCount);
    return Math.max(temp, config.divergence.min_temperature);
  }
  if (schedule === 'adaptive') {
    let temp = config.divergence.initial_temperature;
    if (passCount < 2) return temp;
    const lastTwo = history.slice(-2);
    const lastDelta = lastTwo[1] && lastTwo[1].delta || 0;
    const prevDelta = lastTwo[0] && lastTwo[0].delta || 0;
    if (lastDelta < config.convergence.min_improvement_delta && prevDelta < config.convergence.min_improvement_delta) {
      temp = Math.min(1.0, temp + 0.2);
      log('Stagnation detected — raising temperature to encourage divergence', 'diverge');
    } else if (ledger.regressions.length > 0) {
      temp = Math.min(1.0, temp + 0.4);
      log('Regressions detected — raising temperature for broader exploration', 'diverge');
    } else if (lastDelta > 0.05) {
      temp = Math.max(config.divergence.min_temperature, temp - 0.15);
    } else {
      temp = Math.max(config.divergence.min_temperature, temp - 0.05);
    }
    return Math.round(temp * 100) / 100;
  }
  return config.divergence.initial_temperature;
}

function suggestPassType(ledger, config) {
  const history = ledger.convergence_history;
  const passCount = history.length;
  const temp = getTemperature(ledger, config);
  const activeBranches = ledger.branches.filter(function(b) { return b.status === 'active'; });
  if (temp > 0.7) {
    if (passCount === 0) return { type: 'landscape', mode: 'divergent', reason: 'First pass — explore broadly' };
    if (activeBranches.length < config.divergence.max_active_branches) {
      return { type: 'exploration', mode: 'divergent', reason: 'High temperature (' + temp + ') — generate alternative approaches' };
    }
  }
  if (passCount === 0) return { type: 'landscape', mode: 'convergent', reason: 'First pass — comprehensive survey' };
  var lastPass = history[history.length - 1];
  if (ledger.regressions.length > 0) return { type: 'adversarial', mode: 'convergent', reason: 'Active regressions — investigate and fix' };
  if (!history.some(function(h) { return h.type === 'landscape'; })) return { type: 'landscape', mode: 'convergent', reason: 'No landscape pass executed yet' };
  if (!history.some(function(h) { return h.type === 'depth'; })) return { type: 'depth', mode: 'convergent', reason: 'Landscape complete — depth needed' };
  if (!history.some(function(h) { return h.type === 'adversarial'; }) && (lastPass && lastPass.score || 0) >= 6) return { type: 'adversarial', mode: 'convergent', reason: 'Work appears solid — adversarial scrutiny needed' };
  if (passCount >= 2) {
    var lastTwo = history.slice(-2);
    if (lastTwo.every(function(h) { return (h.delta || 0) < config.convergence.min_improvement_delta; })) {
      if (temp > 0.3) return { type: 'exploration', mode: 'divergent', reason: 'Stagnating — diverge to escape local optimum' };
      return { type: 'synthesis', mode: 'convergent', reason: 'Stagnating — synthesize and assess convergence' };
    }
  }
  if (temp < 0.3) {
    if (activeBranches.length > 0) return { type: 'synthesis', mode: 'convergent', reason: 'Low temperature — resolve ' + activeBranches.length + ' active branches using Sequential Halving' };
    return { type: 'depth', mode: 'convergent', reason: 'Low temperature — deepen strongest areas' };
  }
  var typeCounts = {};
  history.forEach(function(h) { typeCounts[h.type] = (typeCounts[h.type] || 0) + 1; });
  if ((typeCounts.depth || 0) <= (typeCounts.adversarial || 0)) return { type: 'depth', mode: 'convergent', reason: 'Balanced cycle — depth turn' };
  return { type: 'adversarial', mode: 'convergent', reason: 'Balanced cycle — adversarial turn' };
}

function checkConvergence(ledger, config) {
  var c = config.convergence;
  var history = ledger.convergence_history;
  var results = {};
  if (history.length >= 2) {
    var lastTwo = history.slice(-2);
    var bothBelow = lastTwo.every(function(h) { return h.delta !== null && h.delta < c.min_improvement_delta; });
    results.delta = { met: bothBelow, value: lastTwo.map(function(h) { return h.delta; }), threshold: '< ' + c.min_improvement_delta + ' for 2 passes' };
  } else {
    results.delta = { met: false, value: 'insufficient passes', threshold: '< ' + c.min_improvement_delta + ' for 2 passes' };
  }
  var lastScore = history.length > 0 ? history[history.length - 1].score : 0;
  results.quality = { met: lastScore >= c.target_quality_score, value: lastScore, threshold: '>= ' + c.target_quality_score };
  results.passes = { met: history.length >= 3, value: history.length, threshold: '>= 3 and <= ' + c.max_passes };
  var activeRegressions = ledger.regressions.filter(function(r) { return r.status === 'open'; }).length;
  results.regressions = { met: activeRegressions === 0, value: activeRegressions, threshold: '= 0' };
  var lastNovelty = history.length > 0 ? (history[history.length - 1].novelty_count || 99) : 99;
  results.novelty = { met: lastNovelty < c.novelty_threshold, value: lastNovelty, threshold: '< ' + c.novelty_threshold };
  var activeBranches = ledger.branches.filter(function(b) { return b.status === 'active'; }).length;
  results.branches = { met: activeBranches === 0, value: activeBranches, threshold: '= 0 (all resolved)' };
  var allMet = Object.values(results).every(function(r) { return r.met; });
  return { converged: allMet, criteria: results };
}

var commands = {
  init: function(args) {
    var project = args.find(function(a) { return !a.startsWith('--'); }) || 'unnamed';
    var safety = args.includes('--safety');
    var config = Object.assign({}, DEFAULT_CONFIG, { project: project });
    var ledger = Object.assign({}, DEFAULT_LEDGER, { project: project, safety_sensitive: safety, created: new Date().toISOString(), last_updated: new Date().toISOString() });
    saveJSON(CONFIG_FILE, config);
    saveJSON(LEDGER_FILE, ledger);
    log('Initialized project "' + project + '" with Manual mode' + (safety ? ' [SAFETY-SENSITIVE]' : ''), 'ok');
    log('Config: ' + CONFIG_FILE);
    log('Ledger: ' + LEDGER_FILE);
    log('');
    log('Next steps:');
    log('  1. Run: node toolkit.js suggest');
    log('  2. Run: node toolkit.js snapshot 1');
    log('  3. Execute the suggested pass');
    log('  4. Run: node toolkit.js score 1 "7,6,7,5,8,7"');
  },
  verify: function() {
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found. Run: node toolkit.js init <project>', 'error'); return; }
    var verified = ledger.improvements.filter(function(i) { return i.status === 'verified'; });
    var issues = 0;
    verified.forEach(function(imp) {
      (imp.files || []).forEach(function(f) {
        if (!fs.existsSync(f)) {
          log('REGRESSION: ' + imp.id + ' — file missing: ' + f, 'error');
          issues++;
          imp.status = 'regressed';
          ledger.regressions.push({ id: 'REG-' + Date.now(), improvement_id: imp.id, detected: new Date().toISOString(), type: 'file_missing', status: 'open' });
        }
      });
    });
    if (issues === 0) { log('Ledger OK: ' + verified.length + ' items verified', 'ok'); }
    else { log(issues + ' regressions detected — fix before proceeding', 'error'); saveJSON(LEDGER_FILE, ledger); }
  },
  snapshot: function(args) {
    var passNum = args[0] || '1';
    var src = LEDGER_FILE;
    var dst = 'ledger.pre-pass-' + passNum + '.json';
    if (!fs.existsSync(src)) { log('No ledger found', 'error'); return; }
    fs.copyFileSync(src, dst);
    log('Snapshot saved: ' + dst, 'ok');
  },
  diff: function(args) {
    var passNum = args[0] || '1';
    var snapshot = 'ledger.pre-pass-' + passNum + '.json';
    if (!fs.existsSync(snapshot)) { log('No snapshot: ' + snapshot, 'error'); return; }
    var before = JSON.parse(fs.readFileSync(snapshot, 'utf-8'));
    var after = loadJSON(LEDGER_FILE);
    log('Pass ' + passNum + ' diff:', 'info');
    log('  Improvements: ' + before.improvements.length + ' -> ' + after.improvements.length + ' (+' + (after.improvements.length - before.improvements.length) + ')');
    log('  Regressions: ' + before.regressions.length + ' -> ' + after.regressions.length + ' (+' + (after.regressions.length - before.regressions.length) + ')');
    if (after.regressions.length > before.regressions.length) log('  WARNING: New regressions detected!', 'warn');
    if (after.improvements.length === before.improvements.length) log('  WARNING: No new improvements (stagnation signal)', 'warn');
  },
  score: function(args) {
    var passNum = args[0] || '1';
    var dims = (args[1] || '5,5,5,5,5,5').split(',').map(Number);
    var passType = args[2] || 'unknown';
    var noveltyCount = parseInt(args[3] || '5');
    if (dims.length !== 6) { log('Need 6 scores: completeness,accuracy,depth,novelty,actionability,regression', 'error'); return; }
    if (dims.some(function(d) { return !Number.isFinite(d) || d < 1 || d > 10; })) { log('All scores must be numbers between 1 and 10', 'error'); return; }
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    var avgScore = dims.reduce(function(a, b) { return a + b; }, 0) / dims.length;
    var roundedScore = Math.round(avgScore * 10) / 10;
    var lastEntry = ledger.convergence_history.length > 0 ? ledger.convergence_history[ledger.convergence_history.length - 1] : null;
    var delta = lastEntry ? Math.round((roundedScore - lastEntry.score) * 100) / 100 : null;
    var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
    var passMode = 'convergent';
    try { passMode = suggestPassType(ledger, config).mode || 'convergent'; } catch(e) {}
    ledger.convergence_history.push({ pass: 'pass-' + passNum, type: passType, mode: passMode, score: roundedScore, delta: delta, dimensions: { completeness: dims[0], accuracy: dims[1], depth: dims[2], novelty: dims[3], actionability: dims[4], regression_safety: dims[5] }, novelty_count: noveltyCount, timestamp: new Date().toISOString() });
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
    log('Pass ' + passNum + ' scored: ' + roundedScore + '/10 (delta: ' + (delta !== null ? delta : 'N/A') + ')', 'ok');
    log('  Dimensions: C=' + dims[0] + ' A=' + dims[1] + ' D=' + dims[2] + ' N=' + dims[3] + ' Ac=' + dims[4] + ' R=' + dims[5]);
    var conv = checkConvergence(ledger, config);
    log(''); log('Convergence check:');
    Object.entries(conv.criteria).forEach(function(entry) { var name = entry[0]; var c = entry[1]; var icon = c.met ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'; log('  ' + icon + ' ' + name + ': ' + JSON.stringify(c.value) + ' (threshold: ' + c.threshold + ')'); });
    if (conv.converged) {
      ledger.graduation_history.cycles_completed = (ledger.graduation_history.cycles_completed || 0) + 1;
      saveJSON(LEDGER_FILE, ledger);
      log(''); log('=== CONVERGENCE ACHIEVED ===', 'converge');
    } else {
      var suggestion = suggestPassType(ledger, config);
      var temp = getTemperature(ledger, config);
      log(''); log('Temperature: ' + temp + ' (' + (temp > 0.7 ? 'explore' : temp < 0.3 ? 'exploit' : 'balanced') + ')');
      log('Suggested next: ' + suggestion.type + ' [' + suggestion.mode + '] — ' + suggestion.reason);
      var recentDeltas = ledger.convergence_history.slice(-3).map(function(h) { return h.delta; }).filter(function(d) { return d !== null && d > 0; });
      if (recentDeltas.length > 0) { var avgDelta = recentDeltas.reduce(function(a, b) { return a + b; }, 0) / recentDeltas.length; log('Estimated passes to convergence: ~' + Math.ceil(4 / Math.max(avgDelta, 0.01)) + ' (4/delta where delta=' + avgDelta.toFixed(2) + ')'); }
      if (ledger.safety_sensitive) { var consecutiveAuto = ledger.convergence_history.slice(-3).filter(function(h) { return h.mode !== 'human-verified'; }).length; if (consecutiveAuto >= 3) { log(''); log('WARNING: SAFETY CAP: 3 consecutive passes without human verification', 'warn'); } }
    }
  },
  suggest: function() {
    var ledger = loadJSON(LEDGER_FILE);
    var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
    if (!ledger) { log('No ledger found', 'error'); return; }
    var suggestion = suggestPassType(ledger, config);
    var temp = getTemperature(ledger, config);
    log('Temperature: ' + temp, temp > 0.7 ? 'diverge' : temp < 0.3 ? 'converge' : 'info');
    log('Mode: ' + suggestion.mode.toUpperCase());
    log('Suggested pass: ' + suggestion.type.toUpperCase());
    log('Reason: ' + suggestion.reason);
    if (suggestion.mode === 'divergent') { log(''); log('DIVERGENT PASS — Generate multiple alternatives, do NOT narrow yet.', 'diverge'); }
  },
  diverge: function(args) {
    var branchName = args[0];
    if (!branchName) { log('Usage: node toolkit.js diverge <branch-name>', 'error'); return; }
    var ledger = loadJSON(LEDGER_FILE);
    var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
    if (!ledger) { log('No ledger found', 'error'); return; }
    var activeBranches = ledger.branches.filter(function(b) { return b.status === 'active'; });
    if (activeBranches.length >= config.divergence.max_active_branches) { log('Max active branches reached. Converge or prune first.', 'error'); return; }
    ledger.branches.push({ name: branchName, status: 'active', created: new Date().toISOString(), created_at_pass: ledger.convergence_history.length, description: '', scores: [], rationale: '' });
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
    log('Branch "' + branchName + '" created', 'diverge');
  },
  branches: function() {
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    if (ledger.branches.length === 0) { log('No branches.'); return; }
    log('Branches:');
    ledger.branches.forEach(function(b) { log('  ' + (b.status === 'active' ? '>' : b.status === 'converged' ? '=' : 'x') + ' ' + b.name + ' [' + b.status + '] created at pass ' + b.created_at_pass); });
  },
  converge: function(args) {
    var branchName = args[0];
    if (!branchName) { log('Usage: node toolkit.js converge <branch-name>', 'error'); return; }
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    var branch = ledger.branches.find(function(b) { return b.name === branchName; });
    if (!branch) { log('Branch not found', 'error'); return; }
    branch.status = 'converged';
    branch.converged_at = new Date().toISOString();
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
    log('Branch "' + branchName + '" marked for convergence', 'converge');
  },
  prune: function(args) {
    var branchName = args[0];
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    if (branchName) {
      var branch = ledger.branches.find(function(b) { return b.name === branchName && b.status === 'active'; });
      if (!branch) { log('Active branch not found', 'error'); return; }
      branch.status = 'pruned';
      branch.pruned_at = new Date().toISOString();
      branch.pruned_reason = args.slice(1).join(' ') || 'Manual prune';
      log('Branch "' + branchName + '" pruned: ' + branch.pruned_reason, 'warn');
    } else {
      var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
      var currentPass = ledger.convergence_history.length;
      var threshold = config.divergence.auto_prune_after_passes || 3;
      ledger.branches.filter(function(b) { return b.status === 'active'; }).forEach(function(b) {
        if (b.scores.length === 0 && (currentPass - b.created_at_pass) >= threshold) { b.status = 'pruned'; b.pruned_at = new Date().toISOString(); b.pruned_reason = 'Auto-pruned: no scores after ' + threshold + ' passes'; log('Auto-pruned: "' + b.name + '"', 'warn'); }
      });
    }
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
  },
  fail: function(args) {
    var description = args.join(' ');
    if (!description) { log('Usage: node toolkit.js fail "description"', 'error'); return; }
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    if (!ledger.failed_approaches) ledger.failed_approaches = [];
    var id = 'FAIL-' + String(ledger.failed_approaches.length + 1).padStart(3, '0');
    ledger.failed_approaches.push({ id: id, pass: 'pass-' + ledger.convergence_history.length, description: description, created: new Date().toISOString() });
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
    log('Logged ' + id + ': ' + description, 'warn');
  },
  'check-gaming': function() {
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    var history = ledger.convergence_history;
    if (history.length < 3) { log('Need at least 3 passes to detect gaming', 'info'); return; }
    log('=== EVALUATION GAMING CHECK ===');
    var lastThree = history.slice(-3);
    var scoresRising = lastThree.every(function(h, i) { return i === 0 || (h.score || 0) >= (lastThree[i-1].score || 0); });
    var recentImps = ledger.improvements.filter(function(i) { var pn = parseInt((i.pass || '').replace('pass-', '')); return pn >= history.length - 3; });
    if (scoresRising && recentImps.length === 0) { log('WARNING: Scores rising but no new improvements logged', 'warn'); }
    else { log('OK: Scores track improvements', 'ok'); }
    var lastDims = lastThree.map(function(h) { return h.dimensions; }).filter(Boolean);
    if (lastDims.length >= 2) { var spreads = lastDims.map(function(d) { var vals = Object.values(d); return Math.max.apply(null, vals) - Math.min.apply(null, vals); }); if (spreads.every(function(s) { return s <= 1; })) { log('WARNING: All dimensions scoring within 1 point', 'warn'); } else { log('OK: Dimension scores show natural variation', 'ok'); } }
  },
  'add-improvement': function(args) {
    var description = args.join(' ');
    if (!description) { log('Usage: node toolkit.js add-improvement "description"', 'error'); return; }
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    var id = 'IMP-' + String(ledger.improvements.length + 1).padStart(3, '0');
    ledger.improvements.push({ id: id, pass: 'pass-' + ledger.convergence_history.length, status: 'verified', description: description, files: [], tests: [], quality_delta: '', depends_on: [], depended_by: [], created: new Date().toISOString() });
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
    log('Added ' + id + ': ' + description, 'ok');
  },
  record: function(args) {
    var event = args[0];
    var ledger = loadJSON(LEDGER_FILE);
    if (!ledger) { log('No ledger found', 'error'); return; }
    var gh = ledger.graduation_history;
    var valid = ['false-convergence', 'missed-regression', 'detected-regression', 'cycle-complete'];
    if (!valid.includes(event)) { log('Usage: node toolkit.js record <' + valid.join('|') + '>', 'error'); return; }
    if (event === 'false-convergence') { gh.false_convergences = (gh.false_convergences || 0) + 1; log('Recorded: false convergence', 'warn'); }
    if (event === 'missed-regression') { gh.regressions_missed = (gh.regressions_missed || 0) + 1; log('Recorded: missed regression', 'warn'); }
    if (event === 'detected-regression') { gh.regressions_detected = (gh.regressions_detected || 0) + 1; log('Recorded: detected regression', 'ok'); }
    if (event === 'cycle-complete') { gh.cycles_completed = (gh.cycles_completed || 0) + 1; log('Recorded: cycle complete (' + gh.cycles_completed + ')', 'ok'); }
    ledger.last_updated = new Date().toISOString();
    saveJSON(LEDGER_FILE, ledger);
  },
  temperature: function() {
    var ledger = loadJSON(LEDGER_FILE);
    var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
    if (!ledger) { log('No ledger found', 'error'); return; }
    var temp = getTemperature(ledger, config);
    var activeBranches = ledger.branches.filter(function(b) { return b.status === 'active'; }).length;
    var passCount = ledger.convergence_history.length;
    var divergentPasses = ledger.convergence_history.filter(function(h) { return h.mode === 'divergent'; }).length;
    log('=== TEMPERATURE STATUS ===');
    log('Current temperature: ' + temp);
    log('Schedule: ' + config.divergence.temperature_schedule);
    log('Passes completed: ' + passCount);
    log('Active branches: ' + activeBranches + '/' + config.divergence.max_active_branches);
    log('Divergence budget: ' + Math.round((passCount > 0 ? divergentPasses / passCount : 0) * 100) + '% used (limit: ' + config.divergence.divergence_budget * 100 + '%)');
    if (temp > 0.7) log('EXPLORE MODE', 'diverge');
    else if (temp > 0.3) log('BALANCED MODE', 'info');
    else log('EXPLOIT MODE', 'converge');
  },
  status: function() {
    var ledger = loadJSON(LEDGER_FILE);
    var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
    if (!ledger) { log('No ledger found. Run: node toolkit.js init <project>', 'error'); return; }
    var temp = getTemperature(ledger, config);
    var conv = checkConvergence(ledger, config);
    var suggestion = suggestPassType(ledger, config);
    var activeBranches = ledger.branches.filter(function(b) { return b.status === 'active'; });
    var verifiedImps = ledger.improvements.filter(function(i) { return i.status === 'verified'; });
    var openRegs = ledger.regressions.filter(function(r) { return r.status === 'open'; });
    log('=======================================');
    log('  PROJECT: ' + ledger.project);
    log('  AUTOMATION: ' + config.automation_tier.toUpperCase());
    log('  TEMPERATURE: ' + temp + ' (' + (temp > 0.7 ? 'EXPLORE' : temp < 0.3 ? 'EXPLOIT' : 'BALANCED') + ')');
    if (ledger.safety_sensitive) log('  SAFETY-SENSITIVE: Yes');
    log('=======================================');
    log('');
    log('Passes: ' + ledger.convergence_history.length);
    log('Improvements: ' + verifiedImps.length + ' verified');
    log('Failed approaches: ' + (ledger.failed_approaches || []).length + ' logged');
    log('Regressions: ' + openRegs.length + ' open', openRegs.length > 0 ? 'error' : 'ok');
    log('Branches: ' + activeBranches.length + ' active');
    if (ledger.convergence_history.length > 0) { var last = ledger.convergence_history[ledger.convergence_history.length - 1]; log('Last score: ' + last.score + '/10 (delta: ' + last.delta + ')'); }
    log(''); log('Convergence:');
    Object.entries(conv.criteria).forEach(function(entry) { log('  ' + (entry[1].met ? 'Y' : 'N') + ' ' + entry[0] + ': ' + JSON.stringify(entry[1].value)); });
    log(''); log('Next: ' + suggestion.type.toUpperCase() + ' [' + suggestion.mode + ']');
    log('  ' + suggestion.reason);
  },
  graduate: function() {
    var ledger = loadJSON(LEDGER_FILE);
    var config = loadJSON(CONFIG_FILE) || DEFAULT_CONFIG;
    if (!ledger) { log('No ledger found', 'error'); return; }
    var tier = config.automation_tier;
    var gh = ledger.graduation_history;
    log('Current tier: ' + tier.toUpperCase());
    if (tier === 'manual') {
      var criteria = config.graduation.manual_to_semi;
      log('Graduation to SEMI-AUTOMATIC:');
      log('  Cycles: ' + gh.cycles_completed + '/' + criteria.min_cycles);
      var fcr = gh.cycles_completed > 0 ? gh.false_convergences / gh.cycles_completed : 1;
      log('  False convergence rate: ' + Math.round(fcr * 100) + '% (max ' + criteria.max_false_convergence_rate * 100 + '%)');
      var rdr = (gh.regressions_detected + gh.regressions_missed) > 0 ? gh.regressions_detected / (gh.regressions_detected + gh.regressions_missed) : 0;
      log('  Regression detection: ' + Math.round(rdr * 100) + '% (min ' + criteria.min_regression_detection_rate * 100 + '%)');
    }
  }
};

var cmd = process.argv[2];
var args = process.argv.slice(3);
if (commands[cmd]) { commands[cmd](args); }
else {
  console.log('Recursive Optimization Toolkit');
  console.log('Usage: node toolkit.js <command> [args]');
  console.log('');
  console.log('Commands:');
  console.log('  init <project> [--safety] Initialize project');
  console.log('  verify                  Pre-pass ledger check');
  console.log('  snapshot <pass>         Save pre-pass snapshot');
  console.log('  diff <pass>             Post-pass diff');
  console.log('  score <pass> <dims>     Record scores (6 comma-separated)');
  console.log('  suggest                 AI-suggested next pass');
  console.log('  diverge <name>          Create divergence branch');
  console.log('  branches                List branches');
  console.log('  converge <name>         Mark branch for convergence');
  console.log('  prune [name]            Prune branch (or auto-prune stale)');
  console.log('  add-improvement "desc"  Add improvement to ledger');
  console.log('  fail "desc"             Log failed approach');
  console.log('  check-gaming            Detect evaluation gaming');
  console.log('  record <event>          Record graduation event');
  console.log('  temperature             Show explore/exploit state');
  console.log('  status                  Full dashboard');
  console.log('  graduate                Check automation tier readiness');
}
