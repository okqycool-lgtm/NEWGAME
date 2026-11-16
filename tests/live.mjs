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

// swipe gestures: flick up = jump, second flick = double jump, flick down = slide; slow drags never trigger them
const swipe = async (x, y0, y1, steps = 4, hold = false) => {
  await touch('touchStart', [{ x, y: y0 }]);
  for (let i = 1; i <= steps; i++) await touch('touchMove', [{ x, y: y0 + ((y1 - y0) * i) / steps }]);
  if (!hold) await touch('touchEnd', []);
};
const ev = () => page.evaluate(() => ({ ps: __ch.player.state, dj: __ch.player.usedDouble, g: __ch.player.grounded, x: +__ch.player.x.toFixed(2) }));
const settle = async () => { for (let i = 0; i < 40; i++) { const e = await ev(); if (e.ps === 'run' && e.g) return; await page.waitForTimeout(120); } };
await page.evaluate(() => { __ch.resetRun(true); });
for (let i = 0; i < 60; i++) { await page.waitForTimeout(200); const e = await st(page); if (e.s === 'play' && e.ps === 'run' && e.d > 8) break; }
await swipe(200, 500, 420);
const j1 = await ev();
await swipe(200, 500, 420);
const j2 = await ev();
console.log(j1.ps === 'air' && !j1.dj && j2.dj ? 'PASS swipe up jumps, second swipe double jumps' : 'FAIL swipe up ' + JSON.stringify({ j1, j2 }));
await settle();
await swipe(200, 420, 500, 4, true);
const sl = await ev();
await touch('touchEnd', []);
console.log(sl.ps === 'slide' ? 'PASS swipe down slides' : 'FAIL swipe down ' + JSON.stringify(sl));
await settle();
// a slow diagonal steering drag (mostly sideways, drifting 40px vertically) must not jump or slide
await touch('touchStart', [{ x: 250, y: 400 }]);
for (let i = 1; i <= 20; i++) { await touch('touchMove', [{ x: 250 - i * 5, y: 400 - i * 2 }]); await page.waitForTimeout(15); }
const d1 = await ev();
await touch('touchEnd', []);
console.log(d1.ps === 'run' && d1.x < -0.5 ? 'PASS steering drag does not trigger a jump' : 'FAIL steering drag ' + JSON.stringify(d1));
await browser.close();
