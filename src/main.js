// Cyber Heist — Glass District. Game loop, camera, HUD, cash rules.
import * as THREE from 'three';
import { Player } from './player.js';
import { Runner } from './runner.js';
import { buildWorld } from './world.js';
import { Fx, makeBundleMesh } from './fx.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Cop } from './cop.js';
import { Gfx } from './gfx.js';
import * as L from './level.js';

const $ = (id) => document.getElementById(id);
const FIXED = 1 / 120;
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

// ---------------------------------------------------------------- renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120a26);
scene.fog = new THREE.Fog(0x131c33, 55, 900);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 3200);
// ---------------------------------------------------------------- objects
const world = buildWorld(scene, renderer);
const gfx = new Gfx(renderer, scene, camera, (level) => world.setQuality(level));
$('gfxbtn').textContent = 'GFX ' + gfx.label;
addEventListener('resize', () => gfx.resize());
const player = new Player();
const runner = new Runner();
scene.add(runner.root);
const fx = new Fx(scene);
const sfx = new Sfx();
const input = new Input();
const cop = new Cop(scene);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);
const bundleMeshes = [];
const HUM_SPOTS = [[6.5, 196], [12, 284], [12, 309], [12, 335], [12, 360], [12, 386], [12, 411], [-9.5, 56], [9.6, 106], [-10, 176]];

// ---------------------------------------------------------------- persistent bests
const store = {
  get(k) { try { const v = localStorage.getItem('cyberheist.' + k); return v === null ? null : Number(v); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('cyberheist.' + k, String(v)); } catch { /* private mode */ } },
};

// ---------------------------------------------------------------- game state
const game = {
  state: 'ready', first: true, manual: false, clock: 0, timeScale: 0.12, acc: 0,
  cash: L.START_CASH, time: 0, vanD: L.VAN.startD, vanGo: false, vanSpeed: 0,
  bundles: [], finishT: 0, resultsShown: false, shake: 0, camBlend: 1, chaseT: 0,
  stats: { dropped: 0, recovered: 0, lost: 0, falls: 0 }, lastStep: 0, result: null,
};
const cam = { x: 0, y: 34, off: 0, roll: 0, fov: 62, pos: new THREE.Vector3(0, 38, 20), look: new THREE.Vector3() };

function resetRun(retry) {
  player.reset(retry);
  player.events.length = 0;
  Object.assign(game, {
    state: 'ready', first: !retry, cash: L.START_CASH, time: 0, vanD: L.VAN.startD, vanGo: false, vanSpeed: 0,
    finishT: 0, resultsShown: false, shake: 0, camBlend: 1, acc: 0, result: null, chaseT: 0,
    stats: { dropped: 0, recovered: 0, lost: 0, falls: 0 },
  });
  game.bundles.length = 0;
  bundleMeshes.forEach((m) => { m.visible = false; });
  fx.reset();
  cop.reset();
  $('chase').classList.remove('show');
  world.glassPane.visible = true;
  world.van.position.set(L.VAN.x, 0, -L.VAN.startD);
  cam.x = 0; cam.y = player.y; cam.off = 0;
  $('results').classList.add('hidden');
  $('title').classList.toggle('hidden', retry);
  for (const id of ['toast', 'delta']) $(id).className = '';
  hud.cash = -1;
}

