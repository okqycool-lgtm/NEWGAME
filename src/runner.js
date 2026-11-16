// The runner: an original low-poly character built from boxes on a small joint rig,
// animated procedurally from the controller state.
import * as THREE from 'three';

const C = {
  jacket: 0xff4a1c, jacketDark: 0xc7330f, shirt: 0x1d3b45, pants: 0x34363d, pocket: 0x45484f,
  skin: 0xe8b08a, hair: 0x15131c, streak: 0xfff2b0, chrome: 0xd4deea, boot: 0x17171c,
  pack: 0x0c0c10, strap: 0x26262c, cash: 0x35ff6b, cashDark: 0x18b848, cyan: 0x39f0ff,
};
const mats = {};
const mat = (c, glow = 0) => {
  const k = c + ':' + glow;
  if (!mats[k]) {
    const chrome = c === C.chrome;       // real metal so the forearm and heels catch the neon
    mats[k] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: chrome ? 0.08 : glow * 1.1 + 0.07, flatShading: true,
      roughness: chrome ? 0.18 : 0.7, metalness: chrome ? 1 : 0.05, envMapIntensity: chrome ? 2.4 : 1 });
  }
  return mats[k];
};
function box(parent, w, h, d, color, x = 0, y = 0, z = 0, glow = 0.12) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, glow));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

