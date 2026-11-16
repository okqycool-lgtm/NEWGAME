// Real-time checks with real input events: keyboard intro, then touch on a narrow phone viewport.
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const BASE = process.env.URL || 'http://localhost:5173/';
const st = (page) => page.evaluate(() => { const { game: g, player: p } = __ch; return { s: g.state, ps: p.state, d: +p.d.toFixed(1), x: +p.x.toFixed(2), y: +p.y.toFixed(1), t: +g.time.toFixed(2), blend: +g.camBlend.toFixed(2), touch: __ch.input.touchMode }; });

// --- desktop keyboard: intro kick
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE); await page.waitForFunction(() => window.__ch); await page.waitForTimeout(1200);
console.log('ready', JSON.stringify(await st(page)));
await page.keyboard.press('Space');
for (let i = 0; i < 6; i++) { await page.waitForTimeout(350); const s = await st(page); console.log('kick', i, JSON.stringify(s)); if (i < 4) await page.screenshot({ path: `tests/shots/kick${i}.png` }); }
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
const s1 = await st(page); console.log('steer right ->', JSON.stringify(s1));
await page.close();

// --- phone portrait: touch controls, simultaneous steer + jump
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
page = await ctx.newPage();
await page.goto(BASE); await page.waitForFunction(() => window.__ch); await page.waitForTimeout(1000);
await page.screenshot({ path: 'tests/shots/phone-title.png' });
const cdp = await ctx.newCDPSession(page);
const box = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, sel);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
// tap the title to kick off
await touch('touchStart', [{ x: 200, y: 300 }]); await touch('touchEnd', []);
let s; for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); s = await st(page); if (s.s === 'play' && s.ps === 'run' && s.d > 8) break; }
console.log('phone after tap', JSON.stringify(s));
const jump = await box('#btn-jump');
const x0 = s.x;
// thumb 1: swipe left starting from an arbitrary spot in the middle of the screen
await touch('touchStart', [{ x: 220, y: 380 }]);
await touch('touchMove', [{ x: 150, y: 385 }]);
await page.waitForTimeout(500);
await touch('touchMove', [{ x: 150, y: 385 }, { x: jump.x, y: jump.y }]);            // thumb 2: jump while steering
await touch('touchStart', [{ x: 150, y: 385 }, { x: jump.x, y: jump.y }]);
await page.waitForTimeout(200);
const mid = await st(page);
await page.screenshot({ path: 'tests/shots/phone-play.png' });
await touch('touchEnd', [{ x: 150, y: 385 }]);
await page.waitForTimeout(300);
await touch('touchEnd', []);
const end = await st(page);
console.log('phone steer+jump', JSON.stringify({ x0, mid, end }));
console.log(mid.x < x0 - 0.5 && (mid.ps === 'air' || mid.ps === 'vault') ? 'PASS touch steer + jump together' : 'FAIL touch steer + jump together');
console.log(mid.touch ? 'PASS touch controls visible' : 'FAIL touch controls hidden');
await browser.close();
