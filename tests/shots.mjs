// Captures screenshots along the route (uses the bot to reach each spot).
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const bot = readFileSync(new URL('./bot.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__ch);
await page.addScriptTag({ content: bot });
const want = (process.argv[2] || '').split(',').filter(Boolean);
const spots = [['r1', 'market', 22], ['vault', 'market', 45.5], ['slide', 'market', 117.6], ['gap', 'market', 153], ['split', 'market', 190], ['split2', 'market', 232],
  ['ramp', 'market', 250], ['market', 'market', 292], ['market2', 'market', 372], ['wallrun', 'roof', 266], ['kick', 'roof', 284], ['roof4', 'roof', 310], ['drop', 'roof', 424],
  ['final', 'market', 480], ['f2', 'market', 585], ['road', 'market', 660], ['van', 'market', 9999]];
for (const [name, route, stopD] of spots) {
  if (want.length && !want.includes(name)) continue;
  await page.evaluate(([route, stopD]) => { window.runBot({ route, stopD, retry: true }); __ch.game.camBlend = 1; }, [route, stopD]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `tests/shots/${name}.png` });
  console.log(name);
}
await browser.close();
