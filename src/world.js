// Builds the Glass District: route geometry from level data plus procedural city dressing.
// Everything is generated at runtime — no external assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colliders, walls, LANDING_PAD, VAN, S } from './level.js';

export const ACCENT = 0xffd60a;        // runnable walls + reachable ledges
const CYAN = 0x39f0ff, MAGENTA = 0xff3df0, PURPLE = 0x8b5cff, HAZARD = 0xff3b30, WARM = 0xffb347;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ textures
// Facades: dark stained concrete with irregular clusters of lit windows (runs, stacks, dark floors),
// rather than an even grid. 12 x 8 windows per tile so the pattern doesn't visibly repeat.
function windowTexture(lit, seed, wall = '#141b21', density = 0.24, maxRun = 5) {
  const r = rng(seed), cv = document.createElement('canvas'), W = 40, H = 60, COLS = 12, ROWS = 8;
  cv.width = W * COLS; cv.height = H * ROWS;
  const g = cv.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 160; i++) {                                   // blotchy concrete
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.012 + r() * 0.03})` : `rgba(0,0,0,${0.05 + r() * 0.14})`;
    g.fillRect(r() * cv.width, r() * cv.height, 6 + r() * 70, 4 + r() * 40);
  }
  const on = [];
  for (let row = 0; row < ROWS; row++) {
    on.push(new Array(COLS).fill(null));
    if (r() < 0.22) continue;                                       // whole floor dark
    for (let col = 0; col < COLS; ) {
      if (r() < density) {
        const len = 1 + Math.floor(r() * maxRun), c = lit[Math.floor(r() * r() * lit.length)];
        for (let k = 0; k < len && col < COLS; k++, col++) on[row][col] = c;
        col += 1;
      } else col++;
    }
  }
  const stair = Math.floor(r() * COLS);                             // a stairwell column that is always on
  for (let row = 0; row < ROWS; row++) if (r() < 0.8) on[row][stair] = lit[0];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const x = col * W + 6, y = row * H + 12, w = 28, h = 34, c = on[row][col];
    g.fillStyle = '#080b0f'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    if (c) {
      g.fillStyle = c; g.fillRect(x, y, w, h);
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      const k = r();
      if (k < 0.3) { g.fillStyle = 'rgba(6,10,14,0.6)'; g.fillRect(x, y, w, 6 + r() * 22); }
      else if (k < 0.4) { g.fillStyle = 'rgba(6,8,12,0.8)'; const px = x + 5 + r() * 14; g.fillRect(px, y + h - 15, 7, 15); g.beginPath(); g.arc(px + 3.5, y + h - 18, 3.5, 0, 7); g.fill(); }
    } else {
      g.fillStyle = 'rgba(120,150,170,0.07)'; g.fillRect(x, y, w, h);
    }
    g.fillStyle = '#080b0f'; g.fillRect(x + w / 2 - 1, y, 2, h);
    const st = g.createLinearGradient(0, y + h, 0, y + h + 22); st.addColorStop(0, 'rgba(0,0,0,0.35)'); st.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = st; g.fillRect(x + 3 + r() * 14, y + h + 2, 5 + r() * 8, 22);       // rain stains under the sills
    if (r() < 0.1) { g.fillStyle = '#2b333b'; g.fillRect(x + 4, y + h + 4, 16, 9); }  // wall AC unit
  }
  for (let row = 0; row < ROWS; row++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, row * H + 55, cv.width, 5); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, row * H + 53, cv.width, 2); }
  for (let col = 0; col < COLS; col += 3) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(col * W - 1, 0, 2, cv.height); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Roughness map for wet roofs: glossy puddles in rougher concrete.
function puddleTexture() {
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

function signMesh(text, w, h, { fg = '#39f0ff', bg = '#120a26', vertical = false, sub = '', bare = false } = {}) {
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

function billboardTexture(w) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b1030'; g.fillRect(0, 0, 1024, 256);
  const kx = ((w.kickFrom - w.d0) / (w.d1 - w.d0)) * 1024;
  g.strokeStyle = '#ffd60a'; g.lineWidth = 26; g.lineJoin = 'miter';
  for (let x = 30; x < kx - 40; x += 92) {
    g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 56, 128); g.lineTo(x, 206); g.stroke();
  }
  g.fillStyle = '#ffd60a'; g.fillRect(kx, 0, 1024 - kx, 256);
  g.fillStyle = '#1b1030'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 italic 92px "Arial Black", Impact, sans-serif';
  g.fillText('KICK', kx + (1024 - kx) / 2, 92);
  g.beginPath(); const cx = kx + (1024 - kx) / 2;                      // arrow pointing off the wall
  g.moveTo(cx - 70, 150); g.lineTo(cx + 20, 150); g.lineTo(cx + 20, 128); g.lineTo(cx + 80, 180);
  g.lineTo(cx + 20, 232); g.lineTo(cx + 20, 210); g.lineTo(cx - 70, 210); g.closePath(); g.fill();
  g.strokeStyle = '#ffd60a'; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 242);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ batching
class Batch {
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
      mesh.castShadow = key !== 'glow'; mesh.receiveShadow = key !== 'glow';
      this.meshes.push({ key, mesh });
      this.scene.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.groups.clear();
  }
}

export function buildWorld(scene, renderer) {
  const R = rng(20771);
  const B = new Batch(scene);
  const lamMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0.12 });
  const wetMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, roughnessMap: puddleTexture(), metalness: 0.35, envMapIntensity: 1.5 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const winMats = [
    windowTexture(['#bfe4ff', '#8fd0ff', '#e6f5ff', '#5fb8ff', '#ffd9a0'], 11, '#141b21', 0.22, 6),      // corporate concrete, cold light
    windowTexture(['#59dcff', '#a6f0ff', '#2fa8e0', '#d9fbff'], 22, '#0e1a22', 0.3, 7),                  // teal glass tower
    windowTexture(['#ffc27a', '#ff9d5c', '#ffe0b0', '#ff7a6b', '#9fd8ff', '#ff6fb5'], 33, '#1c1a20', 0.3, 3),   // housing block, warm
  ].map((map) => new THREE.MeshLambertMaterial({ map, color: 0xd0d6dc, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.9 }));

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
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 11, p.getZ(i) / 11);
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
    B.push('win' + v, winMats[v], g, (d0 + d1) / 2);
  };
  // signs: face = 'back' (toward the approaching runner), 'left' (faces +x), 'right' (faces -x), 'front'
  const sign = (text, w, h, x, y, d, face = 'back', opts) => {
    const m = signMesh(text, w, h, opts);
    m.position.set(x, y, -d);
    m.rotation.y = face === 'left' ? Math.PI / 2 : face === 'right' ? -Math.PI / 2 : face === 'front' ? Math.PI : 0;
    scene.add(m);
    return m;
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
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#03050c'); gr.addColorStop(0.36, '#0a1428'); gr.addColorStop(0.48, '#1d3350');
    gr.addColorStop(0.535, '#4a5f7a'); gr.addColorStop(0.57, '#6a4868'); gr.addColorStop(0.63, '#141d33'); gr.addColorStop(1, '#070a14');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.name = 'sky'; scene.add(sky);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(150, 40), new THREE.MeshBasicMaterial({ color: 0xff9be8, fog: false }));
    moon.position.set(-260, 330, -1900); scene.add(moon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(190, 200, 48), new THREE.MeshBasicMaterial({ color: 0x39f0ff, fog: false, side: THREE.DoubleSide }));
    ring.position.copy(moon.position); ring.rotation.x = 1.25; scene.add(ring);
  }
  box(0x0c0918, -400, 400, -1, -0.06, -260, 1700);
  {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, e = 0.12 + R() * 1.3, rad = 2000;
      pos.set([Math.cos(a) * Math.cos(e) * rad, Math.sin(e) * rad, Math.sin(a) * Math.cos(e) * rad], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2, sizeAttenuation: false, fog: false, depthWrite: false }));
    stars.name = 'stars'; scene.add(stars);
    // neon haze pooling in the streets far below
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(900, 2000), new THREE.MeshBasicMaterial({ color: 0x1c4a70, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    haze.rotation.x = -Math.PI / 2; haze.position.set(0, 3, -600); scene.add(haze);
  }
  const beams = [];
  for (const [x, y, d, col] of [[-170, 150, 420, 0x39f0ff], [150, 170, 760, 0xff3df0], [-120, 190, 1050, 0xb388ff], [190, 140, 250, 0x39f0ff]]) {
    const cg = new THREE.ConeGeometry(26, 520, 14, 1, true); cg.translate(0, 260, 0);
    const beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.set(x, y, -d); scene.add(beam); beams.push(beam);
  }

  // ---------------------------------------------------------------- bank
  {
    const F = 34, Ct = 40.5;
    slab(0x34314a, -9, 9, 33.4, F, -60, 0.6);
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
  const ROOF = 0x3a3360, EDGE = 0x1b1730;
  for (const c of colliders) {
    const { x0, x1, d0, d1 } = c, top = c.y1;
    switch (c.style) {
      case 'roof': {
        winBox(c.win ?? 0, x0 + 0.3, x1 - 0.3, 0, top - 0.5, d0 + 0.3, d1 - 0.3);
        slab(c.shanty ? 0x4a3a52 : ROOF, x0, x1, top - 0.5, top, d0, d1);
        // concrete slab seams + patched panels so it reads as a roof, not a runway
        for (let x = x0 + 3; x < x1 - 1; x += 3) box(0x241f3a, x - 0.04, x + 0.04, top, top + 0.012, d0 + 0.6, d1 - 0.4);
        for (let d = d0 + 5; d < d1 - 6; d += 9 + R() * 8) {
          const px = x0 + 1 + R() * (x1 - x0 - 4), pw = 1.2 + R() * 1.6;
          box([0x453d6e, 0x2e2a4c, 0x51406a, 0x35455e][Math.floor(R() * 4)], px, px + pw, top, top + 0.01, d, d + 1.5 + R() * 2.5);
        }
        for (let d = Math.ceil(d0 / 12) * 12 + 6; d < d1 - 2; d += 12) glow(0x1f6f8a, x0 + 0.6, x1 - 0.6, top, top + 0.015, d, d + 0.14);
        if (!c.noLip) {                                           // reachable ledge = accent
          glow(ACCENT, x0, x1, top - 0.5, top + 0.02, d0 - 0.06, d0 + 0.5);
        }
        glow(0xf2f2ff, x0, x1, top, top + 0.02, d1 - 0.3, d1 - 0.12);
        const open = x1 === -4;                                   // rooftop line: right side opens onto the market
        if (!open) for (const [xa, xb] of [[x0 - 0.3, x0], [x1, x1 + 0.3]]) {
          box(EDGE, xa, xb, top - 0.5, top + 0.4, d0, d1);
          glow(MAGENTA, xa, xb, top + 0.4, top + 0.45, d0, d1);
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
        slab(0x2c2440, x0, x1, top - 0.3, top, d0, d1);
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
          const cols = [0x2f8f86, 0x3566a8, 0xa5502f, 0x2f8f86, 0xb04a7a, 0x3566a8];
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
        boxR(0x2e2948, x1 - x0, 0.4, len, (x0 + x1) / 2, cy - 0.22, cd, ang);
        for (let k = 0.08; k < 1; k += 0.14) {
          boxR(0x5a2a80, x1 - x0 - 1, 0.03, 0.14, (x0 + x1) / 2, c.yA + (c.yB - c.yA) * k + 0.0, d0 + (d1 - d0) * k, ang, 0, 0, true);
        }
        for (const x of [x0 + 0.1, x1 - 0.1]) boxR(CYAN, 0.08, 0.08, len, x, cy + 0.02, cd, ang, 0, 0, true);
        for (let d = d0 + 3; d < d1; d += 8) for (const x of [x0 + 0.4, x1 - 0.4]) {
          const y = c.yA + (c.yB - c.yA) * ((d - d0) / (d1 - d0));
          box(0x1a1528, x - 0.15, x + 0.15, 0, y - 0.3, d - 0.15, d + 0.15);
        }
        break;
      }
      case 'plaza': {
        box(0x161222, x0, x1, 0, top - 0.4, d0, d1);
        slab(0x2a2444, x0, x1, top - 0.4, top, d0, d1);
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
        slab(0x181624, -40, 40, -2, 0, d0, d1);
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
          const xa = x0 + i * w + 0.08, xb = x0 + (i + 1) * w - 0.08;
          box(0x7c8296, xa, xb, b, c.y1, d0, d1);
          box(0x4b5064, xa + 0.15, xb - 0.15, b + 0.15, c.y1 - 0.2, d0 - 0.04, d0);
          cyl(0x23252f, Math.min(0.6, (xb - xa) * 0.32), 0.06, (xa + xb) / 2, c.y1 + 0.02, (d0 + d1) / 2, 'y', false, 10);
        }
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.04, d0 - 0.05, d0 + 0.05);
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
        for (const x of [x0 - 0.2, x1 + 0.2]) box(0x23202e, x - 0.2, x + 0.2, b, b + 3.7, d0 - 0.05, d1 + 0.05);
        box(0x23202e, x0 - 0.4, x1 + 0.4, b + 3.1, b + 3.7, d0 - 0.1, d1 + 0.1);
        if (c.style === 'shutter') {
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
  const CONC = 0x232b33, CONC2 = 0x161c22;
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
  overpass(104, 66, 30); overpass(380, 74, 36); overpass(622, 52, 28); overpass(930, 58, 34);
  // lattice power pylons
  const pylon = (x, d, h) => {
    for (const [ox, od] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) boxR(0x0f1418, 0.25, h, 0.25, x + ox * 0.55, h / 2, d + od * 0.55, od * 0.035, 0, -ox * 0.035);
    for (let y = 8; y < h; y += 9) { box(0x0f1418, x - 1.7, x + 1.7, y, y + 0.15, d - 0.08, d + 0.08); box(0x0f1418, x - 0.08, x + 0.08, y, y + 0.15, d - 1.7, d + 1.7); }
    for (const y of [h - 4, h - 12]) box(0x0f1418, x - 7, x + 7, y, y + 0.3, d - 0.15, d + 0.15);
    glow(HAZARD, x - 0.3, x + 0.3, h, h + 0.6, d - 0.3, d + 0.3);
  };
  for (const [x, d, h] of [[-34, 40, 70], [33, 210, 62], [-34, 470, 56], [33, 700, 50], [-34, 880, 48]]) pylon(x, d, h);
  for (let d = -130; d < 1300; ) {
    const len = 16 + R() * 20;
    for (const sx of [-1, 1]) {
      const near = sx < 0 ? 38 : 40;
      const w1 = 14 + R() * 12;
      tower(sx > 0 ? near : -near - w1, sx > 0 ? near + w1 : -near, d, d + len - 3, 26 + R() * 60, Math.floor(R() * 3));
      const w2 = 18 + R() * 20, n2 = near + w1 + 6;
      tower(sx > 0 ? n2 : -n2 - w2, sx > 0 ? n2 + w2 : -n2, d + 2, d + len - 2, 60 + R() * 110, Math.floor(R() * 3));
    }
    // low filler blocks between the route and the avenues (kept well below the run line)
    if (d < 225 || d > 475) {
      const routeTop = d < 80 ? 28 : d < 240 ? 26 : d < 560 ? 12 : d < 730 ? 9 : d < 640 + S ? 8 : 0;
      const half = d > 160 && d < 240 ? 12 : 6;
      const h = Math.max(0, routeTop - 10 - R() * 5);
      if (h > 2 && d > 4) for (const sx of [-1, 1]) {
        const xa = half + 6.5, xb = 22;
        if (R() < 0.8) winBox(Math.floor(R() * 3), sx > 0 ? xa : -xb, sx > 0 ? xb : -xa, 0, h, d + 1, d + len - 4);
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
  const SHEET = [0x2f8f86, 0xa5502f, 0x3566a8, 0xb04a7a, 0x6a7a3a];
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
    if (R() < 0.6) box(0x7c8296, x - 0.4, x + 0.4, y + h + 0.13, y + h + 0.7, d - 0.4, d + 0.4);
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
    const xa = sx > 0 ? half + 0.3 : -half - 0.3 - w, xb = xa + w, cx = (xa + xb) / 2;
    winBox(Math.floor(R() * 3), xa + 0.2, xb - 0.2, 0, top - 0.7, d0 + 0.6, d1 - 0.6);
    slab(0x2b2644, xa, xb, top - 0.7, top - 0.3, d0 + 0.4, d1 - 0.4);
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
  const hemi = new THREE.HemisphereLight(0x8fb0e8, 0x1c1626, 1.0); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffc4b0, 1.9); scene.add(key); scene.add(key.target);
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 240 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.06;
  const rim = new THREE.DirectionalLight(0x4be3ff, 0.9); rim.position.set(40, 30, -60); scene.add(rim);

  // Image-based lighting from a tiny neon "studio" so wet roofs and chrome have something to reflect.
  if (renderer) {
    const env = new THREE.Scene();
    const skyTex = scene.getObjectByName('sky').material.map;
    env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 16, 12), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
    for (const [c, x, y, z, w, h] of [[0xff3df0, -40, 6, -30, 30, 14], [0x39f0ff, 45, 10, -20, 30, 18], [0xffb347, 10, 2, 50, 40, 8], [0xff9be8, -20, 45, -70, 26, 26], [0x8b5cff, 30, 20, 60, 30, 20]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3.5), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.55;
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
        else if (k === 'wet') mesh.material = low ? lamMat : wetMat;
      }
      key.castShadow = level === 'high';
      hemi.intensity = low ? 1.5 : 1.0; key.intensity = low ? 1.3 : 1.9;
    },
    update(time, playerD) {
      beams.forEach((b, i) => { b.rotation.z = Math.sin(time * 0.23 + i * 1.7) * 0.5; b.rotation.x = Math.cos(time * 0.17 + i * 2.3) * 0.4; });
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
