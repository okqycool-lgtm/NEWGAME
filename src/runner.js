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
  if (!mats[k]) mats[k] = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: glow, flatShading: true });
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

export class Runner {
  constructor() {
    const root = this.root = new THREE.Group();
    const model = this.model = new THREE.Group();
    model.scale.setScalar(1.22);
    root.add(model);
    const body = this.body = pivot(model, 0, 0.9, 0);
    box(body, 0.34, 0.17, 0.21, C.pants, 0, 0, 0);
    box(body, 0.36, 0.05, 0.22, C.cyan, 0, 0.09, 0, 0.7);          // belt

    // legs
    const leg = (sx) => {
      const hip = pivot(body, sx * 0.1, -0.03, 0);
      box(hip, 0.16, 0.44, 0.18, C.pants, 0, -0.21, 0);
      box(hip, 0.07, 0.15, 0.14, C.pocket, sx * 0.1, -0.24, 0);     // cargo pocket
      const knee = pivot(hip, 0, -0.42, 0);
      box(knee, 0.13, 0.4, 0.15, C.pants, 0, -0.2, 0);
      box(knee, 0.15, 0.11, 0.3, C.boot, 0, -0.42, -0.05);
      box(knee, 0.07, 0.13, 0.07, C.chrome, 0, -0.38, 0.13, 0.35);  // spring heel
      box(knee, 0.09, 0.03, 0.09, C.cyan, 0, -0.46, 0.13, 1);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x9ffaff, transparent: true, opacity: 0.85, depthWrite: false }));
      jet.rotation.x = Math.PI; jet.position.set(0, -0.72, 0.13); jet.visible = false;
      knee.add(jet);
      return { hip, knee, jet };
    };
    this.legL = leg(-1); this.legR = leg(1);

    // torso
    const torso = this.torso = pivot(body, 0, 0.07, 0);
    box(torso, 0.32, 0.24, 0.2, C.shirt, 0, 0.12, 0);
    box(torso, 0.46, 0.3, 0.27, C.jacket, 0, 0.38, 0, 0.3);          // cropped jacket
    box(torso, 0.47, 0.05, 0.28, C.jacketDark, 0, 0.235, 0, 0.2);    // hem
    box(torso, 0.3, 0.1, 0.1, C.jacketDark, 0, 0.56, 0.1, 0.2);      // popped collar

    // head
    const head = this.head = pivot(torso, 0, 0.56, 0);
    box(head, 0.22, 0.24, 0.22, C.skin, 0, 0.13, 0);
    box(head, 0.24, 0.06, 0.05, C.cyan, 0, 0.16, -0.11, 0.9);        // visor
    box(head, 0.27, 0.11, 0.28, C.hair, 0, 0.28, 0.01);
    box(head, 0.26, 0.2, 0.08, C.hair, 0, 0.16, 0.13);
    const spike = (x, y, z, rx, rz, col = C.hair) => {
      const s = box(head, 0.09, 0.2, 0.08, col, x, y, z, col === C.streak ? 0.55 : 0.1);
      s.rotation.set(rx, 0, rz);
    };
    spike(-0.09, 0.33, 0.1, 0.7, 0.35); spike(0.02, 0.36, 0.13, 0.9, 0); spike(-0.1, 0.2, 0.17, 1.2, 0.3);
    spike(0.0, 0.16, 0.19, 1.3, -0.1); spike(-0.05, 0.34, -0.08, -0.5, 0.3);
    box(head, 0.08, 0.13, 0.3, C.streak, 0.085, 0.285, 0.0, 0.55);   // bleached streak, front to back
    spike(0.1, 0.3, 0.15, 1.0, -0.4, C.streak); spike(0.09, 0.25, -0.13, -0.7, -0.3, C.streak);

    // backpack — crooked, overstuffed
    const pack = this.pack = pivot(torso, 0.03, 0.33, 0.24);
    pack.rotation.set(0.08, 0.1, 0.22);
    box(pack, 0.4, 0.44, 0.22, C.pack, 0, 0, 0, 0.05);
    box(pack, 0.3, 0.16, 0.06, C.strap, 0, -0.08, 0.13, 0.05);
    box(pack, 0.42, 0.06, 0.1, C.strap, 0, 0.2, -0.1, 0.05);          // half-open flap
    const bills = [[-0.1, 0.27, 0.02, 0.3], [0.06, 0.29, 0.0, -0.25], [0.0, 0.25, 0.07, 0.1], [0.14, 0.24, 0.05, -0.6], [-0.15, 0.22, 0.08, 0.7]];
    for (const [x, y, z, r] of bills) {
      const b = box(pack, 0.17, 0.1, 0.09, C.cash, x, y, z, 0.75);
      b.rotation.set(r * 0.4, r, r);
      box(b, 0.05, 0.105, 0.095, 0xffffff, 0, 0, 0, 0.5);
    }
    box(pack, 0.12, 0.07, 0.05, C.cash, -0.22, -0.05, 0.02, 0.75).rotation.z = 0.5;

    // arms
    const arm = (sx, chrome) => {
      const sh = pivot(torso, sx * 0.28, 0.48, 0);
      box(sh, 0.13, 0.3, 0.14, C.jacket, 0, -0.14, 0, 0.3);
      const el = pivot(sh, 0, -0.29, 0);
      box(el, 0.105, 0.27, 0.115, chrome ? C.chrome : C.skin, 0, -0.13, 0, chrome ? 0.4 : 0.12);
      if (chrome) box(el, 0.11, 0.03, 0.12, C.cyan, 0, -0.08, 0, 1);
      box(el, 0.12, 0.1, 0.13, chrome ? C.chrome : C.boot, 0, -0.31, 0, chrome ? 0.4 : 0.05);
      return { sh, el };
    };
    this.armL = arm(-1, true); this.armR = arm(1, false);

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
      T.pitch = 1.25; T.bodyY = -0.62; T.torso = -0.4; T.head = -0.35;
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
    this.body.position.y = 0.9 + P.bodyY;
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
    this.model.visible = !(p.invuln > 0 && p.state !== 'done' && Math.floor(time * 18) % 2 === 0);
  }

  // world position of the backpack opening (for fluttering bills)
  packPos(out) {
    return this.pack.localToWorld(out.set(0, 0.3, 0.05));
  }
}
