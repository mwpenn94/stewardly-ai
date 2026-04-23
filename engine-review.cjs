const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://3000-iu7oj0ckvhcwmqkf5hka9-7dbe8d40.us2.manus.computer';
const ENGINES = [
  { name: 'wealth-engine', path: '/wealth-engine', focus: 'Calculators, financial modeling' },
  { name: 'chat', path: '/chat', focus: 'AI conversational assistant' },
  { name: 'intelligence', path: '/intelligence', focus: 'Analytics, market data, insights' },
  { name: 'people', path: '/people', focus: 'Lead pipeline, CRM, relationships' },
  { name: 'team', path: '/team', focus: 'Team management, hierarchy' },
  { name: 'organizations', path: '/organizations', focus: 'Org management' },
  { name: 'integrations', path: '/integrations', focus: 'CRM sync, GHL, external services' },
  { name: 'learning', path: '/learning', focus: 'EMBA tracks, education' },
  { name: 'operations', path: '/operations', focus: 'Operations hub, workflows' },
  { name: 'advisory', path: '/advisory', focus: 'Advisory execution, planning' },
  { name: 'market-data', path: '/market-data', focus: 'Financial data hub, market feeds' },
  { name: 'products', path: '/products', focus: 'Product catalog, insurance' },
  { name: 'settings', path: '/settings', focus: 'Platform settings, profile' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const results = [];

  for (const engine of ENGINES) {
    const url = BASE + engine.path;
    console.log('\n=== ' + engine.name + ' (' + engine.focus + ') ===');
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: '/tmp/engine-' + engine.name + '.png', fullPage: false });
      
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || '');
      
      const interactiveCount = await page.evaluate(() => ({
        buttons: document.querySelectorAll('button:not([disabled])').length,
        inputs: document.querySelectorAll('input:not([type="hidden"])').length,
        selects: document.querySelectorAll('select').length,
        tabs: document.querySelectorAll('[role="tab"]').length,
      }));
      
      const tableCount = await page.evaluate(() => document.querySelectorAll('table').length);
      const chartCount = await page.evaluate(() => document.querySelectorAll('svg, canvas').length);
      
      const headings = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()).filter(Boolean).slice(0, 15);
      });
      
      const result = {
        engine: engine.name,
        focus: engine.focus,
        headings,
        interactive: interactiveCount,
        tables: tableCount,
        charts: chartCount,
        bodyPreview: bodyText.slice(0, 800),
        status: 'LOADED'
      };
      
      results.push(result);
      console.log('  Buttons: ' + result.interactive.buttons + ' | Inputs: ' + result.interactive.inputs + ' | Tabs: ' + result.interactive.tabs + ' | Tables: ' + result.tables + ' | Charts: ' + result.charts);
      console.log('  Headings: ' + result.headings.slice(0, 8).join(' | '));
      
    } catch (err) {
      console.log('  FAILED: ' + err.message);
      results.push({ engine: engine.name, status: 'FAILED', error: err.message });
    }
  }

  console.log('\n=== DEEP TEST: Wealth Engine ===');
  await page.goto(BASE + '/wealth-engine', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  
  const calcDetails = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.textContent?.trim()).filter(Boolean);
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name || i.placeholder || i.getAttribute('aria-label') || '', value: i.value
    })).filter(i => i.type !== 'hidden').slice(0, 30);
    return { tabs, inputs };
  });
  console.log('Tabs: ' + JSON.stringify(calcDetails.tabs));
  console.log('Inputs: ' + JSON.stringify(calcDetails.inputs.slice(0, 10)));
  
  await page.screenshot({ path: '/tmp/engine-wealth-deep.png', fullPage: true });

  fs.writeFileSync('/tmp/engine-review-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved.');
  
  await browser.close();
})();
