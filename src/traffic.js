// Moving traffic on fixed lanes. With the Blender car models loaded each lane entry becomes an
// instance of a sedan, van or hover car turned to face its direction of travel; without them
// (or for lanes flagged `box`, e.g. boats) it falls back to the original glowing boxes.
import * as THREE from 'three';

const PAINT = [0xe9ecf5, 0xff5a36, 0xffd60a, 0x39d0e8, 0xd94ad6, 0x596080, 0x7dffb0, 0xf5f1ff, 0x2f6bff, 0xff8fc7];
const HERO_TINT = [0xffffff, 0xffb8a0, 0xa8ffe6, 0xd8c8ff];

export function makeTraffic(scene, assets, lanes, { boxSize = [1.7, 0.7, 3.8], boxColor, rand = Math.random } = {}) {
  const cars = assets?.has('traffic', 'CarSedan'), hero = assets?.has('hovercar', 'HoverCar');
  const groups = new Map();
  lanes.forEach((l, i) => {
    const flying = l.y > 1;
    let kind = 'box';
    if (cars && !l.box) kind = flying ? (hero && l.hero ? 'HoverCar' : 'CarHover') : (i % 6 === 0 ? 'CarVan' : 'CarSedan');
    // models point down +Z; lanes run along -Z (d) or +X
    l.rot = l.axis === 'd' ? (l.dir > 0 ? Math.PI : 0) : (l.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(l);
  });
  const sets = [];
  const c = new THREE.Color();
  for (const [kind, list] of groups) {
    let im;
    if (kind === 'box') {
      im = new THREE.InstancedMesh(new THREE.BoxGeometry(...boxSize), new THREE.MeshBasicMaterial(), list.length);
      list.forEach((l, i) => im.setColorAt(i, c.set(boxColor(l))));
    } else {
      im = kind === 'HoverCar' ? assets.instanced('hovercar', assets.has('hovercar', 'HoverCar_LOD1') ? 'HoverCar_LOD1' : kind, list.length) : assets.instanced('traffic', kind, list.length);
      const tints = kind === 'HoverCar' ? HERO_TINT : PAINT;
      list.forEach((l, i) => im.setColorAt(i, c.set(tints[Math.floor(rand() * tints.length)])));
    }
    im.frustumCulled = false;
    scene.add(im);
    sets.push({ im, list, drop: kind === 'box' ? 0 : boxSize[1] / 2 });
  }
  const m4 = new THREE.Matrix4();
  return {
    update(time) {
      for (const { im, list, drop } of sets) {
        list.forEach((l, i) => {
          const span = l.b - l.a;
          let p = (l.off + time * l.speed) % span; if (l.dir < 0) p = span - p;
          if (drop) m4.makeRotationY(l.rot); else if (l.axis === 'd') m4.identity(); else m4.makeRotationY(Math.PI / 2);
          if (l.axis === 'd') m4.setPosition(l.pos, l.y - drop, -(l.a + p));
          else m4.setPosition(l.a + p, l.y - drop, -l.pos);
          im.setMatrixAt(i, m4);
        });
        im.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
