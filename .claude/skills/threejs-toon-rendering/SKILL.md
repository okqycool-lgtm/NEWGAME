---
name: threejs-toon-rendering
description: Stylized anime/arcade look in three.js - MeshToonMaterial with gradient ramps, onBeforeCompile rim light, inverted-hull outlines that work on SkinnedMesh, lighting rig, shadow framing, EffectComposer with restrained bloom, colour grade and vignette, speed-line/shockwave shader passes. Use when changing materials, lighting, shadows or post-processing.
---

# Toon rendering

## Materials (`src/chars/toon.js`)
- `toonMat( color, { rim, ramp } )` = `MeshToonMaterial` + a 3-4 step `DataTexture`
  ramp (NearestFilter) + rim light injected with `onBeforeCompile`:
  ```glsl
  float rim = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
  outgoingLight += rimColor * smoothstep( 0.45, 0.6, rim ) * rimStrength;
  ```
  (insert before `#include <opaque_fragment>`). Keep shadow side warm/saturated, not grey.
- Skin: warm peach, ramp with soft pink terminator. Uniform: cloth whites slightly blue so
  highlights don't clip. Metal/plastic helmet: add a fake spec band via a second ramp step.
- Environment uses `MeshLambertMaterial`/`MeshToonMaterial` with canvas textures; avoid
  photoreal PBR textures next to toon characters.

## Outlines (inverted hull)
- Clone the geometry, render `side: BackSide` with a material that pushes vertices along the
  normal in the vertex shader (`transformed += objectNormal * width`). For SkinnedMesh, create
  a second `SkinnedMesh` sharing the same geometry and skeleton (`outline.bind( skeleton, mesh.bindMatrix )`)
  so it deforms identically. Width in metres ~0.008-0.012, colour dark warm brown, not black.
- `outline.castShadow = false`.

## Lighting
- Key: `DirectionalLight` sun, warm, from behind-left of the pitcher so characters get rim.
  Shadow camera tightly framed around the plate/mound (±12 m), `mapSize` 2048 (1024 on low),
  `bias -0.0004`, `normalBias 0.02`. Move the shadow target with the camera in cinematics.
- Fill: `HemisphereLight` sky blue / grass green-warm. Stadium flood lights are emissive
  meshes + bloom, not real lights (too expensive).
- Special moments (Clash): animate `scene.fog`, hemisphere colour and sun intensity toward a
  dusk-purple palette, restore after.

## Post (`src/core/renderer.js`)
`RenderPass → UnrealBloomPass (strength 0.35, threshold 0.85) → grade ShaderPass → OutputPass → FXAAPass`.
- Grade pass: lift/gamma/gain, saturation 1.1, vignette 0.25, plus uniforms for
  `uFlash` (impact flash, tiny), `uSpeed` (radial speed lines), `uChroma` (subtle chromatic
  aberration on perfect hits) and `uDesat` (hit-stop freeze frame).
- Keep bloom threshold high so only emissive FX/lights bloom. No full-screen white flashes:
  cap `uFlash` at ~0.35 and decay within 120 ms.
- Low tier: skip bloom and FXAA, render direct with tone mapping on the renderer.
