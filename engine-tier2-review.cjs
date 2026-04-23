const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const TIMEOUT = 15000;

// All engine pages to test with their expected capabilities
const ENGINES = [
  // WEALTH ENGINE
  { name: 'Wealth Engine - Main', path: '/wealth-engine', 
    principlesFirst: ['methodology', 'formula', 'explain', 'how', 'why', 'concept', 'learn', 'understand', 'education'],
    applicationsFirst: ['calculate', 'run', 'generate', 'start', 'quick', 'action', 'button', 'input', 'form'],
    expectedElements: ['calculator', 'scenario', 'analysis', 'projection'] },
  { name: 'Wealth Engine - Calculators', path: '/calculators',
    principlesFirst: ['formula', 'methodology', 'assumption'],
    applicationsFirst: ['input', 'calculate', 'result', 'button'],
    expectedElements: ['calculator', 'input', 'result'] },
  { name: 'Wealth Engine - Products', path: '/products',
    principlesFirst: ['description', 'feature', 'comparison', 'detail'],
    applicationsFirst: ['compare', 'select', 'filter', 'search'],
    expectedElements: ['product', 'carrier', 'category'] },
  { name: 'Wealth Engine - Advisory', path: '/advisory',
    principlesFirst: ['strategy', 'methodology', 'framework', 'approach'],
    applicationsFirst: ['plan', 'create', 'generate', 'action'],
    expectedElements: ['plan', 'client', 'strategy'] },
  
  // PEOPLE ENGINE
  { name: 'People Engine - CRM Sync', path: '/crm-sync',
    principlesFirst: ['sync', 'integration', 'provider', 'how', 'status'],
    applicationsFirst: ['connect', 'sync', 'configure', 'button'],
    expectedElements: ['provider', 'sync', 'status', 'connection'] },
  { name: 'People Engine - Lead Pipeline', path: '/lead-pipeline',
    principlesFirst: ['score', 'stage', 'criteria', 'methodology'],
    applicationsFirst: ['add', 'move', 'filter', 'action', 'button'],
    expectedElements: ['lead', 'pipeline', 'stage', 'score'] },
  { name: 'People Engine - Contacts', path: '/contacts',
    principlesFirst: ['relationship', 'history', 'detail'],
    applicationsFirst: ['add', 'search', 'filter', 'import'],
    expectedElements: ['contact', 'name', 'email'] },
  { name: 'People Engine - Email Campaign', path: '/email-campaigns',
    principlesFirst: ['template', 'strategy', 'audience', 'analytics'],
    applicationsFirst: ['create', 'send', 'schedule', 'template'],
    expectedElements: ['campaign', 'template', 'email'] },
  
  // LEARNING ENGINE
  { name: 'Learning Engine - EMBA', path: '/learning',
    principlesFirst: ['curriculum', 'track', 'concept', 'module', 'lesson'],
    applicationsFirst: ['start', 'continue', 'enroll', 'begin'],
    expectedElements: ['track', 'module', 'progress', 'learn'] },
  { name: 'Learning Engine - Knowledge Base', path: '/knowledge-base',
    principlesFirst: ['definition', 'concept', 'reference', 'article'],
    applicationsFirst: ['search', 'browse', 'filter'],
    expectedElements: ['article', 'knowledge', 'search'] },
  
  // DATA ENGINE  
  { name: 'Data Engine - Intelligence', path: '/intelligence',
    principlesFirst: ['insight', 'analysis', 'trend', 'methodology'],
    applicationsFirst: ['generate', 'run', 'refresh', 'action'],
    expectedElements: ['insight', 'analysis', 'data', 'chart'] },
  { name: 'Data Engine - Analytics', path: '/analytics',
    principlesFirst: ['metric', 'trend', 'methodology', 'definition'],
    applicationsFirst: ['filter', 'export', 'date', 'range'],
    expectedElements: ['chart', 'metric', 'data', 'analytics'] },
  
  // INTELLIGENCE ENGINE
  { name: 'Intelligence Engine - Chat', path: '/chat',
    principlesFirst: ['context', 'capability', 'help', 'guide'],
    applicationsFirst: ['input', 'send', 'message', 'ask'],
    expectedElements: ['chat', 'message', 'input', 'send'] },
  { name: 'Intelligence Engine - CodeChat', path: '/code-chat',
    principlesFirst: ['workspace', 'tool', 'capability', 'help'],
    applicationsFirst: ['input', 'send', 'execute', 'run'],
    expectedElements: ['chat', 'code', 'workspace', 'tool'] },
  
  // PLATFORM
  { name: 'Platform - Settings', path: '/settings',
    principlesFirst: ['configuration', 'preference', 'option'],
    applicationsFirst: ['save', 'update', 'toggle', 'input'],
    expectedElements: ['setting', 'preference', 'config'] },
  { name: 'Platform - Alert Thresholds', path: '/alert-thresholds',
    principlesFirst: ['threshold', 'metric', 'definition', 'when'],
    applicationsFirst: ['set', 'save', 'configure', 'input'],
    expectedElements: ['threshold', 'alert', 'warning', 'critical'] },
];