// ---------------------------------------------------------------- HUD helpers
const hud = { cash: -1, time: '', prompt: '', prog: -1 };
function restart(el, cls) { el.className = ''; void el.offsetWidth; el.className = cls; }
function toast(text, cls) { $('toast').textContent = text; restart($('toast'), 'show ' + cls); }
function delta(text, cls) {
  $('delta').textContent = text; restart($('delta'), 'show ' + cls);
  restart($('cashbox'), 'chip ' + (cls === 'gain' ? 'gain' : 'hit'));
}
function showBests() {
  const bc = store.get('bestCash'), bt = store.get('bestTime');
  $('title-bests').textContent = bc === null ? '' : `BEST CASH ${money(bc)}  ·  BEST TIME ${clock(bt)}`;
}
const PROMPTS = {
  steer: ['<b>A / D</b> or <b>← →</b> to steer', '<b>Swipe anywhere</b> to steer'],
  vault: ['<b>VAULT</b> — press <b>SPACE</b> right at the unit', '<b>VAULT</b> — tap <b>JUMP</b> right at the unit'],
  slide: ['<b>SLIDE</b> under — hold <b>S</b> or <b>↓</b>', '<b>SLIDE</b> under — hold <b>SLIDE</b>'],
  double: ['<b>DOUBLE JUMP</b> the gap — jump, then jump again in mid-air', '<b>DOUBLE JUMP</b> the gap — jump, then jump again in mid-air'],
  split: ['<b>◀ ROOFTOPS</b> wall run · fast &nbsp;|&nbsp; <b>MARKET ▶</b> street · safer', '<b>◀ ROOFTOPS</b> wall run · fast &nbsp;|&nbsp; <b>MARKET ▶</b> street · safer'],
  wall: ['Jump at the billboard and <b>steer left</b> into it', 'Jump at the billboard and <b>steer left</b> into it'],
  wallrun: ['<b>JUMP</b> on the yellow <b>KICK</b> panel', '<b>JUMP</b> on the yellow <b>KICK</b> panel'],
  roll: ['Long drop — tap <b>S</b> just before landing to <b>ROLL</b>', 'Long drop — tap <b>SLIDE</b> just before landing to <b>ROLL</b>'],
  gap: ['<b>JUMP!</b>', '<b>JUMP!</b>'],
  slope: ['<b>SLIDE</b> the slope — hold <b>S</b> to ride it down fast', '<b>SLIDE</b> the slope — hold <b>SLIDE</b> to ride it down fast'],
  van: ['<b>JUMP</b> into the van!', '<b>JUMP</b> into the van!'],
  ready: ['Press <b>SPACE</b> — kick through the glass', 'Tap <b>JUMP</b> — kick through the glass'],
};
function currentPrompt() {
  if (game.state === 'ready') return game.first ? '' : 'ready';
  if (game.state !== 'play') return '';
  if (player.state === 'wallrun') return 'wallrun';
  for (const z of L.prompts) {
    if (player.d < z.d0 || player.d > z.d1) continue;
    if (z.x1 !== undefined && player.x > z.x1) continue;
    if (z.x0 !== undefined && player.x < z.x0) continue;
    if (z.yMin !== undefined && player.y < z.yMin) continue;
    return z.key;
  }
  return '';
}
function updateHud() {
  if (game.cash !== hud.cash) { hud.cash = game.cash; $('cash').textContent = money(game.cash); }
  const t = clock(game.time);
  if (t !== hud.time) { hud.time = t; $('time').textContent = t; }
  const key = currentPrompt();
  const html = key ? PROMPTS[key][input.touchMode ? 1 : 0] : '';
  if (html !== hud.prompt) {
    hud.prompt = html;
    if (html) $('prompt').innerHTML = html;
    $('prompt').classList.toggle('show', !!html);
  }
  const prog = Math.round(Math.max(0, Math.min(1, player.d / (700 + L.S))) * 200) / 2;
  if (prog !== hud.prog) { hud.prog = prog; $('progfill').style.width = prog + '%'; }
  const chasing = game.chaseT > 0 && game.state === 'play';
  $('chase').classList.toggle('show', chasing);
  if (chasing) $('chasefill').style.width = (game.chaseT / L.CHASE_TIME) * 100 + '%';
}

