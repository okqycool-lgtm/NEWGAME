// Enforcer unit: a heavy armoured robot that drops onto the runner's tail after a stumble.
import * as THREE from 'three';

const lam = (c, g = 0.1) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: g, flatShading: true });
const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
const ARMOR = lam(0x14161c, 0.15), PLATE = lam(0x2a2f3a, 0.2), STEEL = lam(0x5b6270, 0.25), HAZ = lam(0xd9a400, 0.5);

export class Cop {
  constructor(scene) {
    const root = this.root = new THREE.Group();
    const model = new THREE.Group(); model.scale.setScalar(1.38); root.add(model);   // towers over the runner
    const part = (parent, m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.set(rx, ry, rz); parent.add(b); return b;
    };
    const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const body = this.body = piv(model, 0, 0.98, 0);

    // wedge torso: narrow waist, huge chest
    part(body, ARMOR, 0.52, 0.3, 0.4, 0, 0.04, 0);
    part(body, PLATE, 0.98, 0.5, 0.56, 0, 0.42, -0.02);
    part(body, ARMOR, 1.06, 0.2, 0.62, 0, 0.64, 0);
    part(body, STEEL, 0.5, 0.22, 0.08, 0, 0.44, -0.31);                               // chest plate
    part(body, HAZ, 0.9, 0.06, 0.58, 0, 0.2, -0.02);                                  // hazard band
    this.core = part(body, basic(0xff2030), 0.2, 0.1, 0.04, 0, 0.44, -0.36);          // pulsing core
    part(body, ARMOR, 0.6, 0.6, 0.26, 0, 0.42, 0.36);                                 // power pack
    for (const sx of [-1, 1]) { part(body, STEEL, 0.1, 0.5, 0.1, sx * 0.2, 0.6, 0.52, 0.25); }   // exhaust stacks

    // head: low, hooded, one burning visor slit
    const head = this.headP = piv(body, 0, 0.74, -0.06);
    part(head, ARMOR, 0.46, 0.34, 0.5, 0, 0.14, 0);
    part(head, PLATE, 0.54, 0.12, 0.6, 0, 0.3, 0.02, 0.18);                           // brow hood
    part(head, ARMOR, 0.3, 0.16, 0.16, 0, 0.0, -0.26);                                // jaw guard
    this.visor = part(head, basic(0xff1020), 0.4, 0.06, 0.04, 0, 0.17, -0.26);
    part(head, STEEL, 0.03, 0.5, 0.03, 0.2, 0.5, 0.18, 0, 0, -0.12);                  // antenna
    this.lightL = part(head, basic(0xff2030), 0.2, 0.08, 0.14, -0.14, 0.4, 0.06);
    this.lightR = part(head, basic(0x2f6bff), 0.2, 0.08, 0.14, 0.14, 0.4, 0.06);

    // arms: massive pauldrons, piston forearms, claw / shock baton
    const arm = (sx) => {
      const p = piv(body, sx * 0.66, 0.6, 0);
      part(p, PLATE, 0.44, 0.34, 0.5, sx * 0.04, 0.06, 0, 0, 0, sx * -0.25);          // pauldron
      part(p, HAZ, 0.46, 0.05, 0.52, sx * 0.04, -0.08, 0, 0, 0, sx * -0.25);
      part(p, ARMOR, 0.24, 0.4, 0.26, 0, -0.3, 0);
      const k = piv(p, 0, -0.5, 0);
      part(k, PLATE, 0.3, 0.44, 0.32, 0, -0.2, 0);
      part(k, STEEL, 0.08, 0.36, 0.08, sx * 0.17, -0.2, 0.1);                         // piston
      for (const fx of [-0.09, 0, 0.09]) part(k, STEEL, 0.06, 0.24, 0.07, fx, -0.52, -0.06, 0.5);   // claws
      return { p, k };
    };
    this.armL = arm(-1); this.armR = arm(1);
    this.baton = part(this.armR.k, basic(0x39f0ff), 0.07, 0.07, 1.0, 0, -0.5, -0.5);
    part(this.armR.k, ARMOR, 0.1, 0.1, 0.3, 0, -0.5, 0.05);

    // legs: reverse-jointed heavy stompers
    const leg = (sx) => {
      const p = piv(body, sx * 0.24, -0.08, 0);
      part(p, PLATE, 0.3, 0.46, 0.36, 0, -0.2, 0);
      part(p, ARMOR, 0.34, 0.16, 0.4, 0, -0.42, 0);                                   // knee armour
      const k = piv(p, 0, -0.44, 0);
      part(k, ARMOR, 0.24, 0.44, 0.28, 0, -0.2, 0);
      part(k, PLATE, 0.36, 0.14, 0.56, 0, -0.44, -0.08);                              // foot
      part(k, HAZ, 0.37, 0.04, 0.2, 0, -0.38, -0.27);
      return { p, k };
    };
    this.legL = leg(-1); this.legR = leg(1);

    // searchlight pinned on the runner + pulsing ground glow
    const cg = new THREE.ConeGeometry(1.5, 7, 12, 1, true); cg.translate(0, -3.5, 0); cg.rotateX(Math.PI / 2 + 0.22);
    this.beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.set(0, 0.18, -0.3); head.add(this.beam);
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.3, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.05; root.add(this.glow);

    root.traverse((o) => { if (o.isMesh && o.material.isMeshLambertMaterial) o.castShadow = true; });
    root.visible = false;
    scene.add(root);
    this.reset();
  }

