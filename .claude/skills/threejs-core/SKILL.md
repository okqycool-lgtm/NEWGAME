---
name: threejs-core
description: Foundation for all three.js work in Home Run Ascension - the vendored three.js r187 build, import map, WebGLRenderer setup, colour management, the frame loop, and where to look up three.js APIs (the 3d-games fork). Read first before writing or changing any rendering or game code.
---

# three.js core (Home Run Ascension)

## How three.js is loaded

- three.js is **vendored**, not installed from npm: `vendor/three/three.module.js`
  (+ `three.core.js`) and only the addons we use under `vendor/three/addons/`.
- `index.html` has an import map:
  ```html
  <script type="importmap">{ "imports": {
    "three": "./vendor/three/three.module.js",
    "three/addons/": "./vendor/three/addons/" } }</script>
  ```
  So code imports exactly like the three.js docs: `import * as THREE from 'three'`,
  `import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'`.
- Need another addon? Add its path to `ADDONS` in `tools/vendor-three.mjs` and run
  `node tools/vendor-three.mjs [path/to/3d-games]`. The script follows relative
  imports, so dependencies (shaders, `Pass.js`, ...) come along. Never hand-edit `vendor/`.
- No bundler. The site is plain ES modules; any static server works
  (`npm start` runs a tiny Node static server, `tools/serve.mjs`).

## Looking up APIs

The three.js fork is the reference (clone `okqycool-lgtm/3d-games` beside this repo if missing):
- `docs/llms-full.txt` - full API text; grep it (`grep -n "class AnimationMixer" -A40`).
- `src/` core classes, `examples/jsm/` addons, `examples/*.html` working demos
  (e.g. `webgl_animation_skinning_blending.html`, `webgl_postprocessing_unreal_bloom.html`).
- Don't rely on memory for signatures that changed recently (r150+): `outputColorSpace`,
  `ColorManagement`, `CapsuleGeometry(radius, height, capSegments, radialSegments, heightSegments)`,
  physically-correct light intensities (no `physicallyCorrectLights`), `three.core.js` split.

## Renderer conventions

```js
const renderer = new THREE.WebGLRenderer( { antialias: false, powerPreference: 'high-performance' } );
renderer.outputColorSpace = THREE.SRGBColorSpace;   // OutputPass does tone map + sRGB when composing
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio( Math.min( devicePixelRatio, quality.maxPixelRatio ) );
```
- Canvas textures holding colour: `tex.colorSpace = THREE.SRGBColorSpace`. Data/ramp textures: leave linear,
  `NearestFilter` for toon ramps.
- Colours written as hex in code (`new THREE.Color( 0xff8844 )`) are sRGB and converted automatically.
- Units: 1 unit = 1 metre. +Y up. Home plate at the origin, pitcher toward -Z, right field +X.

## Frame loop

- One `requestAnimationFrame` loop in `src/main.js` calls `game.frame( realDt )`.
- Clamp `realDt` to 0.1 s (tab switches). Gameplay runs on a fixed 240 Hz step with an
  accumulator (see `threejs-game-feel`); rendering and animation use `dt * timeScale`.
- Dispose geometry/material/texture you replace (`.dispose()`), never inside the hot loop.

## Project layout

```
index.html          import map, UI markup
src/main.js         boot, loop, resize
src/core/           renderer + post, quality tiers, audio, input
src/world/          sky, stadium, crowd, procedural textures
src/chars/          toon materials, skinned body builder, faces, designs, animation clips
src/game/           pitching, ball physics, batting, camera director, fx, cinematic, upgrades, game state
tests/              Playwright flow + screenshot scripts
```