// ---------------------------------------------------------------- cash bundles
function spawnBundle(before) {
  const p = player;
  let lo = -99, hi = 99;
  const cl = L.clampAt(p.d), g = p.groundUnder(p.x, p.d, p.y + 1);
  if (cl) [lo, hi] = cl; else if (g) { lo = g.c.x0; hi = g.c.x1; }
  const dir = p.x <= (lo + hi) / 2 ? 1 : -1;
  const room = dir > 0 ? hi - p.x : p.x - lo;
  const off = Math.max(0.6, Math.min(2.8, room - 0.8));
  let mesh = bundleMeshes.find((m) => !m.visible);
  if (!mesh) { mesh = makeBundleMesh(); scene.add(mesh); bundleMeshes.push(mesh); }
  mesh.visible = true;
  game.bundles.push({ x: p.x, y: p.y + 1.2, d: p.d, vx: (dir * off) / 0.6, vy: 6.5, vd: Math.max(before, 9) + 3.5, t: 0, hits: 0, rest: false, alive: true, mesh });
}
function endBundle(b, recovered) {
  if (!b.alive) return;                       // each bundle resolves exactly once
  b.alive = false; b.mesh.visible = false;
  if (recovered) {
    game.cash += L.BUNDLE; game.stats.recovered++;
    delta('+' + money(L.BUNDLE), 'gain'); toast('+' + money(L.BUNDLE) + ' RECOVERED', 'gain'); sfx.play('recover');
  } else {
    game.stats.lost++;
    toast('BUNDLE LOST', 'loss'); sfx.play('lost');
  }
}
function updateBundles(dt) {
  for (const b of game.bundles) {
    if (!b.alive) continue;
    b.t += dt;
    if (!b.rest) {
      b.vy -= 26 * dt;
      b.x += b.vx * dt; b.d += b.vd * dt;
      const py = b.y; b.y += b.vy * dt;
      if (b.vy < 0) {
        const g = player.groundUnder(b.x, b.d, py + 0.05);
        if (g && g.top >= b.y) {
          b.y = g.top; b.hits++;
          if (b.hits >= 2) { b.rest = true; b.vx = b.vd = b.vy = 0; }
          else { b.vy = -b.vy * 0.35; b.vx *= 0.4; b.vd *= 0.45; }
        }
      }
    }
    if (b.t > 0.3 && game.state === 'play' && Math.abs(b.x - player.x) < 1.3 && Math.abs(b.d - player.d) < 1.5 && Math.abs(b.y - player.y) < 2.6) endBundle(b, true);
    else if (b.t > 5 || b.y < L.killY(b.d) - 2 || b.d < player.d - 6) endBundle(b, false);
  }
  if (game.bundles.length > 8) game.bundles = game.bundles.filter((b) => b.alive);
}

// ---------------------------------------------------------------- simulation
const TRICKS = { vault: 'SPEED VAULT', wallrun: 'WALL RUN', kickoff: 'KICK-OFF!', ledge: 'LEDGE CATCH', bounce: 'AWNING SAVE!' };
function handleEvents() {
  for (const e of player.events) {
    switch (e.type) {
      case 'kickstart': game.state = 'kick'; $('title').classList.add('hidden'); break;
      case 'kicklaunch': game.camBlend = 0; sfx.play('kickoff'); break;
      case 'glass':
        world.glassPane.visible = false; fx.shatter(player.x, 34.3, 0); sfx.play('glass'); game.shake = 0.5;
        break;
      case 'jump': sfx.play('jump'); break;
      case 'djump': sfx.play('djump'); break;
      case 'slide': sfx.play('slide'); break;
      case 'vault': case 'wallrun': case 'kickoff': case 'ledge': case 'bounce':
        sfx.play(e.type); toast(TRICKS[e.type], 'trick'); break;
      case 'land':
        if (e.kind === 'roll') { sfx.play('roll'); toast('ROLL!', 'trick'); }
        else if (e.kind === 'hard') { sfx.play('hard'); game.shake = 0.35; toast('HARD LANDING', 'trick'); }
        else sfx.play('land');
        fx.puff(player.x, player.y, player.d, e.kind === 'soft' ? 4 : 10);
        break;
      case 'clip':
        if (game.chaseT > 0) { busted(); player.events.length = 0; return; }   // tripped with the officer on your tail
        game.chaseT = L.CHASE_TIME; sfx.play('siren');
        sfx.play('clip'); game.shake = 0.45;
        fx.burst(runner.packPos(tmp), 10, player.speed);
        if (game.cash >= L.BUNDLE) {
          game.cash -= L.BUNDLE; game.stats.dropped++;
          spawnBundle(e.before);
          delta('−' + money(L.BUNDLE), 'loss'); toast('−' + money(L.BUNDLE) + ' · GRAB THE BUNDLE!', 'loss');
        }
        break;
      case 'fall': {
        if (game.state !== 'play') break;
        const pen = Math.min(game.cash, L.FALL_PENALTY);
        game.cash -= pen; game.stats.falls++;
        game.bundles.forEach((b) => { if (b.alive) { b.alive = false; b.mesh.visible = false; game.stats.lost++; } });
        player.respawn();
        cam.x = player.x; cam.y = player.y;
        delta('−' + money(pen), 'loss'); toast((e.why === 'stuck' ? 'CORNERED' : 'FELL') + ' −' + money(pen), 'loss');
        sfx.play('fall');
        $('flash').classList.add('on'); requestAnimationFrame(() => $('flash').classList.remove('on'));
        player.events.length = 0;
        return;
      }
      case 'van': finish(); break;
    }
  }
  player.events.length = 0;
}

