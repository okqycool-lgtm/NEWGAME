// Level data for every job (no rendering). Units are metres.
// One level is active per page load: chosen by ?level=N, else the last one picked.
// Coordinates: x = lateral (right is +), y = up, d = distance along the route.
// World-space z is -d.

export const BASE_SPEED = 11.5;
export const START_CASH = 50000;
export const BUNDLE = 2500;
export const FALL_PENALTY = 5000;

// The finale sits this far beyond its original position (room for the shanty rooftops).
export const S = 164;

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
  // ---------------------------------------------------------------- structures
  solid(-9, 9, 34, -60, 0.6, { y0: 33.4, style: 'bankfloor' });
  
  // Opening stretch
  solid(-6, 6, 28, 1, 80, { style: 'roof', win: 0 });
  solid(-6, 6, 26, 80, 150, { style: 'roof', win: 1 });
  // (gap 150..161 — double jump)
  solid(-12, 12, 26, 161, 240, { style: 'roof', win: 0 });
  
  // Split: rooftop line (left)
  solid(-12, -4, 26, 240, 252, { style: 'roof', win: 0, noLip: true });
  solid(-22, -12, 46, 236, 250, { style: 'pilaster' });
  solid(-13, -12, 34, 250, 284, { y0: 24.5, style: 'billboard' });
  bounce(-13, -4, 19, 252, 290, { style: 'awning' });
  solid(-13, -4, 23, 290, 352, { style: 'roof', win: 1 });
  bounce(-13, -4, 14, 352, 360, { style: 'alley', targetX: 3 });
  solid(-13, -4, 21, 360, 420, { style: 'roof', win: 2 });
  solid(-22, -13, 46, 240, 440, { style: 'tallwall' });
  
  // Split: market line (right)
  ramp(-4, 12, 240, 266, 26, 14, { style: 'ramp' });
  solid(-4, 12, 14, 266, 440, { style: 'market' });
  solid(12, 26, 46, 240, 440, { style: 'aptwall' });
  
  // Merge + final sprint
  solid(-13, -4, 12, 420, 440, { style: 'plaza' });
  solid(-13, 12, 12, 440, 472, { style: 'plaza' });
  solid(-6, 6, 12, 472, 560, { style: 'roof', win: 1 });
  
  // Shanty rooftops: climb, then two long tin-roof slopes to slide
  ramp(-6, 6, 560, 580, 12, 21, { style: 'ramp' });
  solid(-6, 6, 21, 580, 612, { style: 'roof', win: 2, shanty: true });
  ramp(-6, 6, 612, 646, 21, 14, { style: 'tin' });
  // (gap 646..655)
  solid(-6, 6, 13, 655, 700, { style: 'roof', win: 2, shanty: true });
  ramp(-6, 6, 700, 725, 13, 9, { style: 'tin' });
  // (gap 725..734)
  solid(-6, 6, 8, 570 + S, 622 + S, { style: 'roof', win: 0 });
  ramp(-6, 6, 622 + S, 652 + S, 8, 0, { style: 'ramp' });
  solid(-8, 8, 0, 652 + S, 1500, { y0: -2, style: 'road' });
  
  // ---------------------------------------------------------------- obstacles
  low(-5.5, 5.5, 28, 1.0, 46, 1.6, 'ac');
  over(-6, 6, 26, 118, 'shutter');
  
  low(5, 8, 26, 2.0, 196, 1.0, 'vending');
  low(-1, 3, 26, 1.0, 206, 1.4, 'crate');
  low(-10.5, -5.5, 26, 1.0, 214, 1.6, 'ac');
  
  // rooftop line
  low(-13, -8.5, 23, 1.0, 318, 1.6, 'ac');
  low(-8.5, -4, 23, 0.9, 336, 1.4, 'skylight');
  over(-13, -4, 21, 386, 'pipes');
  
  // market line
  low(4, 12, 14, 1.0, 300, 1.4, 'stall');
  low(-4, 3, 14, 1.0, 313, 1.4, 'stall');
  over(-4, 12, 14, 328, 'shutter');
  low(0, 8, 14, 1.0, 345, 1.4, 'stall');
  low(-4, 12, 14, 1.0, 380, 1.4, 'stall');
  over(-4, 12, 14, 398, 'shutter');
  low(5, 12, 14, 1.0, 412, 1.4, 'stall');
  low(-4, 4, 14, 1.0, 426, 1.4, 'stall');
  
  // final sprint
  low(-5.5, 5.5, 12, 1.0, 494, 1.6, 'ac');
  over(-6, 6, 12, 522, 'shutter');
  low(-6, -0.5, 12, 1.0, 542, 1.4, 'crate');
  low(0.5, 6, 8, 1.0, 592 + S, 1.4, 'crate');
  
  // extra rooftop clutter on the opening roofs
  low(2, 5, 28, 1.0, 66, 1.2, 'chairs');
  low(-6, -2.5, 26, 2.4, 94, 3, 'shack');
  low(1, 5, 26, 0.9, 138, 1.4, 'solar');
  // shanty rooftops
  low(-6, -1, 21, 0.9, 592, 1.4, 'solar');
  low(2, 6, 21, 2.4, 600, 3, 'shack');
  over(-6, 6, 21 - 7 * (16 / 34), 628, 'pipes');
  low(-2, 2, 13, 1.0, 668, 1.2, 'chairs');
  low(-6, -3, 13, 2.0, 680, 1.0, 'vending');
  low(-5.5, 5.5, 13, 1.0, 690, 1.6, 'ac');
  
  // ---------------------------------------------------------------- wall runs
  // side: -1 = wall is on the runner's left. x = the runnable face.
  const walls = [
    { x: -12, side: -1, d0: 250, d1: 284, y0: 24.5, y1: 34, kickFrom: 276 },
  ];
  const LANDING_PAD = { x0: -11.5, x1: -5.5, d0: 290.6, d1: 297, y: 23 };
  
  // ---------------------------------------------------------------- zones
  // Soft lateral corridor (parapets / funnels). a = range at d0, b = range at d1.
  const clampZones = [
    { d0: -60, d1: 1, a: [-2.4, 2.4], b: [-2.4, 2.4] },
    { d0: 1, d1: 161, a: [-6, 6], b: [-6, 6] },
    { d0: 161, d1: 176, a: [-6, 6], b: [-12, 12] },
    { d0: 176, d1: 240, a: [-12, 12], b: [-12, 12] },
    { d0: 440, d1: 472, a: [-13, 12], b: [-6, 6] },
    { d0: 472, d1: 622 + S, a: [-6, 6], b: [-6, 6] },
    { d0: 622 + S, d1: 652 + S, a: [-6, 6], b: [-2.05, 2.05] },
    { d0: 652 + S, d1: 5000, a: [-2.05, 2.05], b: [-2.05, 2.05] },
  ];
  function killY(d) {
    if (d < 240) return 20;
    if (d < 440) return 8;
    if (d < 729) return 6;
    if (d < 626 + S) return 2;
    return -20;
  }
  // The night market is crowded: slightly slower than the rooftops.
  function speedMult(d, y) {
    return d > 266 && d < 440 && y < 17.5 ? 0.87 : 1;
  }
  
  const checkpoints = [
    { d: 6, x: 0, y: 28 },
    { d: 84, x: 0, y: 26 },
    { d: 126, x: 0, y: 26 },
    { d: 166, x: 0, y: 26 },
    { d: 294, x: -8.5, y: 23, x0: -13, x1: -4 },
    { d: 340, x: -10.5, y: 23, x0: -13, x1: -4 },
    { d: 364, x: -8.5, y: 21, x0: -13, x1: -4 },
    { d: 270, x: 4, y: 14, x0: -4, x1: 12 },
    { d: 362, x: 4, y: 14, x0: -4, x1: 12 },
    { d: 446, x: 0, y: 12 },
    { d: 530, x: 2.5, y: 12 },
    { d: 583, x: 2, y: 21 },
    { d: 660, x: 0, y: 13 },
    { d: 574 + S, x: -2, y: 8 },
    { d: 656 + S, x: 0, y: 0 },
  ];
  
  // Tutorial prompts: shown while the runner is inside the zone.
  const prompts = [
    { d0: 4, d1: 26, key: 'steer' },
    { d0: 29, d1: 46, key: 'vault' },
    { d0: 98, d1: 118, key: 'slide' },
    { d0: 131, d1: 152, key: 'double' },
    { d0: 170, d1: 232, key: 'split' },
    { d0: 232, d1: 252, x1: -4, key: 'wall' },
    { d0: 396, d1: 421, x1: -4, yMin: 20, key: 'roll' },
    { d0: 236, d1: 262, x0: -4, key: 'slope' },
    { d0: 600, d1: 640, key: 'slope' },
    { d0: 640, d1: 648, key: 'gap' },
    { d0: 696, d1: 716, key: 'slope' },
    { d0: 716, d1: 727, key: 'gap' },
    { d0: 640 + S, d1: 5000, key: 'van' },
  ];
  
  const VAN = { startD: 676 + S, triggerD: 628 + S, speed: 7.2, x: 0, bedY: 0.75 };
  const LEVEL_END = 720 + S;
  const INFO = {
    id: 1, job: 'JOB 01 // KUMO BANK', name: 'GLASS DISTRICT', sub: 'GLASS DISTRICT · NIGHT', total: 700 + S, start: 'KUMO BANK',
    zone: (d, y) => (d < 240 ? 'ROOFTOPS' : d < 440 ? (y < 19.5 ? 'NIGHT MARKET' : 'BILLBOARD ROW') : d < 560 ? 'FUNNEL' : d < 734 ? 'SHANTY ROOFS' : 'GETAWAY ROAD'),
  };
  return { walls, LANDING_PAD, clampZones, killY, speedMult, checkpoints, prompts, VAN, LEVEL_END, INFO };
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
  return { walls, LANDING_PAD, clampZones, killY, speedMult, checkpoints, prompts, VAN, LEVEL_END: 760, INFO };
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
export const { walls, LANDING_PAD, clampZones, killY, speedMult, checkpoints, prompts, VAN, LEVEL_END, INFO } = LEVEL === 2 ? harbor() : glass();
export function clampAt(d) {
  for (const z of clampZones) {
    if (d >= z.d0 && d < z.d1) {
      const k = (d - z.d0) / (z.d1 - z.d0);
      return [z.a[0] + (z.b[0] - z.a[0]) * k, z.a[1] + (z.b[1] - z.a[1]) * k];
    }
  }
  return null;
}
