// Robot officer: appears on the runner's tail after a stumble.
import * as THREE from 'three';

const lam = (c, g = 0.15) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: g, flatShading: true });
const NAVY = lam(0x1c2a4d, 0.25), WHITE = lam(0xdfe6f2, 0.2), DARK = lam(0x0e1220, 0.1);

export class Cop {
  constructor(scene) {
    const root = this.root = new THREE.Group();
    const part = (parent, m, w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
    const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const body = this.body = piv(root, 0, 0.95, 0);
    part(body, NAVY, 0.7, 0.62, 0.42, 0, 0.36, 0);
    part(body, WHITE, 0.72, 0.16, 0.44, 0, 0.5, 0);
    part(body, DARK, 0.5, 0.2, 0.36, 0, -0.02, 0);
    this.badge = part(body, new THREE.MeshBasicMaterial({ color: 0xffd60a }), 0.16, 0.16, 0.02, -0.18, 0.42, -0.225);
    const head = piv(body, 0, 0.7, 0);
    part(head, WHITE, 0.46, 0.4, 0.44, 0, 0.2, 0);
    this.visor = part(head, new THREE.MeshBasicMaterial({ color: 0xff2030 }), 0.4, 0.1, 0.04, 0, 0.22, -0.23);
    part(head, NAVY, 0.5, 0.1, 0.48, 0, 0.42, 0);
    this.lightL = part(head, new THREE.MeshBasicMaterial({ color: 0xff2030 }), 0.2, 0.1, 0.16, -0.12, 0.52, 0);
    this.lightR = part(head, new THREE.MeshBasicMaterial({ color: 0x2f6bff }), 0.2, 0.1, 0.16, 0.12, 0.52, 0);
    const limb = (sx, y, len, w, m) => {
      const p = piv(body, sx, y, 0);
      part(p, m, w, len, w + 0.02, 0, -len / 2, 0);
      const k = piv(p, 0, -len, 0);
      part(k, WHITE, w - 0.02, len, w, 0, -len / 2, 0);
      part(k, DARK, w + 0.02, 0.1, w + 0.06, 0, -len, -0.02);
      return { p, k };
    };
    this.armL = limb(-0.47, 0.6, 0.34, 0.2, NAVY); this.armR = limb(0.47, 0.6, 0.34, 0.2, NAVY);
    this.legL = limb(-0.2, -0.1, 0.42, 0.24, NAVY); this.legR = limb(0.2, -0.1, 0.42, 0.24, NAVY);
    // flashing glow that reads from behind the camera
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.25, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.05; root.add(this.glow);
    root.visible = false;
    scene.add(root);
    this.reset();
  }

  reset() { this.gap = 14; this.x = 0; this.y = 0; this.side = 1; this.root.visible = false; }

  // chase: seconds left on the tail (0 = none). busted: grabbing the runner.
  update(dt, time, player, chase, busted) {
    const active = chase > 0 || busted;
    const target = busted ? 0.6 : chase > 1 ? 1.6 + (1 - Math.min(1, chase / 8)) * 1.8 : 14;
    this.gap += (target - this.gap) * Math.min(1, (active ? 5 : 1.6) * dt);
    if (!active && this.gap > 12) { this.root.visible = false; return; }
    this.root.visible = true;
    const d = player.d - this.gap;
    // run off the runner's shoulder so the officer never hides them from the camera
    if (player.x > 1.5) this.side = -1; else if (player.x < -1.5) this.side = 1;
    const tx = player.x + (busted ? this.side * 0.5 : this.side * 1.7);
    this.x += (tx - this.x) * Math.min(1, 6 * dt);
    const g = player.groundUnder(this.x, d, player.y + 2.5);
    const gy = g ? Math.max(g.top, player.y - 3) : player.y;
    this.y += (Math.min(gy, player.y + 0.5) - this.y) * Math.min(1, 14 * dt);
    this.root.position.set(this.x, this.y, -d);

    const ph = player.phase * 0.9, s = Math.sin(ph), c = Math.cos(ph);
    this.legL.p.rotation.x = 0.1 + 0.9 * s; this.legL.k.rotation.x = -(0.2 + 1.1 * Math.max(0, c));
    this.legR.p.rotation.x = 0.1 - 0.9 * s; this.legR.k.rotation.x = -(0.2 + 1.1 * Math.max(0, -c));
    const reach = busted ? 1.5 : 1.1 + 0.15 * s;                 // arms out, grabbing
    this.armL.p.rotation.x = reach; this.armR.p.rotation.x = busted ? 1.5 : 1.1 - 0.15 * s;
    this.armL.k.rotation.x = this.armR.k.rotation.x = 0.25;
    this.body.rotation.x = -0.3; this.body.position.y = 0.95 + 0.05 * Math.abs(c);
    const flip = Math.floor(time * 7) % 2 === 0;
    this.lightL.material.color.setHex(flip ? 0xff2030 : 0x3a0a10);
    this.lightR.material.color.setHex(flip ? 0x0a1640 : 0x2f6bff);
    this.glow.material.color.setHex(flip ? 0xff2030 : 0x2f6bff);
  }
}