function finish() {
  game.state = 'finish'; game.finishT = 0;
  game.bundles.forEach((b) => { if (b.alive) { b.alive = false; b.mesh.visible = false; game.stats.lost++; } });
  const prevCash = store.get('bestCash'), prevTime = store.get('bestTime');
  const newCash = prevCash === null || game.cash > prevCash, newTime = prevTime === null || game.time < prevTime;
  if (newCash) store.set('bestCash', game.cash);
  if (newTime) store.set('bestTime', Number(game.time.toFixed(3)));
  game.result = { cash: game.cash, time: game.time, newCash, newTime, bestCash: newCash ? game.cash : prevCash, bestTime: newTime ? game.time : prevTime };
  sfx.play('finish');
  fx.burst(runner.packPos(tmp), 30, 4);
}
function busted() {
  game.state = 'busted'; game.finishT = 0; game.shake = 0.6;
  player.setState('busted'); player.speed = 0;
  game.bundles.forEach((b) => { if (b.alive) { b.alive = false; b.mesh.visible = false; } });
  // a busted run delivers nothing and never touches the personal bests
  game.result = { busted: true, cash: 0, time: game.time, newCash: false, newTime: false, bestCash: store.get('bestCash'), bestTime: store.get('bestTime') };
  sfx.play('busted');
  $('flash').classList.add('on'); requestAnimationFrame(() => $('flash').classList.remove('on'));
}
function showResults() {
  const r = game.result;
  game.resultsShown = true;
  $('results').classList.toggle('busted', !!r.busted);
  $('res-cashlbl').textContent = r.busted ? 'CASH SEIZED' : 'CASH DELIVERED';
  $('res-head').textContent = r.busted ? 'BUSTED' : r.cash >= L.START_CASH ? 'PERFECT GETAWAY' : r.cash > 0 ? 'CLEAN GETAWAY' : 'EMPTY-HANDED';
  $('res-cash').textContent = money(r.busted ? game.cash : r.cash); $('res-time').textContent = clock(r.time);
  $('res-bestcash').textContent = r.bestCash === null ? '—' : money(r.bestCash); $('res-besttime').textContent = r.bestTime === null ? '—' : clock(r.bestTime);
  $('st-cash').classList.toggle('new', r.newCash); $('st-time').classList.toggle('new', r.newTime);
  $('results').classList.remove('hidden');
  showBests();
}

function tick(dt, inp) {
  if (game.state === 'finish') {
    game.finishT += dt;
    game.vanSpeed = Math.min(17, game.vanSpeed + 9 * dt, Math.max(0, (1080 - game.vanD) * 0.6));
    game.vanD += game.vanSpeed * dt;
    player.x += (L.VAN.x - player.x) * Math.min(1, 12 * dt);
    player.y += (L.VAN.bedY - player.y) * Math.min(1, 12 * dt);
    player.d = game.vanD + 1.5; player.stateT += dt;
    if (!game.resultsShown && game.finishT > 1.2) showResults();
    return;
  }
  if (game.state === 'busted') {
    game.finishT += dt;
    if (!game.resultsShown && game.finishT > 1.3) showResults();
    return;
  }
  if (game.chaseT > 0 && game.state === 'play') game.chaseT = Math.max(0, game.chaseT - dt);
  player.frontLimit = game.vanD - 0.1;
  player.vanSpeed = game.vanSpeed;
  player.step(dt, inp);
  if (game.state === 'kick' && player.state !== 'kick') game.state = 'play';
  if (game.state === 'kick' || game.state === 'play') game.time += dt;
  handleEvents();
  if (!game.vanGo && player.d > L.VAN.triggerD) game.vanGo = true;
  if (game.vanGo && game.state !== 'finish') {
    game.vanSpeed = game.vanD > 1250 ? 0 : Math.min(L.VAN.speed, game.vanSpeed + 6 * dt);
    game.vanD += game.vanSpeed * dt;
  }
  updateBundles(dt);
  const stepN = Math.floor(player.phase / Math.PI);
  if (stepN !== game.lastStep) { game.lastStep = stepN; if (player.grounded && (player.state === 'run' || player.state === 'ready')) sfx.play('step'); }
}

