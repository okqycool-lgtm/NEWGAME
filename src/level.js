// Level data for every job (no rendering). Units are metres.
// One level is active per page load: chosen by ?level=N, else the last one picked.
// Coordinates: x = lateral (right is +), y = up, d = distance along the route.
// World-space z is -d.

export const BASE_SPEED = 11.5;
export const START_CASH = 50000;
export const BUNDLE = 2500;
export const FALL_PENALTY = 5000;

export const S = 0;   // legacy offset, kept for imports

export const colliders = [];
const add = (c) => { c.id = colliders.length; colliders.push(c); return c; };
const solid = (x0, x1, top, d0, d1, o = {}) => add({ kind: 'solid', x0, x1, y0: 0, y1: top, d0, d1, ...o });
const bounce = (x0, x1, top, d0, d1, o = {}) => add({ kind: 'bounce', x0, x1, y0: 0, y1: top, d0, d1, targetX: 4, ...o });
const ramp = (x0, x1, d0, d1, yA, yB, o = {}) =>
  add({ kind: 'ramp', x0, x1, d0, d1, yA, yB, y0: Math.min(yA, yB) - 0.4, y1: Math.max(yA, yB), ...o });
const low = (x0, x1, base, h, d0, depth, style) =>
  add({ kind: 'low', x0, x1, y0: base, y1: base + h, d0, d1: d0 + depth, style });
const over = (x0, x1, base, d0, style) =>
  add({ kind: 'over', x0, x1, y0: base + 1.15, y1: base + 3.5, d0, d1: d0 + 0.5, base, style });

