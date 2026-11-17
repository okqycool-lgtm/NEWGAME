// Loads the Blender-built GLB assets (see blender/) and hands out meshes that share
// geometry and one palette material per file. Everything degrades gracefully: a file
// that fails to load just leaves the procedural fallback in place.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FILES = ['runner', 'getaway_van', 'getaway_skiff', 'traffic', 'hovercar', 'buildings', 'signs', 'props'];

export class Assets {
  constructor() { this.files = {}; this.level = 'high'; }

  async load() {
    const loader = new GLTFLoader(), base = import.meta.env.BASE_URL + 'assets/';
    await Promise.all(FILES.map(async (f) => {
      try {
        const gltf = await loader.loadAsync(base + f + '.glb');
        const nodes = {};
        let std = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          nodes[o.name] = o;
          std ??= o.material;
        });
        if (!std) return;
        // palette atlases: one texel per colour, so no filtering or mipmaps
        for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap']) {
          const t = std[k]; if (!t) continue;
          t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
        }
        std.side = THREE.FrontSide;
        std.envMapIntensity = 1.2;
        const glow = std.emissiveIntensity;
        const lam = new THREE.MeshLambertMaterial({ map: std.map, emissiveMap: std.emissiveMap, emissive: std.emissive, vertexColors: std.vertexColors });
        this.files[f] = { nodes, std, lam, glow, meshes: [] };
      } catch (e) { console.warn('asset missing:', f, e?.message ?? e); }
    }));
    return this;
  }

  has(file, node) { return !!this.files[file] && (!node || !!this.files[file].nodes[node]); }
  geo(file, node) { return this.files[file]?.nodes[node]?.geometry ?? null; }
  mat(file) { const f = this.files[file]; return f ? (this.level === 'low' ? f.lam : f.std) : null; }
  // bounding box size of a node's geometry (model units)
  size(file, node, out = new THREE.Vector3()) {
    const g = this.geo(file, node); if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    return g.boundingBox.getSize(out);
  }

  // A new mesh for a node; the material follows the quality level.
  mesh(file, node, { shadow = false } = {}) {
    const f = this.files[file], src = f?.nodes[node];
    if (!src) return null;
    const m = new THREE.Mesh(src.geometry, this.mat(file));
    m.castShadow = shadow; m.receiveShadow = false;
    f.meshes.push(m);
    return m;
  }
  instanced(file, node, count) {
    const f = this.files[file], src = f?.nodes[node];
    if (!src) return null;
    const m = new THREE.InstancedMesh(src.geometry, this.mat(file), count);
    f.meshes.push(m);
    return m;
  }

  track(file, mesh) { const f = this.files[file]; if (f) { f.meshes.push(mesh); mesh.material = this.mat(file); } }

  // Without the bloom pipeline emissive values above 1 just clip to white, so only High keeps them hot.
  setQuality(level) {
    this.level = level;
    for (const f of Object.values(this.files)) {
      const m = level === 'low' ? f.lam : f.std;
      m.emissiveIntensity = Math.min(f.glow, level === 'high' ? 1.6 : 1.1);    // the palette already holds full-strength colours
      for (const mesh of f.meshes) mesh.material = m;
    }
  }
}
