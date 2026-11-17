// JOB 02 — Iron Harbor. A container port across the bay from the Glass District: stacked boxes,
// a conveyor, a moored freighter, gantry cranes, rain and sodium light over black water.
import * as THREE from 'three';
import { colliders, walls, LANDING_PAD, VAN } from './level.js';
import { ACCENT, rng, Batch, windowTexture, roofTexture, puddleTexture, lampTexture, signMesh, billboardTexture, propPlacer } from './world.js';
import { makeTraffic } from './traffic.js';

const TEAL = 0x39ffd0, AMBER = 0xff9a3d, HAZARD = 0xff3b30, CYAN = 0x39f0ff, MAGENTA = 0xff3df0;
const CONT = [0x9a3b2e, 0x2f5f9a, 0x2f7a5a, 0xc46a28, 0x8a9098, 0x2a8a8a, 0x6a2a3a, 0x4a5a8a, 0xa8a090];
const CONC = 0x6f7478, STEEL = 0x3a4046, DARK = 0x14181c, YEL = 0xd2aa32;

function ridgeTexture() {                       // corrugated container steel
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d'), r = rng(31);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) { g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(x, 0, 5, 128); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 8, 0, 3, 128); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,30,10,${0.05 + r() * 0.16})`; g.fillRect(r() * 128, r() * 128, 4 + r() * 22, 2 + r() * 10); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function harborSky() {
  const r = rng(77), cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  [[0, '#020507'], [0.3, '#05121a'], [0.44, '#0c2a30'], [0.5, '#1c4a48'], [0.53, '#0c262a'], [1, '#03080a']].forEach(([t, c]) => gr.addColorStop(t, c));
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (const [x, col, rad, a] of [[768, '255,60,200', 220, 0.34], [700, '60,220,255', 160, 0.25], [420, '255,150,60', 300, 0.3], [120, '255,150,60', 240, 0.22]]) {
    const gl = g.createRadialGradient(x, 262, 0, x, 262, rad); gl.addColorStop(0, `rgba(${col},${a})`); gl.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gl; g.fillRect(0, 0, 1024, 512);
  }
  for (let i = 0; i < 80; i++) {                                         // low overcast, lit from the yard
    const y = 60 + r() * 190, x = r() * 1024, w = 80 + r() * 260, h = 8 + r() * 20;
    for (const ox of [0, -1024, 1024]) {
      const cg = g.createLinearGradient(0, y - h, 0, y + h);
      cg.addColorStop(0, 'rgba(4,12,16,0)'); cg.addColorStop(0.5, 'rgba(6,18,22,0.75)'); cg.addColorStop(0.9, 'rgba(120,80,40,0.22)'); cg.addColorStop(1, 'rgba(60,60,50,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(x + ox, y, w, h, 0, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHarbor(scene, renderer, assets) {
  const R = rng(9142), B = new Batch(scene);
  const { prop, fit, track } = propPlacer(B, assets);
  scene.fog.color.set(0x0c2428); scene.fog.near = 45; scene.fog.far = 700; scene.background.set(0x05100f);

  const lamMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.25 });
  const puddles = puddleTexture();
  const concMap = roofTexture(), ridgeMap = ridgeTexture();
  const wetMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: concMap, roughness: 1, roughnessMap: puddles, metalness: 0.3, envMapIntensity: 1.7 });
  const deckMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: ridgeMap, roughness: 1, roughnessMap: puddles, metalness: 0.45, envMapIntensity: 1.7 });
  const wetLam = new THREE.MeshLambertMaterial({ vertexColors: true, map: concMap }), deckLam = new THREE.MeshLambertMaterial({ vertexColors: true, map: ridgeMap });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const winMats = [
    windowTexture(['#ffe2b0', '#ffc27a', '#bfeaff', '#fff2d8'], 71, '#c8ccd0', 0.5, 6),       // ship superstructure / offices
    windowTexture(['#ffb45a', '#39ffd0', '#ffd28a'], 72, '#3a4448', 0.22, 3),                // warehouses
  ].map(({ map, emis }) => new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: 0xffffff, emissiveMap: emis, emissiveIntensity: 1 }));
  const NEON = [0xffa85a, TEAL, AMBER, CYAN, MAGENTA];
  const lampTex = lampTexture();
  const coneMats = NEON.map((color) => new THREE.MeshBasicMaterial({ map: lampTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const poolTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 4;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const poolMats = NEON.map((color) => new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));

  // ---------------------------------------------------------------- helpers
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
  const slab = (color, x0, x1, y0, y1, d0, d1, deck = false) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, d1 - d0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv, k = deck ? 2.44 : 9;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / k, p.getZ(i) / k);
    B.push(deck ? 'deck' : 'wet', deck ? deckMat : wetMat, tint(g, color), (d0 + d1) / 2);
  };
  const addGeo = (g, color, x, y, d, rx = 0, ry = 0, rz = 0, isGlow = false) => {
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, -d);
    B.push(isGlow ? 'glow' : 'lit', isGlow ? glowMat : litMat, tint(g, color), d);
  };
  const boxR = (color, w, h, dp, x, y, d, rx = 0, ry = 0, rz = 0, isGlow = false) => addGeo(new THREE.BoxGeometry(w, h, dp), color, x, y, d, rx, ry, rz, isGlow);
  const cyl = (color, r, h, x, y, d, axis = 'y', isGlow = false, seg = 8) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, -d);
    B.push(isGlow ? 'glow' : 'lit', isGlow ? glowMat : litMat, tint(g, color), d);
  };
  const winBox = (v, x0, x1, y0, y1, d0, d1, col = 0xffffff) => {
    const w = x1 - x0, h = y1 - y0, dp = d1 - d0, g = new THREE.BoxGeometry(w, h, dp), uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const j = f * 4 + i;
      if (f === 2 || f === 3) { uv.setXY(j, 0, 0); continue; }
      uv.setXY(j, uv.getX(j) * Math.max(1, Math.round((f < 2 ? dp : w) / 2)) / 12, uv.getY(j) * Math.max(1, Math.round(h / 3)) / 8);
    }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2);
    B.push('win' + v, winMats[v], tint(g, col), (d0 + d1) / 2);
  };
  const sign = (text, w, h, x, y, d, face = 'back', opts) => {
    const m = signMesh(text, w, h, opts);
    m.position.set(x, y, -d);
    m.rotation.y = face === 'left' ? Math.PI / 2 : face === 'right' ? -Math.PI / 2 : face === 'front' ? Math.PI : 0;
    scene.add(m);
    return m;
  };
  const pool = (xEdge, xFar, y, d0, d1, tone) => {
    const g = new THREE.PlaneGeometry(Math.abs(xFar - xEdge), d1 - d0); g.rotateX(-Math.PI / 2);
    if (xFar < xEdge) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    g.translate((xEdge + xFar) / 2, y + 0.035, -(d0 + d1) / 2);
    B.push('pool' + tone, poolMats[tone], g, (d0 + d1) / 2);
  };
  const lamp = (x, y, d, face, size = 4.2, tone = 0) => {
    const g = new THREE.PlaneGeometry(size * 0.9, size); g.translate(0, -size / 2, 0);
    if (face === 'left') g.rotateY(Math.PI / 2); else if (face === 'right') g.rotateY(-Math.PI / 2);
    g.translate(x + (face === 'left' ? 0.07 : face === 'right' ? -0.07 : 0), y, -(d + (face === 'back' ? -0.07 : 0)));
    B.push('cone' + tone, coneMats[tone], g, d);
    glow(NEON[tone], x - 0.3, x + 0.3, y - 0.06, y + 0.1, d - 0.3, d + 0.3);
  };
  const cc = () => CONT[Math.floor(R() * CONT.length)];
  // one shipping container with end doors toward the runner; lit = an open, glowing one
  const container = (col, x0, x1, y0, d0, d1, lit = false) => {
    box(col, x0 + 0.03, x1 - 0.03, y0 + 0.03, y0 + 2.57, d0 + 0.03, d1 - 0.03);
    for (const x of [x0 + 0.03, x1 - 0.15]) box(DARK, x, x + 0.12, y0, y0 + 2.6, d0, d0 + 0.12);
    box(DARK, (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, y0 + 0.1, y0 + 2.5, d0, d0 + 0.04);
    for (const fx of [0.3, 0.7]) box(0xb8bcc0, x0 + (x1 - x0) * fx - 0.02, x0 + (x1 - x0) * fx + 0.02, y0 + 0.15, y0 + 2.45, d0 - 0.02, d0 + 0.03);
    if (lit) glow([0xffc27a, TEAL, 0xff6fb5][Math.floor(R() * 3)], x0 + 0.25, x1 - 0.25, y0 + 0.3, y0 + 2.3, d0 - 0.01, d0 + 0.02);
  };
  // a block of stacked containers down to the water; tops are separate (see 'stack')
  const stackBody = (x0, x1, yTop, d0, d1) => {
    for (let y = yTop - 2.6; y > -2.6; y -= 2.6) for (let d = d0; d < d1 - 0.5; d += 12.2) {
      const de = Math.min(d1, d + 12.2), col = cc(), ya = Math.max(-0.3, y);
      box(col, x0 + 0.04, x1 - 0.04, ya, y + 2.56, d + 0.04, de - 0.04);
      for (let x = x0 + 2.44; x < x1 - 0.5; x += 2.44) { box(DARK, x - 0.04, x + 0.04, ya, y + 2.56, d, d + 0.06); box(DARK, x - 0.04, x + 0.04, ya, y + 2.56, de - 0.06, de); }
      if (R() < 0.12) glow(0xffc27a, x0 + 0.4, x0 + 2, ya + 0.4, y + 2.2, d - 0.01, d + 0.03);
    }
  };

  // ---------------------------------------------------------------- sky, water, horizon
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 20), new THREE.MeshBasicMaterial({ map: harborSky(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky'; scene.add(sky);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 3200), new THREE.MeshStandardMaterial({ color: 0x04100f, roughness: 0.22, metalness: 0.6, roughnessMap: puddles, envMapIntensity: 0.85 }));
  puddles.repeat?.set(1, 1);
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.35, -500); scene.add(water);
  {
    // the Glass District across the bay: same skyline, same spire and halo
    const sil = new THREE.MeshBasicMaterial({ color: 0x0f1a2a, fog: false }), neonC = new THREE.MeshBasicMaterial({ color: 0x59e6ff, fog: false }), neonP = new THREE.MeshBasicMaterial({ color: 0xff7ad9, fog: false });
    const win = new THREE.MeshBasicMaterial({ color: 0xffc27a, fog: false });
    const city = new THREE.Group(); city.position.set(260, 0, -1900);
    [[90, 110, 0], [64, 130, 110], [42, 140, 240], [22, 130, 380], [8, 110, 510]].forEach(([w, h, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), sil); m.position.y = y + h / 2; city.add(m); });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(130, 2.8, 6, 56), neonP); halo.rotation.x = 1.38; halo.position.y = 430; city.add(halo);
    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(90, 2, 6, 48), neonC); halo2.rotation.x = 1.38; halo2.position.y = 462; city.add(halo2);
    for (let i = 0; i < 46; i++) {
      const x = -900 + i * 40 + R() * 20, w = 22 + R() * 34, h = 70 + R() * 240;
      if (Math.abs(x) < 70) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 20), sil); m.position.set(x, h / 2, 30 + R() * 60); city.add(m);
      for (let k = 0; k < 5; k++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(2 + R() * 6, 1.6), R() < 0.2 ? neonC : R() < 0.25 ? neonP : win); d.position.set(x + (R() - 0.5) * w * 0.8, 10 + R() * (h - 14), m.position.z + 10.2); city.add(d); }
    }
    scene.add(city);
    sign('GLASS DISTRICT', 150, 34, 250, 660, 1880, 'back', { fg: '#59e6ff', sub: 'ACROSS THE BAY', bare: true }).material.fog = false;
  }

  // ---------------------------------------------------------------- port control (start)
  {
    const F = 34, Ct = 40.5;
    slab(0x7a8488, -9, 9, 33.4, F, -60, 0.6);
    box(0x1a2226, -9.4, 9.4, Ct, 41, -60, 0);
    for (const sx of [-1, 1]) {
      box(0x2c383e, sx * 9.4 - 0.2, sx * 9.4 + 0.2, F, Ct, -60, 0);
      glow(ACCENT, sx * 3 - 0.06, sx * 3 + 0.06, F, F + 0.02, -60, 0);
      for (let d = -52; d < -8; d += 8) {                                              // control desks with live screens
        box(0x2a3238, sx * 7.4 - 1, sx * 7.4 + 1, F, F + 1, d, d + 5);
        for (let k = 0; k < 3; k++) glow([TEAL, CYAN, AMBER][(k + Math.floor(d)) % 3 < 0 ? 0 : Math.abs(k + Math.floor(d)) % 3], sx * 7.9 - 0.04, sx * 7.9 + 0.04, F + 1.15, F + 2.0, d + 0.3 + k * 1.6, d + 1.6 + k * 1.6);
      }
    }
    for (let d = -56; d < -2; d += 6) glow(0xcfe8e8, -1.4, 1.4, Ct - 0.05, Ct, d, d + 3);
    box(0x2c383e, -9.4, 9.4, F, Ct, -60.4, -60);
    box(0x1c262a, -9.4, 9.4, 33.0, F + 0.05, -0.2, 0.75); box(0x1c262a, -9.4, 9.4, Ct, 41.4, -0.2, 0.75);
    for (const x of [-9.2, -2.7, 2.7, 9.2]) box(0x39454a, x - 0.12, x + 0.12, F, Ct, -0.08, 0.16);
    winBox(1, -14, 14, 0, 33.0, -64, 0, 0xcfd6d8); winBox(1, -14, 14, 41.4, 70, -64, 0, 0xcfd6d8);
    winBox(1, -14, -9.4, 33.0, 41.4, -64, 0, 0xcfd6d8); winBox(1, 9.4, 14, 33.0, 41.4, -64, 0, 0xcfd6d8);
    glow(ACCENT, -2.6, 2.6, F, F + 0.03, -1.4, 0.6);
    sign('HANAZO', 14, 4.6, 0, 45.4, -0.05, 'front', { fg: '#39ffd0', sub: 'PORT AUTHORITY', bare: true });
    sign('PORT CONTROL', 9, 1.6, 0, 38.6, -59.9, 'back', { fg: '#39ffd0', bg: '#132024' });
    box(STEEL, -0.3, 0.3, 70, 96, -32, -31.4); glow(HAZARD, -0.5, 0.5, 96, 96.8, -32.2, -31.2);       // radar mast
  }
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x7fe9e0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  for (const [x0, x1] of [[-9.1, -2.8], [2.8, 9.1]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 6.5), glassMat); m.position.set((x0 + x1) / 2, 37.25, 0); scene.add(m); }
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 6.5), glassMat.clone()); glassPane.material.opacity = 0.3; glassPane.position.set(0, 37.25, 0); scene.add(glassPane);
  const alarmMat = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  for (let d = -54; d < -2; d += 9) for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), alarmMat); m.position.set(sx * 8.9, 39.4, -d); scene.add(m); }

  // ---------------------------------------------------------------- route structures
  for (const c of colliders) {
    const { x0, x1, d0, d1 } = c, top = c.y1;
    switch (c.style) {
      case 'stack': {
        stackBody(x0, x1, top, d0, d1);
        const nx = Math.max(1, Math.round((x1 - x0) / 2.44)), w = (x1 - x0) / nx;
        for (let d = d0; d < d1 - 0.5; d += 12.2) for (let i = 0; i < nx; i++) {                    // the top layer you run on
          const de = Math.min(d1, d + 12.2), col = cc();
          slab(col, x0 + i * w + 0.03, x0 + (i + 1) * w - 0.03, top - 2.6, top, d + 0.03, de - 0.03, true);
          if (d === d0) { for (const fx of [0.3, 0.7]) box(0xb8bcc0, x0 + (i + fx) * w - 0.02, x0 + (i + fx) * w + 0.02, top - 2.45, top - 0.15, d0 - 0.03, d0 + 0.04); }
        }
        if (!c.noLip) glow(ACCENT, x0, x1, top - 0.16, top + 0.02, d0 - 0.06, d0 + 0.3);            // reachable ledge
        if (c.hop) glow(ACCENT, x0, x1, top - 0.1, top + 0.02, d1 - 0.22, d1 + 0.04);
        const open = x0 === 4;                                                                      // crane line: left side opens onto the dock
        for (const sx of [-1, 1]) {
          if (open && sx < 0) continue;
          const xe = sx < 0 ? x0 : x1, tone = sx < 0 ? 2 : 1;
          glow(NEON[tone], xe - 0.05, xe + 0.05, top + 0.02, top + 0.1, d0 + 0.3, d1 - 0.3);         // edge light bars
          pool(xe, xe - sx * 4, top, d0 + 0.3, d1 - 0.3, tone);
          for (let d = d0 + 1; d < d1; d += 6.1) { box(YEL, xe - 0.05, xe + 0.05, top, top + 0.55, d - 0.05, d + 0.05); }
          box(YEL, xe - 0.03, xe + 0.03, top + 0.5, top + 0.56, d0 + 1, d1 - 1);
        }
        break;
      }
      case 'belt': case 'gangway': {
        const len = Math.hypot(d1 - d0, c.yB - c.yA), ang = Math.atan2(c.yB - c.yA, d1 - d0), cy = (c.yA + c.yB) / 2, cd = (d0 + d1) / 2, cx = (x0 + x1) / 2;
        boxR(c.style === 'belt' ? 0x1b1f24 : 0x4a5258, x1 - x0, 0.3, len, cx, cy - 0.17, cd, ang);
        for (let k = 0.04; k < 1; k += c.style === 'belt' ? 0.08 : 0.05) {
          const y = c.yA + (c.yB - c.yA) * k, d = d0 + (d1 - d0) * k;
          if (c.style === 'belt') for (const s of [-1, 1]) boxR(0xe6e6ea, (x1 - x0) * 0.2, 0.02, 0.22, cx + s * (x1 - x0) * 0.09, y + 0.0, d, ang, s * 0.6, 0, true);   // chevrons
          else boxR(0x2c3338, x1 - x0 - 0.4, 0.03, 0.1, cx, y, d, ang);
          if (c.style === 'belt') cyl(STEEL, 0.16, x1 - x0 + 0.4, cx, y - 0.36, d, 'x');
        }
        for (const x of [x0 - 0.15, x1 + 0.15]) {
          boxR(YEL, 0.3, 0.5, len, x, cy + 0.05, cd, ang); boxR(YEL, 0.08, 0.08, len, x, cy + 1.05, cd, ang);
          for (let d = d0 + 0.3; d <= d1; d += 3) { const y = c.yA + (c.yB - c.yA) * ((d - d0) / (d1 - d0)); box(YEL, x - 0.05, x + 0.05, y, y + 1.05, d - 0.05, d + 0.05); }
          glow(c.style === 'belt' ? AMBER : TEAL, x - 0.02, x + 0.02, c.yB + 0.3, c.yB + 0.36, d1 - 0.3, d1);
        }
        for (let d = d0 + 4; d < d1; d += 9) for (const x of [x0 + 0.5, x1 - 0.5]) { const y = c.yA + (c.yB - c.yA) * ((d - d0) / (d1 - d0)); box(STEEL, x - 0.18, x + 0.18, -0.3, y - 0.4, d - 0.18, d + 0.18); }
        break;
      }
      case 'billboard': {                       // runnable plating on the freighter's side
        const w = walls[0];
        box(0x1a1f24, x0 + 0.06, x1, c.y0, top + 0.3, d0, d1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(d1 - d0, top - c.y0), new THREE.MeshBasicMaterial({ map: billboardTexture(w, true) }));
        m.rotation.y = -Math.PI / 2; m.position.set(x0 - 0.01, (c.y0 + top) / 2, -(d0 + d1) / 2); scene.add(m);
        break;
      }
      case 'hull': case 'hullend': {            // moored freighter HANAZO MARU
        box(0x6a2020, x0, x1, -0.3, 9, d0, d1); box(0x15191d, x0 - 0.02, x1, 9, top - 6, d0, d1);
        box(0xd8dce0, x0 - 0.04, x0, 8.6, 9.2, d0, d1);
        box(0x2a3036, x0 - 0.3, x1, top - 6, top - 5.6, d0, d1);                                     // deck edge
        if (c.style === 'hull') {
          for (let d = d0 + 6; d < d1 - 4; d += 9) { cyl(0x0a0d10, 0.5, 0.1, x0 - 0.03, 22 + (Math.floor(d) % 2) * 5, d, 'x', false, 10); glow(0xffd9a0, x0 - 0.06, x0 - 0.02, 21.8 + (Math.floor(d) % 2) * 5, 22.2 + (Math.floor(d) % 2) * 5, d - 0.2, d + 0.2); }
          for (let d = d0 + 2; d < d1 - 12; d += 12.4) for (let y = top - 5.6; y < top + 5; y += 2.6) if (R() < 0.85) box(cc(), x0 + 0.2, x1, y, y + 2.56, d, d + 12.2);
          sign('HANAZO MARU', 34, 4.4, x0 - 0.12, 12.6, 392, 'right', { fg: '#e6eaee', bare: true });
          for (let d = 306; d < 440; d += 26) lamp(x0, top - 6.4, d, 'right', 7, 0);
          winBox(0, x0 + 1, x1, top - 5.6, top + 14, 452, 478); box(0xb82a2a, x0 + 3, x1 - 2, top + 14, top + 22, 458, 468); box(0x15191d, x0 + 3, x1 - 2, top + 19, top + 20.5, 458, 468);
        }
        break;
      }
      case 'net': case 'netlow': {              // barge under a striped tarp: the bounce
        box(0x23292e, x0, x1, -0.3, top - 0.5, d0, d1);
        let i = 0;
        for (let d = d0; d < d1; d += 2, i++) box(i % 2 ? 0xf2f2f2 : ACCENT, x0 - 0.5, x1, top - 0.3, top, d, Math.min(d1, d + 2));
        glow(ACCENT, x0 - 0.56, x0 - 0.5, top - 0.5, top, d0, d1);
        break;
      }
      case 'dock': {
        box(0x3a4046, x0, x1, -0.3, top - 0.4, d0, d1);
        slab(0xb9c0c4, x0, x1, top - 0.4, top, d0, d1);
        for (let d = d0 + 3; d < d1; d += 5) box(YEL, x0 + 5.5, x0 + 10.5, top, top + 0.012, d, d + 0.25);         // lane dashes
        for (let d = d0 + 8; d < d1 - 10; d += 44) for (let k = 0; k < 6; k++) boxR(YEL, 4, 0.012, 0.25, x0 + 3, top + 0.006, d + k * 0.9, 0, 0.6);   // hatched bays
        glow(NEON[2], x0 + 0.05, x0 + 0.13, top, top + 0.04, d0, d1); glow(NEON[1], x1 - 0.13, x1 - 0.05, top, top + 0.04, d0, d1);
        pool(x0, x0 + 7, top, d0 + 2, d1 - 2, 2); pool(x1, x1 - 7, top, d0 + 2, d1 - 2, 1);
        for (let d = d0 + 14; d < d1 - 6; d += 28) {                                                              // workers in hi-vis
          const wx = x0 + 1 + R() * 1.2;
          box(0x1b2228, wx - 0.2, wx + 0.2, top, top + 0.8, d - 0.14, d + 0.14); box(0xff7a1c, wx - 0.26, wx + 0.26, top + 0.8, top + 1.45, d - 0.17, d + 0.17);
          glow(0xf2f2c0, wx - 0.27, wx + 0.27, top + 1.05, top + 1.12, d - 0.18, d + 0.18); box(0xffd23a, wx - 0.15, wx + 0.15, top + 1.47, top + 1.76, d - 0.15, d + 0.15);
        }
        break;
      }
      case 'cwall': {                           // a cliff of containers along the alley
        for (let y = 0; y < top; y += 2.6) for (let d = d0; d < d1 - 1; d += 12.2) {
          const col = cc(), de = Math.min(d1, d + 12.2), inset = R() < 0.15 ? 0.6 : 0;
          box(col, x0, x1 - inset, Math.max(-0.3, y), y + 2.56, d + 0.04, de - 0.04);
          if (y > 7 && R() < 0.14) glow([0xffc27a, TEAL, 0xff6fb5][Math.floor(R() * 3)], x1 - inset, x1 - inset + 0.04, y + 0.4, y + 2.1, d + 1, d + 4.5);
          if (y > 7 && R() < 0.06) { box(0xb8bcc0, x1 - inset, x1 - inset + 0.5, y + 0.3, y + 2.2, d + 9, d + 11.6); glow(TEAL, x1 - inset + 0.5, x1 - inset + 0.54, y + 1.5, y + 1.9, d + 9.4, d + 10.2); }   // reefer unit
        }
        sign('KUROMA', 14, 4.4, x1 + 0.1, 24, 318, 'left', { fg: '#ff5a36', sub: 'ELECTRONICS', bare: true });
        sign('TETSUDO', 14, 4.4, x1 + 0.1, 27, 404, 'left', { fg: '#39ffd0', sub: 'RAIL FREIGHT', bare: true });
        for (let d = 290; d < 440; d += 30) lamp(x1, 19, d, 'left', 8, [0, 2, 1][Math.floor(d / 30) % 3]);
        break;
      }
      case 'quay': {
        box(0x3a4046, x0, x1, -0.3, top - 0.4, d0, d1); slab(0xb9c0c4, x0, x1, top - 0.4, top, d0, d1);
        if (d0 === 450) {
          glow(ACCENT, 4, 13, top - 0.4, top + 0.02, 429.95, 430.5);
          for (const [xa, xb] of [[-12, -6], [13, 6]]) {
            const ang = Math.atan2(xb - xa, 32), len = Math.hypot(xb - xa, 32);
            boxR(0x8a9098, 0.4, 0.9, len, (xa + xb) / 2, top + 0.45, 466, 0, -ang, 0); boxR(AMBER, 0.44, 0.08, len, (xa + xb) / 2, top + 0.92, 466, 0, -ang, 0, true);
          }
        }
        break;
      }
      case 'pier': {
        slab(0xa9b0b4, -9, 9, -1.6, 0, d0, d1);
        for (let d = d0 + 6; d < d1; d += 12) for (const x of [-8.2, 8.2]) box(STEEL, x - 0.4, x + 0.4, -3, -1.6, d - 0.4, d + 0.4);
        for (let d = d0; d < d1; d += 6) glow(0xe8e8f0, -0.08, 0.08, 0, 0.012, d, d + 2.6);
        for (const sx of [-1, 1]) {
          box(0x8a9098, sx * 2.25 - 0.2, sx * 2.25 + 0.2, 0, 0.7, d0, d1); glow(sx < 0 ? AMBER : TEAL, sx * 2.25 - 0.21, sx * 2.25 + 0.21, 0.7, 0.76, d0, d1);
          for (let d = d0 + 4; d < d1; d += 10) { cyl(DARK, 0.3, 0.7, sx * 7, 0.35, d, 'y', false, 8); cyl(DARK, 0.42, 0.14, sx * 7, 0.72, d, 'y', false, 8); }     // bollards
        }
        break;
      }
    }
  }
  // landing pad for the kick-off
  {
    const p = LANDING_PAD, y = p.y + 0.012;
    for (const [a, b, e, f] of [[p.x0, p.x1, p.d0, p.d0 + 0.3], [p.x0, p.x1, p.d1 - 0.3, p.d1], [p.x0, p.x0 + 0.3, p.d0, p.d1], [p.x1 - 0.3, p.x1, p.d0, p.d1]]) glow(ACCENT, a, b, y, y + 0.012, e, f);
    for (let d = p.d0 + 1.4; d < p.d1 - 1; d += 1.6) for (const s of [-1, 1]) boxR(ACCENT, 2.2, 0.012, 0.3, (p.x0 + p.x1) / 2 + s * 0.85, y, d, 0, s * 0.6, 0, true);
  }
  // final funnel onto the pier
  for (const sx of [-1, 1]) boxR(sx < 0 ? AMBER : TEAL, 0.12, 0.12, Math.hypot(1.95, 24, 4), sx * 3.1, 2.9, 672, Math.atan2(-4, 24), -Math.atan2(sx * -1.95, 24), 0, true);

  // ---------------------------------------------------------------- obstacles
  for (const c of colliders) {
    const { x0, x1, d0, d1 } = c, b = c.kind === 'over' ? c.base : c.y0, cx = (x0 + x1) / 2;
    switch (c.style) {
      case 'crate': {
        const n = Math.max(1, Math.round((x1 - x0) / 1.5)), w = (x1 - x0) / n;
        for (let i = 0; i < n; i++) {
          const xa = x0 + i * w + 0.05, xb = x0 + (i + 1) * w - 0.05;
          if (fit('Crate', xa, xb, b, c.y1, d0, d1, { tint: i % 2 ? 0xffe6c8 : 0xffffff })) continue;
          box(i % 2 ? 0x8a6a4a : 0x7a5c40, xa, xb, b, c.y1, d0, d1);
          box(0x4a3828, xa, xb, b + 0.44, b + 0.56, d0 - 0.03, d0); box(0x4a3828, (xa + xb) / 2 - 0.05, (xa + xb) / 2 + 0.05, b, c.y1, d0 - 0.03, d0);
        }
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.03, d0 - 0.05, d0 + 0.03);
        break;
      }
      case 'drum': {
        for (let x = x0 + 0.45; x < x1; x += 0.95) {
          if (fit('Barrel', x - 0.42, x + 0.42, b, c.y1, (d0 + d1) / 2 - 0.42, (d0 + d1) / 2 + 0.42, { tint: [0xffffff, 0xffc8b8, 0xc8ffd8][Math.abs(Math.floor(x * 3)) % 3] })) continue;
          cyl([0x2f5f9a, 0x9a3b2e, 0x2f7a5a][Math.floor(x * 3) % 3 < 0 ? 0 : Math.abs(Math.floor(x * 3)) % 3], 0.42, c.y1 - b, x, (b + c.y1) / 2, (d0 + d1) / 2, 'y', false, 10);
          cyl(YEL, 0.44, 0.12, x, b + 0.7, (d0 + d1) / 2, 'y', false, 10);
        }
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.03, d0 + 0.1, d0 + 0.18);
        break;
      }
      case 'pallet': {
        box(0x8a6a4a, x0, x1, b, b + 0.15, d0, d1);
        for (let x = x0 + 0.1; x < x1 - 0.5; x += 1.3) box([0xcfd6da, 0xb9c4cc, 0xd8cfc0][Math.floor(x) % 3 < 0 ? 0 : Math.abs(Math.floor(x)) % 3], x, Math.min(x1 - 0.1, x + 1.15), b + 0.15, c.y1, d0 + 0.1, d1 - 0.1);
        glow(MAGENTA, x0, x1, c.y1, c.y1 + 0.03, d0 + 0.05, d0 + 0.13);
        break;
      }
      case 'forklift': {
        box(0xe0a81c, cx - 0.8, cx + 0.8, b + 0.3, b + 1.1, d0 + 0.6, d1);
        box(0x1a1f24, cx - 0.7, cx + 0.7, b + 1.1, b + 1.2, d0 + 0.7, d1 - 0.1);
        for (const x of [cx - 0.7, cx + 0.62]) { box(0x1a1f24, x, x + 0.08, b + 1.1, c.y1, d0 + 0.75, d0 + 0.83); box(0x1a1f24, x, x + 0.08, b + 1.1, c.y1, d1 - 0.2, d1 - 0.12); }
        box(0x1a1f24, cx - 0.75, cx + 0.75, c.y1 - 0.08, c.y1, d0 + 0.7, d1 - 0.1);
        for (const x of [cx - 0.5, cx + 0.4]) { box(STEEL, x, x + 0.1, b + 0.1, c.y1 + 0.3, d0 + 0.45, d0 + 0.6); box(0x8a9098, x, x + 0.1, b + 0.12, b + 0.2, d0 - 0.5, d0 + 0.5); }
        for (const x of [cx - 0.85, cx + 0.85]) for (const d of [d0 + 0.9, d1 - 0.4]) cyl(DARK, 0.3, 0.25, x, b + 0.3, d, 'x', false, 10);
        glow(AMBER, cx - 0.12, cx + 0.12, c.y1, c.y1 + 0.18, (d0 + d1) / 2, (d0 + d1) / 2 + 0.24);
        glow(HAZARD, x0, x1, b, b + 0.06, d0 - 0.52, d0 - 0.46);
        break;
      }
      case 'spreader': case 'scanner': case 'barrier': {
        if (c.style === 'spreader') {                                                    // crane spreader beam hanging on cables
          box(YEL, x0 - 0.2, x1 + 0.2, b + 1.32, b + 2.1, d0 - 0.2, d1 + 0.3);
          for (let x = x0 + 0.5; x < x1; x += 2) box(DARK, x, x + 0.5, b + 1.3, b + 2.12, d0 - 0.22, d0 - 0.2);
          for (const x of [x0 + 1, x1 - 1]) box(DARK, x - 0.05, x + 0.05, b + 2.1, b + 22, d0 + 0.1, d0 + 0.2);
          for (const x of [x0 - 0.1, x1 + 0.1]) box(STEEL, x - 0.2, x + 0.2, b + 0.9, b + 1.32, d0 - 0.1, d1 + 0.2);
        } else if (c.style === 'scanner') {                                              // cargo scanner arch over the belt
          for (const x of [x0 - 0.3, x1 + 0.3]) box(0xcfd6da, x - 0.3, x + 0.3, b - 1, b + 3.4, d0 - 0.4, d1 + 0.4);
          box(0xcfd6da, x0 - 0.6, x1 + 0.6, b + 1.32, b + 3.4, d0 - 0.4, d1 + 0.4);
          glow(TEAL, x0, x1, b + 2.2, b + 2.5, d0 - 0.43, d0 - 0.4); sign('SCAN', 3, 0.9, cx, b + 2.95, d0 - 0.45, 'back', { fg: '#39ffd0', bg: '#132024' });
        } else {                                                                         // striped boom barrier
          for (const x of [x0 + 0.3, x1 - 0.3]) box(0xcfd6da, x - 0.3, x + 0.3, b, b + 2.2, d0 - 0.2, d1 + 0.2);
          let i = 0; for (let x = x0 + 0.6; x < x1 - 0.6; x += 1, i++) box(i % 2 ? 0xf2f2f2 : 0xd62a2a, x, Math.min(x1 - 0.6, x + 1), b + 1.32, b + 1.75, d0 + 0.1, d0 + 0.4);
          glow(AMBER, x0 + 0.1, x0 + 0.5, b + 2.2, b + 2.45, d0, d0 + 0.3);
        }
        glow(HAZARD, x0, x1, b + 1.15, b + 1.32, d0 + 0.05, d0 + 0.35);                   // the edge you must duck
        let i = 0; for (let x = x0 + 0.5; x < x1 - 0.5; x += 1.4, i++) if (i % 2) glow(0xfff0f0, x, x + 0.7, b + 1.19, b + 1.28, d0 + 0.02, d0 + 0.05);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- yard dressing
  sign('CRANE LINE', 8, 2.6, 8.5, 24.4, 249, 'back', { fg: '#ffd60a', sub: 'HULL RUN · FAST ▶' });
  sign('DOCK ALLEY', 9, 2.6, -4.5, 23.8, 251, 'back', { fg: '#39ffd0', sub: '◀ QUAYSIDE · SAFE' });
  for (const x of [4.6, 12.3]) box(DARK, x - 0.12, x + 0.12, 19, 24.4, 248.9, 249.1);
  for (const x of [-8.8, -0.2]) box(DARK, x - 0.12, x + 0.12, 19, 23.8, 250.9, 251.1);
  sign('PIER 9', 6, 2, 0, 8.4, 660.2, 'back', { fg: '#35ff6b', sub: '▼ SKIFF ▼' });
  for (const x of [-3.2, 3.2]) box(DARK, x - 0.1, x + 0.1, 4, 8.2, 660.1, 660.3);

  // container fields either side of the run
  for (let d = -110; d < 1150; d += 13.2) for (const sx of [-1, 1]) {
    const inner = d > 244 && d < 452 ? (sx < 0 ? 28 : 26) : (d > 180 && d < 250 ? 15 : 9.5);
    for (let x = inner; x < 84; x += 2.6 + (R() < 0.12 ? 7 : 0)) {
      const n = Math.floor(R() * R() * 7), xa = sx > 0 ? x : -x - 2.44;
      for (let k = 0; k < n; k++) { const col = cc(); box(col, xa, xa + 2.44, k * 2.6 - (k ? 0 : 0.3), k * 2.6 + 2.56, d, d + 12.2); if (R() < 0.04) glow(0xffc27a, xa + 0.3, xa + 2.1, k * 2.6 + 0.4, k * 2.6 + 2.2, d - 0.03, d); }
      if (n === 0 && R() < 0.3) box(0x3a4046, xa, xa + 2.44, -0.3, 0.05, d, d + 12.2);
    }
    if (R() < 0.5) box(0x3a4046, sx > 0 ? inner : -84, sx > 0 ? 84 : -inner, -0.3, 0.02, d, d + 13.2);     // yard apron
  }
  // gantry cranes straddling the route
  const craneLights = [];
  const crane = (d, h = 64) => {
    for (const x of [-32, 30]) for (const dd of [d, d + 14]) { box(0xb82a2a, x, x + 2, -0.3, h, dd, dd + 2); for (let y = 10; y < h; y += 20) box(0xe6e6ea, x - 0.02, x + 2.02, y, y + 5, dd - 0.02, dd + 2.02); }
    for (const x of [-32, 30]) { box(0xb82a2a, x, x + 2, h * 0.45, h * 0.45 + 1.4, d, d + 16); boxR(0x8a2020, 0.6, Math.hypot(14, h * 0.4), 0.6, x + 1, h * 0.25, d + 8, 0.34); }
    box(0xb82a2a, -62, 60, h, h + 4, d + 5, d + 11); box(0x8a2020, -62, 60, h + 4, h + 4.6, d + 4, d + 12);
    for (let x = -60; x < 60; x += 6) boxR(0x8a2020, 0.3, 8.4, 0.3, x + 3, h + 8, d + 8, 0, 0, x % 12 ? 0.6 : -0.6);
    box(0x8a2020, -62, 60, h + 12, h + 12.6, d + 7.6, d + 8.4);
    const tx = (R() < 0.5 ? -1 : 1) * (36 + R() * 18);
    box(0x2a3036, tx - 3, tx + 3, h - 3.4, h, d + 5, d + 11); winBox(0, tx - 2.4, tx + 2.4, h - 7, h - 3.4, d + 4, d + 8);
    for (const ox of [-2, 2]) box(DARK, tx + ox - 0.05, tx + ox + 0.05, h - 30, h - 3.4, d + 7.9, d + 8.1);
    box(YEL, tx - 3.2, tx + 3.2, h - 31, h - 30, d + 1.8, d + 14.2); box(cc(), tx - 1.22, tx + 1.22, h - 33.6, h - 31, d + 1.9, d + 14.1);
    for (const x of [-20, 0, 20]) lamp(x, h - 0.1, d + 8, 'back', 26, 0);
    for (const x of [-61, 59]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff2030, fog: false })); m.position.set(x, h + 13.4, -(d + 8)); scene.add(m); craneLights.push(m); }
  };
  crane(96); crane(318, 70); crane(520, 58); crane(742, 60);
  // floodlight masts
  for (const [x, d, h, tone] of [[-9, 40, 44, 0], [9, 118, 44, 0], [-15, 222, 36, 0], [-9, 500, 22, 0], [9, 540, 22, 0], [-7, 606, 20, 0], [7, 640, 20, 0], [-11, 720, 18, 0], [11, 800, 18, 0]]) {
    box(STEEL, x - 0.2, x + 0.2, -0.3, h, d - 0.2, d + 0.2); box(DARK, x - 1.4, x + 1.4, h, h + 0.5, d - 0.3, d + 0.3);
    for (const ox of [-1, -0.33, 0.33, 1]) glow(0xfff2d0, x + ox - 0.22, x + ox + 0.22, h + 0.05, h + 0.45, d - 0.36, d - 0.3);
    lamp(x, h, d - 0.4, 'back', Math.min(h * 0.8, 20), tone);
  }
  // a second freighter and warehouses on the far quay
  {
    const sx0 = -150, d0 = 60, d1 = 330;
    box(0x1c2a3a, sx0, sx0 + 30, -0.3, 16, d0, d1); box(0x6a2020, sx0 - 0.1, sx0 + 30.1, -0.3, 5, d0 - 0.1, d1 + 0.1);
    for (let d = d0 + 6; d < d1 - 60; d += 12.4) for (let y = 16; y < 16 + Math.floor(1 + R() * 4) * 2.6; y += 2.6) box(cc(), sx0 + 2, sx0 + 28, y, y + 2.56, d, d + 12.2);
    winBox(0, sx0 + 4, sx0 + 26, 16, 40, d1 - 50, d1 - 24); box(0xb82a2a, sx0 + 10, sx0 + 18, 40, 50, d1 - 42, d1 - 32);
    for (let i = 0; i < 6; i++) { const x = 100 + i * 46, w = 36, d = 420 + (i % 2) * 40; winBox(1, x, x + w, -0.3, 16 + R() * 10, d, d + 90, 0xb9c4c8); boxR(0x4a5258, w + 2, 0.4, 92, x + w / 2, 26 + (i % 3), d + 45, 0, 0, 0.08); }
  }

  B.build();
  track();

  // ---------------------------------------------------------------- moving lights: boats and flying freight
  const lanes = [];
  const lane = (axis, pos, dir, a, b, n, speed, y) => { for (let i = 0; i < n; i++) lanes.push({ axis, pos, dir, a, b, speed: speed * (0.8 + R() * 0.4), off: R() * (b - a), y }); };
  lane('d', -112, 1, -200, 1300, 5, 9, 0.3); lane('d', 118, -1, -200, 1300, 5, 8, 0.3); lane('x', 880, 1, -300, 300, 4, 7, 0.3); lane('x', -90, -1, -300, 300, 3, 6, 0.3);
  lane('d', -60, 1, -200, 1300, 6, 40, 86); lane('d', 70, -1, -200, 1300, 6, 46, 98); lane('x', 420, 1, -300, 300, 5, 40, 80); lane('x', 700, -1, -300, 300, 5, 44, 90);
  for (const l of lanes) { l.box = l.y < 1; l.hero = l.axis === 'd'; }                       // boats stay as running lights; sky freight becomes hover cars
  const traffic = makeTraffic(scene, assets, lanes, { boxSize: [1.8, 0.7, 4.4], rand: R, boxColor: (l) => (l.y < 1 ? 0x39ffd0 : l.dir > 0 ? 0xff2b3b : 0xfff3c9) });

  // ---------------------------------------------------------------- getaway skiff (hover)
  const van = new THREE.Group();
  const skiffModel = assets?.mesh('getaway_skiff', 'Skiff', { shadow: true });   // blender/build_vehicles.py
  if (skiffModel) van.add(skiffModel);
  {
    const box0 = !skiffModel;
    const vm = (c, g = 0.12) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: g, flatShading: true }), gm = (c) => new THREE.MeshBasicMaterial({ color: c });
    const vb = (m, w, h, dp, x, y, z, rx = 0) => { if (!box0) return null; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), m); b.position.set(x, y, z); b.rotation.x = rx; van.add(b); return b; };
    const hull = vm(0x1f3038, 0.25);
    vb(hull, 2.5, 0.25, 4.6, 0, 0.62, -2.3);                                         // open cargo bed
    vb(hull, 0.14, 0.7, 4.6, -1.2, 1.05, -2.3); vb(hull, 0.14, 0.7, 4.6, 1.2, 1.05, -2.3);
    vb(hull, 2.5, 0.9, 0.14, 0, 1.15, -4.6);
    vb(vm(0x172329, 0.2), 2.3, 1.2, 1.8, 0, 1.25, -5.5); vb(hull, 1.9, 0.5, 1.4, 0, 0.9, -6.9, 0.25);     // cab + raked bow
    vb(gm(0x7fe9e0), 2.0, 0.5, 0.05, 0, 1.55, -6.42);
    vb(gm(ACCENT), 2.5, 0.1, 0.14, 0, 0.78, -0.05);                                   // the ledge to hit
    vb(gm(0xff7a1c), 0.04, 0.3, 4.6, -1.28, 1.1, -2.3); vb(gm(0xff7a1c), 0.04, 0.3, 4.6, 1.28, 1.1, -2.3);
    for (const [x, z] of [[-1, -0.9], [1, -0.9], [-1, -4.6], [1, -4.6]]) {            // lift thrusters
      if (box0) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.35, 10), vm(0x0c1114, 0)); t.position.set(x, 0.42, z); van.add(t); }
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.15, 0.4, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x39f0ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      j.position.set(x, 0.1, z); van.add(j);
    }
    vb(gm(0xff2b3b), 0.25, 0.3, 0.06, -1.05, 1.15, 0.02); vb(gm(0xff2b3b), 0.25, 0.3, 0.06, 1.05, 1.15, 0.02);
    for (let i = 0; i < 4; i++) vb(vm(0x35ff6b, 0.7), 0.5, 0.22, 0.3, -0.5 + (i % 2), 0.86, -3.4 - Math.floor(i / 2) * 0.5);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 150, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x35ff6b, transparent: true, opacity: 0.4, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0, 78, -2.4); van.add(beam); van.userData.beam = beam;
    const tag = signMesh('SKIFF', 9, 4.4, { fg: '#35ff6b', sub: '▼ GETAWAY ▼' });
    tag.material.fog = false; tag.position.set(0, 12, -2.4); van.add(tag); van.userData.tag = tag;
  }
  van.position.set(VAN.x, 0, -VAN.startD);
  scene.add(van);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x6fb8c0, 0x14262a, 1.45); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffa860, 1.2); scene.add(key); scene.add(key.target);          // sodium floods
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 240 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.06;
  const rim = new THREE.DirectionalLight(TEAL, 0.8); rim.position.set(60, 22, -20); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(AMBER, 0.75); rim2.position.set(-60, 22, -10); scene.add(rim2);
  if (renderer) {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 16, 12), new THREE.MeshBasicMaterial({ map: sky.material.map, side: THREE.BackSide })));
    for (const [c, x, y, z, w, h] of [[AMBER, -45, 10, -40, 40, 18], [TEAL, 45, 10, -50, 40, 18], [0xffc27a, 10, 30, 30, 30, 10], [0xff3df0, 60, 8, -90, 30, 12]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3.2), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture; scene.environmentIntensity = 0.7; pm.dispose();
  }

  return {
    glassPane, van, sun: key,
    setQuality(level) {
      const low = level === 'low';
      for (const { key: k, mesh } of B.meshes) {
        if (k === 'lit') mesh.material = level === 'high' ? litMat : lamMat;
        else if (k === 'wet') mesh.material = low ? wetLam : wetMat;
        else if (k === 'deck') mesh.material = low ? deckLam : deckMat;
      }
      key.castShadow = level === 'high';
      hemi.intensity = low ? 1.7 : 1.45;
    },
    update(time) {
      alarmMat.color.setHex(Math.floor(time * 3) % 2 ? 0xff2030 : 0x4a0a10);
      const on = Math.floor(time * 1.2) % 2 === 0;
      craneLights.forEach((m, i) => { m.visible = i % 2 ? on : !on; });
      traffic.update(time);
      van.position.y = 0.12 + Math.sin(time * 3.2) * 0.05;                    // hovering
      van.userData.beam.material.opacity = 0.3 + 0.12 * Math.sin(time * 4);
      van.userData.tag.position.y = 12 + Math.sin(time * 3) * 0.5;
    },
  };
}
