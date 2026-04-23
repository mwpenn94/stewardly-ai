const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://3000-iu7oj0ckvhcwmqkf5hka9-7dbe8d40.us2.manus.computer';

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'wealth-engine', path: '/wealth-engine' },
  { name: 'chat', path: '/chat' },
  { name: 'intelligence', path: '/intelligence' },
  { name: 'integrations', path: '/integrations' },
  { name: 'advisory', path: '/advisory' },
  { name: 'products', path: '/products' },
  { name: 'market-data', path: '/market-data' },
  { name: 'settings', path: '/settings' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const findings = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    for (const pg of PAGES) {
      const url = BASE + pg.path;
      console.log(`\n=== ${pg.name} @ ${vp.name} ===`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Check for horizontal overflow
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        // Check touch target sizes (buttons/links < 44px)
        const smallTargets = await page.evaluate(() => {
          const elements = document.querySelectorAll('button, a, [role="button"], input, select');
          let count = 0;
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
              count++;
            }
          }
          return count;
        });

        // Check text readability (font-size < 12px)
        const smallText = await page.evaluate(() => {
          const all = document.querySelectorAll('*');
          let count = 0;
          for (const el of all) {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            if (el.textContent?.trim() && fontSize < 12 && el.children.length === 0) {
              count++;
            }
          }
          return count;
        });

        // Check for overlapping elements
        const truncatedText = await page.evaluate(() => {
          const all = document.querySelectorAll('h1, h2, h3, p, span, td, th, button');
          let count = 0;
          for (const el of all) {
            if (el.scrollWidth > el.clientWidth + 2 && el.textContent?.trim().length > 5) {
              count++;
            }
          }
          return count;
        });

        // Check animation/transition presence
        const hasAnimations = await page.evaluate(() => {
          const all = document.querySelectorAll('*');
          let count = 0;
          for (const el of all) {
            const style = window.getComputedStyle(el);
            if (style.transition !== 'all 0s ease 0s' && style.transition !== '' && style.transition !== 'none') {
              count++;
            }
            if (style.animation !== 'none' && style.animation !== '') {
              count++;
            }
          }
          return count;
        });

        // Check for missing alt text on images
        const missingAlt = await page.evaluate(() => {
          return document.querySelectorAll('img:not([alt])').length;
        });

        // Check for empty buttons
        const emptyButtons = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          let count = 0;
          for (const b of buttons) {
            if (!b.textContent?.trim() && !b.getAttribute('aria-label') && !b.querySelector('svg')) {
              count++;
            }
          }
          return count;
        });

        const finding = {
          page: pg.name,
          viewport: vp.name,
          overflow: hasOverflow,
          smallTargets,
          smallText,
          truncatedText,
          animations: hasAnimations,
          missingAlt,
          emptyButtons,
        };

        findings.push(finding);

        const issues = [];
        if (hasOverflow) issues.push('OVERFLOW');
        if (smallTargets > 20) issues.push(`${smallTargets} small targets`);
        if (smallText > 10) issues.push(`${smallText} small text`);
        if (truncatedText > 5) issues.push(`${truncatedText} truncated`);
        if (missingAlt > 0) issues.push(`${missingAlt} missing alt`);
        if (emptyButtons > 0) issues.push(`${emptyButtons} empty buttons`);

        console.log(`  Overflow: ${hasOverflow} | SmallTargets: ${smallTargets} | SmallText: ${smallText} | Truncated: ${truncatedText} | Animations: ${hasAnimations} | MissingAlt: ${missingAlt} | EmptyBtns: ${emptyButtons}`);
        if (issues.length > 0) console.log(`  ⚠️ ISSUES: ${issues.join(', ')}`);

        // Screenshot mobile views
        if (vp.name === 'mobile-375') {
          await page.screenshot({ path: `/tmp/mobile-${pg.name}.png` });
        }

      } catch (err) {
        console.log(`  ERROR: ${err.message}`);
        findings.push({ page: pg.name, viewport: vp.name, error: err.message });
      }
    }

    await ctx.close();
  }

  fs.writeFileSync('/tmp/mobile-findings.json', JSON.stringify(findings, null, 2));
  console.log('\n\nResults saved to /tmp/mobile-findings.json');
  await browser.close();
})();
