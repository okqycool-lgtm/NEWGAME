// Glass District — pure level data (no rendering). Units are metres.
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
export const walls = [
  { x: -12, side: -1, d0: 250, d1: 284, y0: 24.5, y1: 34, kickFrom: 276 },
];
export const LANDING_PAD = { x0: -11.5, x1: -5.5, d0: 290.6, d1: 297, y: 23 };

// ---------------------------------------------------------------- zones
// Soft lateral corridor (parapets / funnels). a = range at d0, b = range at d1.
export const clampZones = [
  { d0: -60, d1: 1, a: [-2.4, 2.4], b: [-2.4, 2.4] },
  { d0: 1, d1: 161, a: [-6, 6], b: [-6, 6] },
  { d0: 161, d1: 176, a: [-6, 6], b: [-12, 12] },
  { d0: 176, d1: 240, a: [-12, 12], b: [-12, 12] },
  { d0: 440, d1: 472, a: [-13, 12], b: [-6, 6] },
  { d0: 472, d1: 622 + S, a: [-6, 6], b: [-6, 6] },
  { d0: 622 + S, d1: 652 + S, a: [-6, 6], b: [-2.05, 2.05] },
  { d0: 652 + S, d1: 5000, a: [-2.05, 2.05], b: [-2.05, 2.05] },
];
export function clampAt(d) {
  for (const z of clampZones) {
    if (d >= z.d0 && d < z.d1) {
      const k = (d - z.d0) / (z.d1 - z.d0);
      return [z.a[0] + (z.b[0] - z.a[0]) * k, z.a[1] + (z.b[1] - z.a[1]) * k];
    }
  }
  return null;
}
export function killY(d) {
  if (d < 240) return 20;
  if (d < 440) return 8;
  if (d < 729) return 6;
  if (d < 626 + S) return 2;
  return -20;
}
// The night market is crowded: slightly slower than the rooftops.
export function speedMult(d, y) {
  return d > 266 && d < 440 && y < 17.5 ? 0.87 : 1;
}

export const checkpoints = [
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
export const prompts = [
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

export const VAN = { startD: 676 + S, triggerD: 628 + S, speed: 7.2, x: 0, bedY: 0.75 };
export const LEVEL_END = 720 + S;
export const CHASE_TIME = 8;