function glass() {
  // JOB 01: GLASS DISTRICT. Short roofs, constant height changes: fan launchers up, zip lines
  // down, a wall-to-wall chain over the market, a climb up the stack and a long slide out.
  solid(-9, 9, 34, -60, 0.6, { y0: 33.4, style: 'bankfloor' });

  // Act 1 — the drop
  solid(-6, 6, 28, 1, 40, { style: 'roof', win: 0, margin: true });
  // (gap 40..46)
  solid(-6, 6, 26, 46, 80, { style: 'roof', win: 1, margin: true });
  // (gap 80..91 — double jump)
  solid(-6, 6, 26, 91, 119, { style: 'roof', win: 0, margin: true });
  bounce(-6, 6, 26, 119, 126, { style: 'fan', power: 20, targetX: undefined });
  solid(-6, 6, 31, 130, 164, { style: 'roof', win: 2, margin: true, md1: 150 });
  // zip line 1: 164 → 216, down to the split roof
  solid(-12, 12, 20, 214, 250, { style: 'roof', win: 0, margin: true, md1: 244 });

  // Act 2 — the canyon. High line (left): wall A → wall B → roofs, fan, zip over the market.
  solid(-10, -2, 20, 250, 256, { style: 'roof', win: 0, noLip: true });
  solid(-22, -10, 46, 250, 252, { style: 'pilaster' });
  solid(-12, -10, 29, 252, 274, { y0: 19.2, style: 'billboard', wall: 0 });
  solid(-2, -1, 29, 274, 300, { y0: 19.2, style: 'billboard', wall: 1 });
  bounce(-12, -2, 13, 256, 302, { style: 'awning', targetX: 5 });
  solid(-12, -2, 18, 302, 344, { style: 'roof', win: 1, open: true });
  bounce(-12, -2, 18, 344, 351, { style: 'fan', power: 20, targetX: undefined });
  solid(-12, -2, 23, 355, 392, { style: 'roof', win: 2, open: true });
  solid(-12, -2, 8, 392, 430, { style: 'plaza' });
  solid(-22, -12, 46, 252, 430, { style: 'tallwall' });
  // Low line (right): ramp into the night market
  ramp(-2, 12, 250, 276, 20, 8, { style: 'ramp' });
  solid(-2, 12, 8, 276, 430, { style: 'market' });
  solid(12, 26, 46, 250, 430, { style: 'aptwall', deck: 8 });

  // Act 3 — the stack: two fans up, a long tin slide, a kicker, and out
  solid(-12, 12, 6, 430, 462, { style: 'plaza', funnel: [[-12, -6], [12, 6]] });
  bounce(-6, 6, 6, 462, 469, { style: 'fan', power: 20, targetX: undefined });
  solid(-6, 6, 11, 473, 498, { style: 'roof', win: 1, shanty: true, margin: true });
  bounce(-6, 6, 11, 498, 505, { style: 'fan', power: 20, targetX: undefined });
  solid(-6, 6, 16, 509, 530, { style: 'roof', win: 2, shanty: true, margin: true });
  ramp(-6, 6, 530, 570, 16, 8, { style: 'tin' });
  // (gap 570..579)
  solid(-6, 6, 7, 579, 606, { style: 'roof', win: 2, shanty: true, margin: true });
  ramp(-6, 6, 606, 614, 7, 9.5, { style: 'kicker', kick: 10 });
  // (gap 614..623)
  solid(-6, 6, 6, 623, 650, { style: 'roof', win: 0, margin: true });
  ramp(-6, 6, 650, 684, 6, 0, { style: 'tin', last: true });
  solid(-8, 8, 0, 684, 1500, { y0: -2, style: 'road' });

  // obstacles
  low(-5.5, 5.5, 28, 1.0, 22, 1.6, 'ac');
  over(-6, 6, 26, 62, 'shutter');
  low(-6, -1, 26, 1.0, 104, 1.4, 'crate');
  low(-2, 2, 31, 1.0, 143, 1.2, 'chairs');
  over(-12, 12, 20, 232, 'shutter');
  // high line
  low(-12, -7, 18, 1.0, 316, 1.6, 'ac');
  low(-7, -2, 18, 0.9, 330, 1.4, 'skylight');
  over(-12, -2, 23, 372, 'pipes');
  // market
  low(5, 12, 8, 1.0, 292, 1.4, 'stall');
  low(-2, 4, 8, 1.0, 306, 1.4, 'stall');
  over(-2, 12, 8, 320, 'shutter');
  low(1, 8, 8, 1.0, 336, 1.4, 'stall');
  low(-2, 12, 8, 1.0, 352, 1.4, 'stall');
  over(-2, 12, 8, 368, 'shutter');
  low(6, 12, 8, 1.0, 382, 1.4, 'stall');
  low(-2, 5, 8, 1.0, 394, 1.4, 'stall');
  // the stack
  low(-12, -3, 6, 1.0, 444, 1.6, 'ac');
  low(-5.5, 5.5, 11, 1.0, 486, 1.4, 'crate');
  over(-6, 6, 16 - 8 * (20 / 40), 550, 'pipes');
  low(-2, 2, 7, 1.0, 591, 1.2, 'chairs');
  low(-5.5, 5.5, 6, 1.0, 636, 1.6, 'ac');

  const walls = [
    { x: -10, side: -1, d0: 252, d1: 274, y0: 19.2, y1: 29, kickFrom: 264 },
    { x: -2, side: 1, d0: 274, d1: 300, y0: 19.2, y1: 29, kickFrom: 291 },
  ];
  // zip lines: grab at (x0, d0), ride to (x1, d1). y is the cable; the runner hangs 2.2 m below.
  const zips = [
    { x0: 0, d0: 163.4, y0: 33.2, x1: 0, d1: 216, y1: 23.0 },
    { x0: -7, d0: 391.4, y0: 25.2, x1: 2, d1: 440, y1: 9.1 },
  ];
  const LANDING_PAD = { x0: -10.5, x1: -3.5, d0: 302.6, d1: 309, y: 18 };
  const clampZones = [
    { d0: -60, d1: 1, a: [-2.4, 2.4], b: [-2.4, 2.4] },
    { d0: 1, d1: 150, a: [-6, 6], b: [-6, 6] },
    { d0: 150, d1: 163, a: [-6, 6], b: [-1.9, 1.9] },
    { d0: 163, d1: 214, a: [-1.9, 1.9], b: [-1.9, 1.9] },
    { d0: 214, d1: 236, a: [-12, 12], b: [-12, 12] },
    { d0: 236, d1: 246, a: [-12, 12], b: [-10, 12] },
    { d0: 246, d1: 256, a: [-10, 12], b: [-10, 12] },
    { d0: 430, d1: 462, a: [-12, 12], b: [-6, 6] },
    { d0: 462, d1: 650, a: [-6, 6], b: [-6, 6] },
    { d0: 650, d1: 684, a: [-6, 6], b: [-2.05, 2.05] },
    { d0: 684, d1: 5000, a: [-2.05, 2.05], b: [-2.05, 2.05] },
  ];
  const killY = (d) => (d < 130 ? 20 : d < 214 ? 18 : d < 250 ? 14 : d < 430 ? 2 : d < 660 ? 1 : -20);
  const speedMult = (d, y) => (d > 276 && d < 430 && y < 11 ? 0.87 : 1);
  const checkpoints = [
    { d: 5, x: 0, y: 28 }, { d: 48, x: 0, y: 26 }, { d: 93, x: 0, y: 26 }, { d: 133, x: 0, y: 31 }, { d: 219, x: 0, y: 20 },
    { d: 305, x: -7, y: 18, x0: -12, x1: -2 }, { d: 358, x: -7, y: 23, x0: -12, x1: -2 },
    { d: 280, x: 5, y: 8, x0: -2, x1: 12 }, { d: 360, x: 5, y: 8, x0: -2, x1: 12 },
    { d: 434, x: 0, y: 6 }, { d: 476, x: 0, y: 11 }, { d: 512, x: 0, y: 16 }, { d: 582, x: 0, y: 7 }, { d: 626, x: 0, y: 6 }, { d: 688, x: 0, y: 0 },
  ];
  const prompts = [
    { d0: 2, d1: 10, key: 'steer' },
    { d0: 10, d1: 22, key: 'vault' },
    { d0: 28, d1: 41, key: 'gap' },
    { d0: 50, d1: 62, key: 'slide' },
    { d0: 68, d1: 82, key: 'double' },
    { d0: 106, d1: 120, key: 'fan' },
    { d0: 148, d1: 166, key: 'zip' },
    { d0: 218, d1: 244, key: 'split' },
    { d0: 244, d1: 256, x1: -2, key: 'walls' },
    { d0: 246, d1: 272, x0: -2, key: 'slope' },
    { d0: 380, d1: 393, x1: -2, yMin: 20, key: 'zip' },
    { d0: 520, d1: 566, key: 'slope' },
    { d0: 566, d1: 572, key: 'gap' },
    { d0: 596, d1: 608, key: 'kicker' },
    { d0: 644, d1: 676, key: 'slope' },
    { d0: 676, d1: 5000, key: 'van' },
  ];
  const VAN = { startD: 708, triggerD: 660, speed: 7.2, x: 0, bedY: 0.75 };
  const LEVEL_END = 760;
  const INFO = {
    id: 1, job: 'JOB 01 // KUMO BANK', name: 'GLASS DISTRICT', sub: 'GLASS DISTRICT · NIGHT', total: 760, start: 'KUMO BANK',
    zone: (d, y) => (d < 130 ? 'THE DROP' : d < 216 ? 'HIGH ROOF · ZIP' : d < 250 ? 'SPLIT' : d < 430 ? (y < 11 ? 'NIGHT MARKET' : 'CANYON WALLS') : d < 530 ? 'THE STACK' : d < 660 ? 'TIN SLIDE' : 'GETAWAY ROAD'),
  };
  return { walls, zips, LANDING_PAD, clampZones, killY, speedMult, checkpoints, prompts, VAN, LEVEL_END, INFO };
}

