// Lightweight instanced particles: fluttering bills, glass shards, and the cash bundle prop.
import * as THREE from 'three';

class Particles {
  constructor(scene, geo, material, count, gravity) {
    this.mesh = new THREE.InstancedMesh(geo, material, count);
    this.mesh.frustumCulled = false;
    this.count = count; this.gravity = gravity; this.next = 0;
    this.items = Array.from({ length: count }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1, flutter: 0 }));
    this.dummy = new THREE.Object3D();
    this.clear();
    scene.add(this.mesh);
  }
  spawn(p, v, life, scale = 1, flutter = 0) {
    const it = this.items[this.next]; this.next = (this.next + 1) % this.count;
    it.p.copy(p); it.v.copy(v); it.life = it.max = life; it.s = scale; it.flutter = flutter;
    it.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    it.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
  }
  clear() {
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < this.count; i++) { this.items[i].life = 0; this.mesh.setMatrixAt(i, this.dummy.matrix); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(dt, time) {
    const d = this.dummy;
    this.items.forEach((it, i) => {
      if (it.life <= 0) return;
      it.life -= dt;
      it.v.y -= this.gravity * dt;
      if (it.flutter) { it.v.x += Math.sin(time * 9 + i) * it.flutter * dt; it.v.multiplyScalar(1 - 1.2 * dt); }
      it.p.addScaledVector(it.v, dt);
      it.r.x += it.w.x * dt; it.r.y += it.w.y * dt; it.r.z += it.w.z * dt;
      d.position.copy(it.p); d.rotation.copy(it.r);
      d.scale.setScalar(it.life <= 0 ? 0 : it.s * Math.min(1, it.life * 4));
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Fx {
  constructor(scene) {
    this.bills = new Particles(scene, new THREE.PlaneGeometry(0.26, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x4dff7c, side: THREE.DoubleSide }), 90, 5);
    this.shards = new Particles(scene, new THREE.CircleGeometry(0.22, 3),
      new THREE.MeshBasicMaterial({ color: 0xbff6ff, side: THREE.DoubleSide, transparent: true, opacity: 0.75, depthWrite: false }), 110, 16);
    this.v = new THREE.Vector3(); this.p = new THREE.Vector3();
    this.billT = 0;
  }
  reset() { this.bills.clear(); this.shards.clear(); }

  // a few loose bills constantly escape the backpack (cosmetic only)
  trail(dt, pos, speed) {
    this.billT -= dt;
    if (this.billT > 0) return;
    this.billT = 0.14 + Math.random() * 0.16;
    this.v.set((Math.random() - 0.5) * 2.4, 1 + Math.random() * 1.6, -speed * 0.35);
    this.bills.spawn(pos, this.v, 1.5, 1, 9);
  }
  burst(pos, n, speed) {
    for (let i = 0; i < n; i++) {
      this.v.set((Math.random() - 0.5) * 8, 2 + Math.random() * 5, -speed * 0.6 + (Math.random() - 0.5) * 6);
      this.bills.spawn(pos, this.v, 1.6 + Math.random(), 1.2, 9);
    }
  }
  shatter(x, y, d) {
    for (let i = 0; i < 100; i++) {
      this.p.set(x + (Math.random() - 0.5) * 5, y + Math.random() * 5.5, -d + (Math.random() - 0.5) * 0.3);
      this.v.set((this.p.x - x) * 1.8 + (Math.random() - 0.5) * 3, Math.random() * 5, -(5 + Math.random() * 12));
      this.shards.spawn(this.p, this.v, 1.6 + Math.random() * 1.2, 0.6 + Math.random() * 1.6);
    }
  }
  update(dt, time) { this.bills.update(dt, time); this.shards.update(dt, time); }
}

export function makeBundleMesh() {
  const g = new THREE.Group();
  const cash = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 0.42), new THREE.MeshBasicMaterial({ color: 0x35ff6b }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.44), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x35ff6b, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 2.5;
  const spin = new THREE.Group(); spin.add(cash, band);
  g.add(spin, beam);
  g.userData = { spin, beam };
  g.visible = false;
  return g;
}