  reset() { this.gap = 14; this.x = 0; this.y = 0; this.side = 1; this.lastStep = 0; this.stomp = false; this.root.visible = false; }

  // chase: seconds left on the tail (0 = none). busted: grabbing the runner.
  update(dt, time, player, chase, busted) {
    this.stomp = false;
    const active = chase > 0 || busted;
    const target = busted ? 0.7 : chase > 1 ? 1.7 + (1 - Math.min(1, chase / 8)) * 1.8 : 14;
    this.gap += (target - this.gap) * Math.min(1, (active ? 5 : 1.6) * dt);
    if (!active && this.gap > 12) { this.root.visible = false; return; }
    this.root.visible = true;
    const d = player.d - this.gap;
    // run off the runner's shoulder so the officer never hides them from the camera
    if (player.x > 1.5) this.side = -1; else if (player.x < -1.5) this.side = 1;
    const tx = player.x + (busted ? this.side * 0.6 : this.side * 1.9);
    this.x += (tx - this.x) * Math.min(1, 6 * dt);
    const g = player.groundUnder(this.x, d, player.y + 2.5);
    const gy = g ? Math.max(g.top, player.y - 3) : player.y;
    this.y += (Math.min(gy, player.y + 0.5) - this.y) * Math.min(1, 14 * dt);
    this.root.position.set(this.x, this.y, -d);
    this.root.rotation.y = busted ? 0 : -this.side * 0.18;        // angled in toward the runner

    const ph = player.phase * 0.7, s = Math.sin(ph), c = Math.cos(ph);
    const stepN = Math.floor(ph / Math.PI);
    if (stepN !== this.lastStep) { this.lastStep = stepN; this.stomp = active && !busted; }
    this.legL.p.rotation.x = 0.15 + 0.85 * s; this.legL.k.rotation.x = -(0.3 + 1.0 * Math.max(0, c));
    this.legR.p.rotation.x = 0.15 - 0.85 * s; this.legR.k.rotation.x = -(0.3 + 1.0 * Math.max(0, -c));
    // left claw reaches for the backpack, right arm cocks the baton
    this.armL.p.rotation.x = busted ? 1.6 : 1.25 + 0.2 * s; this.armL.k.rotation.x = 0.3;
    this.armR.p.rotation.set(busted ? 1.5 : 0.5 - 0.3 * s, 0, 0.25); this.armR.k.rotation.x = busted ? 0.4 : 1.2;
    this.body.rotation.set(-0.38, 0, 0.06 * s); this.body.position.y = 0.98 + 0.07 * Math.abs(c);
    this.headP.rotation.x = 0.3;
    const flip = Math.floor(time * 8) % 2 === 0, pulse = 0.6 + 0.4 * Math.sin(time * 14);
    this.lightL.material.color.setHex(flip ? 0xff2030 : 0x3a0a10);
    this.lightR.material.color.setHex(flip ? 0x0a1640 : 0x2f6bff);
    this.glow.material.color.setHex(flip ? 0xff2030 : 0x2f6bff);
    this.beam.material.color.setHex(flip ? 0xff2030 : 0x2f6bff);
    this.core.material.color.setRGB(pulse, 0.05, 0.08);
    this.baton.material.color.setRGB(0.3 + 0.7 * pulse, 0.95, 1);
  }
}
