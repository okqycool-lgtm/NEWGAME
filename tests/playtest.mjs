// Automated playtest: drives the real game simulation in headless Chromium.
// Usage: npm run dev (in another terminal), then: npm test
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.URL || 'http://localhost:5173/';
const bot = readFileSync(new URL('./bot.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE);
await page.waitForFunction(() => window.__ch);
await page.evaluate(() => localStorage.clear());
await page.addScriptTag({ content: bot });
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); if (!ok) fails++; };
const run = (opts) => page.evaluate((o) => window.runBot(o), opts);
const verbose = process.env.VERBOSE;

let r = await run({ route: 'market' });
if (verbose) console.log(JSON.stringify(r, null, 1));
check('market route reaches the van', r.state === 'finish' && r.resultsShown, `time ${r.time}s cash ${r.cash} | ${r.tricks}`);
check('market run is clean (no cash lost)', r.cash === 50000 && r.stats.falls === 0, r.lands);
check('market run stayed at street level', r.minYMid < 15);
const marketTime = r.time;

r = await run({ route: 'roof', retry: true });
if (verbose) console.log(JSON.stringify(r, null, 1));
check('rooftop route reaches the van', r.state === 'finish', `time ${r.time}s cash ${r.cash} | ${r.tricks} | ${r.lands}`);
check('high line chains both walls and stays on the roofs', /wallrun:2/.test(r.tricks) && /kickoff:2/.test(r.tricks) && r.minYMid > 15 && r.stats.falls === 0);
check('rooftop is the faster line', r.time < marketTime, `${r.time}s vs ${marketTime}s`);
check('level length is roughly a minute', r.time >= 50 && marketTime <= 90, `${r.time}s / ${marketTime}s`);
check('retry reset the run (full cash, fresh timer)', r.maxCash === 50000 && r.cashLog.length === 0);

r = await run({ route: 'roof', kick: false, retry: true });
if (verbose) console.log(JSON.stringify(r, null, 1));
check('missed kick-off lands on the awning and flows into the market', r.state === 'finish' && /bounce:[1-9]/.test(r.tricks) && r.stats.falls === 0 && r.minYMid < 15, `${r.tricks} cash ${r.cash}`);

r = await run({ route: 'market', vaultAC: false, chase: true, retry: true });
if (verbose) console.log(JSON.stringify(r.cashLog));
const c = r.cashLog;
check('clip drops exactly $2,500 then recovers it once', c.length === 2 && c[0].cash === 47500 && c[1].cash === 50000 && r.stats.dropped === 1 && r.stats.recovered === 1 && r.maxCash === 50000 && r.cash === 50000, JSON.stringify(c));

r = await run({ route: 'market', vaultAC: false, chase: false, retry: true });
check('ignored bundle is lost exactly once', r.cashLog.length === 1 && r.cash === 47500 && r.stats.lost === 1 && r.stats.recovered === 0, JSON.stringify(r.cashLog));

r = await run({ route: 'market', noDouble: true, retry: true, maxT: 30 });      // single-jumping the 11 m gap falls short
const falls = r.notable.filter((e) => e.type === 'fall');
check('fall respawns at checkpoint with one $5,000 penalty per fall', falls.length >= 1 && r.cashLog.length === falls.length && r.cashLog[0].cash === 45000, `${falls.length} falls, cash ${r.cash}, respawn d≈${r.cashLog[0]?.d}`);

r = await run({ route: 'market', retry: true });
check('slope slide rides to the bottom with extra speed', r.maxSlideSpeed > 15 && r.state === 'finish', `peak slide speed ${r.maxSlideSpeed} m/s (run speed 11.5)`);
if (verbose) console.log(JSON.stringify(r.notable));

// robot officer: one stumble starts an 8 s chase; a second stumble inside it ends the run
r = await run({ route: 'market', vaultAC: false, chase: true, retry: true, stopD: 34 });
check('a stumble puts the officer on your tail for ~8 s', r.chaseT > 6 && r.chaseT < 8, `chase left ${r.chaseT}s at d=34`);
r = await run({ route: 'market', vaultAC: false, chase: true, retry: true });
check('surviving the chase lets the run finish', r.state === 'finish' && r.chaseT === 0 && r.cash === 50000);
const bestBefore = await page.evaluate(() => [localStorage.getItem('cyberheist.bestCash'), localStorage.getItem('cyberheist.bestTime')].join());
r = await run({ route: 'market', vaultAC: false, noSlide: true, chase: true, retry: true });
const bestAfter = await page.evaluate(() => [localStorage.getItem('cyberheist.bestCash'), localStorage.getItem('cyberheist.bestTime')].join());
const bustUi = await page.evaluate(() => ({ head: document.getElementById('res-head').textContent, shown: !document.getElementById('results').classList.contains('hidden') }));
check('second stumble during the chase = busted, bests untouched', r.state === 'busted' && r.result.busted && bustUi.head === 'BUSTED' && bustUi.shown && bestBefore === bestAfter, `busted at d=${r.d}, t=${r.time}s`);
r = await run({ route: 'market', retry: true, stopD: 30 });
check('retry after a bust starts a clean run', r.state === 'play' && r.cash === 50000 && r.chaseT === 0);

