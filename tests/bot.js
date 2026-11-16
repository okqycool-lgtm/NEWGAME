// Runs inside the page: drives the real simulation tick-by-tick with a scripted bot.
// opts: { route: 'roof'|'market', kick: bool, vaultAC: bool, chase: bool, jumpGap1: bool, maxT }
window.runBot = function (opts) {
  const { game, player: p, tick, resetRun, level: L } = window.__ch;
  const o = Object.assign({ route: 'market', kick: true, vaultAC: true, chase: true, jumpGap1: true, maxT: 150, retry: false }, opts);
  game.manual = true;
  if (!o.keep) resetRun(o.retry);
  p.wallB = false;
  const log = [], cashLog = [];
  const emit0 = p.emit.bind(p);
  p.emit = (type, data) => { log.push({ type, d: +p.d.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), t: +game.time.toFixed(2), kind: data && data.kind, why: data && data.why }); emit0(type, data); };
  let lastCash = game.cash, t = 0, heldSlide = false, dj = false, minYMid = 99, maxCash = game.cash, wasAir = false;
  const H = L.LEVEL === 2;                 // Iron Harbor: mirrored split, different gaps
  const fastName = H ? 'roof' : 'roof';
  const harborX = (d) => {
    if (d < 196) return 0;
    const low = d > 265 && d < 450 && p.y < 12.5;
    if (o.route === 'roof' && !low) {
      if (d < 232) return 3; if (d < 310) return 12.5; if (d < 336) return 11; if (d < 356) return 6; if (d < 446) return 8.5;
    } else {
      if (d < 222) return -2; if (d < 302) return -4; if (d < 316) return 0; if (d < 330) return -8; if (d < 348) return -4; if (d < 360) return 2.5;
      if (d < 414) return -4; if (d < 428) return 0; if (d < 442) return -8;
    }
    if (d < 530) return 0; if (d < 552) return 3; return 0;
  };
  const targetX = () => {
    const d = p.d, b = game.bundles.find((b) => b.alive);
    if (b && o.chase && b.d > d - 1) return b.x;
    if (b && !o.chase) return b.x > p.x ? p.x - 3 : p.x + 3;
    if (H) return harborX(d);
    const low = d > 258 && d < 430 && p.y < 12;
    if (d < 222) return 0;
    if (o.route === 'roof' && !low) {
      if (d < 236) return -8; if (d < 262) return -10.5; if (d < 300) return -2.5; if (d < 322) return -4.5; if (d < 336) return -9.5; if (d < 400) return -7;
    } else {
      if (d < 236) return 2; if (d < 286) return 5; if (d < 298) return 1; if (d < 312) return 8; if (d < 330) return 5; if (d < 342) return 10.5;
      if (d < 376) return 5; if (d < 388) return 2; if (d < 400) return 9; if (d < 430) return 4;
    }
    return 0;
  };
  let maxSpeed = 0, topSpeed = 0, maxCombo = 0;
  while (t < o.maxT && game.state !== 'finish' && game.state !== 'busted' && !(o.stopD && p.d >= o.stopD)) {
    const inp = { steer: 0, jump: false, slide: false, slideHeld: false };
    if (game.state === 'ready') { if (!o.retry && t > 0.05) inp.jump = true; }
    else if (game.state === 'play') {
      inp.steer = Math.max(-1, Math.min(1, (targetX() - p.x) * 1.5));
      const d = p.d;
      // vaults
      const v = p.grounded && p.findVault();
      if (v && v.d0 - d < (o.perfect ? 1.4 : 2.7) && (o.vaultAC || v.d0 !== (H ? 44 : 22))) inp.jump = true;
      // shutters
      const sh = L.colliders.find((c) => c.kind === 'over' && c.d0 - d < (o.perfect ? 2.4 : 4.3) && c.d1 - d > -1 && p.x + 0.4 > c.x0 && p.x - 0.4 < c.x1 && Math.abs(c.base - p.y) < 1);
      const slope = p.grounded && p.ground && p.ground.kind === 'ramp' && p.ground.yB < p.ground.yA && o.slopes !== false;
      if (slope) { inp.slideHeld = true; if (p.state === 'run') inp.slide = true; }
      if (sh && o.noSlide) { /* run straight into it */ } else
      if (sh) { inp.slideHeld = true; if (!heldSlide) inp.slide = true; heldSlide = true; } else heldSlide = false;
      // gaps
      const gaps = H ? [[68.9, o.jumpGap1], [174.4, true], [360.6, o.route === 'roof'], [558.9, true], [584.9, true], [610.9, true]]
        : [[38.8, o.jumpGap1], [78.6, true], [568.6, true]];
      for (const [gd, on] of gaps) if (on && p.grounded && d >= gd && d < gd + 1.2 && p.y > (H ? 3 : 7)) inp.jump = true;
      if (!H && !p.grounded && p.state === 'air' && !p.usedDouble && p.vy < -1 && d > 80 && d < 91 && !o.noDouble) inp.jump = true;
      // wall run + kick
      if (o.route === 'roof' && H) {
        if (p.grounded && d >= 259 && d < 262 && p.x > 11) { inp.jump = true; inp.steer = 1; }
        if (d > 259 && d < 295 && p.state === 'air' && p.y > 17 && !p.kickT) inp.steer = 1;
        if (p.state === 'wallrun') { inp.steer = 1; if (o.kick && d >= 289) inp.jump = true; }
        if (d > 430 && d < 450 && !p.grounded && p.vy < 0 && p.y - 5 < 1.2) inp.slide = true;      // roll on the long drop
      } else if (o.route === 'roof') {
        // wall A on the left, kick across to wall B on the right, kick back onto the roofs
        if (p.grounded && d >= 251 && d < 255 && p.x < -9) { inp.jump = true; inp.steer = -1; }
        if (d > 251 && d < 274 && p.state === 'air' && p.y > 19 && !p.wallB && !p.kickT) inp.steer = -1;
        if (p.state === 'wallrun' && p.wall.side < 0) { inp.steer = -1; if (o.kick && d >= 265) { inp.jump = true; p.wallB = true; } }
        if (p.wallB && p.state === 'air' && d < 300 && p.y > 18.5 && !o.kickB) inp.steer = 1;
        if (p.state === 'wallrun' && p.wall.side > 0) { inp.steer = 1; if (d >= 293) { inp.jump = true; o.kickB = true; } }
      }
      // van
      if (d > L.VAN.triggerD + 20 && p.grounded && game.vanD - d < 2.2) inp.jump = true;
      if (d > (H ? 300 : 304) && d < (H ? 430 : 388)) minYMid = Math.min(minYMid, p.y);
    }
    tick(1 / 120, inp);
    t += 1 / 120;
    if (game.cash !== lastCash) { cashLog.push({ t: +game.time.toFixed(2), d: +p.d.toFixed(1), cash: game.cash }); lastCash = game.cash; }
    maxCash = Math.max(maxCash, game.cash); topSpeed = Math.max(topSpeed, p.speed); maxCombo = Math.max(maxCombo, p.combo); if (p.state === 'slide') maxSpeed = Math.max(maxSpeed, p.speed);
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
    cashLog, result: game.result, topSpeed: +topSpeed.toFixed(1), maxCombo, perfects: log.filter((e) => e.type === 'vault' || e.type === 'slide').length, maxSlideSpeed: +maxSpeed.toFixed(1), chaseT: +game.chaseT.toFixed(2), resultsShown: game.resultsShown,
  };
};