function advance(rdt) {
  game.clock += rdt;
  const slowKick = player.state === 'kick' && player.kickPhase === 1;
  const target = game.state === 'ready' && game.first ? 0.12 : slowKick ? 0.4 : 1;
  game.timeScale = target < game.timeScale ? target : game.timeScale + (target - game.timeScale) * Math.min(1, 5 * rdt);
  game.acc += rdt * game.timeScale;
  const inp = input.consume();
  if ((game.state === 'finish' || game.state === 'busted') && game.resultsShown && game.finishT > 2 && inp.jump) { resetRun(true); return; }
  let n = 0;
  while (game.acc >= FIXED && n < 14) {
    tick(FIXED, n === 0 ? inp : { ...inp, jump: false, slide: false });
    game.acc -= FIXED; n++;
  }
  if (n === 14) game.acc = 0;
  if (n === 0) { if (inp.jump) input.jumpQ++; if (inp.slide) input.slideQ++; }   // slow-mo frame: keep the press
}

// ---------------------------------------------------------------- presentation
const tmp = new THREE.Vector3(), follow = new THREE.Vector3(), look = new THREE.Vector3();
const sidePos = new THREE.Vector3(7.2, 35.7, -2.8), sideLook = new THREE.Vector3();
function updateCamera(dt) {
  const p = player, portrait = camera.aspect < 0.9;
  const back = portrait ? 9 : 6.8, up = portrait ? 4.6 : 3.3;
  if (game.state === 'finish') {
    // ease the offset relative to the moving van so the camera never falls behind it
    const vz = -game.vanD;
    tmp.set(cam.pos.x, cam.pos.y, cam.pos.z - vz).lerp(follow.set(4.6, 3.3, 6.5), Math.min(1, 3 * dt));
    cam.pos.set(tmp.x, tmp.y, tmp.z + vz);
    cam.look.lerp(look.set(0, 1.7, vz - 2), Math.min(1, 10 * dt));
  } else {
    const ky = p.grounded || p.state === 'ledge' ? 9 : p.y < cam.y ? 7 : 2.2;
    cam.y += (p.y - cam.y) * Math.min(1, ky * dt);
    cam.x += (p.x - cam.x) * Math.min(1, 8 * dt);
    cam.off += ((p.state === 'wallrun' ? -p.wall.side * 2.6 : 0) - cam.off) * Math.min(1, 4 * dt);
    follow.set(cam.x + cam.off, cam.y + up, -(p.d - back));
    look.set((cam.x + p.x) / 2 + cam.off * 0.3, cam.y + 1.2, -(p.d + 11));
    if (game.state === 'kick' && p.kickPhase === 1) { if (p.d > 0.2) game.camBlend = Math.min(1, game.camBlend + dt / 0.38); }
    else game.camBlend = Math.min(1, game.camBlend + dt / 0.38);
    const s = game.camBlend * game.camBlend * (3 - 2 * game.camBlend);
    sideLook.set(p.x, p.y + 1, -p.d);
    cam.pos.lerpVectors(sidePos, follow, s); cam.look.lerpVectors(sideLook, look, s);
  }
  camera.position.copy(cam.pos);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 1.6);
    camera.position.x += (Math.random() - 0.5) * game.shake; camera.position.y += (Math.random() - 0.5) * game.shake;
  }
  camera.lookAt(cam.look);
  cam.roll += ((p.state === 'wallrun' ? p.wall.side * 0.09 : -p.steer * 0.025) - cam.roll) * Math.min(1, 5 * dt);
  camera.rotateZ(cam.roll);
  const fov = (portrait ? 80 : 62) + (p.boostT > 0 && game.state === 'play' ? 5 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, 4 * dt);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

