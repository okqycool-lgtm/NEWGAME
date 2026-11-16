// Rendering pipeline: bloom + colour grade + vignette, soft shadows, rain,
// and a quality ladder that steps down automatically when frames get slow.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uBoost: { value: 0 }, uHit: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uBoost, uHit; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      float ca = (0.004 + uBoost * 0.009 + uHit * 0.03) * r2;            // lens fringe, stronger at speed
      vec3 col = vec3(texture2D(tDiffuse, vUv + c * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * ca).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.12);                                      // a little extra saturation
      col = mix(col * vec3(0.92, 0.96, 1.12), col * vec3(1.06, 1.0, 0.97), smoothstep(0.0, 0.7, l));  // cool shadows, warm highlights
      col = pow(max(col, 0.0), vec3(1.05));
      col *= 1.0 - 0.45 * smoothstep(0.14, 0.66, r2);                     // vignette
      col += vec3(0.5, 0.02, 0.05) * uHit * smoothstep(0.1, 0.5, r2);
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.016;                   // film grain
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const LEVELS = ['high', 'med', 'low'];

export class Gfx {
  constructor(renderer, scene, camera, onLevel) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.onLevel = onLevel;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.composer = null; this.boost = 0; this.hit = 0;

    // light rain that follows the camera
    const N = 1100, pos = new Float32Array(N * 6), top = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 44, y = Math.random() * 30, z = Math.random() * 44;
      pos.set([x, y, z, x, y, z], i * 6); top[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
    this.rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: `attribute float aTop; uniform float uTime; uniform vec3 uCam; varying float vA;
        void main(){ vec3 p = position;
          p.y = mod(p.y - uTime * 30.0, 30.0) - 11.0 + uCam.y;
          p.xz = mod(p.xz - uCam.xz, 44.0) - 22.0 + uCam.xz;
          p += aTop * vec3(0.06, 0.75, 0.1); vA = aTop;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.62, 0.78, 1.0, 0.05 + 0.2 * vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    let saved = null;
    try { saved = localStorage.getItem('cyberheist.gfx'); } catch { /* ignore */ }
    const forced = new URLSearchParams(location.search).get('gfx');
    this.mode = LEVELS.includes(forced) ? forced : LEVELS.includes(saved) ? saved : 'auto';
    this.locked = LEVELS.includes(forced);
    this.frames = 0; this.acc = 0; this.slow = 0; this.last = performance.now(); this.warm = 0;
    this.setLevel(this.mode === 'auto' ? (this.coarse ? 'med' : 'high') : this.mode);
  }

  get label() { return this.mode === 'auto' ? 'AUTO' : this.mode.toUpperCase(); }
  cycle() {
    const order = ['auto', 'high', 'med', 'low'];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    try { localStorage.setItem('cyberheist.gfx', this.mode); } catch { /* ignore */ }
    this.slow = 0; this.warm = 0;
    this.setLevel(this.mode === 'auto' ? (this.coarse ? 'med' : 'high') : this.mode);
  }

  setLevel(level) {
    this.level = level;
    const r = this.renderer, dpr = devicePixelRatio || 1;
    this.pixelRatio = level === 'high' ? Math.min(dpr, this.coarse ? 1.5 : 2) : level === 'med' ? Math.min(dpr, 1.25) : 1;
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); this.bloom.dispose(); this.composer = null; }
    if (level !== 'low') {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: level === 'high' ? 4 : 0 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), level === 'high' ? 0.42 : 0.36, 0.5, 0.82);
      this.composer.addPass(this.bloom);
      this.final = new ShaderPass(FinalShader);
      this.composer.addPass(this.final);
      this.composer.addPass(new OutputPass());
    }
    this.rain.visible = level !== 'low';
    this.onLevel?.(level);
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Step down a level when the device can't hold ~40 fps (auto mode only).
  tune() {
    const now = performance.now(), dt = now - this.last; this.last = now;
    if (this.mode !== 'auto' || this.locked || this.level === 'low' || document.hidden || dt > 250) return;
    if (++this.warm < 120) return;
    this.acc += dt;
    if (++this.frames < 90) return;
    const avg = this.acc / this.frames; this.frames = 0; this.acc = 0;
    this.slow = avg > 25 ? this.slow + 1 : 0;
    if (this.slow >= 2) { this.slow = 0; this.warm = 0; this.setLevel(LEVELS[LEVELS.indexOf(this.level) + 1]); }
  }

  render(dt, time, boost, hit, indoors) {
    this.tune();
    this.boost += (boost - this.boost) * Math.min(1, 5 * dt);
    this.hit += (hit - this.hit) * Math.min(1, 10 * dt);
    if (this.rain.visible || this.level !== 'low') {
      this.rain.visible = this.level !== 'low' && !indoors;
      this.rain.material.uniforms.uTime.value = time;
      this.rain.material.uniforms.uCam.value.copy(this.camera.position);
    }
    if (this.composer) {
      const u = this.final.uniforms; u.uTime.value = time % 100; u.uBoost.value = this.boost; u.uHit.value = this.hit;
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
  }
}
