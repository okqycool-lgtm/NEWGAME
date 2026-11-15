---
name: threejs-performance-mobile
description: Keep the three.js game smooth on desktop and phones - quality tiers, adaptive pixel ratio, shadow and post budgets, draw-call merging and instancing, touch aim pad + swing button, safe-area aware responsive HUD, orientation handling. Use when optimizing or working on input/HUD layout.
---

# Performance and mobile

## Quality tiers (`src/core/quality.js`)
`high` (desktop): pixel ratio ≤ 2, 2048 shadows, bloom + FXAA, 3000 fans.
`medium`: pixel ratio ≤ 1.5, 1024 shadows, bloom at half resolution, 1800 fans.
`low` (weak mobile): pixel ratio 1, 1024 shadows, no composer, 900 fans.
- Initial tier from `matchMedia('(pointer: coarse)')`, screen size and `hardwareConcurrency`;
  `?q=low|medium|high` overrides. An FPS monitor drops one tier after 3 s below 45 fps.

## Budgets
- < 150 draw calls total. Merge static meshes per material; characters ~6 calls each + outlines.
- One shadow-casting light; shadow camera tightly framed; `autoUpdate` stays on (characters move).
- Particles: pooled `Points`/`InstancedMesh`, no per-hit allocation.
- Canvas textures ≤ 2048, power of two where mipmaps are used.

## Touch controls
- Left / centre of the screen = **relative aim pad**: drag moves the reticle by the finger delta
  (×1.6) so the finger never covers the reticle or ball.
- Bottom-right **SWING** button (≥ 88 px, safe-area inset); a quick tap anywhere (< 200 ms,
  < 10 px movement) also swings.
- `touch-action: none` on the canvas, `preventDefault` on touchmove, pointer events throughout.

## Layout
- HUD in CSS with `env(safe-area-inset-*)`; top bar for Resolve, small count panel top-left,
  distance banner top-centre during flights, nothing in the centre third where the pitch travels.
- Portrait phones: camera FOV widens and moves back (`camera.aspect < 1`) so plate and mound both fit.