const POSE_KEYS = ['bodyY', 'pitch', 'roll', 'yaw', 'torso', 'twist', 'head',
  'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'elR', 'hipLx', 'hipLz', 'knL', 'hipRx', 'hipRz', 'knR'];

export const HIP = 0.8;   // hip height of the blocky rig

export class Runner {
  constructor() {
    // Chunky toy-block proportions: big cube head, slab torso, thick short limbs.
    const root = this.root = new THREE.Group();
    const model = this.model = new THREE.Group();
    model.scale.setScalar(1.16);
    root.add(model);
    const body = this.body = pivot(model, 0, HIP, 0);
    box(body, 0.5, 0.16, 0.28, C.pants, 0, 0.02, 0);
    box(body, 0.52, 0.05, 0.3, C.cyan, 0, 0.11, 0, 0.7);            // belt

    // legs
    const leg = (sx) => {
      const hip = pivot(body, sx * 0.125, -0.03, 0);
      box(hip, 0.23, 0.4, 0.25, C.pants, 0, -0.19, 0);
      box(hip, 0.07, 0.16, 0.18, C.pocket, sx * 0.14, -0.22, 0);     // cargo pocket
      const knee = pivot(hip, 0, -0.38, 0);
      box(knee, 0.22, 0.34, 0.24, C.pants, 0, -0.16, 0);
      box(knee, 0.24, 0.12, 0.36, C.boot, 0, -0.36, -0.05);
      box(knee, 0.1, 0.13, 0.08, C.chrome, 0, -0.33, 0.16, 0.35);    // spring heel
      box(knee, 0.12, 0.03, 0.1, C.cyan, 0, -0.41, 0.16, 1);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 6),
        new THREE.MeshBasicMaterial({ color: 0x9ffaff, transparent: true, opacity: 0.85, depthWrite: false }));
      jet.rotation.x = Math.PI; jet.position.set(0, -0.7, 0.16); jet.visible = false;
      knee.add(jet);
      return { hip, knee, jet };
    };
    this.legL = leg(-1); this.legR = leg(1);

    // torso
    const torso = this.torso = pivot(body, 0, 0.1, 0);
    box(torso, 0.5, 0.22, 0.28, C.shirt, 0, 0.1, 0);
    box(torso, 0.56, 0.32, 0.33, C.jacket, 0, 0.36, 0, 0.3);         // cropped jacket
    box(torso, 0.57, 0.05, 0.34, C.jacketDark, 0, 0.205, 0, 0.2);    // hem
    box(torso, 0.38, 0.1, 0.1, C.jacketDark, 0, 0.55, 0.13, 0.2);    // popped collar

    // head — a big rounded-off cube
    const head = this.head = pivot(torso, 0, 0.53, 0);
    box(head, 0.4, 0.36, 0.36, C.skin, 0, 0.19, 0);
    box(head, 0.42, 0.09, 0.06, C.cyan, 0, 0.23, -0.17, 0.9);        // visor
    box(head, 0.44, 0.12, 0.4, C.hair, 0, 0.4, 0.01);
    box(head, 0.43, 0.28, 0.1, C.hair, 0, 0.26, 0.17);
    const spike = (x, y, z, rx, rz, col = C.hair) => {
      const sp = box(head, 0.13, 0.24, 0.1, col, x, y, z, col === C.streak ? 0.55 : 0.1);
      sp.rotation.set(rx, 0, rz);
    };
    spike(-0.14, 0.46, 0.14, 0.7, 0.35); spike(0.02, 0.5, 0.17, 0.9, 0); spike(-0.16, 0.3, 0.22, 1.2, 0.3);
    spike(0.0, 0.24, 0.24, 1.3, -0.1); spike(-0.08, 0.47, -0.12, -0.5, 0.3);
    box(head, 0.11, 0.14, 0.42, C.streak, 0.13, 0.405, 0.0, 0.55);   // bleached streak, front to back
    spike(0.15, 0.44, 0.2, 1.0, -0.4, C.streak); spike(0.14, 0.36, -0.19, -0.7, -0.3, C.streak);

    // backpack — crooked, overstuffed
    const pack = this.pack = pivot(torso, 0.04, 0.3, 0.29);
    pack.rotation.set(0.08, 0.1, 0.22);
    box(pack, 0.48, 0.48, 0.26, C.pack, 0, 0, 0, 0.05);
    box(pack, 0.36, 0.18, 0.07, C.strap, 0, -0.09, 0.15, 0.05);
    box(pack, 0.5, 0.07, 0.12, C.strap, 0, 0.22, -0.11, 0.05);        // half-open flap
    const bills = [[-0.13, 0.3, 0.02, 0.3], [0.08, 0.32, 0.0, -0.25], [0.0, 0.28, 0.08, 0.1], [0.17, 0.27, 0.06, -0.6], [-0.18, 0.25, 0.09, 0.7]];
    for (const [x, y, z, r] of bills) {
      const b = box(pack, 0.2, 0.12, 0.1, C.cash, x, y, z, 0.75);
      b.rotation.set(r * 0.4, r, r);
      box(b, 0.06, 0.125, 0.105, 0xffffff, 0, 0, 0, 0.5);
    }
    box(pack, 0.14, 0.08, 0.06, C.cash, -0.27, -0.05, 0.02, 0.75).rotation.z = 0.5;

    // arms — thick blocks, chrome left forearm
    const arm = (sx, chrome) => {
      const sh = pivot(torso, sx * 0.375, 0.47, 0);
      box(sh, 0.19, 0.28, 0.21, C.jacket, 0, -0.12, 0, 0.3);
      const el = pivot(sh, 0, -0.26, 0);
      box(el, 0.17, 0.24, 0.19, chrome ? C.chrome : C.skin, 0, -0.11, 0, chrome ? 0.4 : 0.12);
      if (chrome) box(el, 0.18, 0.035, 0.2, C.cyan, 0, -0.07, 0, 1);
      box(el, 0.19, 0.12, 0.21, chrome ? C.chrome : C.boot, 0, -0.28, 0, chrome ? 0.4 : 0.05);
      return { sh, el };
    };
    this.armL = arm(-1, true); this.armR = arm(1, false);

    root.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial) o.castShadow = true; });
    this.pose = {}; for (const k of POSE_KEYS) this.pose[k] = 0;
    this.tgt = { ...this.pose };
    this.spin = 0;
  }

  // Target pose for the current controller state.
  computeTarget(p, T) {
    const s = Math.sin(p.phase), c = Math.cos(p.phase);
    for (const k of POSE_KEYS) T[k] = 0;
    let rate = 22;
    const run = (amp = 1) => {
      T.hipLx = 0.15 + 0.95 * s * amp; T.knL = -(0.25 + 1.25 * Math.max(0, c));
      T.hipRx = 0.15 - 0.95 * s * amp; T.knR = -(0.25 + 1.25 * Math.max(0, -c));
      T.shLx = -0.95 * s; T.shRx = 0.95 * s; T.elL = T.elR = 1.35;
      T.shLz = -0.14; T.shRz = 0.14;
      T.torso = -0.3; T.twist = 0.2 * s; T.head = 0.18;
      T.bodyY = 0.05 * Math.abs(c) - 0.04;
      T.roll = -p.steer * 0.2; T.yaw = -p.steer * 0.25;
      rate = 40;
    };
    this.spin = 0;
    const st = p.state;
    if (st === 'ready' || st === 'run' || (st === 'kick' && p.kickPhase === 0)) {
      run();
      if (p.landT < 0.28 && p.landKind === 'hard') {
        T.bodyY = -0.42; T.hipLx = 1.3; T.hipRx = 1.1; T.knL = -1.9; T.knR = -1.8; T.torso = -0.7; T.shLx = 0.4; T.shRx = 0.5;
      }
    } else if (st === 'kick') {
      T.pitch = 0.5; T.hipRx = 1.85; T.knR = -0.05; T.hipLx = 1.1; T.knL = -2.2;
      T.shLx = 1.3; T.elL = 1.7; T.shRx = -1.0; T.shRz = 0.6; T.elR = 0.4; T.torso = -0.25; T.head = -0.1; T.twist = -0.3;
      rate = 30;
    } else if (st === 'air') {
      const k = Math.max(0, Math.min(1, (p.vy + 4) / 10));     // 1 = rising, 0 = falling
      T.hipLx = 0.5 + 0.75 * k; T.knL = -0.6 - 0.9 * k; T.hipRx = 0.1 - 0.45 * k; T.knR = -0.5 - 0.15 * k;
      T.shLx = 0.3 - 0.9 * k; T.shRx = 0.3 + 1.6 * k; T.shLz = -1.2 * (1 - k); T.shRz = 1.2 * (1 - k) + 0.2 * k;
      T.elL = 0.3 + 0.5 * k; T.elR = 0.3 + 0.3 * k; T.torso = -0.1 - 0.1 * k;
      T.roll = -p.steer * 0.25;
      if (p.kickT > 0) { T.roll = -p.kickVx * 0.07; T.hipLx = 0.2; T.knL = -0.2; T.hipLz = -0.7; T.shRz = 1.5; }
      if (p.djT < 0.45) {                                      // heel-jet flip
        const u = p.djT / 0.45;
        this.spin = -Math.PI * 2 * (u * u * (3 - 2 * u));
        T.hipLx = T.hipRx = 1.75; T.knL = T.knR = -2.1; T.shLx = T.shRx = 0.9; T.elL = T.elR = 1.5; T.torso = -0.5; T.shLz = T.shRz = 0;
        rate = 30;
      }
    } else if (st === 'vault') {
      T.roll = 1.15; T.bodyY = -0.22; T.pitch = -0.15; T.yaw = 0.35;
      T.shLz = -1.15; T.shLx = 0.1; T.elL = 0.05; T.shRz = 1.3; T.shRx = -0.4; T.elR = 0.5;
      T.hipLx = 0.55; T.hipRx = 0.75; T.knL = -0.45; T.knR = -0.7; T.head = 0.2;
      rate = 26;
    } else if (st === 'slide') {
      T.pitch = 1.25; T.bodyY = -0.52; T.torso = -0.4; T.head = -0.35;
      T.hipLx = 0.3; T.knL = -0.08; T.hipRx = 1.25; T.knR = -1.8;
      T.shRx = -1.0; T.shRz = 0.35; T.elR = 0.2; T.shLx = 0.7; T.shLz = -0.9; T.elL = 0.9;
      rate = 26;
    } else if (st === 'roll') {
      const u = Math.min(1, p.stateT / 0.5);
      this.spin = -Math.PI * 2 * u;
      T.bodyY = -0.42; T.hipLx = T.hipRx = 1.8; T.knL = T.knR = -2.2; T.torso = -0.7; T.shLx = T.shRx = 1.2; T.elL = T.elR = 1.6; T.head = 0.5;
      rate = 34;
    } else if (st === 'wallrun') {
      run(1.1);
      const side = p.wall ? p.wall.side : -1;
      T.roll = side * 0.5; T.yaw = 0;
      if (side < 0) { T.shLz = -1.5; T.shLx = 0.2; T.elL = 0.2; } else { T.shRz = 1.5; T.shRx = 0.2; T.elR = 0.2; }
      T.bodyY = 0.08;
    } else if (st === 'ledge') {
      if (p.stateT < 0.2) {
        T.shLx = T.shRx = 3.0; T.elL = T.elR = 0.15; T.hipLx = 0.25; T.hipRx = 0.1; T.knL = -0.5; T.knR = -0.3; T.bodyY = -0.25; T.head = -0.4;
      } else {
        T.shLx = T.shRx = 0.7; T.elL = T.elR = 0.9; T.hipRx = 1.7; T.knR = -1.9; T.hipLx = 0.2; T.knL = -0.4; T.torso = -0.6; T.bodyY = -0.25;
      }
      rate = 26;
    } else if (st === 'zip') {                                   // hanging from the zip handle, legs trailing
      T.shLx = T.shRx = 3.05; T.shLz = 0.18; T.shRz = -0.18; T.elL = T.elR = 0.1; T.pitch = 0.32; T.torso = 0.05; T.head = 0.25;
      T.hipLx = -0.25 + 0.12 * s; T.hipRx = 0.35 - 0.12 * s; T.knL = -0.9; T.knR = -0.5; T.roll = 0.08 * s;
      rate = 16;
    } else if (st === 'busted') {
      T.shLx = T.shRx = 3.0; T.shLz = -0.35; T.shRz = 0.35; T.elL = T.elR = 0.5; T.torso = 0.1; T.head = -0.2;
      T.hipLx = 0.2; T.hipRx = -0.1; T.knL = -0.3; T.knR = -0.2; T.bodyY = -0.05;
      rate = 12;
    } else if (st === 'done') {
      T.bodyY = -0.4; T.hipLx = 1.45; T.hipRx = 1.3; T.knL = -1.7; T.knR = -1.5; T.yaw = Math.PI;
      T.shRx = 2.9; T.elR = 0.3; T.shLx = 0.5; T.elL = 1.2; T.torso = 0.05;
      rate = 9;
    }
    if (p.stumbleT > 0 && st !== 'done') {
      const w = Math.sin(p.stumbleT * 40);
      T.torso = -0.95; T.head = 0.5; T.shLz = -1.4 + 0.5 * w; T.shRz = 1.4 + 0.5 * w; T.shLx = 0.8; T.shRx = 0.6; T.elL = T.elR = 0.4;
    }
    return rate;
  }

  update(p, dt, time) {
    const rate = this.computeTarget(p, this.tgt);
    const k = Math.min(1, rate * dt);
    const P = this.pose;
    for (const key of POSE_KEYS) P[key] += (this.tgt[key] - P[key]) * k;

    this.root.position.set(p.x, p.y, -p.d);
    this.body.position.y = HIP + P.bodyY;
    this.body.rotation.set(P.pitch + this.spin, P.yaw, P.roll);
    this.torso.rotation.set(P.torso, P.twist, 0);
    this.head.rotation.x = P.head;
    this.armL.sh.rotation.set(P.shLx, 0, P.shLz); this.armL.el.rotation.x = P.elL;
    this.armR.sh.rotation.set(P.shRx, 0, P.shRz); this.armR.el.rotation.x = P.elR;
    this.legL.hip.rotation.set(P.hipLx, 0, P.hipLz); this.legL.knee.rotation.x = P.knL;
    this.legR.hip.rotation.set(P.hipRx, 0, P.hipRz); this.legR.knee.rotation.x = P.knR;
    this.pack.rotation.z = 0.22 + Math.sin(p.phase * 2) * 0.06;

    const jets = p.djT < 0.28 || (p.kickT > 0.2 && p.state === 'air');
    this.legL.jet.visible = this.legR.jet.visible = jets;
    if (jets) { const sc = 0.7 + Math.random() * 0.7; this.legL.jet.scale.y = this.legR.jet.scale.y = sc; }

    // brief collision protection reads as a flicker
    this.model.visible = !(p.invuln > 0 && p.state !== 'done' && p.state !== 'busted' && Math.floor(time * 18) % 2 === 0);
  }

  // world position of the backpack opening (for fluttering bills)
  packPos(out) {
    return this.pack.localToWorld(out.set(0, 0.34, 0.05));
  }
}
