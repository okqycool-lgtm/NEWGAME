// Builds the Glass District: route geometry from level data plus procedural city dressing.
// Everything is generated at runtime — no external assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colliders, walls, LANDING_PAD, VAN, S, LEVEL } from './level.js';
import { buildHarbor } from './world2.js';

export const ACCENT = 0xffd60a;        // runnable walls + reachable ledges
const CYAN = 0x39f0ff, MAGENTA = 0xff3df0, PURPLE = 0x8b5cff, HAZARD = 0xff3b30, WARM = 0xffb347;

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ textures
// Facades at dusk: weathered concrete lit by the sunset, with dense warm window light in
// irregular clusters. Returns the colour map plus an emissive map holding only the lit panes.
export function windowTexture(lit, seed, wall = '#5a5068', density = 0.34, maxRun = 4) {
  const r = rng(seed), W = 40, H = 60, COLS = 12, ROWS = 8;
  const cv = document.createElement('canvas'), ev = document.createElement('canvas');
  cv.width = ev.width = W * COLS; cv.height = ev.height = H * ROWS;
  const g = cv.getContext('2d'), e = ev.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, cv.width, cv.height);
  e.fillStyle = '#000'; e.fillRect(0, 0, ev.width, ev.height);
  for (let i = 0; i < 200; i++) {                                   // patchy, repainted concrete
    g.fillStyle = r() < 0.5 ? `rgba(255,235,220,${0.02 + r() * 0.06})` : `rgba(30,15,40,${0.05 + r() * 0.14})`;
    g.fillRect(r() * cv.width, r() * cv.height, 6 + r() * 70, 4 + r() * 40);
  }
  const on = [];
  for (let row = 0; row < ROWS; row++) {
    on.push(new Array(COLS).fill(null));
    if (r() < 0.12) continue;
    for (let col = 0; col < COLS; ) {
      if (r() < density) {
        const len = 1 + Math.floor(r() * maxRun), c = lit[Math.floor(r() * r() * lit.length)];
        for (let k = 0; k < len && col < COLS; k++, col++) on[row][col] = c;
        col += 1;
      } else col++;
    }
  }
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const x = col * W + 6, y = row * H + 12, w = 28, h = 34, c = on[row][col];
    g.fillStyle = '#2a2233'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    if (c) {
      for (const ctx of [g, e]) {
        ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
        const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(120,40,0,0.25)');
        ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(30,18,30,0.85)'; ctx.fillRect(x + w / 2 - 1, y, 2, h); ctx.fillRect(x, y + h * 0.45, w, 2);
      }
      const k = r();
      if (k < 0.3) { const bh = 6 + r() * 20; for (const ctx of [g, e]) { ctx.fillStyle = 'rgba(40,24,30,0.6)'; ctx.fillRect(x, y, w, bh); } }
      else if (k < 0.4) { const px = x + 5 + r() * 14; for (const ctx of [g, e]) { ctx.fillStyle = 'rgba(30,18,24,0.85)'; ctx.fillRect(px, y + h - 15, 7, 15); ctx.beginPath(); ctx.arc(px + 3.5, y + h - 18, 3.5, 0, 7); ctx.fill(); } }
    } else {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#3b3352'); gr.addColorStop(1, '#6b4a66');   // dark glass catching the sky
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = '#2a2233'; g.fillRect(x + w / 2 - 1, y, 2, h);
    }
    const st = g.createLinearGradient(0, y + h, 0, y + h + 22); st.addColorStop(0, 'rgba(30,15,35,0.4)'); st.addColorStop(1, 'rgba(30,15,35,0)');
    g.fillStyle = st; g.fillRect(x + 3 + r() * 14, y + h + 2, 5 + r() * 8, 22);       // rain stains under the sills
    if (r() < 0.16) { g.fillStyle = '#a79fa6'; g.fillRect(x + 4, y + h + 4, 16, 9); g.fillStyle = '#4a4350'; g.fillRect(x + 6, y + h + 6, 8, 5); }   // wall AC unit
    if (r() < 0.07) { g.fillStyle = ['#a8446a', '#4f7fa8', '#c9b06a'][Math.floor(r() * 3)]; g.fillRect(x - 2, y + h + 3, w + 4, 6); }                  // little awning
  }
  for (let row = 0; row < ROWS; row++) { g.fillStyle = 'rgba(30,15,40,0.4)'; g.fillRect(0, row * H + 55, cv.width, 5); g.fillStyle = 'rgba(255,230,210,0.1)'; g.fillRect(0, row * H + 53, cv.width, 2); }
  for (let col = 0; col < COLS; col += 3) { g.fillStyle = 'rgba(30,15,40,0.3)'; g.fillRect(col * W - 1, 0, 2, cv.height); }
  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { map: mk(cv, true), emis: mk(ev, true) };
}

// Night sky: near-black zenith, the city's neon glow along the horizon, a moon, stars and underlit cloud.
function skyTexture() {
  const r = rng(404), cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  [[0, '#03030c'], [0.25, '#080720'], [0.4, '#150f3c'], [0.47, '#2f1763'], [0.5, '#5a2488'], [0.52, '#2a1552'], [0.6, '#100a26'], [1, '#05040d']]
    .forEach(([t, c]) => gr.addColorStop(t, c));
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 520; i++) {                                                    // stars, thinning toward the glow
    const y = r() * r() * 235, a = 0.25 + r() * 0.75;
    g.fillStyle = `rgba(${200 + r() * 55},${205 + r() * 50},255,${a * (1 - y / 260)})`; g.fillRect(r() * 1024, y, r() < 0.12 ? 2 : 1, r() < 0.12 ? 2 : 1);
  }
  for (const [x, col, rad] of [[760, '255,60,200', 300], [520, '50,220,255', 260], [250, '150,90,255', 280], [960, '50,220,255', 200]]) {   // light pollution
    const gl = g.createRadialGradient(x, 262, 0, x, 262, rad);
    gl.addColorStop(0, `rgba(${col},0.42)`); gl.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gl; g.fillRect(0, 0, 1024, 512);
  }
  const mx = 610, my = 120, halo = g.createRadialGradient(mx, my, 6, mx, my, 70);                    // moon
  halo.addColorStop(0, 'rgba(210,220,255,0.55)'); halo.addColorStop(1, 'rgba(160,170,255,0)');
  g.fillStyle = halo; g.fillRect(mx - 70, my - 70, 140, 140);
  g.fillStyle = '#eef0ff'; g.beginPath(); g.arc(mx, my, 13, 0, 7); g.fill();
  g.fillStyle = 'rgba(170,180,220,0.5)'; g.beginPath(); g.arc(mx - 4, my - 3, 3, 0, 7); g.arc(mx + 5, my + 4, 2.2, 0, 7); g.fill();
  for (let i = 0; i < 60; i++) {                                                     // cloud banks lit from the streets below
    const y = 130 + r() * 125, x = r() * 1024, w = 60 + r() * 220, h = 5 + r() * 13, pink = r() < 0.5;
    for (const ox of [0, -1024, 1024]) {
      const cg = g.createLinearGradient(0, y - h, 0, y + h);
      cg.addColorStop(0, 'rgba(10,8,30,0)'); cg.addColorStop(0.45, 'rgba(14,10,38,0.7)');
      cg.addColorStop(0.85, pink ? 'rgba(200,60,190,0.4)' : 'rgba(50,170,230,0.34)'); cg.addColorStop(1, 'rgba(120,60,200,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(x + ox, y, w, h, 0, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Rooftop surface: a patchwork of poured slabs and tar-paper repairs, seams, stains and cracks.
export function roofTexture() {
  const r = rng(909), cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#8b8391'; g.fillRect(0, 0, 512, 512);
  const tones = ['#8b8391', '#7c7484', '#968d99', '#857b8a', '#746c7e', '#9a8f97', '#807889'];
  const cell = (x, y, w, h, depth) => {                              // recursive uneven split into slabs
    if (depth > 0 && (w > 150 || h > 150 || (r() < 0.62 && w > 56 && h > 56))) {
      if (w > h) { const k = Math.round(w * (0.35 + r() * 0.3)); cell(x, y, k, h, depth - 1); cell(x + k, y, w - k, h, depth - 1); }
      else { const k = Math.round(h * (0.35 + r() * 0.3)); cell(x, y, w, k, depth - 1); cell(x, y + k, w, h - k, depth - 1); }
      return;
    }
    g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x, y, w, h);
    if (r() < 0.2) { g.fillStyle = 'rgba(40,34,48,0.35)'; g.fillRect(x, y, w, h); }                  // tar-paper patch
    g.strokeStyle = 'rgba(38,30,46,0.75)'; g.lineWidth = 2.5; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.strokeStyle = 'rgba(255,240,235,0.10)'; g.lineWidth = 1; g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  };
  cell(0, 0, 512, 512, 6);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,245,240,0.07)' : 'rgba(20,12,28,0.10)'; g.fillRect(r() * 512, r() * 512, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 26; i++) {                                    // stains and scuffs
    const x = r() * 512, y = r() * 512, rad = 12 + r() * 40, gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(30,20,38,${0.18 + r() * 0.2})`); gr.addColorStop(1, 'rgba(30,20,38,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.strokeStyle = 'rgba(30,22,38,0.55)'; g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { let x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(214,176,60,${0.25 + r() * 0.35})`; g.fillRect(r() * 512, r() * 512, 3 + r() * 14, 2 + r() * 5); }   // old paint flecks
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Chain-link mesh for rooftop fences.
function fenceTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.strokeStyle = '#b9b2bd'; g.lineWidth = 3.2;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Warm pool of light under a wall lamp.
export function lampTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 0, 2, 64, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(52, 0); g.lineTo(76, 0); g.lineTo(128, 128); g.lineTo(0, 128); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Roughness map for wet roofs: glossy puddles in rougher concrete.
export function puddleTexture() {
  const r = rng(77), cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { const v = 120 + r() * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * 256, r() * 256, 2 + r() * 10, 2 + r() * 10); }
  for (let i = 0; i < 16; i++) {
    const x = r() * 256, y = r() * 256, rad = 16 + r() * 34;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, rad * 0.3, x + ox, y + oy, rad);
      gr.addColorStop(0, 'rgba(14,14,14,1)'); gr.addColorStop(1, 'rgba(14,14,14,0)');
      g.fillStyle = gr; g.save(); g.translate(x + ox, y + oy); g.scale(1, 0.55 + r() * 0.5); g.translate(-x - ox, -y - oy);
      g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 7); g.fill(); g.restore();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function signMesh(text, w, h, { fg = '#39f0ff', bg = '#120a26', vertical = false, sub = '', bare = false } = {}) {
  const ppm = Math.min(48, 1024 / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * ppm); cv.height = Math.round(h * ppm);
  const g = cv.getContext('2d');
  if (!bare) {
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = fg; g.lineWidth = Math.max(3, ppm * 0.12);
    g.strokeRect(g.lineWidth, g.lineWidth, cv.width - 2 * g.lineWidth, cv.height - 2 * g.lineWidth);
  }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = ppm * 0.35;
  const font = (px) => `900 italic ${px}px "Arial Black", Impact, "Segoe UI", sans-serif`;
  if (vertical) {
    const n = text.length, px = Math.min(cv.width * 0.72, (cv.height * 0.9) / n);
    g.font = font(px);
    [...text].forEach((ch, i) => g.fillText(ch, cv.width / 2, cv.height * 0.05 + (i + 0.5) * ((cv.height * 0.9) / n)));
  } else {
    let px = cv.height * (sub ? 0.46 : 0.6);
    g.font = font(px);
    const tw = g.measureText(text).width;
    if (tw > cv.width * 0.86) { px *= (cv.width * 0.86) / tw; g.font = font(px); }
    g.fillText(text, cv.width / 2, cv.height * (sub ? 0.4 : 0.53));
    if (sub && bare) {                         // tube-light strapline in a lit capsule, like a shopfront logo
      const bw = cv.width * 0.62, bh = cv.height * 0.2, bx = (cv.width - bw) / 2, by = cv.height * 0.7;
      g.fillStyle = fg; g.fillRect(bx, by, bw, bh);
      g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.font = `700 ${bh * 0.62}px "Segoe UI", Arial, sans-serif`;
      if ('letterSpacing' in g) g.letterSpacing = `${bh * 0.25}px`;
      g.fillText(sub, cv.width / 2, by + bh * 0.54);
    } else if (sub) { g.font = font(cv.height * 0.2); g.fillStyle = '#ffffff'; g.fillText(sub, cv.width / 2, cv.height * 0.78); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: bare, alphaTest: bare ? 0.08 : 0 }));
}

export function billboardTexture(w, flip = false) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b1030'; g.fillRect(0, 0, 1024, 256);
  const kx = ((w.kickFrom - w.d0) / (w.d1 - w.d0)) * 1024;
  if (flip) { g.save(); g.translate(1024, 0); g.scale(-1, 1); }      // mirrored layout for a wall on the right
  g.strokeStyle = '#ffd60a'; g.lineWidth = 26; g.lineJoin = 'miter';
  for (let x = 30; x < kx - 40; x += 92) {
    g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 56, 128); g.lineTo(x, 206); g.stroke();
  }
  g.fillStyle = '#ffd60a'; g.fillRect(kx, 0, 1024 - kx, 256);
  g.fillStyle = '#1b1030';
  g.beginPath(); const cx = kx + (1024 - kx) / 2;                      // arrow pointing off the wall
  g.moveTo(cx - 70, 150); g.lineTo(cx + 20, 150); g.lineTo(cx + 20, 128); g.lineTo(cx + 80, 180);
  g.lineTo(cx + 20, 232); g.lineTo(cx + 20, 210); g.lineTo(cx - 70, 210); g.closePath(); g.fill();
  g.strokeStyle = '#ffd60a'; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 242);
  if (flip) g.restore();
  g.fillStyle = '#1b1030'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 italic 92px "Arial Black", Impact, sans-serif';
  g.fillText('KICK', flip ? (1024 - kx) / 2 : kx + (1024 - kx) / 2, 92);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ batching