function present(rdt) {
  const sdt = rdt * game.timeScale;
  runner.update(player, game.manual ? rdt : sdt, game.clock);
  if (game.state !== 'finish' && player.state !== 'done') fx.trail(sdt, runner.packPos(tmp), player.speed);
  fx.update(sdt, game.clock);
  world.update(game.clock, player.d);
  cop.update(rdt, game.clock, player, game.state === 'play' ? game.chaseT : 0, game.state === 'busted');
  if (cop.stomp) { sfx.play('stomp'); game.shake = Math.max(game.shake, 0.07); }
  world.van.position.z = -game.vanD;

  const g = player.groundUnder(player.x, player.d, player.y + 0.5);
  shadow.visible = !!g && game.state !== 'finish';
  if (g) { const k = 1 / (1 + (player.y - g.top) * 0.18); shadow.position.set(player.x, g.top + 0.04, -player.d); shadow.scale.setScalar(k * 1.2); }

  for (const b of game.bundles) {
    if (!b.alive) continue;
    b.mesh.position.set(b.x, b.y + 0.3, -b.d);
    b.mesh.userData.spin.rotation.y = game.clock * 5; b.mesh.userData.spin.rotation.x = b.rest ? 0.3 : game.clock * 9;
    b.mesh.visible = b.t < 3.5 || Math.floor(game.clock * 10) % 2 === 0;
  }
  let hum = 0;
  for (const [x, d] of HUM_SPOTS) hum = Math.max(hum, 1 - Math.hypot(x - player.x, d - player.d) / 16);
  sfx.setHum(game.state === 'play' ? hum : 0);

  if (player.state === 'slide' && player.grounded && game.state === 'play') fx.slide(sdt, player.x, player.y, player.d, player.speed);
  // the shadow-casting light follows the runner (snapped so shadow edges don't shimmer)
  const sx = Math.round(player.x / 2) * 2, sy = Math.round(player.y / 2) * 2, sz = Math.round(-player.d / 2) * 2;
  world.sun.position.set(sx - 9, sy + 70, sz + 42); world.sun.target.position.set(sx, sy, sz - 6); world.sun.target.updateMatrixWorld();
  updateCamera(rdt);
  updateHud();
  gfx.render(rdt, game.clock, player.boostT > 0 && game.state === 'play' ? Math.min(1, player.speed / 15) : 0, Math.min(1, game.shake * 1.6), player.d < 0.5 && game.state !== 'finish');
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (!game.manual) advance(rdt);
  present(rdt);
}

// ---------------------------------------------------------------- wiring
input.onAny = () => sfx.unlock();
input.onRetry = (code) => {
  if (game.state === 'finish' || game.state === 'busted' ? game.resultsShown : code === 'KeyR' && game.state === 'play') resetRun(true);
};
input.onMute = () => { sfx.setMuted(!sfx.muted); $('mute').classList.toggle('off', sfx.muted); };
input.bindTouch({ root: $('touch'), zone: $('steerzone'), knob: $('knob'), jump: $('btn-jump'), slide: $('btn-slide') });
$('mute').classList.toggle('off', sfx.muted);
$('gfxbtn').addEventListener('click', () => { gfx.cycle(); $('gfxbtn').textContent = 'GFX ' + gfx.label; $('gfxbtn').blur(); });
$('mute').addEventListener('click', () => { sfx.unlock(); input.onMute(); $('mute').blur(); });
$('title').addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); input.pressJump(); });
$('retry').addEventListener('click', () => { sfx.unlock(); resetRun(true); $('retry').blur(); });
document.addEventListener('visibilitychange', () => { last = performance.now(); });

resetRun(false);
showBests();
requestAnimationFrame(frame);

// Debug / automated playtest hook.
window.__ch = { game, player, input, runner, cop, gfx, level: L, tick, resetRun, store, camera };
