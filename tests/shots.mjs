// Captures screenshots along the route (uses the bot to reach each spot).
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const bot = readFileSync(new URL('./bot.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto((process.env.URL || 'http://localhost:5173/') + '?gfx=' + (process.env.GFX || 'high'));
await page.waitForFunction(() => window.__ch);
await page.addScriptTag({ content: bot });
const want = (process.argv[2] || '').split(',').filter(Boolean);
const spots = [['r1', 'market', 30], ['r2', 'market', 90], ['split2', 'market', 232], ['climb', 'market', 572], ['shanty', 'market', 584], ['slope', 'market', 622], ['slope2', 'market', 706],
  ['n2', 'market', 662], ['f2', 'market', 745], ['road', 'market', 824], ['cop', 'market', 52, { vaultAC: false }], ['bust', 'market', 9999, { vaultAC: false, noSlide: true }]];
for (const [name, route, stopD, extra] of spots) {
  if (want.length && !want.includes(name)) continue;
  await page.evaluate(([route, stopD, extra]) => { window.runBot({ route, stopD, retry: true, ...extra }); __ch.game.camBlend = 1; __ch.game.manual = name0(extra); function name0(e) { return !(e && e.noSlide); } }, [route, stopD, extra || null]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `tests/shots/${name}.png` });
  console.log(name);
}
await browser.close();