// ---------------------------------------------------------------- JOB 02: IRON HARBOR
// Container port across the bay. Mirrored split (the fast line is on the right, along a
// freighter hull), a conveyor to slide early on, and container hops before the pier.
function harbor() {
  solid(-9, 9, 34, -60, 0.6, { y0: 33.4, style: 'bankfloor' });

  solid(-6, 6, 28, 1, 70, { style: 'stack' });
  // (gap 70..76)
  solid(-6, 6, 28, 76, 140, { style: 'stack' });
  ramp(-6, 6, 140, 176, 28, 20, { style: 'belt' });
  // (gap 176..185)
  solid(-12, 12, 19, 185, 250, { style: 'stack' });

  // split: crane line (right, fast) along the hull
  solid(4, 12, 19, 250, 262, { style: 'stack', noLip: true });
  solid(12, 24, 40, 246, 260, { style: 'hullend' });
  solid(12, 13, 27, 260, 294, { y0: 17.5, style: 'billboard' });
  bounce(4, 13, 12, 262, 300, { style: 'net', targetX: -4 });
  solid(4, 13, 16, 300, 362, { style: 'stack' });
  bounce(4, 13, 7, 362, 370, { style: 'netlow', targetX: -3 });
  solid(4, 13, 14, 370, 430, { style: 'stack' });
  solid(13, 24, 40, 260, 450, { style: 'hull' });

  // split: dock alley (left, safer)
  ramp(-12, 4, 250, 276, 19, 7, { style: 'gangway' });
  solid(-12, 4, 7, 276, 450, { style: 'dock' });
  solid(-26, -12, 40, 250, 450, { style: 'cwall' });

  // merge, run-up, container hops, pier
  solid(4, 13, 5, 430, 450, { style: 'quay' });
  solid(-12, 13, 5, 450, 482, { style: 'quay' });
  solid(-6, 6, 5, 482, 560, { style: 'stack' });
  solid(-4, 4, 5, 566, 586, { style: 'stack', hop: true });
  solid(-4, 4, 5, 592, 612, { style: 'stack', hop: true });
  solid(-4, 4, 4, 618, 660, { style: 'stack', hop: true });
  ramp(-4, 4, 660, 684, 4, 0, { style: 'belt' });
  solid(-8, 8, 0, 684, 1500, { y0: -2, style: 'pier' });

  // obstacles
  low(-6, -1, 28, 1.0, 24, 1.2, 'drum');
  low(-5.5, 5.5, 28, 1.0, 44, 1.6, 'crate');
  over(-6, 6, 28, 58, 'spreader');
  low(1, 5, 28, 2.0, 96, 2.2, 'forklift');
  low(-6, -1, 28, 0.9, 110, 1.4, 'pallet');
  low(-5.5, 5.5, 28, 1.0, 126, 1.6, 'crate');
  over(-6, 6, 28 - 8 * (18 / 36), 158, 'scanner');
  low(-3, 2, 19, 1.0, 205, 1.4, 'crate');
  low(-9, -5, 19, 2.0, 216, 2.2, 'forklift');
  low(5, 10, 19, 0.9, 226, 1.4, 'pallet');
  // crane line
  low(4, 8.5, 16, 1.0, 326, 1.4, 'drum');
  low(8.5, 13, 16, 1.0, 344, 1.6, 'crate');
  over(4, 13, 14, 396, 'spreader');
  // dock alley
  low(-12, -4, 7, 0.9, 310, 1.4, 'pallet');
  low(-3, 4, 7, 1.0, 323, 1.4, 'crate');
  over(-12, 4, 7, 338, 'barrier');
  low(-8, 0, 7, 1.0, 355, 1.2, 'drum');
  low(-12, 4, 7, 1.0, 390, 1.6, 'crate');
  over(-12, 4, 7, 408, 'barrier');
  low(-12, -5, 7, 0.9, 422, 1.4, 'pallet');
  low(-4, 4, 7, 1.0, 436, 1.4, 'crate');
  // run-up
  low(-5.5, 5.5, 5, 1.0, 500, 1.6, 'crate');
  over(-6, 6, 5, 526, 'spreader');
  low(-6, -1, 5, 2.0, 544, 2.2, 'forklift');

  const walls = [{ x: 12, side: 1, d0: 260, d1: 294, y0: 17.5, y1: 27, kickFrom: 286 }];
  const LANDING_PAD = { x0: 5.5, x1: 11.5, d0: 300.6, d1: 307, y: 16 };
  const clampZones = [
    { d0: -60, d1: 1, a: [-2.4, 2.4], b: [-2.4, 2.4] },
    { d0: 1, d1: 185, a: [-6, 6], b: [-6, 6] },
    { d0: 185, d1: 200, a: [-6, 6], b: [-12, 12] },
    { d0: 200, d1: 250, a: [-12, 12], b: [-12, 12] },
    { d0: 450, d1: 482, a: [-12, 13], b: [-6, 6] },
    { d0: 482, d1: 556, a: [-6, 6], b: [-6, 6] },
    { d0: 556, d1: 566, a: [-6, 6], b: [-4, 4] },
    { d0: 566, d1: 660, a: [-4, 4], b: [-4, 4] },
    { d0: 660, d1: 684, a: [-4, 4], b: [-2.05, 2.05] },
    { d0: 684, d1: 5000, a: [-2.05, 2.05], b: [-2.05, 2.05] },
  ];
  const killY = (d) => (d < 250 ? 13 : d < 450 ? 1 : d < 662 ? 0.6 : -20);
  const speedMult = (d, y) => (d > 276 && d < 450 && y < 10.5 ? 0.87 : 1);
  const checkpoints = [
    { d: 6, x: 0, y: 28 }, { d: 80, x: 0, y: 28 }, { d: 190, x: 0, y: 19 },
    { d: 304, x: 8.5, y: 16, x0: 4, x1: 13 }, { d: 350, x: 6, y: 16, x0: 4, x1: 13 }, { d: 374, x: 8.5, y: 14, x0: 4, x1: 13 },
    { d: 280, x: -4, y: 7, x0: -12, x1: 4 }, { d: 372, x: -4, y: 7, x0: -12, x1: 4 },
    { d: 456, x: 0, y: 5 }, { d: 532, x: 2.5, y: 5 }, { d: 568, x: 0, y: 5 }, { d: 622, x: 0, y: 4 }, { d: 688, x: 0, y: 0 },
  ];
  const prompts = [
    { d0: 60, d1: 71, key: 'gap' },
    { d0: 130, d1: 170, key: 'slope' },
    { d0: 170, d1: 178, key: 'gap' },
    { d0: 194, d1: 242, key: 'split2' },
    { d0: 242, d1: 262, x0: 4, key: 'wall2' },
    { d0: 246, d1: 272, x1: 4, key: 'slope' },
    { d0: 406, d1: 431, x0: 4, yMin: 13, key: 'roll' },
    { d0: 550, d1: 614, key: 'hops' },
    { d0: 650, d1: 672, key: 'slope' },
    { d0: 672, d1: 5000, key: 'van2' },
  ];
  const VAN = { startD: 708, triggerD: 660, speed: 7.2, x: 0, bedY: 0.75 };
  const INFO = {
    id: 2, job: 'JOB 02 // HANAZO PORT AUTHORITY', name: 'IRON HARBOR', sub: 'IRON HARBOR · RAIN', total: 760, start: 'PORT CONTROL',
    zone: (d, y) => (d < 140 ? 'CONTAINER STACKS' : d < 185 ? 'CONVEYOR 4' : d < 250 ? 'UPPER STACKS' : d < 450 ? (y < 10.5 ? 'DOCK ALLEY' : 'CRANE LINE') : d < 560 ? 'QUAYSIDE' : d < 662 ? 'CONTAINER HOPS' : 'PIER 9'),
  };
  return { walls, zips: [], LANDING_PAD, clampZones, killY, speedMult, checkpoints, prompts, VAN, LEVEL_END: 760, INFO };
}

// ---------------------------------------------------------------- active level
export const LEVELS = [{ id: 1, name: 'GLASS DISTRICT' }, { id: 2, name: 'IRON HARBOR' }];
function pickLevel() {
  let n = 1;
  try {
    const q = new URLSearchParams(location.search).get('level');
    n = Number(q || localStorage.getItem('cyberheist.level') || 1);
  } catch { /* no storage */ }
  return n === 2 ? 2 : 1;
}
export const LEVEL = pickLevel();
export const CHASE_TIME = 8;
export const { walls, zips, LANDING_PAD, clampZones, killY, speedMult, checkpoints, prompts, VAN, LEVEL_END, INFO } = LEVEL === 2 ? harbor() : glass();
export function clampAt(d) {
  for (const z of clampZones) {
    if (d >= z.d0 && d < z.d1) {
      const k = (d - z.d0) / (z.d1 - z.d0);
      return [z.a[0] + (z.b[0] - z.a[0]) * k, z.a[1] + (z.b[1] - z.a[1]) * k];
    }
  }
  return null;
}