async function reviewEngine(page, engine) {
  const result = {
    name: engine.name,
    path: engine.path,
    status: 'unknown',
    loadTime: 0,
    errors: [],
    principlesScore: 0,
    applicationsScore: 0,
    functionalElements: [],
    missingElements: [],
    interactiveElements: 0,
    formInputs: 0,
    buttons: 0,
    links: 0,
    charts: 0,
    tables: 0,
    emptyStates: 0,
    loadingStates: 0,
    errorStates: 0,
    contentLength: 0,
    hasSearch: false,
    hasFilters: false,
    hasPagination: false,
    hasExport: false,
    hasCTA: false,
    mobileOverflow: false,
    textContent: '',
  };

  try {
    const start = Date.now();
    const response = await page.goto(`${BASE}${engine.path}`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    result.loadTime = Date.now() - start;
    result.status = response?.status() === 200 ? 'loaded' : `HTTP ${response?.status()}`;
    
    // Wait for content to render
    await page.waitForTimeout(2000);
    
    // Get full text content
    result.textContent = await page.evaluate(() => document.body?.innerText || '');
    result.contentLength = result.textContent.length;
    
    // Check for errors on page
    const errorText = result.textContent.toLowerCase();
    if (errorText.includes('undefined') && !errorText.includes('if undefined')) result.errors.push('Contains "undefined" text');
    if (/\bNaN\b/.test(result.textContent)) result.errors.push('Contains NaN');
    if (errorText.includes('error') && errorText.includes('something went wrong')) result.errors.push('Error state visible');
    
    // Count interactive elements
    result.buttons = await page.locator('button').count();
    result.links = await page.locator('a').count();
    result.formInputs = await page.locator('input, select, textarea').count();
    result.interactiveElements = result.buttons + result.links + result.formInputs;
    result.charts = await page.locator('canvas, svg.recharts-surface, .recharts-wrapper, [class*="chart"]').count();
    result.tables = await page.locator('table').count();
    
    // Check for UX patterns
    result.hasSearch = await page.locator('[placeholder*="search" i], [placeholder*="Search" i], [aria-label*="search" i]').count() > 0;
    result.hasFilters = await page.locator('[class*="filter" i], select, [role="combobox"]').count() > 0;
    result.hasPagination = result.textContent.toLowerCase().includes('page') || await page.locator('[class*="pagination"]').count() > 0;
    result.hasExport = result.textContent.toLowerCase().includes('export') || result.textContent.toLowerCase().includes('download');
    result.hasCTA = result.buttons > 0;
    
    // Check for empty/loading/error states
    const emptyPhrases = ['no data', 'no results', 'nothing here', 'get started', 'no items', 'empty'];
    const loadingPhrases = ['loading', 'spinner', 'skeleton'];
    result.emptyStates = emptyPhrases.filter(p => errorText.includes(p)).length;
    result.loadingStates = loadingPhrases.filter(p => errorText.includes(p)).length;
    
    // Score principles-first (educational content)
    const lowerText = result.textContent.toLowerCase();
    result.principlesScore = engine.principlesFirst.filter(kw => lowerText.includes(kw)).length;
    
    // Score applications-first (action-oriented)
    result.applicationsScore = engine.applicationsFirst.filter(kw => lowerText.includes(kw) || 
      page.locator(`button:has-text("${kw}"), a:has-text("${kw}"), [placeholder*="${kw}" i]`).count() > 0
    ).length;
    
    // Check expected functional elements
    for (const el of engine.expectedElements) {
      if (lowerText.includes(el)) {
        result.functionalElements.push(el);
      } else {
        result.missingElements.push(el);
      }
    }
    
    // Mobile overflow check (viewport 375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    result.mobileOverflow = scrollWidth > 380;
    await page.setViewportSize({ width: 1280, height: 720 });
    
  } catch (err) {
    result.status = 'error';
    result.errors.push(err.message.substring(0, 200));
  }
  
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200));
  });
  
  const results = [];
  
  for (const engine of ENGINES) {
    console.log(`Reviewing: ${engine.name}...`);
    const result = await reviewEngine(page, engine);
    results.push(result);
    console.log(`  Status: ${result.status} | Load: ${result.loadTime}ms | Buttons: ${result.buttons} | Inputs: ${result.formInputs} | Charts: ${result.charts}`);
    console.log(`  Principles: ${result.principlesScore}/${engine.principlesFirst.length} | Applications: ${result.applicationsScore}/${engine.applicationsFirst.length}`);
    if (result.errors.length) console.log(`  ERRORS: ${result.errors.join(', ')}`);
    if (result.missingElements.length) console.log(`  MISSING: ${result.missingElements.join(', ')}`);
    if (result.mobileOverflow) console.log(`  ⚠️ MOBILE OVERFLOW`);
  }
  
  // Summary
  console.log('\n═══ TIER 2 SUMMARY ═══');
  console.log(`Total engines reviewed: ${results.length}`);
  console.log(`Loaded successfully: ${results.filter(r => r.status === 'loaded').length}`);
  console.log(`With errors: ${results.filter(r => r.errors.length > 0).length}`);
  console.log(`Mobile overflow: ${results.filter(r => r.mobileOverflow).length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  
  // Engine maturity scoring
  console.log('\n═══ ENGINE MATURITY SCORES ═══');
  for (const r of results) {
    const funcScore = r.functionalElements.length / (r.functionalElements.length + r.missingElements.length) * 100;
    const interScore = Math.min(r.interactiveElements / 10 * 100, 100);
    const contentScore = Math.min(r.contentLength / 1000 * 100, 100);
    const uxScore = [r.hasSearch, r.hasFilters, r.hasPagination, r.hasExport, r.hasCTA].filter(Boolean).length / 5 * 100;
    const maturity = ((funcScore + interScore + contentScore + uxScore) / 4 / 100 * 5).toFixed(1);
    console.log(`${r.name}: ${maturity}/5.0 (func:${funcScore.toFixed(0)}% inter:${interScore.toFixed(0)}% content:${contentScore.toFixed(0)}% ux:${uxScore.toFixed(0)}%)`);
  }
  
  // Write detailed results
  fs.writeFileSync('/tmp/tier2-results.json', JSON.stringify(results, null, 2));
  
  if (consoleErrors.length) {
    console.log('\n═══ CONSOLE ERRORS ═══');
    consoleErrors.forEach(e => console.log(`  ${e}`));
  }
  
  await browser.close();
})();