// perfect moves: bigger boost, and they chain into a combo
const plain = await run({ route: 'market', retry: true });
r = await run({ route: 'market', retry: true, perfect: true });
if (verbose) console.log(JSON.stringify({ plain: [plain.time, plain.topSpeed, plain.maxCombo], perfect: [r.time, r.topSpeed, r.maxCombo], notable: r.notable }));
check('perfect vaults and slides chain into a combo', r.state === 'finish' && r.maxCombo >= 3 && plain.maxCombo === 0, `best chain x${r.maxCombo}`);
check('perfect play is clearly faster', r.time < plain.time - 3 && r.cash === 50000, `time ${r.time}s vs ${plain.time}s`);
r = await run({ route: 'market', retry: true, perfect: true, vaultAC: false, stopD: 36 });
check('a stumble breaks the combo', r.maxCombo === 0 || (await page.evaluate(() => __ch.player.combo)) === 0);

// swipe gestures, driven with real pointer events against the stepped simulation
const sw = await page.evaluate(() => {
  const { game, player: p, input, tick, resetRun } = window.__ch, zone = document.getElementById('steerzone');
  const none = { steer: 0, jump: false, slide: false, slideHeld: false };
  const step = (n) => { for (let i = 0; i < n; i++) tick(1 / 120, i === 0 ? input.consume() : { ...input.consume(), jump: false, slide: false }); };
  const pe = (type, x, y, id = 7) => zone.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true }));
  const flick = (x, y0, y1, lift = true) => { pe('pointerdown', x, y0); for (let i = 1; i <= 4; i++) pe('pointermove', x, y0 + ((y1 - y0) * i) / 4); if (lift) pe('pointerup', x, y1); };
  const run = () => { for (let i = 0; i < 2000 && !(game.state === 'play' && p.state === 'run' && p.grounded); i++) tick(1 / 120, none); };
  game.manual = true; resetRun(true); run(); for (let i = 0; i < 120; i++) tick(1 / 120, none);
  const out = {};
  flick(200, 500, 430); step(6); out.jump = p.state === 'air' && !p.usedDouble;
  flick(200, 500, 430); step(6); out.double = p.usedDouble;
  run();
  flick(200, 430, 500, false); step(6); out.slide = p.state === 'slide';
  step(90); out.slideHeld = p.state === 'slide';                 // finger still down: slide holds past its minimum
  pe('pointerup', 200, 500); step(40); out.slideEnds = p.state === 'run';
  // one long upward drag must fire only one jump
  run(); pe('pointerdown', 200, 600); for (let i = 1; i <= 30; i++) pe('pointermove', 200, 600 - i * 8); step(6); out.oneJumpPerFlick = p.state === 'air' && !p.usedDouble; pe('pointerup', 200, 360);
  // a slow diagonal steering drag must not jump or slide
  run(); const x0 = p.x; pe('pointerdown', 250, 400);
  for (let i = 1; i <= 40; i++) { pe('pointermove', 250 - i * 3, 400 - i * 1.2); step(3); }
  out.steerOnly = p.state === 'run' && p.x < x0 - 1; pe('pointerup', 130, 352);
  return out;
});
check('swipe up jumps, a second swipe up double jumps', sw.jump && sw.double && sw.oneJumpPerFlick, JSON.stringify(sw));
check('swipe down slides and holds while the finger stays down', sw.slide && sw.slideHeld && sw.slideEnds);
check('a steering drag never triggers a jump or slide', sw.steerOnly);

// personal bests survive a refresh
const before = await page.evaluate(() => ({ c: localStorage.getItem('cyberheist.bestCash'), t: localStorage.getItem('cyberheist.bestTime') }));
await page.reload();
await page.waitForFunction(() => window.__ch);
const after = await page.evaluate(() => ({ c: localStorage.getItem('cyberheist.bestCash'), t: localStorage.getItem('cyberheist.bestTime'), title: document.getElementById('title-bests').textContent }));
check('personal bests survive a refresh (stored separately)', before.c === '50000' && after.c === before.c && after.t === before.t && /BEST CASH \$50,000/.test(after.title), JSON.stringify(after));
await page.close();
// ---------------------------------------------------------------- JOB 02: Iron Harbor
if (!process.env.SKIP_L2) {
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push('L2 ' + e.message));
  await p2.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'level=2');
  await p2.waitForFunction(() => window.__ch);
  await p2.addScriptTag({ content: bot });
  const run2 = (opts) => p2.evaluate((o) => window.runBot(o), opts);
  let h = await run2({ route: 'market' });
  if (verbose) console.log(JSON.stringify(h, null, 1));
  check('harbor: dock alley reaches the skiff', h.state === 'finish' && h.cash === 50000 && h.stats.falls === 0 && h.minYMid < 9, `time ${h.time}s | ${h.tricks} | ${h.lands}`);
  const dockTime = h.time;
  h = await run2({ route: 'roof', retry: true });
  if (verbose) console.log(JSON.stringify(h, null, 1));
  check('harbor: crane line (hull wall run on the right) reaches the skiff', h.state === 'finish' && /wallrun:1/.test(h.tricks) && /kickoff:1/.test(h.tricks) && h.minYMid > 13 && h.stats.falls === 0, `time ${h.time}s | ${h.tricks} | ${h.lands}`);
  check('harbor: crane line is faster, level is 55–90 s', h.time < dockTime && h.time > 55 && dockTime < 90, `${h.time}s vs ${dockTime}s`);
  h = await run2({ route: 'roof', kick: false, retry: true });
  check('harbor: missed kick-off bounces off the tarp into the dock alley', h.state === 'finish' && /bounce:[1-9]/.test(h.tricks) && h.stats.falls === 0 && h.minYMid < 9, `${h.tricks}`);
  const keys = await p2.evaluate(() => [localStorage.getItem('cyberheist.bestCash2'), localStorage.getItem('cyberheist.bestCash')].join('|'));
  check('harbor: bests are stored separately from job 01', /^50000\|/.test(keys), keys);
  await p2.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