export class Batch {
  constructor(scene) { this.scene = scene; this.groups = new Map(); this.meshes = []; }
  push(key, material, geo, d) {
    const k = key + '|' + Math.floor(d / 160);
    if (!this.groups.has(k)) this.groups.set(k, { key, material, list: [] });
    this.groups.get(k).list.push(geo);
  }
  build() {
    for (const { key, material, list } of this.groups.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), material);
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = key === 'lit' || key === 'wet' || key === 'deck' || key.startsWith('win'); mesh.receiveShadow = mesh.castShadow;
      this.meshes.push({ key, mesh });
      this.scene.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.groups.clear();
  }
}

export function buildWorld(scene, renderer) {
  if (LEVEL === 2) return buildHarbor(scene, renderer);
  const R = rng(20771);
  const B = new Batch(scene);
  const lamMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0.12 });
  const roofMap = roofTexture();
  const wetMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: roofMap, roughness: 1, roughnessMap: puddleTexture(), metalness: 0.3, envMapIntensity: 1.6 });
  const wetLam = new THREE.MeshLambertMaterial({ vertexColors: true, map: roofMap });
  const fenceMat = new THREE.MeshLambertMaterial({ map: fenceTexture(), alphaTest: 0.45, side: THREE.DoubleSide, emissive: 0x3a3440 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const winMats = [
    windowTexture(['#ffc978', '#ffb060', '#ffe2a6', '#ff9a5a', '#9fe6ff'], 11, '#5d5269', 0.3, 5),              // concrete offices
    windowTexture(['#ffd08a', '#ffb86a', '#59dcff', '#ff6fb5', '#ffe6b8'], 22, '#4f4a66', 0.26, 6),              // darker tower, a little neon
    windowTexture(['#ffc66e', '#ffab52', '#ffe0a0', '#ff8a5c', '#ffd08a', '#ff6fb5'], 33, '#6a5568', 0.46, 3),   // packed housing block
    windowTexture(['#bfeaff', '#8fd8ff', '#ffe2b0', '#e6f7ff'], 44, '#3f4a66', 0.5, 12),                         // glass curtain wall, long lit floors
    windowTexture(['#ffb45a', '#ff9648', '#ffd28a'], 55, '#7a4f4a', 0.2, 2),                                     // old brick tenement, few lights
  ].map(({ map, emis }) => new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: 0xffffff, emissiveMap: emis, emissiveIntensity: 1.0 }));
  // light is faked with additive decals: lamp cones on walls and neon wash across the floor
  const NEON = [0xffc27a, 0x39f0ff, 0xff3df0, 0x8b5cff, 0x7dffb0];
  const lampTex = lampTexture();
  const coneMats = NEON.map((color) => new THREE.MeshBasicMaterial({ map: lampTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const poolTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 4;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.62)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.26)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const poolMats = NEON.map((color) => new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));

  const tint = (geo, color) => {
    const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  };
  const box = (color, x0, x1, y0, y1, d0, d1, glow = false) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, d1 - d0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2);
    B.push(glow ? 'glow' : 'lit', glow ? glowMat : litMat, tint(g, color), (d0 + d1) / 2);
  };
  const glow = (color, x0, x1, y0, y1, d0, d1) => box(color, x0, x1, y0, y1, d0, d1, true);
  const slab = (color, x0, x1, y0, y1, d0, d1) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, d1 - d0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 9, p.getZ(i) / 9);
    B.push('wet', wetMat, tint(g, color), (d0 + d1) / 2);
  };
  const boxR = (color, w, h, dp, x, y, d, rx = 0, ry = 0, rz = 0, isGlow = false) => {
    const g = new THREE.BoxGeometry(w, h, dp);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, -d);
    B.push(isGlow ? 'glow' : 'lit', isGlow ? glowMat : litMat, tint(g, color), d);
  };
  const cyl = (color, r, h, x, y, d, axis = 'y', isGlow = false, seg = 8) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, -d);
    B.push(isGlow ? 'glow' : 'lit', isGlow ? glowMat : litMat, tint(g, color), d);
  };
  const addGeo = (g, color, x, y, d, rx = 0, ry = 0, rz = 0, isGlow = false) => {
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, -d);
    B.push(isGlow ? 'glow' : 'lit', isGlow ? glowMat : litMat, tint(g, color), d);
  };
  let TINT = 0xffffff;                       // per-building wall tint, applied through vertex colours
  const winBox = (v, x0, x1, y0, y1, d0, d1) => {
    const w = x1 - x0, h = y1 - y0, dp = d1 - d0;
    const g = new THREE.BoxGeometry(w, h, dp), uv = g.attributes.uv;
    const off = Math.floor(R() * 12) / 12, voff = Math.floor(R() * 8) / 8;
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const j = f * 4 + i;
      if (f === 2 || f === 3) { uv.setXY(j, 0, 0); continue; }
      const span = f < 2 ? dp : w;
      uv.setXY(j, off + uv.getX(j) * Math.max(1, Math.round(span / 2)) / 12, voff + uv.getY(j) * Math.max(1, Math.round(h / 3)) / 8);
    }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2);
    B.push('win' + v, winMats[v], tint(g, TINT), (d0 + d1) / 2);
  };
  const winCyl = (v, cx, cd, rad, y0, y1) => {
    const g = new THREE.CylinderGeometry(rad, rad, y1 - y0, 20, 1, true), uv = g.attributes.uv;
    const ru = Math.max(1, Math.round((rad * 6.283) / 2)) / 12, rv = Math.max(1, Math.round((y1 - y0) / 3)) / 8;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
    g.translate(cx, (y0 + y1) / 2, -cd);
    B.push('win' + v, winMats[v], tint(g, TINT), cd);
  };
  // signs: face = 'back' (toward the approaching runner), 'left' (faces +x), 'right' (faces -x), 'front'
  const sign = (text, w, h, x, y, d, face = 'back', opts) => {
    const m = signMesh(text, w, h, opts);
    m.position.set(x, y, -d);
    m.rotation.y = face === 'left' ? Math.PI / 2 : face === 'right' ? -Math.PI / 2 : face === 'front' ? Math.PI : 0;
    scene.add(m);
    return m;
  };
  // wall lamp: face 'left' = wall faces +x, 'right' = faces -x, 'back' = faces the approaching runner
  // neon wash on a floor: brightest along the edge at xEdge, fading toward xFar
  const pool = (xEdge, xFar, y, d0, d1, tone) => {
    const g = new THREE.PlaneGeometry(Math.abs(xFar - xEdge), d1 - d0); g.rotateX(-Math.PI / 2);
    if (xFar < xEdge) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    g.translate((xEdge + xFar) / 2, y + 0.035, -(d0 + d1) / 2);
    B.push('pool' + tone, poolMats[tone], g, (d0 + d1) / 2);
  };
  const lamp = (x, y, d, face, size = 4.2, tone = 0) => {
    const g = new THREE.PlaneGeometry(size * 0.9, size);
    g.translate(0, -size / 2, 0);
    if (face === 'left') g.rotateY(Math.PI / 2); else if (face === 'right') g.rotateY(-Math.PI / 2);
    const o = 0.07, ox = face === 'left' ? o : face === 'right' ? -o : 0, od = face === 'back' ? -o : 0;
    g.translate(x + ox, y, -(d + od));
    B.push('cone' + tone, coneMats[tone], g, d);
    if (face === 'back') { box(0x3a3440, x - 0.35, x + 0.35, y, y + 0.16, d - 0.3, d); glow(tone ? NEON[tone] : 0xffe2a8, x - 0.28, x + 0.28, y - 0.05, y, d - 0.26, d - 0.02); }
    else { const xa = face === 'left' ? x : x - 0.3; box(0x3a3440, xa, xa + 0.3, y, y + 0.16, d - 0.35, d + 0.35); glow(tone ? NEON[tone] : 0xffe2a8, xa + 0.02, xa + 0.28, y - 0.05, y, d - 0.28, d + 0.28); }
  };
  const laundry = (xa, xb, y, d) => {
    box(0x0b0b12, xa, xb, y, y + 0.04, d, d + 0.04);
    const cols = [0xf5f1ff, 0xff8fc7, 0x5fe0d8, 0xb9a2ff, 0xff6b5e, 0x8fd0ff];
    for (let x = xa + 0.8; x < xb - 1; x += 1.25 + R() * 0.5) {
      const h = 0.7 + R() * 0.7, w = 0.6 + R() * 0.5;
      boxR(cols[Math.floor(R() * cols.length)], w, h, 0.05, x, y - h / 2, d, (R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.12);
    }
  };
  const npc = (x, y, d, color) => {
    box(0x1b1a24, x - 0.2, x + 0.2, y, y + 0.8, d - 0.14, d + 0.14);
    box(color, x - 0.26, x + 0.26, y + 0.8, y + 1.45, d - 0.17, d + 0.17);
    box(0xd9a583, x - 0.13, x + 0.13, y + 1.47, y + 1.74, d - 0.13, d + 0.13);
  };
  const vending = (x0, x1, base, d0, d1, face) => {
    box(0x15151f, x0, x1, base, base + 2.0, d0, d1);
    const cols = [CYAN, MAGENTA, 0x7dffb0];
    if (face === 'back') {
      const n = Math.max(1, Math.round((x1 - x0) / 1.0)), w = (x1 - x0) / n;
      for (let i = 0; i < n; i++) glow(cols[i % 3], x0 + i * w + 0.1, x0 + (i + 1) * w - 0.1, base + 0.5, base + 1.85, d0 - 0.03, d0);
    } else {
      const xf = face === 'right' ? x0 - 0.03 : x1;
      glow(cols[Math.floor(R() * 3)], xf, xf + 0.03, base + 0.5, base + 1.85, d0 + 0.1, d1 - 0.1);
    }
  };

  // ---------------------------------------------------------------- sky + ground
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 20),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.name = 'sky'; scene.add(sky);
    // the district spire and its halo, a landmark on the horizon
    const sil = new THREE.MeshBasicMaterial({ color: 0x1c1640, fog: false }), neonC = new THREE.MeshBasicMaterial({ color: 0x59e6ff, fog: false }), neonP = new THREE.MeshBasicMaterial({ color: 0xff7ad9, fog: false });
    const spire = new THREE.Group(); spire.position.set(190, 0, -1950);
    [[120, 150, 0], [86, 170, 150], [56, 190, 320], [30, 170, 510], [10, 150, 680]].forEach(([w, h, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), sil); m.position.y = y + h / 2; spire.add(m); });
    for (const [x, y, h, m] of [[-20, 330, 260, neonC], [14, 300, 180, neonP], [-44, 180, 150, neonP], [36, 160, 130, neonC]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, h, 2), m); b.position.set(x, y + h / 2, 62); spire.add(b); }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(175, 3.5, 6, 56), neonP); halo.rotation.x = 1.38; halo.position.y = 560; spire.add(halo);
    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(120, 2.5, 6, 48), neonC); halo2.rotation.x = 1.38; halo2.position.y = 600; spire.add(halo2);
    for (const [x, w, h] of [[-330, 60, 300], [-240, 40, 420], [240, 50, 380], [330, 70, 260], [-430, 50, 220], [420, 44, 330]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), sil); m.position.set(x, h / 2, 40); spire.add(m); }
    scene.add(spire);
  }
  box(0x120d22, -400, 400, -1, -0.06, -260, 1700);
  {
    // warm dust and street glow pooling between the blocks
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(900, 2000), new THREE.MeshBasicMaterial({ color: 0x5a1f9a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    haze.rotation.x = -Math.PI / 2; haze.position.set(0, 3, -600); scene.add(haze);
  }
  // ---------------------------------------------------------------- bank
  {
    const F = 34, Ct = 40.5;
    slab(0x8f88a8, -9, 9, 33.4, F, -60, 0.6);
    box(0x1d1b2b, -9.4, 9.4, Ct, 41, -60, 0);
    for (const sx of [-1, 1]) {
      box(0x3b3654, sx * 9.4 - 0.2, sx * 9.4 + 0.2, F, Ct, -60, 0);
      glow(0xcfa94a, sx * 3 - 0.06, sx * 3 + 0.06, F, F + 0.02, -60, 0);              // gold floor inlays
      for (let d = -54; d < -2; d += 9) {
        box(0x4a4468, sx * 8.6 - 0.45, sx * 8.6 + 0.45, F, Ct, d - 0.45, d + 0.45);   // pillars
        box(0xcfa94a, sx * 8.6 - 0.55, sx * 8.6 + 0.55, Ct - 0.5, Ct - 0.3, d - 0.55, d + 0.55);
      }
      for (let d = -50; d < -10; d += 9) {                                            // teller desks
        box(0x574a3f, sx * 7.6 - 0.9, sx * 7.6 + 0.9, F, F + 1.1, d + 1.4, d + 7.4);
        glow(0x1d8fa0, sx * 6.75 - 0.03, sx * 6.75 + 0.03, F + 1.1, F + 1.9, d + 1.6, d + 7.2);
      }
    }
    for (let d = -56; d < -2; d += 6) glow(0xdfe6ff, -1.6, 1.6, Ct - 0.05, Ct, d, d + 3);   // ceiling panels
    box(0x3b3654, -9.4, 9.4, F, Ct, -60.4, -60);                                             // back wall + vault
    cyl(0x8a90a6, 2.7, 0.5, 0, F + 3, -59.6, 'z', false, 20);
    cyl(0x35ff6b, 1.9, 0.52, 0, F + 3, -59.6, 'z', true, 20);
    for (let i = 0; i < 46; i++) {                                                           // dropped bills
      boxR(0x35ff6b, 0.3, 0.02, 0.14, (R() - 0.5) * 9, F + 0.02, -58 + R() * 54, 0, R() * 3, 0, true);
    }
    // facade around the window opening
    box(0x241d3d, -9.4, 9.4, 33.0, F + 0.05, -0.2, 0.75);
    box(0x241d3d, -9.4, 9.4, Ct, 41.4, -0.2, 0.75);
    for (const x of [-9.2, -2.7, 2.7, 9.2]) box(0x2f2850, x - 0.12, x + 0.12, F, Ct, -0.08, 0.16);
    winBox(0, -14, 14, 0, 33.0, -64, 0);
    winBox(0, -14, 14, 41.4, 110, -64, 0);
    winBox(0, -14, -9.4, 33.0, 41.4, -64, 0);
    winBox(0, 9.4, 14, 33.0, 41.4, -64, 0);
    glow(ACCENT, -2.6, 2.6, F, F + 0.03, -1.4, 0.6);                                          // launch mark
    sign('KUMO BANK', 16, 3.4, 0, 45, -0.05, 'front', { fg: '#ffd9f4' });
    sign('KUMO BANK', 9, 1.6, 0, 38.6, -59.9, 'back', { fg: '#cfa94a', bg: '#2b2540' });
  }
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  for (const [x0, x1] of [[-9.1, -2.8], [2.8, 9.1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 6.5), glassMat);
    m.position.set((x0 + x1) / 2, 37.25, 0); scene.add(m);
  }
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 6.5), glassMat.clone());
  glassPane.material.opacity = 0.3;
  glassPane.position.set(0, 37.25, 0); scene.add(glassPane);
  const alarmMat = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  for (let d = -54; d < -2; d += 9) for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), alarmMat);
    m.position.set(sx * 8.1, 39.2, -d); scene.add(m);
  }

  // ---------------------------------------------------------------- route structures
  const ROOF = 0x6f6878, EDGE = 0x544c5e, MARGIN = 2.4;
  for (const c of colliders) {
    const { x0, x1, d0, d1 } = c, top = c.y1;
    switch (c.style) {
      case 'roof': {
        const open = x1 === -4;                                   // rooftop line: right side opens onto the market
        const m = open || c.noLip ? 0 : MARGIN, md1 = d0 === 161 ? 236 : d1;   // furnished service strip beside the lane
        winBox(c.win ?? 0, x0 + 0.3 - m, x1 - 0.3 + m, 0, top - 0.5, d0 + 0.3, d1 - 0.3);
        slab(c.shanty ? 0xf2dcdc : 0xe8e0ea, x0, x1, top - 0.5, top, d0, d1);
        if (!c.noLip) {                                           // reachable ledge = accent
          // a proper concrete kerb with worn yellow paint: flaking in patches, still unmistakable
          box(0x9a8f86, x0 - m, x1 + m, top - 0.62, top + 0.02, d0 - 0.16, d0 + 0.5);
          for (let x = x0 - m; x < x1 + m; ) { const w = 0.5 + R() * 2.2; glow(ACCENT, x, Math.min(x1 + m, x + w), top - 0.56 + R() * 0.14, top + 0.03, d0 - 0.18, d0 + 0.32 + R() * 0.2); x += w + 0.08 + R() * 0.35; }
          // the wall below the kerb: louvred vents and a downpipe
          for (const vx of [x0 + 1.2, x1 - 3.4]) { box(0x3a3440, vx, vx + 2.2, top - 2.6, top - 1.7, d0 + 0.2, d0 + 0.3); for (let y = top - 2.5; y < top - 1.75; y += 0.16) box(0x8a8290, vx + 0.08, vx + 2.12, y, y + 0.06, d0 + 0.17, d0 + 0.3); }
          cyl(0x9a8478, 0.12, 9, (x0 + x1) / 2 + 2.2, top - 5.1, d0 + 0.14); box(0x9a8478, (x0 + x1) / 2 + 2.04, (x0 + x1) / 2 + 2.36, top - 0.9, top - 0.6, d0 + 0.02, d0 + 0.3);
        }
        box(0xd8d2c8, x0, x1, top, top + 0.015, d1 - 0.3, d1 - 0.16);
        if (m) for (const sx of [-1, 1]) {
          const xin = sx < 0 ? x0 : x1, xout = xin + sx * m;
          slab(0xcfc6d2, Math.min(xin, xout), Math.max(xin, xout), top - 0.5, top - 0.02, d0, md1);       // strip sits a touch lower
          const pa = sx < 0 ? xout - 0.55 : xout, pb = pa + 0.55;                                          // parapet
          box(0x857c8a, pa, pb, top - 0.5, top + 0.62, d0, md1);
          box(0xa39aa6, pa - 0.06, pb + 0.06, top + 0.62, top + 0.72, d0, md1);
          const tone = sx < 0 ? 2 : 1, tx = sx < 0 ? pb + 0.02 : pa - 0.1;                                  // neon tube on the inner face
          glow(NEON[tone], tx, tx + 0.08, top + 0.44, top + 0.52, d0 + 0.4, md1 - 0.4);
          pool(sx < 0 ? pb : pa, xin - sx * 4.2, top - 0.02, d0 + 0.4, md1 - 0.4, tone);
          pool(sx < 0 ? pb : pa, xin, top - 0.04, d0 + 0.4, md1 - 0.4, tone);
          for (let d = d0 + R() * 3; d < md1 - 2; d += 2.5 + R() * 6) box(0xc0a044, pa - 0.065, pb + 0.065, top + 0.722, top + 0.735, d, Math.min(md1, d + 0.6 + R() * 2.4));   // faded paint remnants
          // pipe run marking the lane edge, with flanges and the odd valve
          const px = xin + sx * 0.2, len = md1 - d0 - 0.6, mid = (d0 + md1) / 2;
          cyl(0xa08a7c, 0.13, len, px, top + 0.15, mid, 'z'); cyl(0x8d8590, 0.09, len, px + sx * 0.3, top + 0.1, mid, 'z');
          for (let d = d0 + 2; d < md1 - 1; d += 4) { cyl(0x6f6672, 0.19, 0.12, px, top + 0.15, d, 'z'); box(0x6f6672, px - 0.09, px + 0.4 * 1 - 0.09 + (sx < 0 ? -0.31 : 0), top - 0.02, top + 0.04, d + 1.9, d + 2.1); }
          for (let d = d0 + 9 + R() * 6; d < md1 - 4; d += 17 + R() * 9) { box(0x6f6672, px - 0.05, px + 0.05, top + 0.15, top + 0.5, d - 0.05, d + 0.05); cyl(0xc0413a, 0.17, 0.05, px, top + 0.52, d, 'y', false, 8); }
        }
        break;
      }
      case 'billboard': {
        const w = walls[0];
        box(0x15121f, x0, x1 - 0.06, c.y0, top + 0.3, d0, d1);
        for (let d = d0 + 2; d < d1; d += 7.5) box(0x15121f, x0 + 0.3, x0 + 0.7, 19, c.y0, d, d + 0.4);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(d1 - d0, top - c.y0), new THREE.MeshBasicMaterial({ map: billboardTexture(w) }));
        m.rotation.y = Math.PI / 2; m.position.set(x1 + 0.01, (c.y0 + top) / 2, -(d0 + d1) / 2);
        scene.add(m);
        break;
      }
      case 'awning': {
        winBox(2, x0 + 0.3, x1 - 0.3, 0, top - 0.7, d0 + 0.3, d1 - 0.3);
        box(0x1c182c, x0, x1, top - 0.7, top - 0.3, d0, d1);
        let i = 0;
        for (let d = d0; d < d1; d += 2, i++) box(i % 2 ? 0xf5f1ff : ACCENT, x0, x1 + 0.5, top - 0.3, top, d, Math.min(d1, d + 2));
        glow(ACCENT, x1 + 0.5, x1 + 0.56, top - 0.5, top, d0, d1);
        break;
      }
      case 'alley': {
        box(0x1c182c, x0, x1, 0, top - 0.3, d0, d1);
        let i = 0;
        for (let x = x0; x < x1; x += 1.5, i++) box(i % 2 ? 0xf5f1ff : ACCENT, x, Math.min(x1, x + 1.5), top - 0.3, top, d0 + 0.3, d1 - 0.3);
        break;
      }
      case 'pilaster': winBox(0, x0, x1, 0, top, d0, d1); break;
      case 'tallwall': {
        winBox(0, x0, x1, 0, top, d0, d1);
        for (let y = 30; y < top; y += 5) glow(PURPLE, x1, x1 + 0.05, y, y + 0.12, d0, d1);
        sign('HOTEL ZERO', 2.6, 12, x1 + 0.3, 33, 322, 'left', { fg: '#ff5fd2', vertical: true });
        sign('NEO SODA', 2.4, 10, x1 + 0.3, 31, 396, 'left', { fg: '#39f0ff', vertical: true });
        break;
      }
      case 'aptwall': {
        winBox(2, x0, x1, 18.2, top, d0, d1);
        box(0x1a1528, x0, x1, 0, 18.2, d0, d1);
        const shops = [WARM, 0xff5fa2, CYAN, WARM, 0xb388ff];
        let i = 0;
        for (let d = 268; d < 436; d += 8.5, i++) {
          glow(shops[i % 5], x0 - 0.04, x0, 14.25, 16.9, d, d + 6.2);                       // lit shopfront
          box(0x0e0b18, x0 - 0.08, x0 - 0.04, 14.25, 16.9, d + 2.9, d + 3.3);
          box([0xb3243b, 0x1f7f8f, 0x6a3fb8][i % 3], x0 - 0.35, x0, 17.1, 17.3, d - 0.3, d + 6.5);  // shop awning
          if (i % 3 === 1) vending(x0 - 0.3, x0 + 0.4, 14, d + 6.6, d + 7.7, 'right');
          if (i % 2 === 0) npc(x0 - 0.75, 14, d + 1 + R() * 4, [0x4b6bd6, 0xb04bd6, 0xd6a24b, 0x3aa39a][i % 4]);
        }
        for (let y = 21.2; y < top - 4; y += 6) for (let d = d0 + 4; d < d1 - 8; d += 13) {     // balconies
          box(0x221c38, x0 - 0.9, x0, y, y + 0.14, d, d + 5);
          glow(0x4a2f7a, x0 - 0.9, x0 - 0.86, y + 0.14, y + 0.9, d, d + 5);
          if (R() < 0.5) box(0x7c8296, x0 - 0.6, x0, y + 0.14, y + 0.8, d + 5.6, d + 6.6);      // wall AC
        }
        const names = [['NOODLE 24H', '#ffb347'], ['BAO', '#ff5fd2'], ['TEA', '#39f0ff'], ['RAMEN', '#ff6f5e'], ['ARCADE', '#b388ff']];
        names.forEach(([t, fg], k) => sign(t, 1.9, 7.5, x0 - 0.5, 23 + (k % 2) * 2, 282 + k * 34, 'right', { fg, vertical: true }));
        break;
      }
      case 'market': {
        box(0x161222, x0, x1, 0, top - 0.3, d0, d1);
        slab(0xcbbfd0, x0, x1, top - 0.3, top, d0, d1);
        for (let d = d0 + 4; d < d1; d += 8) glow(0x5a2a80, x0 + 0.4, x1 - 0.4, top, top + 0.015, d, d + 0.1);
        glow(MAGENTA, x0 + 0.05, x0 + 0.12, top, top + 0.03, d0, d1);
        glow(CYAN, x1 - 0.12, x1 - 0.05, top, top + 0.03, d0, d1);
        // closed shutters / pipes on the left wall (under the rooftop line)
        for (let d = 292; d < 418; d += 9) {
          if (d > 346 && d < 362) continue;
          box(0x3a3d52, x0, x0 + 0.06, 14.2, 17.2, d, d + 5.5);
          glow([MAGENTA, CYAN, PURPLE][Math.floor(d / 9) % 3], x0, x0 + 0.07, 17.3, 17.42, d, d + 5.5);
          if (R() < 0.6) npc(x0 + 0.7, 14, d + 6.5 + R() * 1.5, [0xd64b6b, 0x4bd6a0, 0x8f8fa8][Math.floor(R() * 3)]);
        }
        break;
      }
      case 'ramp': case 'tin': {
        const len = Math.hypot(d1 - d0, c.yB - c.yA), ang = Math.atan2(c.yB - c.yA, d1 - d0);
        const cy = (c.yA + c.yB) / 2, cd = (d0 + d1) / 2;
        if (c.style === 'tin') {
          // corrugated tin roof: coloured sheets with ridges running down the slope
          const cols = [0x9c4a5c, 0x5d7fa0, 0x8a3f52, 0x6f8fae, 0xa85a64, 0x54708f];        // rust red and faded blue sheets
          let i = 0;
          for (let x = x0; x < x1; x += 2, i++) boxR(cols[i % cols.length], 2, 0.3, len, x + 1, cy - 0.17, cd, ang);
          for (let x = x0 + 0.5; x < x1; x += 0.5) boxR(0x1b1730, 0.06, 0.05, len, x, cy + 0.0, cd, ang);
          for (const x of [x0 + 0.1, x1 - 0.1]) boxR(MAGENTA, 0.08, 0.08, len, x, cy + 0.04, cd, ang, 0, 0, true);
          for (let k = 0.1; k < 1; k += 0.2) for (const sx of [-1, 1]) {            // downhill chevrons
            boxR(0xf2f2ff, 1.6, 0.02, 0.2, (x0 + x1) / 2 + sx * 0.62, c.yA + (c.yB - c.yA) * k + 0.03, d0 + (d1 - d0) * k, ang, sx * 0.6, 0, true);
          }
          box(0x1a1528, x0, x1, 0, c.yB - 0.3, d0 + 0.4, d1);
          break;
        }
        boxR(0x8a8290, x1 - x0, 0.4, len, (x0 + x1) / 2, cy - 0.22, cd, ang);
        for (const x of [x0 - 0.2, x1 + 0.2]) boxR(0x6f6672, 0.4, 0.75, len, x, cy - 0.05, cd, ang);            // side kerbs
        for (let k = 0.08; k < 1; k += 0.14) {
          boxR(0x4a4352, x1 - x0 - 0.6, 0.03, 0.12, (x0 + x1) / 2, c.yA + (c.yB - c.yA) * k + 0.0, d0 + (d1 - d0) * k, ang);
        }
        for (const x of [x0 + 0.12, x1 - 0.12]) {                                   // worn yellow handrails
          boxR(0xd2aa32, 0.09, 0.09, len, x, cy + 1.05, cd, ang); boxR(0xb8942c, 0.07, 0.07, len, x, cy + 0.55, cd, ang);
          for (let d = d0 + 0.3; d <= d1; d += 3) { const y = c.yA + (c.yB - c.yA) * ((d - d0) / (d1 - d0)); box(0xd2aa32, x - 0.05, x + 0.05, y, y + 1.05, d - 0.05, d + 0.05); }
        }
        for (let d = d0 + 3; d < d1; d += 8) for (const x of [x0 + 0.4, x1 - 0.4]) {
          const y = c.yA + (c.yB - c.yA) * ((d - d0) / (d1 - d0));
          box(0x1a1528, x - 0.15, x + 0.15, 0, y - 0.3, d - 0.15, d + 0.15);
        }
        break;
      }
      case 'plaza': {
        box(0x161222, x0, x1, 0, top - 0.4, d0, d1);
        slab(0xdcd4de, x0, x1, top - 0.4, top, d0, d1);
        if (d0 === 440) {
          glow(ACCENT, -13, -4, top - 0.4, top + 0.02, 419.95, 420.5);
          for (const [xa, xb] of [[-13, -6], [12, 6]]) {                                   // funnel rails
            const ang = Math.atan2(xb - xa, 32), len = Math.hypot(xb - xa, 32);
            boxR(EDGE, 0.3, 0.9, len, (xa + xb) / 2, top + 0.45, 456, 0, -ang, 0);
            boxR(MAGENTA, 0.34, 0.08, len, (xa + xb) / 2, top + 0.92, 456, 0, -ang, 0, true);
          }
          for (let d = 446; d < 470; d += 6) for (const sx of [-1, 1]) {                    // chevrons pointing in
            boxR(0x1f6f8a, 2.4, 0.02, 0.3, sx * 3.2, top + 0.01, d, 0, sx * 0.7, 0, true);
          }
        }
        break;
      }
      case 'road': {
        slab(0x56505e, -40, 40, -2, 0, d0, d1);
        for (let d = d0; d < d1; d += 6) glow(0xe8e8f0, -0.08, 0.08, 0, 0.012, d, d + 2.6);
        for (const sx of [-1, 1]) {
          box(0x3a3d52, sx * 2.25 - 0.2, sx * 2.25 + 0.2, 0, 0.7, d0, d1);
          glow(CYAN, sx * 2.25 - 0.21, sx * 2.25 + 0.21, 0.7, 0.76, d0, d1);
        }
        break;
      }
    }
  }
  // final ramp funnel barriers
  for (const sx of [-1, 1]) {
    const ang = Math.atan2(sx * (2.25 - 6), 30), len = Math.hypot(3.75, 30, 8);
    boxR(CYAN, 0.12, 0.12, len, sx * 4.12, 4.9, 637 + S, Math.atan2(-8, 30), -ang, 0, true);
  }
  // landing pad on the far roof (kick-off target)
  {
    const p = LANDING_PAD, y = p.y + 0.012;
    glow(ACCENT, p.x0, p.x1, y, y + 0.012, p.d0, p.d0 + 0.3); glow(ACCENT, p.x0, p.x1, y, y + 0.012, p.d1 - 0.3, p.d1);
    glow(ACCENT, p.x0, p.x0 + 0.3, y, y + 0.012, p.d0, p.d1); glow(ACCENT, p.x1 - 0.3, p.x1, y, y + 0.012, p.d0, p.d1);
    for (let d = p.d0 + 1.4; d < p.d1 - 1; d += 1.6) for (const s of [-1, 1]) {
      boxR(ACCENT, 2.2, 0.012, 0.3, (p.x0 + p.x1) / 2 + s * 0.85, y, d, 0, s * 0.6, 0, true);
    }
  }

  // ---------------------------------------------------------------- obstacles
  let stallN = 0;
  for (const c of colliders) {
    const { x0, x1, d0, d1 } = c, b = c.kind === 'over' ? c.base : c.y0;
    switch (c.style) {
      case 'ac': {
        const n = Math.max(1, Math.round((x1 - x0) / 2.3)), w = (x1 - x0) / n;
        for (let i = 0; i < n; i++) {
          const xa = x0 + i * w + 0.08, xb = x0 + (i + 1) * w - 0.08, r = Math.min(0.34, (xb - xa) * 0.2);
          box(0xc9c3c4, xa, xb, b + 0.08, c.y1, d0, d1);
          box(0x6e6672, xa + 0.1, xb - 0.1, b, b + 0.08, d0 + 0.1, d1 - 0.1);                    // pallet feet
          for (const fx of [(xa * 3 + xb) / 4, (xa + xb * 3) / 4]) {                              // fan grilles
            cyl(0x3a3440, r, 0.05, fx, (b + c.y1) / 2 + 0.03, d0 - 0.02, 'z', false, 12);
            cyl(0xa9a2a6, r * 0.28, 0.07, fx, (b + c.y1) / 2 + 0.03, d0 - 0.03, 'z', false, 8);
            box(0xa9a2a6, fx - r, fx + r, (b + c.y1) / 2, (b + c.y1) / 2 + 0.05, d0 - 0.05, d0 - 0.03);
          }
          box(0x9b9498, xa, xb, c.y1 - 0.06, c.y1, d0 - 0.03, d1 + 0.03);
        }
        cyl(0x9a8478, 0.09, x1 - x0, (x0 + x1) / 2, b + 0.14, d1 + 0.16, 'x');                  // conduit behind
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.03, d0 - 0.05, d0 + 0.03);
        break;
      }
      case 'crate': {
        const n = Math.max(1, Math.round((x1 - x0) / 1.4)), w = (x1 - x0) / n;
        for (let i = 0; i < n; i++) {
          box(i % 2 ? 0x6b4a6e : 0x4f4a78, x0 + i * w + 0.05, x0 + (i + 1) * w - 0.05, b, c.y1, d0, d1);
          glow(CYAN, x0 + i * w + 0.05, x0 + (i + 1) * w - 0.05, b + 0.45, b + 0.55, d0 - 0.03, d0);
        }
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.04, d0 - 0.05, d0 + 0.05);
        break;
      }
      case 'solar': {
        const n = Math.max(1, Math.round((x1 - x0) / 1.7)), w = (x1 - x0) / n;
        for (let i = 0; i < n; i++) {
          const cx = x0 + (i + 0.5) * w;
          boxR(0x16305c, w - 0.15, 0.08, d1 - d0 + 0.3, cx, b + 0.55, (d0 + d1) / 2, -0.5);
          boxR(CYAN, 0.03, 0.09, d1 - d0 + 0.3, cx, b + 0.56, (d0 + d1) / 2, -0.5, 0, 0, true);
          box(0x3a3d52, cx - 0.06, cx + 0.06, b, b + 0.85, d1 - 0.2, d1 - 0.08);
        }
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.04, d1 - 0.1, d1);
        break;
      }
      case 'chairs': {
        const cols = [0xd6342c, 0x3558c9, 0xd6342c];
        cols.forEach((col, i) => {
          const cx = x0 + 0.5 + i * ((x1 - x0 - 1) / 2), cd = (d0 + d1) / 2;
          box(col, cx - 0.28, cx + 0.28, b + 0.42, b + 0.5, cd - 0.28, cd + 0.28);
          box(col, cx - 0.28, cx + 0.28, b + 0.5, c.y1, cd + 0.2, cd + 0.28);
          for (const [ox, od] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) box(col, cx + ox - 0.03, cx + ox + 0.03, b, b + 0.42, cd + od - 0.03, cd + od + 0.03);
        });
        box(0xe9eef5, x0 + 0.95, x0 + 1.55, b, b + 0.4, d0 + 0.1, d0 + 0.5);                   // cooler
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.04, d0 + 0.3, d0 + 0.4);
        break;
      }
      case 'shack': {
        const col = [0x2f8f86, 0xa5502f, 0x3566a8][Math.floor(d0) % 3];
        box(col, x0, x1, b, c.y1 - 0.15, d0, d1);
        for (let x = x0 + 0.4; x < x1; x += 0.4) box(0x1b1730, x - 0.02, x + 0.02, b, c.y1 - 0.15, d0 - 0.02, d0);
        boxR(0x565b78, x1 - x0 + 0.5, 0.1, d1 - d0 + 0.6, (x0 + x1) / 2, c.y1 - 0.05, (d0 + d1) / 2, 0.08);
        glow(WARM, x0 + 0.5, x0 + 1.5, b + 1.0, b + 1.7, d0 - 0.04, d0);
        glow(HAZARD, x0, x1, b, b + 0.08, d0 - 0.06, d0);
        break;
      }
      case 'vending': vending(x0, x1, b, d0, d1, 'back'); glow(HAZARD, x0, x1, c.y1, c.y1 + 0.06, d0 - 0.05, d0 + 0.05); break;
      case 'skylight':
        box(0x3a3d52, x0, x1, b, b + 0.3, d0, d1);
        box(0x1d8fa0, x0 + 0.2, x1 - 0.2, b + 0.3, c.y1, d0 + 0.15, d1 - 0.15);
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.04, d0 - 0.02, d0 + 0.08);
        break;
      case 'stall': {
        const k = stallN++;
        box(0x7a2230, x0, x1, b, c.y1, d0, d1);
        glow(WARM, x0 + 0.15, x1 - 0.15, b + 0.25, b + 0.75, d0 - 0.03, d0);
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.04, d0 - 0.05, d0 + 0.05);
        for (const x of [x0 + 0.12, x1 - 0.12]) for (const d of [d0 + 0.1, d1 - 0.1]) box(0x23202e, x - 0.06, x + 0.06, c.y1, b + 3.3, d - 0.06, d + 0.06);
        let i = 0;
        for (let x = x0 - 0.3; x < x1 + 0.3; x += 1, i++) {
          box(i % 2 ? [0xff5fa2, 0x2fd6e6, 0xff8a3d][k % 3] : 0xf5f1ff, x, Math.min(x1 + 0.3, x + 1), b + 3.3, b + 3.42, d0 - 0.5, d1 + 0.5);
        }
        for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.6) {
          glow(k % 2 ? 0xff6f5e : WARM, x - 0.14, x + 0.14, b + 2.75, b + 3.1, d0 - 0.35, d0 - 0.07);   // lanterns
          cyl(0x9aa0b5, 0.22, 0.26, x + 0.5, c.y1 + 0.13, (d0 + d1) / 2);                                 // pots
        }
        break;
      }
      case 'shutter':
      case 'pipes': {
        const roofDuct = c.style === 'shutter' && b !== 14;
        for (const x of [x0 - 0.2, x1 + 0.2]) box(roofDuct ? 0x6f6672 : 0x23202e, x - 0.2, x + 0.2, b, b + (roofDuct ? 2.5 : 3.7), d0 - 0.05, d1 + 0.05);
        if (!roofDuct) box(0x23202e, x0 - 0.4, x1 + 0.4, b + 3.1, b + 3.7, d0 - 0.1, d1 + 0.1);
        if (c.style === 'shutter' && b !== 14) {
          box(0xb9b4bc, x0 - 0.4, x1 + 0.4, b + 1.32, b + 2.5, d0 - 0.3, d1 + 0.45);                 // the duct itself
          for (let x = x0; x < x1 + 0.2; x += 1.5) box(0x8d8590, x - 0.06, x + 0.06, b + 1.28, b + 2.54, d0 - 0.34, d1 + 0.49);   // flange ribs
          box(0x3a3440, x0 + 1, x0 + 2.6, b + 1.6, b + 2.2, d0 - 0.33, d0 - 0.3); for (let y = b + 1.66; y < b + 2.2; y += 0.13) box(0x8d8590, x0 + 1.05, x0 + 2.55, y, y + 0.05, d0 - 0.35, d0 - 0.3);
          cyl(0xa08a7c, 0.12, x1 - x0 + 0.8, (x0 + x1) / 2, b + 2.66, d0 + 0.1, 'x'); cyl(0x8d8590, 0.08, x1 - x0 + 0.8, (x0 + x1) / 2, b + 2.62, d0 + 0.45, 'x');
        } else if (c.style === 'shutter') {
          box(0x565b78, x0, x1, b + 1.3, b + 3.1, d0 + 0.15, d0 + 0.3);
          for (let y = b + 1.5; y < b + 3.1; y += 0.3) box(0x3d4159, x0, x1, y, y + 0.06, d0 + 0.1, d0 + 0.15);
        } else {
          for (let y = b + 1.35; y < b + 3.1; y += 0.45) cyl(0x6f7590, 0.17, x1 - x0, (x0 + x1) / 2, y + 0.1, d0 + 0.25, 'x');
        }
        glow(HAZARD, x0, x1, b + 1.15, b + 1.32, d0 + 0.05, d0 + 0.35);       // the edge you must duck
        let i = 0;
        for (let x = x0 + 0.5; x < x1 - 0.5; x += 1.4, i++) if (i % 2) glow(0xfff0f0, x, x + 0.7, b + 1.19, b + 1.28, d0 + 0.02, d0 + 0.05);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- route dressing
  // split signage — both lines visible before committing
  sign('ROOFTOPS', 8, 2.6, -8.5, 31.2, 239, 'back', { fg: '#ffd60a', sub: '◀ WALL RUN · FAST' });
  sign('NIGHT MARKET', 9, 2.6, 4.5, 30.6, 241, 'back', { fg: '#ff5fd2', sub: 'STREET · SAFE ▶' });
  for (const x of [-12.3, -4.6]) box(0x15121f, x - 0.12, x + 0.12, 26, 31.2, 238.9, 239.1);
  for (const x of [0.2, 8.8]) box(0x15121f, x - 0.12, x + 0.12, 26, 30.6, 240.9, 241.1);
  // market gate
  box(0x23202e, -4, -3.6, 14, 21, 267, 267.5); box(0x23202e, 11.6, 12, 14, 21, 267, 267.5);
  sign('NIGHT MARKET', 15.6, 2.4, 4, 20.4, 267.2, 'back', { fg: '#ff5fd2', bg: '#1a0d2a' });
  for (const d of [288, 306, 322, 338, 364, 388, 406, 420, 434]) laundry(-4, 12, 14 + 5.6 + (d % 3) * 0.5, d);
  for (const d of [30, 70, 100, 140]) { laundry(-13.5, -6.3, 24.2, d); laundry(6.3, 14, 23.6, d + 7); }
  for (const d of [500, 536, 586, 664, 694]) { if (d > 560) { const yy = d < 620 ? 21 : 13; for (const x of [-6.2, 6.2]) box(0x15121f, x - 0.08, x + 0.08, yy, yy + 5.4, d - 0.08, d + 0.08); laundry(-6.2, 6.2, yy + 5.3, d); continue; } for (const x of [-6.2, 6.2]) box(0x15121f, x - 0.08, x + 0.08, 12, 17.4, d - 0.08, d + 0.08); laundry(-6.2, 6.2, 17.3, d); }
  // rooftop vending + water tanks beside the opening run (out of the lane)
  for (const [x, d, top] of [[-9.5, 60, 20], [9.6, 110, 18], [-10, 180, 16]]) {
    box(0x241f3a, x - 3, x + 3, 0, top, d - 6, d + 6);
    cyl(0x4f4a78, 1.6, 2.6, x, top + 1.5, d, 'y', false, 10);
    vending(x - 1.2, x + 1.2, top, d - 4, d - 3.3, 'back');
  }
  // final sprint signs
  sign('GETAWAY', 7, 2.2, 0, 12.8, 621.6 + S, 'back', { fg: '#35ff6b', sub: '▼ VAN ▼' });
  for (const x of [-3.8, 3.8]) box(0x15121f, x - 0.1, x + 0.1, 8, 12.4, 621.5 + S, 621.7 + S);

  // ---------------------------------------------------------------- elevated rail
  box(0x2b2740, -30.2, -26.8, 19, 20, -120, 900);
  glow(CYAN, -30.25, -30.2, 19.4, 19.6, -120, 900); glow(CYAN, -26.8, -26.75, 19.4, 19.6, -120, 900);
  for (let d = -110; d < 900; d += 32) box(0x211d33, -29.2, -27.8, 0, 19, d, d + 1.6);
  box(0x2b2740, -80, 80, 16.4, 17.4, 594.4 + S, 597.6 + S);
  glow(MAGENTA, -80, 80, 16.9, 17.05, 594.3 + S, 594.4 + S);
  for (const x of [-34, -9, 9, 34]) box(0x211d33, x - 0.7, x + 0.7, 0, 16.4, 595.3 + S, 596.7 + S);
  const makeTrain = (alongX) => {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3, 13), new THREE.MeshLambertMaterial({ color: 0x3d4466, flatShading: true }));
      car.position.z = i * 14;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.9, 11.6), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xfff2c4 : 0xffd27a }));
      strip.position.y = 0.45; car.add(strip);
      const line = new THREE.Mesh(new THREE.BoxGeometry(2.97, 0.2, 13), new THREE.MeshBasicMaterial({ color: 0xff4a1c }));
      line.position.y = -0.8; car.add(line);
      g.add(car);
    }
    if (alongX) g.rotation.y = Math.PI / 2;
    scene.add(g);
    return g;
  };
  const train = makeTrain(false), crossTrain = makeTrain(true);
  train.position.set(-28.5, 21.6, 0); crossTrain.position.set(-400, 19, -(596 + S));

  // ---------------------------------------------------------------- city blocks
  // Megastructure blocks: concrete podium, set-back tiers, heavy floor bands, service clutter and neon.
  const CONC = 0x6a6070, CONC2 = 0x4c4456;
  const BRANDS = [['KUROMA', 'ELECTRONICS', '#ff5a36'], ['HANAZO', 'HEAVY INDUSTRY', '#39f0ff'], ['ORBITAL', 'FOODS', '#ffb347'], ['NEONKO', 'ARCADE', '#ff5fd2'],
    ['TETSUDO', 'RAIL', '#ff5a36'], ['VANTA', 'SECURITY', '#7de3ff'], ['MIRAI', 'PHARMA', '#7dffb0'], ['SORA', 'NOODLE', '#ff5a36'], ['KIBO', 'MOTORS', '#ffb347'], ['AKARI', 'OPTICS', '#39f0ff']];
  let brandN = 0, towerN = 0;
  const tower = (x0, x1, d0, d1, h, v) => {
    const n = towerN++, inward = (x0 + x1) / 2 < 0 ? x1 : x0, sx = (x0 + x1) / 2 < 0 ? 1 : -1;
    const h1 = h * (0.5 + R() * 0.2), in1 = 1.5 + R() * 3;
    winBox(v, x0, x1, 0, h1, d0, d1);                                                  // podium
    box(CONC, x0 - 0.5, x1 + 0.5, h1 - 1, h1 + 0.3, d0 - 0.5, d1 + 0.5);              // overhanging slab
    winBox(v, x0 + in1, x1 - in1, h1 + 0.3, h, d0 + in1, d1 - in1);                    // tower above the setback
    if (h > 70 && R() < 0.6) {                                                         // a third, thinner tier
      const in2 = in1 + 2 + R() * 2, h2 = h + 12 + R() * 26;
      if (x1 - x0 > in2 * 2 + 4 && d1 - d0 > in2 * 2 + 4) { winBox((v + 1) % 3, x0 + in2, x1 - in2, h, h2, d0 + in2, d1 - in2); box(CONC, x0 + in1 - 0.3, x1 - in1 + 0.3, h - 0.6, h + 0.2, d0 + in1 - 0.3, d1 - in1 + 0.3); h = h2; }
    }
    for (let y = 9 + R() * 6; y < h1 - 6; y += 10 + R() * 9) box(CONC2, x0 - 0.3, x1 + 0.3, y, y + 1.1, d0 - 0.3, d1 + 0.3);   // floor bands
    // service spine + ducts on the side facing the route
    const sd = d0 + 2 + R() * (d1 - d0 - 5);
    box(CONC2, inward - (sx > 0 ? 0 : 1.2), inward + (sx > 0 ? 1.2 : 0), 0, h1 - 1, sd, sd + 2.4);
    glow(n % 3 === 0 ? 0xff5a36 : 0x2fb6e6, inward + sx * 1.2 - 0.05, inward + sx * 1.2 + 0.05, 4, h1 - 3, sd + 1.1, sd + 1.3);
    for (let y = 14; y < h1 - 8; y += 9 + R() * 8) if (R() < 0.5) box(0x7c8296, inward - (sx > 0 ? 0 : 0.8), inward + (sx > 0 ? 0.8 : 0), y, y + 0.9, sd + 3.4, sd + 4.8);
    // roof plant: tanks, AC blocks, antenna racks, dishes, beacons
    const cx = (x0 + x1) / 2, cd = (d0 + d1) / 2, top = h;
    box(CONC, cx - 2.5, cx + 1.5, top, top + 2.2, cd - 2, cd + 1.5);
    if (R() < 0.7) { for (const ox of [-1.4, 0, 1.4]) { box(0x101318, cx + ox - 0.07, cx + ox + 0.07, top + 2.2, top + 9 + R() * 7, cd - 0.07, cd + 0.07); } box(0x101318, cx - 1.8, cx + 1.8, top + 6, top + 6.1, cd - 0.05, cd + 0.05); box(0x101318, cx - 1.8, cx + 1.8, top + 8, top + 8.1, cd - 0.05, cd + 0.05); glow(HAZARD, cx - 0.25, cx + 0.25, top + 9, top + 9.5, cd - 0.25, cd + 0.25); }
    if (R() < 0.5) cyl(0x39424c, 1.6, 3, x0 + in1 + 3, top + 1.5, d0 + in1 + 3, 'y', false, 10);
    if (R() < 0.5) addGeo(new THREE.CylinderGeometry(1.8, 0.5, 0.5, 12), 0x9aa3ad, x1 - in1 - 3, top + 2.6, d1 - in1 - 3, 0.9, R() * 6, 0);
    if (R() < 0.45) glow(n % 2 ? 0x2fb6e6 : 0xff5a36, x0 + in1, x1 - in1, h - 0.3, h, d0 + in1 - 0.06, d0 + in1);
    // corporate lettering on the face the runner approaches
    if (h1 > 34 && x1 - x0 > 14 && n % 3 === 1) {
      const [name, sub, fg] = BRANDS[brandN++ % BRANDS.length], w = Math.min(x1 - x0 - 2, 20);
      sign(name, w, w * 0.34, cx, h1 * (0.55 + R() * 0.25), d0 - 0.2, 'back', { fg, sub, bare: true });
    }
  };
  // Overhead megastructure: colossal concrete decks spanning the district, lit from below.
  const overpass = (d, y, depth) => {
    box(CONC2, -120, 120, y, y + 7, d, d + depth);
    box(CONC, -120, 120, y + 7, y + 8.5, d - 1.5, d + depth + 1.5);
    for (let x = -108; x < 110; x += 24) { box(0x0f1418, x, x + 3, y - 2.4, y, d, d + depth); glow(0xff5a36, x + 4, x + 18, y - 0.08, y, d + depth * 0.45, d + depth * 0.45 + 0.5); }
    for (const x of [-52, 46]) { box(CONC2, x, x + 8, 0, y, d + depth * 0.25, d + depth * 0.75); boxR(CONC2, 5, 30, 5, x + (x < 0 ? 16 : -8), y - 11, d + depth / 2, 0, 0, x < 0 ? -0.75 : 0.75); }
    winBox(1, -110, -30, y + 8.5, y + 26, d + 3, d + depth - 3); winBox(0, 20, 96, y + 8.5, y + 20, d + 3, d + depth - 3);
    glow(0x2fb6e6, -120, 120, y + 3.4, y + 3.7, d - 0.08, d);
  };
  overpass(380, 86, 36); overpass(980, 70, 34);        // kept few and high so the sunset sky stays open
  // lattice power pylons
  const pylon = (x, d, h) => {
    for (const [ox, od] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) boxR(0x0f1418, 0.25, h, 0.25, x + ox * 0.55, h / 2, d + od * 0.55, od * 0.035, 0, -ox * 0.035);
    for (let y = 8; y < h; y += 9) { box(0x0f1418, x - 1.7, x + 1.7, y, y + 0.15, d - 0.08, d + 0.08); box(0x0f1418, x - 0.08, x + 0.08, y, y + 0.15, d - 1.7, d + 1.7); }
    for (const y of [h - 4, h - 12]) box(0x0f1418, x - 7, x + 7, y, y + 0.3, d - 0.15, d + 0.15);
    glow(HAZARD, x - 0.3, x + 0.3, h, h + 0.6, d - 0.3, d + 0.3);
  };
  for (const [x, d, h] of [[-34, 40, 70], [33, 210, 62], [-34, 470, 56], [33, 700, 50], [-34, 880, 48]]) pylon(x, d, h);
  // ---- distinct building types, so the skyline reads as a real district rather than one block repeated
  const TINTS = [0xffffff, 0xf2ddd0, 0xd6cce8, 0xcfdcdc, 0xf5d2b0, 0xe6b8ac, 0xc2c2d4, 0xf0e6c8];
  const roofTank = (x, y, d) => { for (const [ox, od] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(0x4c4456, x + ox - 0.1, x + ox + 0.1, y, y + 1.6, d + od - 0.1, d + od + 0.1); cyl(0x8a6a5a, 1.5, 2.6, x, y + 2.9, d, 'y', false, 10); addGeo(new THREE.ConeGeometry(1.6, 0.8, 10), 0x6a4f48, x, y + 4.6, d); };
  const types = {
    // long housing slab: balconies, laundry, water tanks, rooftop shacks
    housing(x0, x1, d0, d1, h, face, sx) {
      winBox(2, x0, x1, 0, h, d0, d1);
      for (let y = 7; y < h - 3; y += 6) {
        box(0x7a6f80, face - (sx > 0 ? 0 : 1), face + (sx > 0 ? 1 : 0), y, y + 0.18, d0 + 1, d1 - 1);
        box(0x54495c, face + sx * 0.95 - 0.04, face + sx * 0.95 + 0.04, y + 0.18, y + 1, d0 + 1, d1 - 1);
        if (R() < 0.5) for (let d = d0 + 2; d < d1 - 2; d += 1.4 + R() * 2) if (R() < 0.6) box([0xf5f1ff, 0xff8fc7, 0x8fd0ff, 0xffd08a][Math.floor(R() * 4)], face + sx * 1.0, face + sx * 1.04, y - 1.3, y - 0.2, d, d + 0.8);
      }
      box(0x8a5a52, x0 + 1, x0 + 4, h, h + 3.2, d0 + 1, d0 + 4);                                   // stair head
      roofTank(x1 - 4, h, d1 - 4); if (d1 - d0 > 16) roofTank(x1 - 4, h, d0 + 5);
      for (let i = 0; i < 3; i++) { const c = SHEETS[Math.floor(R() * SHEETS.length)], px = x0 + 5 + R() * Math.max(1, x1 - x0 - 12), pd = d0 + 3 + R() * Math.max(1, d1 - d0 - 8); box(c, px, px + 3, h, h + 2.3, pd, pd + 3.4); }
      for (const d of [d0 + 2, d1 - 2]) { box(0x101318, (x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06, h, h + 8, d - 0.06, d + 0.06); }
    },
    office: (x0, x1, d0, d1, h, face, sx, v) => tower(x0, x1, d0, d1, h, v),
    // stepped terraces with planted decks
    ziggurat(x0, x1, d0, d1, h, face, sx, v) {
      const tiers = 4 + Math.floor(R() * 2), step = Math.min((x1 - x0) / (tiers * 2 + 1.5), (d1 - d0) / (tiers * 2 + 1.5));
      for (let i = 0; i < tiers; i++) {
        const y0 = (h * i) / tiers, y1 = (h * (i + 1)) / tiers, k = i * step;
        winBox(v, x0 + k, x1 - k, y0, y1, d0 + k, d1 - k);
        box(0x7a6f80, x0 + k - 0.3, x1 - k + 0.3, y1 - 0.5, y1, d0 + k - 0.3, d1 - k + 0.3);
        for (let x = x0 + k + 1; x < x1 - k - 1; x += 3 + R() * 3) box(R() < 0.5 ? 0x3f7a55 : 0x5a8a4a, x, x + 1.4, y1, y1 + 0.9 + R(), d0 + k + 0.2, d0 + k + 1.3);
      }
      glow(0xff7ad9, x0 + tiers * step, x1 - tiers * step, h, h + 0.4, d0 + tiers * step - 0.05, d0 + tiers * step);
    },
    // round tower with a crown ring
    round(x0, x1, d0, d1, h, face, sx, v) {
      const cx = (x0 + x1) / 2, cd = (d0 + d1) / 2, rad = Math.min(x1 - x0, d1 - d0) / 2 - 0.5;
      winBox(v, x0, x1, 0, h * 0.22, d0, d1);
      winCyl(v, cx, cd, rad, h * 0.22, h);
      cyl(0x6a6070, rad + 0.6, 0.8, cx, h * 0.22 + 0.4, cd, 'y', false, 20); cyl(0x6a6070, rad + 0.5, 1, cx, h + 0.5, cd, 'y', false, 20);
      cyl(0x59e6ff, rad + 0.7, 0.25, cx, h - 2, cd, 'y', true, 20);
      addGeo(new THREE.ConeGeometry(rad * 0.5, rad * 1.2, 12), 0x54495c, cx, h + 1 + rad * 0.6, cd);
      box(0x101318, cx - 0.08, cx + 0.08, h + 1 + rad * 1.2, h + 1 + rad * 1.2 + 9, cd - 0.08, cd + 0.08);
    },
    // plant: low sheds, chimneys with warning bands, tank farm, pipe racks
    industrial(x0, x1, d0, d1, h) {
      const hh = Math.min(h * 0.35, 20);
      box(0x6a5a60, x0, x1, 0, hh, d0, d1);
      for (let x = x0; x < x1 - 2; x += 4) boxR(0x7a4a52, 4.2, 0.2, d1 - d0, x + 2, hh + 1.1, (d0 + d1) / 2, 0, 0, 0.5);          // saw-tooth roof
      for (let d = d0 + 2; d < d1 - 2; d += 5) glow(0xffc27a, x0 - 0.03, x0, hh * 0.5, hh * 0.5 + 1.6, d, d + 2.4);
      const n = 2 + Math.floor(R() * 2);
      for (let i = 0; i < n; i++) {
        const cx = x0 + 3 + i * 4.5, cd = d0 + 4 + R() * 3, ch = h * (0.7 + R() * 0.5);
        addGeo(new THREE.CylinderGeometry(1.0, 1.5, ch, 10), 0x8a6a66, cx, ch / 2, cd);
        for (const k of [0.82, 0.9]) cyl(0xd9d2c8, 1.12, ch * 0.03, cx, ch * k, cd, 'y', false, 10);
        glow(HAZARD, cx - 0.3, cx + 0.3, ch, ch + 0.5, cd - 0.3, cd + 0.3);
      }
      for (let i = 0; i < 3; i++) cyl(0xb9aeb0, 2.2, 5, x1 - 4, hh + 2.5, d0 + 4 + i * 5.5, 'y', false, 12);
      cyl(0x9a8478, 0.5, d1 - d0, x1 - 0.8, hh + 6.5, (d0 + d1) / 2, 'z'); cyl(0x9a8478, 0.35, d1 - d0, x1 - 2, hh + 6.2, (d0 + d1) / 2, 'z');
    },
    // open-deck car park with a rooftop billboard
    carpark(x0, x1, d0, d1, h) {
      const hh = Math.min(h, 34);
      box(0x241d2a, x0 + 0.6, x1 - 0.6, 0, hh, d0 + 0.6, d1 - 0.6);
      for (let y = 0; y < hh; y += 3.4) {
        box(0x8a8290, x0, x1, y + 2.4, y + 3.4, d0, d1);
        glow(0xffd9a0, x0 - 0.02, x1 + 0.02, y + 2.2, y + 2.32, d0 - 0.02, d1 + 0.02);
      }
      for (const x of [x0, x1 - 0.8]) for (let d = d0; d < d1; d += 5) box(0x6a6070, x, x + 0.8, 0, hh, d, d + 0.8);
      const [name, sub, fg] = BRANDS[brandN++ % BRANDS.length], w = Math.min(x1 - x0, 18), cx = (x0 + x1) / 2;
      for (const x of [cx - w / 2 + 1, cx + w / 2 - 1]) box(0x101318, x - 0.15, x + 0.15, hh, hh + 4 + w * 0.34, d0 + 0.6, d0 + 0.9);
      sign(name, w, w * 0.34, cx, hh + 3 + w * 0.17, d0 + 0.5, 'back', { fg, sub, bare: true });
    },
    // twin towers joined by sky bridges
    twin(x0, x1, d0, d1, h, face, sx, v) {
      const mid = (d0 + d1) / 2, g = Math.max(2.5, (d1 - d0) * 0.16);
      winBox(v, x0, x1, 0, h, d0, mid - g); winBox(v, x0, x1, 0, h * 0.82, mid + g, d1);
      for (const k of [0.35, 0.6]) { box(0x54495c, x0 + 2, x1 - 2, h * k, h * k + 3, mid - g, mid + g); glow(0xffd9a0, x0 + 2, x0 + 2.03, h * k + 1, h * k + 2, mid - g, mid + g); glow(0xffd9a0, x1 - 2.03, x1 - 2, h * k + 1, h * k + 2, mid - g, mid + g); }
      box(0x101318, (x0 + x1) / 2 - 0.1, (x0 + x1) / 2 + 0.1, h, h + 16, d0 + 3, d0 + 3.2); glow(HAZARD, (x0 + x1) / 2 - 0.3, (x0 + x1) / 2 + 0.3, h + 16, h + 16.6, d0 + 2.8, d0 + 3.4);
      glow(0x59e6ff, x0 - 0.05, x1 + 0.05, h * 0.82, h * 0.82 + 0.4, d1 - 0.05, d1 + 0.05);
    },
    // concrete core swallowed by bolted-on units of every colour
    hive(x0, x1, d0, d1, h, face, sx) {
      const hh = Math.min(h, 70);
      winBox(4, x0 + 1.5, x1 - 1.5, 0, hh, d0 + 1.5, d1 - 1.5);
      for (let y = 4; y < hh - 3; y += 2.9) for (let d = d0 + 1; d < d1 - 3; d += 3.3) {
        if (R() < 0.55) { const c = SHEETS[Math.floor(R() * SHEETS.length)], out = 0.6 + R() * 1.6;
          box(c, face - (sx > 0 ? 0 : out) - (sx > 0 ? -0 : 0) + (sx > 0 ? -1.5 : 0), face + (sx > 0 ? out : 1.5), y, y + 2.5, d, d + 3);
          if (R() < 0.6) glow([0xffc27a, 0xffe0a0, 0x9fe6ff, 0xff7ad9][Math.floor(R() * 4)], face + sx * out + (sx > 0 ? 0 : -0.04), face + sx * out + (sx > 0 ? 0.04 : 0), y + 0.9, y + 1.8, d + 0.6, d + 2); }
      }
      for (let x = x0 + 1; x < x1 - 3; x += 3.3) for (let y = 4; y < hh - 3; y += 2.9) if (R() < 0.5) { const c = SHEETS[Math.floor(R() * SHEETS.length)], out = 0.5 + R() * 1.4; box(c, x, x + 3, y, y + 2.5, d0 + 1.5 - out, d0 + 1.6); if (R() < 0.6) glow(0xffc27a, x + 0.7, x + 2, y + 0.9, y + 1.8, d0 + 1.5 - out - 0.04, d0 + 1.5 - out); }
      roofTank((x0 + x1) / 2, hh, (d0 + d1) / 2);
    },
  };
  const SHEETS = [0x9c4a5c, 0x5d7fa0, 0x8a6a5a, 0xa85a64, 0x6f8fae, 0x7a6a7a, 0xc9a86a, 0x4f8a7a];
  const NEAR = ['housing', 'office', 'ziggurat', 'round', 'industrial', 'carpark', 'twin', 'hive', 'housing', 'office'];
  const FAR = ['office', 'twin', 'round', 'ziggurat', 'office', 'housing'];
  const lastType = { '-1n': '', '1n': '', '-1f': '', '1f': '' };
  const block = (row, sx, x0, x1, d0, d1, h) => {
    const list = row === 'n' ? NEAR : FAR, key = sx + row;
    let t = list[Math.floor(R() * list.length)];
    if (t === lastType[key]) t = list[(list.indexOf(t) + 1 + Math.floor(R() * 3)) % list.length];   // never the same type twice running
    lastType[key] = t;
    TINT = TINTS[Math.floor(R() * TINTS.length)];
    const v = [0, 1, 3, 4, 0, 1][Math.floor(R() * 6)];
    const hh = t === 'carpark' || t === 'industrial' ? h : h * (t === 'round' ? 1.25 : 1), face = sx > 0 ? x0 : x1;
    types[t](x0, x1, d0, d1, hh, face, -sx, v);
    TINT = 0xffffff;
    if (t !== 'round' && t !== 'industrial') {                       // neon: vertical tubes on the street face, sometimes a lit roofline
      const top = t === 'carpark' ? Math.min(h, 34) : t === 'hive' ? Math.min(h, 70) : h;
      for (let i = 0; i < 2; i++) if (R() < 0.75) { const c = NEON[1 + Math.floor(R() * 4)], dd = d0 + 1.5 + R() * (d1 - d0 - 3), ya = top * (0.15 + R() * 0.3); glow(c, face - sx * 0.3 - 0.12, face - sx * 0.3 + 0.12, ya, Math.min(top - 1, ya + 8 + R() * top * 0.4), dd, dd + 0.3); }
      if (R() < 0.5 && t !== 'ziggurat') { const c = NEON[1 + Math.floor(R() * 3)]; glow(c, x0 - 0.1, x1 + 0.1, top - 0.35, top, d0 - 0.12, d0); glow(c, face - sx * 0.12 - 0.06, face - sx * 0.12 + 0.06, top - 0.35, top, d0, d1); }
    }
  };
  for (let d = -130; d < 1300; ) {
    const len = 16 + R() * 26;
    for (const sx of [-1, 1]) {
      const near = sx < 0 ? 38 : 40;
      const w1 = 14 + R() * 12;
      block('n', sx, sx > 0 ? near : -near - w1, sx > 0 ? near + w1 : -near, d, d + len - 3, 26 + R() * 60);
      const w2 = 18 + R() * 20, n2 = near + w1 + 6;
      block('f', sx, sx > 0 ? n2 : -n2 - w2, sx > 0 ? n2 + w2 : -n2, d + 2, d + len - 2, 60 + R() * 110);
    }
    // low filler blocks between the route and the avenues (kept well below the run line)
    if (d < 225 || d > 475) {
      const routeTop = d < 80 ? 28 : d < 240 ? 26 : d < 560 ? 12 : d < 730 ? 9 : d < 640 + S ? 8 : 0;
      const half = d > 160 && d < 240 ? 12 : 6;
      const h = Math.max(0, routeTop - 10 - R() * 5);
      if (h > 2 && d > 4) for (const sx of [-1, 1]) {
        const xa = half + 9, xb = 24;
        if (R() < 0.8) { TINT = TINTS[Math.floor(R() * TINTS.length)]; winBox([2, 4, 0][Math.floor(R() * 3)], sx > 0 ? xa : -xb, sx > 0 ? xb : -xa, 0, h, d + 1, d + len - 4); TINT = 0xffffff; }
      }
    }
    d += len;
  }
  // megatowers on the horizon
  for (let i = 0; i < 16; i++) {
    const x = -330 + i * 44 + R() * 20, w = 26 + R() * 30, h = 150 + R() * 240;
    const dd = 1330 + R() * 220; tower(x, x + w, dd, dd + 50 + R() * 40, h, i % 3);
  }
  sign('GLASS DISTRICT', 46, 12, 96, 118, 960, 'back', { fg: '#39f0ff', sub: 'SECTOR 7', bare: true });
  
  
  
  // avenue lane glow
  for (const x of [-34.5, -22.5, 27.5, 39]) glow(0x1f4a66, x - 0.1, x + 0.1, 0, 0.03, -130, 1150);

  // ---------------------------------------------------------------- rooftop dressing
  // Side terraces beside the run line carry the lived-in clutter: shacks, tanks, dishes,
  // antennas, plastic chairs, potted trees, solar panels, umbrellas.
  const SHEET = [0x9c4a5c, 0x5d7fa0, 0x8a6a5a, 0xa85a64, 0x6f8fae, 0x7a6a7a];
  const dish = (x, y, d, r = 0.7) => {
    box(0x2b2740, x - 0.05, x + 0.05, y, y + 1.1, d - 0.05, d + 0.05);
    addGeo(new THREE.CylinderGeometry(r, r * 0.25, 0.22, 10), 0xb9bfd0, x, y + 1.25, d, 0.9, R() * 6, 0);
  };
  const antenna = (x, y, d, h = 6) => {
    box(0x15121f, x - 0.05, x + 0.05, y, y + h, d - 0.05, d + 0.05);
    for (let k = 0.45; k < 1; k += 0.18) box(0x15121f, x - 0.7 * (1.1 - k), x + 0.7 * (1.1 - k), y + h * k, y + h * k + 0.04, d - 0.03, d + 0.03);
    glow(HAZARD, x - 0.1, x + 0.1, y + h, y + h + 0.2, d - 0.1, d + 0.1);
  };
  const tank = (x, y, d) => {
    for (const [ox, od] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(0x211d33, x + ox - 0.07, x + ox + 0.07, y, y + 1.2, d + od - 0.07, d + od + 0.07);
    cyl(0x5a5378, 1.15, 2.2, x, y + 2.3, d, 'y', false, 10);
    addGeo(new THREE.ConeGeometry(1.25, 0.6, 10), 0x3a3458, x, y + 3.7, d);
  };
  const chair = (x, y, d, col) => {
    box(col, x - 0.25, x + 0.25, y + 0.4, y + 0.47, d - 0.25, d + 0.25);
    box(col, x - 0.25, x + 0.25, y + 0.47, y + 0.95, d - 0.25, d - 0.18);
    for (const [ox, od] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(col, x + ox - 0.03, x + ox + 0.03, y, y + 0.4, d + od - 0.03, d + od + 0.03);
  };
  const tree = (x, y, d) => {
    cyl(0x6f7590, 0.32, 0.5, x, y + 0.25, d, 'y', false, 8);
    boxR(0x3b2a22, 0.1, 0.8, 0.1, x + 0.1, y + 0.85, d, 0, 0, -0.3);
    for (const [ox, oy, sz] of [[0.35, 1.25, 0.7], [-0.2, 1.05, 0.5], [0.1, 1.6, 0.45]]) boxR(0x2f7a52, sz, sz * 0.5, sz, x + ox, y + oy, d + (R() - 0.5) * 0.3, 0, R() * 3, 0);
  };
  const solar = (x, y, d) => {
    boxR(0x16305c, 2.2, 0.08, 1.5, x, y + 0.6, d, -0.5);
    boxR(CYAN, 2.2, 0.085, 0.03, x, y + 0.6, d, -0.5, 0, 0, true);
    box(0x3a3d52, x - 0.05, x + 0.05, y, y + 0.9, d + 0.5, d + 0.6);
  };
  const umbrella = (x, y, d) => {
    box(0x9aa0b5, x - 0.03, x + 0.03, y, y + 2.2, d - 0.03, d + 0.03);
    addGeo(new THREE.ConeGeometry(1.3, 0.5, 8), [0xff8a3d, 0x2fd6e6, 0xff5fa2][Math.floor(R() * 3)], x, y + 2.35, d);
    cyl(0xe9eef5, 0.4, 0.06, x, y + 0.75, d, 'y', false, 8);
  };
  const shack = (x, y, d, w, dp, face) => {
    const col = SHEET[Math.floor(R() * SHEET.length)], h = 2.3 + R() * 0.8;
    box(col, x - w / 2, x + w / 2, y, y + h, d - dp / 2, d + dp / 2);
    boxR(0x565b78, w + 0.5, 0.1, dp + 0.5, x, y + h + 0.08, d, 0, 0, face * 0.1);
    const xf = face > 0 ? x - w / 2 - 0.03 : x + w / 2;                                     // lit window toward the run line
    glow([WARM, CYAN, 0xff5fa2][Math.floor(R() * 3)], xf, xf + 0.03, y + 1, y + 1.7, d - dp * 0.3, d + dp * 0.1);
    box(SHEET[Math.floor(R() * SHEET.length)], xf - 0.01, xf + 0.04, y + 0.1, y + 0.9, d + dp * 0.15, d + dp * 0.45);
    if (R() < 0.6) box(0xc9c3c4, x - 0.4, x + 0.4, y + h + 0.13, y + h + 0.7, d - 0.4, d + 0.4);
    lamp(x, y + h - 0.15, d - dp / 2, 'back', 2.4);
  };
  const stack = (x, y, d, face) => {                       // shacks piled two or three high with a ladder and a tarp
    let yy = y;
    const n = 2 + (R() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const w = 3 - i * 0.4, dp = 3.6 - i * 0.5, h = 2.3, ox = (R() - 0.5) * 0.6, col = SHEET[Math.floor(R() * SHEET.length)];
      box(col, x + ox - w / 2, x + ox + w / 2, yy, yy + h, d - dp / 2, d + dp / 2);
      for (let k = -w / 2 + 0.35; k < w / 2; k += 0.35) box(0x12161b, x + ox + k - 0.02, x + ox + k + 0.02, yy, yy + h, d - dp / 2 - 0.02, d - dp / 2);
      box(0x565b78, x + ox - w / 2 - 0.3, x + ox + w / 2 + 0.3, yy + h, yy + h + 0.1, d - dp / 2 - 0.3, d + dp / 2 + 0.3);
      const xf = face > 0 ? x + ox - w / 2 - 0.03 : x + ox + w / 2;
      glow([WARM, 0x9fd8ff, 0xff5a36][Math.floor(R() * 3)], xf, xf + 0.03, yy + 0.9, yy + 1.6, d - dp * 0.3, d + dp * 0.05);
      glow([WARM, 0x9fd8ff][i % 2], x + ox - 0.5, x + ox + 0.5, yy + 1.0, yy + 1.6, d - dp / 2 - 0.04, d - dp / 2);
      yy += h + 0.1;
    }
    box(0x8a8f9c, x - face * 1.7 - 0.04, x - face * 1.7 + 0.04, y, yy - 2.3, d + 0.6, d + 0.68);          // ladder rails
    box(0x8a8f9c, x - face * 1.7 - 0.04, x - face * 1.7 + 0.04, y, yy - 2.3, d + 1.1, d + 1.18);
    boxR([0x2f6fb8, 0xb04a7a, 0x2f8f86][Math.floor(R() * 3)], 2.6, 0.05, 2.2, x, yy + 0.5, d, 0.2, 0, face * 0.15);   // tarp
    if (R() < 0.6) dish(x + 0.6, yy, d + 0.8, 0.55);
  };
  const terrace = (sx, half, top, d0, d1, w = 5.5) => {
    const off = MARGIN + 0.9, xa = sx > 0 ? half + off : -half - off - w, xb = xa + w, cx = (xa + xb) / 2;
    winBox(Math.floor(R() * 3), xa + 0.2, xb - 0.2, 0, top - 0.7, d0 + 0.6, d1 - 0.6);
    slab(0xc4bac8, xa, xb, top - 0.7, top - 0.3, d0 + 0.4, d1 - 0.4);
    box(0x1b1730, sx > 0 ? xb - 0.25 : xa, sx > 0 ? xb : xa + 0.25, top - 0.3, top + 0.3, d0 + 0.4, d1 - 0.4);
    const y = top - 0.3;
    let prev = -1;
    for (let d = d0 + 3.5; d < d1 - 4; d += 6 + R() * 4) {
      let k = Math.floor(R() * 10); if (k === prev) k = (k + 1) % 10; prev = k;
      const far = cx + sx * 1.2, near = cx - sx * 1.4;
      if (k === 0) shack(far, y, d, 2.8, 3.6, sx);
      else if (k === 1) tank(far, y, d);
      else if (k === 2) { dish(far, y, d); dish(near, y, d + 1.4, 0.5); }
      else if (k === 3) antenna(far, y, d, 5 + R() * 5);
      else if (k === 4) { chair(near, y, d, 0xd6342c); chair(near + sx * 0.9, y, d + 0.7, 0x3558c9); box(0xe9eef5, near - 0.3, near + 0.3, y, y + 0.4, d + 1.2, d + 1.6); }
      else if (k === 5) { tree(near, y, d); tree(far, y, d + 1.6); }
      else if (k === 6) { solar(cx, y, d); solar(cx, y, d + 2); }
      else if (k === 7) umbrella(cx, y, d);
      else stack(far, y, d, sx);
    }
    // sagging cables along the outer edge
    const px = sx > 0 ? xb - 0.4 : xa + 0.4;
    for (let d = d0 + 2; d < d1 - 12; d += 12) {
      box(0x15121f, px - 0.05, px + 0.05, y, y + 3.6, d - 0.05, d + 0.05);
      boxR(0x0b0b12, 0.03, 0.03, 6.1, px, y + 3.3, d + 3, 0.1); boxR(0x0b0b12, 0.03, 0.03, 6.1, px, y + 3.3, d + 9, -0.1);
    }
  };
  // Furniture for the service strip between the lane and the parapet. Nothing here collides.
  const SILVER = 0xb9b4bc, PALE = 0xc9c3c4;
  const strip = (sx, half, top, d0, d1) => {
    const xin = sx * (half + 0.55), xout = sx * (half + MARGIN - 0.6), cx = (xin + xout) / 2, y = top - 0.02;
    const wallFace = sx < 0 ? 'left' : 'right';                       // which way things on this side face
    let prev = -1;
    for (let d = d0 + 2.5; d < d1 - 5; ) {
      let k = Math.floor(R() * 9); if (k === prev) k = (k + 1) % 9; prev = k;
      if (k === 0) {                                                  // pair of condensers on a pallet
        for (const od of [0, 2.1]) {
          box(PALE, cx - 0.55, cx + 0.55, y + 0.1, y + 1.25, d + od, d + od + 1.8); box(0x6e6672, cx - 0.5, cx + 0.5, y, y + 0.1, d + od + 0.1, d + od + 1.7);
          for (const fd of [0.5, 1.3]) { cyl(0x3a3440, 0.33, 0.05, cx - sx * 0.56, y + 0.7, d + od + fd, 'x', false, 12); cyl(0xa9a2a6, 0.1, 0.07, cx - sx * 0.57, y + 0.7, d + od + fd, 'x', false, 8); }
        }
        cyl(0xa08a7c, 0.07, 4, cx + sx * 0.5, y + 0.25, d + 2, 'z'); d += 5.6;
      } else if (k === 1) {                                           // galvanised duct: riser, elbow, long run
        box(SILVER, cx - 0.45, cx + 0.45, y, y + 2.5, d, d + 0.9); box(SILVER, cx - 0.45, cx + 0.45, y + 1.6, y + 2.5, d, d + 5.2);
        for (let dd = d + 1.2; dd < d + 5.2; dd += 1) box(0x8d8590, cx - 0.5, cx + 0.5, y + 1.55, y + 2.55, dd - 0.04, dd + 0.04);
        for (const yy of [0.7, 1.4]) box(0x8d8590, cx - 0.5, cx + 0.5, y + yy, y + yy + 0.08, d - 0.05, d + 0.95);
        box(0x3a3440, cx - 0.36, cx + 0.36, y + 1.72, y + 2.38, d + 5.2, d + 5.24);
        for (const dd of [d + 2.4, d + 4.4]) box(0x6f6672, cx - 0.06, cx + 0.06, y, y + 1.6, dd - 0.06, dd + 0.06); d += 6.6;
      } else if (k === 2) {                                           // electrical cabinets
        for (const od of [0, 1.3]) {
          box(0x7d8a84, cx + sx * 0.1 - 0.35, cx + sx * 0.1 + 0.35, y + 0.12, y + 1.55, d + od, d + od + 1.1);
          box(0x4f5a56, cx - sx * 0.26 - 0.01, cx - sx * 0.26 + 0.01, y + 0.2, y + 1.47, d + od + 0.5, d + od + 0.56);
          glow(od ? 0x6dff8a : 0xff4a3a, cx - sx * 0.27 - 0.02, cx - sx * 0.27 + 0.02, y + 1.25, y + 1.33, d + od + 0.15, d + od + 0.23);
        }
        cyl(0x8d8590, 0.05, 1.4, cx + sx * 0.3, y + 0.85, d + 2.55, 'y'); d += 4;
      } else if (k === 3) {                                           // roof-access hut: door, lamp, tin awning
        const hx0 = Math.min(xin + sx * 0.25, xout), hx1 = Math.max(xin + sx * 0.25, xout), face = sx < 0 ? hx1 : hx0;
        box(0x8f8690, hx0, hx1, y, y + 2.7, d, d + 2.8); box(0x7a727e, hx0 - 0.12, hx1 + 0.12, y + 2.7, y + 2.86, d - 0.12, d + 2.92);
        const fo = -sx * 0.03;
        box(0x5a4d52, Math.min(face, face + fo), Math.max(face, face + fo), y + 0.05, y + 2.05, d + 0.9, d + 1.9);
        glow(0xffd28a, Math.min(face, face + fo * 1.3), Math.max(face, face + fo * 1.3), y + 1.25, y + 1.75, d + 1.25, d + 1.55);
        boxR(SHEETS[Math.floor(R() * 3)], 1.3, 0.06, 2.3, face - sx * 0.6, y + 2.42, d + 1.4, 0, 0, sx * 0.32);
        const tone = 1 + Math.floor(R() * 4);
        lamp(face, y + 2.36, d + 1.4, wallFace, 2.6, R() < 0.5 ? 0 : tone);
        glow(NEON[tone], Math.min(face, face + fo * 2), Math.max(face, face + fo * 2), y + 2.15, y + 2.3, d + 0.3, d + 0.8);      // little neon tag by the door
        glow(NEON[tone], hx0 - 0.13, hx1 + 0.13, y + 2.86, y + 2.92, d - 0.13, d - 0.06); d += 4.2;
      } else if (k === 4) {                                           // chain-link fence run along the parapet
        const len = 5 + Math.floor(R() * 3) * 1.5, fx = xout - sx * 0.1;
        for (let dd = d; dd <= d + len + 0.01; dd += 2.5) box(0x8d8590, fx - 0.05, fx + 0.05, y, y + 2.3, dd - 0.05, dd + 0.05);
        box(0x8d8590, fx - 0.04, fx + 0.04, y + 2.26, y + 2.34, d, d + len);
        const fg = new THREE.PlaneGeometry(len, 2.2), uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 2, uv.getY(i) * 4.4);
        fg.rotateY(Math.PI / 2); fg.translate(fx, y + 1.15, -(d + len / 2)); B.push('fence', fenceMat, fg, d);
        d += len + 1;
      } else if (k === 5) {                                           // mushroom vents and a louvred box
        for (const od of [0, 1.2]) { cyl(SILVER, 0.2, 0.8, cx, y + 0.4, d + od + 0.4, 'y', false, 8); cyl(0x8d8590, 0.42, 0.2, cx, y + 0.9, d + od + 0.4, 'y', false, 10); }
        box(SILVER, cx - 0.5, cx + 0.5, y, y + 0.9, d + 2.3, d + 3.4); for (let yy = y + 0.15; yy < y + 0.8; yy += 0.16) box(0x6f6672, cx - sx * 0.5 - 0.02, cx - sx * 0.5 + 0.02, yy, yy + 0.07, d + 2.4, d + 3.3);
        d += 4.6;
      } else if (k === 6) {                                           // dish and mast on a railed plinth
        box(0x857c8a, cx - 0.7, cx + 0.7, y, y + 0.7, d, d + 2.6);
        for (const [ox, od] of [[-0.65, 0.05], [0.65, 0.05], [-0.65, 2.55], [0.65, 2.55]]) box(0x3a3440, cx + ox - 0.03, cx + ox + 0.03, y + 0.7, y + 1.5, d + od - 0.03, d + od + 0.03);
        box(0x3a3440, cx - 0.68, cx + 0.68, y + 1.46, y + 1.52, d + 0.02, d + 0.08); box(0x3a3440, cx - 0.68, cx + 0.68, y + 1.46, y + 1.52, d + 2.52, d + 2.58);
        dish(cx, y + 0.7, d + 0.8, 0.6); antenna(cx, y + 0.7, d + 1.9, 4 + R() * 2); d += 4;
      } else if (k === 7) {                                           // tin lean-to over stacked crates
        for (const [ox, od] of [[-0.6, 0.1], [0.6, 0.1], [-0.6, 3.1], [0.6, 3.1]]) box(0x6a5a52, cx + ox - 0.05, cx + ox + 0.05, y, y + 2.0 + (ox * sx > 0 ? 0.35 : 0), d + od - 0.05, d + od + 0.05);
        boxR(SHEETS[Math.floor(R() * 5)], 1.7, 0.06, 3.5, cx, y + 2.22, d + 1.6, 0, 0, sx * 0.28);
        box(0x8a6a52, cx - 0.4, cx + 0.4, y, y + 0.7, d + 0.5, d + 1.3); box(0x74584a, cx - 0.35, cx + 0.35, y + 0.7, y + 1.3, d + 0.55, d + 1.2); box(0x5d7fa0, cx - 0.4, cx + 0.4, y, y + 0.6, d + 1.6, d + 2.5);
        d += 4.6;
      } else {                                                        // pipes climbing over the parapet
        for (const od of [0, 0.35, 0.7]) { cyl(0xa08a7c, 0.09, 1.1 + od, xout - sx * (0.55 + od / 2), y + 0.12 + od * 0.25, d + od, 'x'); cyl(0xa08a7c, 0.09, 0.9, xout - sx * 0.05, y + 0.55, d + od, 'y'); }
        box(0x7d8a84, cx - 0.3, cx + 0.3, y, y + 0.9, d + 1.5, d + 2.2);
        const tone = 1 + Math.floor(R() * 4), sxp = xout - sx * 0.2;                                        // and a neon blade sign on a pole
        box(0x2a2433, sxp - 0.06, sxp + 0.06, y, y + 4.6, d + 3, d + 3.12);
        box(0x1a1622, sxp - 0.09, sxp + 0.09, y + 2, y + 4.5, d + 2.5, d + 3.6);
        for (let yy = y + 2.2; yy < y + 4.3; yy += 0.5) glow(NEON[tone], sxp - 0.1, sxp + 0.1, yy, yy + 0.28, d + 2.62, d + 3.48);
        glow(NEON[tone], sxp - 0.1, sxp + 0.1, y + 1.95, y + 2.0, d + 2.5, d + 3.6); glow(NEON[tone], sxp - 0.1, sxp + 0.1, y + 4.5, y + 4.55, d + 2.5, d + 3.6);
        d += 4.4;
      }
      d += 1 + R() * 3;
    }
  };
  for (const [half, top, d0, d1] of [[6, 28, 1, 80], [6, 26, 80, 150], [12, 26, 161, 236], [6, 12, 472, 560], [6, 21, 580, 612], [6, 13, 655, 700], [6, 8, 570 + S, 622 + S]]) { strip(-1, half, top, d0, d1); strip(1, half, top, d0, d1); }
  for (const [half, top, d0, d1] of [[6, 28, 1, 80], [6, 26, 80, 150], [12, 26, 161, 236], [6, 12, 472, 560], [6, 21, 580, 612], [6, 13, 655, 700], [6, 8, 570 + S, 622 + S]]) {
    terrace(-1, half, top, d0, d1); terrace(1, half, top, d0, d1);
  }
  // steel pergola frames with hanging planters over the shanty roofs (above head height)
  for (const [d, y] of [[584, 21], [606, 21], [660, 13], [696, 13]]) {
    for (const x of [-6.1, 6.1]) box(0x24524c, x - 0.1, x + 0.1, y, y + 5.2, d - 0.1, d + 0.1);
    box(0x24524c, -6.2, 6.2, y + 5.1, y + 5.3, d - 0.1, d + 0.1);
    for (let x = -5; x < 5.5; x += 2.4) { box(0x2f7a52, x - 0.3, x + 0.3, y + 4.5, y + 5.1, d - 0.25, d + 0.25); }
    glow([CYAN, 0xff5fa2][Math.floor(d) % 2], -6.2, 6.2, y + 5.3, y + 5.36, d - 0.1, d + 0.1);
  }
  sign('SLIDE', 5, 1.8, 0, 26.6, 611, 'back', { fg: '#f2f2ff', sub: '▼ TIN ROOF ▼' });
  for (const x of [-2.6, 2.6]) box(0x15121f, x - 0.08, x + 0.08, 21, 25.8, 610.9, 611.1);

  // warm wall lamps (sodium glow) along the big walls, the market and the bank facade
  for (let d = 262, i = 0; d < 436; d += 22, i++) { lamp(-13, 30.5, d, 'left', 6, [2, 0, 3][i % 3]); lamp(12, 22, d + 9, 'right', 6, [1, 0, 2][i % 3]); }
  pool(-4, 4, 14, 268, 438, 2); pool(12, 4, 14, 268, 438, 1);                       // the market swims in pink and cyan
  for (let d = 296; d < 420; d += 31) if (d < 346 || d > 362) lamp(-4, 18.6, d, 'left', 3.6);
  for (const x of [-11, 11]) lamp(x, 31, -0.2, 'back', 5);
  for (const [x, y, d] of [[-9.5, 23, 55.6], [9.6, 21, 105.6], [-10, 19, 175.6]]) lamp(x, y, d, 'back', 3);
  // distant elevated lines curving through the haze
  for (const [x, y, d, rad, rot] of [[-260, 34, 700, 240, 0.4], [300, 46, 1050, 300, 2.6], [-180, 40, 1250, 220, 5.2]]) {
    const tg = new THREE.TorusGeometry(rad, 2.4, 5, 40, Math.PI * 0.75); tg.rotateX(Math.PI / 2); tg.rotateY(rot);
    addGeo(tg, 0x5a4f66, x, y, d);
    for (let k = 0; k < 6; k++) { const a = rot + (k / 5) * Math.PI * 0.75, px = x + Math.cos(a) * rad, pd = d + Math.sin(a) * rad; box(0x4c4456, px - 1.5, px + 1.5, 0, y, pd - 1.5, pd + 1.5); }
  }

  B.build();

  // ---------------------------------------------------------------- traffic (far below)
  const lanes = [];
  const lane = (axis, pos, dir, a, b, n, speed, y = 0.4) => { for (let i = 0; i < n; i++) lanes.push({ axis, pos, dir, a, b, speed: speed * (0.8 + R() * 0.4), off: R() * (b - a), y }); };
  lane('d', -33, 1, -130, 1150, 22, 17); lane('d', -31, 1, -130, 1150, 18, 22);
  lane('d', -26, -1, -130, 1150, 22, 18); lane('d', -24, -1, -130, 1150, 18, 14);
  lane('d', 29, 1, -130, 1150, 22, 19); lane('d', 31.5, 1, -130, 1150, 18, 15);
  lane('d', 35, -1, -130, 1150, 22, 20); lane('d', 37.5, -1, -130, 1150, 18, 16);
  lane('x', 153.6, 1, -130, 130, 9, 15); lane('x', 157.6, -1, -130, 130, 9, 17);
  lane('x', 727.2, 1, -130, 130, 9, 15); lane('x', 730.8, -1, -130, 130, 9, 17); lane('x', 649.4, 1, -130, 130, 7, 15); lane('x', 652.6, -1, -130, 130, 7, 17);
  // flying traffic between the towers
  lane('d', -17, 1, -130, 1250, 7, 44, 64); lane('d', 21, -1, -130, 1250, 7, 50, 78); lane('d', -52, -1, -130, 1250, 6, 38, 104); lane('d', 58, 1, -130, 1250, 6, 42, 92);
  lane('x', 310, 1, -260, 260, 6, 40, 70); lane('x', 540, -1, -260, 260, 6, 46, 58); lane('x', 800, 1, -260, 260, 6, 40, 52); lane('x', 120, -1, -260, 260, 5, 44, 88);
  lane('d', 5.4, 1, 655 + S, 1250, 9, 15); lane('d', -5.4, -1, 655 + S, 1250, 9, 17);
  const traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.7, 3.8), new THREE.MeshBasicMaterial(), lanes.length);
  traffic.frustumCulled = false;
  const tail = new THREE.Color(0xff2b3b), headl = new THREE.Color(0xfff3c9), side = new THREE.Color(0xffa63d);
  lanes.forEach((l, i) => traffic.setColorAt(i, l.axis === 'x' ? side : l.dir > 0 ? tail : headl));
  scene.add(traffic);

  // ---------------------------------------------------------------- getaway van
  const van = new THREE.Group();
  {
    const vm = (c, g = 0.1) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: g, flatShading: true });
    const gm = (c) => new THREE.MeshBasicMaterial({ color: c });
    const vb = (m, w, h, dp, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), m); b.position.set(x, y, z); van.add(b); return b; };
    const body = vm(0x2a2a38, 0.25);
    vb(body, 2.4, 0.2, 4.4, 0, 0.65, -2.2);                    // bed
    vb(body, 0.12, 1.9, 4.4, -1.14, 1.7, -2.2); vb(body, 0.12, 1.9, 4.4, 1.14, 1.7, -2.2);
    vb(body, 2.4, 0.12, 4.4, 0, 2.7, -2.2);
    vb(body, 2.4, 2.1, 0.12, 0, 1.7, -4.4);
    vb(vm(0x23232d, 0.2), 2.4, 1.7, 1.6, 0, 1.4, -5.2);        // cab
    vb(gm(0x7fe9ff), 2.1, 0.7, 0.05, 0, 1.9, -6.02);
    vb(gm(0xff4a1c), 0.04, 0.35, 4.4, -1.21, 1.6, -2.2); vb(gm(0xff4a1c), 0.04, 0.35, 4.4, 1.21, 1.6, -2.2);
    vb(gm(ACCENT), 2.4, 0.1, 0.14, 0, 0.78, -0.05);            // the ledge to hit
    vb(gm(0x35ff6b), 1.6, 0.06, 3, 0, 2.6, -2.3);              // interior light
    vb(gm(0x39f0ff), 2.2, 0.06, 4.2, 0, 0.3, -2.4);            // underglow
    vb(gm(0xff2b3b), 0.25, 0.4, 0.06, -1.05, 1.1, 0.02); vb(gm(0xff2b3b), 0.25, 0.4, 0.06, 1.05, 1.1, 0.02);
    vb(gm(0xfff3c9), 0.5, 0.25, 0.06, -0.8, 0.9, -6.03); vb(gm(0xfff3c9), 0.5, 0.25, 0.06, 0.8, 0.9, -6.03);
    for (const sx of [-1, 1]) {                                 // doors swung open
      const hinge = new THREE.Group(); hinge.position.set(sx * 1.2, 1.7, 0); hinge.rotation.y = sx * 1.9;
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.9, 0.08), body); door.position.x = -sx * 0.58;
      hinge.add(door); van.add(hinge);
      for (const z of [-0.9, -4.9]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10), vm(0x0c0c10, 0));
        wh.rotation.z = Math.PI / 2; wh.position.set(sx * 1.1, 0.45, z); van.add(wh);
      }
    }
    for (let i = 0; i < 5; i++) vb(vm(0x35ff6b, 0.7), 0.5, 0.22, 0.3, -0.6 + (i % 3) * 0.6, 0.86, -3.4 - Math.floor(i / 3) * 0.5);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 150, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x35ff6b, transparent: true, opacity: 0.4, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0, 78, -2.4); van.add(beam); van.userData.beam = beam;
    const tag = signMesh('VAN', 9, 4.4, { fg: '#35ff6b', sub: '▼ GETAWAY ▼' });
    tag.material.fog = false; tag.position.set(0, 12, -2.4); van.add(tag); van.userData.tag = tag;
  }
  van.position.set(VAN.x, 0, -VAN.startD);
  scene.add(van);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x6c70d8, 0x3a1c58, 1.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xa9b8ff, 0.95); scene.add(key); scene.add(key.target);      // moonlight
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 240 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.06;
  const rim = new THREE.DirectionalLight(0xff3df0, 1.0); rim.position.set(-60, 22, -10); scene.add(rim);    // magenta neon from the left
  const rim2 = new THREE.DirectionalLight(0x39f0ff, 0.9); rim2.position.set(60, 22, -20); scene.add(rim2);   // cyan neon from the right

  // Image-based lighting from a tiny neon "studio" so wet roofs and chrome have something to reflect.
  if (renderer) {
    const env = new THREE.Scene();
    const skyTex = scene.getObjectByName('sky').material.map;
    env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 16, 12), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
    for (const [c, x, y, z, w, h] of [[0xff3df0, -45, 10, -40, 40, 18], [0x39f0ff, 45, 10, -50, 40, 18], [0xffb347, 20, 3, 40, 30, 8], [0x8b5cff, -20, 40, 60, 30, 24], [0xff3df0, 50, 30, 30, 20, 20]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3.4), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.7;
    pm.dispose();
  }

  const m4 = new THREE.Matrix4();
  return {
    glassPane, van, train, crossTrain, sun: key,
    // low quality swaps the physically based materials for cheap ones
    setQuality(level) {
      const low = level === 'low';
      // only High pays for physically based shading everywhere; Med keeps just the wet roofs
      for (const { key: k, mesh } of B.meshes) {
        if (k === 'lit') mesh.material = level === 'high' ? litMat : lamMat;
        else if (k === 'wet') mesh.material = low ? wetLam : wetMat;
      }
      key.castShadow = level === 'high';
      hemi.intensity = low ? 1.7 : 1.5; key.intensity = low ? 1.1 : 0.95;
    },
    update(time, playerD) {
      alarmMat.color.setHex(Math.floor(time * 3) % 2 ? 0xff2030 : 0x4a0a10);
      train.position.z = -(((time * 26) % 1150) - 190);
      crossTrain.position.x = playerD > 500 + S ? -160 + ((time * 34) % 420) : -400;
      lanes.forEach((l, i) => {
        const span = l.b - l.a;
        let p = (l.off + time * l.speed) % span; if (l.dir < 0) p = span - p;
        if (l.axis === 'd') m4.makeTranslation(l.pos, l.y, -(l.a + p));
        else { m4.makeRotationY(Math.PI / 2); m4.setPosition(l.a + p, l.y, -l.pos); }
        traffic.setMatrixAt(i, m4);
      });
      traffic.instanceMatrix.needsUpdate = true;
      van.userData.beam.material.opacity = 0.3 + 0.12 * Math.sin(time * 4);
      van.userData.tag.position.y = 12 + Math.sin(time * 3) * 0.5;
    },
  };
}
