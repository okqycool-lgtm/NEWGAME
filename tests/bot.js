// Runs inside the page: drives the real simulation tick-by-tick with a scripted bot.
// opts: { route: 'roof'|'market', kick: bool, vaultAC: bool, chase: bool, jumpGap1: bool, maxT }
window.runBot = function (opts) {
  const { game, player: p, tick, resetRun, level: L } = window.__ch;
  const o = Object.assign({ route: 'market', kick: true, vaultAC: true, chase: true, jumpGap1: true, maxT: 150, retry: false }, opts);
  game.manual = true;
  if (!o.keep) resetRun(o.retry);
  const log = [], cashLog = [];
  const emit0 = p.emit.bind(p);
  p.emit = (type, data) => { log.push({ type, d: +p.d.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), t: +game.time.toFixed(2), kind: data && data.kind, why: data && data.why }); emit0(type, data); };
  let lastCash = game.cash, t = 0, heldSlide = false, dj = false, minYMid = 99, maxCash = game.cash, wasAir = false;
  const targetX = () => {
    const d = p.d, b = game.bundles.find((b) => b.alive);
    if (b && o.chase && b.d > d - 1) return b.x;
    if (b && !o.chase) return b.x > p.x ? p.x - 3 : p.x + 3;
    if (d < 185) return 0;
    const low = d > 255 && d < 440 && p.y < 19.5;
    if (o.route === 'roof' && !low) {
      if (d < 222) return -3; if (d < 300) return -12.5; if (d < 326) return -6; if (d < 346) return -11; if (d < 436) return -8.5;
    } else {
      if (d < 212) return 2; if (d < 292) return 4; if (d < 306) return 0; if (d < 320) return 7; if (d < 334) return 4; if (d < 350) return 10.5;
      if (d < 402) return 4; if (d < 417) return 1; if (d < 432) return 8;
    }
    if (d < 530) return 0; if (d < 548) return 3; if (d < 596) return 2; if (d < 606) return -3; if (d < 676) return 0; if (d < 686) return 2; if (d < 744) return 0; if (d < 764) return -3; return 0;
  };
  let maxSpeed = 0;
  while (t < o.maxT && game.state !== 'finish' && game.state !== 'busted' && !(o.stopD && p.d >= o.stopD)) {
    const inp = { steer: 0, jump: false, slide: false, slideHeld: false };
    if (game.state === 'ready') { if (!o.retry && t > 0.05) inp.jump = true; }
    else if (game.state === 'play') {
      inp.steer = Math.max(-1, Math.min(1, (targetX() - p.x) * 1.5));
      const d = p.d;
      // vaults
      const v = p.grounded && p.findVault();
      if (v && v.d0 - d < 2.3 && (o.vaultAC || v.d0 !== 46)) inp.jump = true;
      // shutters
      const sh = L.colliders.find((c) => c.kind === 'over' && c.d0 - d < 3.2 && c.d1 - d > -1 && p.x + 0.4 > c.x0 && p.x - 0.4 < c.x1 && Math.abs(c.base - p.y) < 1);
      const slope = p.grounded && p.ground && p.ground.kind === 'ramp' && p.ground.yB < p.ground.yA && o.slopes !== false;
      if (slope) { inp.slideHeld = true; if (p.state === 'run') inp.slide = true; }
      if (sh && o.noSlide) { /* run straight into it */ } else
      if (sh) { inp.slideHeld = true; if (!heldSlide) inp.slide = true; heldSlide = true; } else heldSlide = false;
      // gaps
      const gaps = [[148.6, o.jumpGap1], [350.6, o.route === 'roof'], [644.4, true], [723.4, true]];
      for (const [gd, on] of gaps) if (on && p.grounded && d >= gd && d < gd + 1.2 && p.y > 7) inp.jump = true;
      if (!p.grounded && p.state === 'air' && !p.usedDouble && p.vy < -1 && ((d > 150 && d < 161 && o.jumpGap1) )) inp.jump = true;
      // wall run + kick
      if (o.route === 'roof') {
        if (p.grounded && d >= 249 && d < 252 && p.x < -11) { inp.jump = true; inp.steer = -1; }
        if (d > 249 && d < 285 && p.state === 'air' && p.y > 24 && !p.kickT) inp.steer = -1;
        if (p.state === 'wallrun') { inp.steer = -1; if (o.kick && d >= 279) inp.jump = true; }
        // roll on the long drop
        if (d > 420 && d < 440 && !p.grounded && p.vy < 0 && p.y - 12 < 1.2) inp.slide = true;
      }
      // van
      if (d > 650 + L.S && p.grounded && game.vanD - d < 2.2) inp.jump = true;
      if (d > 290 && d < 420) minYMid = Math.min(minYMid, p.y);
    }
    tick(1 / 120, inp);
    t += 1 / 120;
    if (game.cash !== lastCash) { cashLog.push({ t: +game.time.toFixed(2), d: +p.d.toFixed(1), cash: game.cash }); lastCash = game.cash; }
    maxCash = Math.max(maxCash, game.cash); if (p.state === 'slide') maxSpeed = Math.max(maxSpeed, p.speed);
  }
  // let the finish settle so results + bests are written
  if (game.state === 'finish' || game.state === 'busted') for (let i = 0; i < 200; i++) tick(1 / 120, { steer: 0, jump: false, slide: false, slideHeld: false });
  p.emit = emit0;
  const count = (ty) => log.filter((e) => e.type === ty).length;
  return {
    state: game.state, time: +game.time.toFixed(2), cash: game.cash, maxCash, stats: { ...game.stats }, d: +p.d.toFixed(1), minYMid,
    tricks: ['vault', 'wallrun', 'kickoff', 'ledge', 'bounce', 'clip', 'fall', 'djump', 'slide'].map((k) => k + ':' + count(k)).join(' '),
    lands: log.filter((e) => e.type === 'land' && e.kind !== 'soft').map((e) => e.kind + '@' + e.d).join(' '),
    notable: log.filter((e) => ['clip', 'fall', 'bounce', 'ledge', 'wallrun', 'kickoff', 'walloff', 'van'].includes(e.type)),
    cashLog, result: game.result, maxSlideSpeed: +maxSpeed.toFixed(1), chaseT: +game.chaseT.toFixed(2), resultsShown: game.resultsShown,
  };
};
