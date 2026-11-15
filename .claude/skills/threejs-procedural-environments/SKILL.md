---
name: threejs-procedural-environments
description: Build a complete stylized baseball stadium procedurally in three.js - regulation diamond layout, canvas-painted grass/dirt textures, mound, bases, chalk, outfield wall, tiered stands, instanced animated crowd, scoreboard with live canvas text, light towers, skyline, mountains, gradient sky shader with clouds, flags and other ambient motion. Use when editing src/world/.
---

# Procedural environments

## Layout (metres, home plate at origin, CF toward -Z)
- Bases 27.43 m apart (90 ft); diamond rotated 45°. Mound 18.44 m (60.5 ft) toward -Z,
  radius 2.74 m, height 0.25 m. Infield dirt arc radius ~29 m from mound-ish centre.
- Fence: 100 m down the lines → 122 m centre (smooth curve `r(θ)` blending by angle).
  Wall height 3 m; `world.fenceDistance( angle )` and `world.wallHeight` are the
  gameplay contract used by ball physics to detect home runs.
- Foul lines along ±45°.

## Textures (`src/world/textures.js`)
- Paint with 2D canvas, 1024-2048 px, then `CanvasTexture` (`colorSpace = SRGBColorSpace`,
  anisotropy 8, mipmaps). Grass: alternating mowing stripes + checker + noise speckle,
  painted in **field space** onto one big plane so stripes align to the diamond.
  Dirt: warm clay with grain noise and darker edge rings.
- Paint chalk lines, batter's boxes and the on-deck circles into the field texture, not as
  geometry (no z-fighting, one draw call).

## Structures
- Stands: tiers as extruded arcs (`Shape` + `ExtrudeGeometry` or `LatheGeometry` with
  `phiStart/phiLength`), seat rows as a striped canvas texture rather than geometry.
- Crowd: one `InstancedMesh` of a simple fan figure (capsule body + sphere head merged),
  per-instance colour via `setColorAt`, idle bob + cheer jump in the vertex shader using
  `instanceMatrix` translation as a phase seed and a `uExcite` uniform the game raises on hits.
  2-4k instances on desktop, half on mobile.
- Scoreboard: canvas texture redrawn only when values change (`texture.needsUpdate = true`).
- Light towers: thin pylons + emissive panel grid (bloom picks them up).
- Background: skyline boxes with window-grid emissive texture, distant mountains as a
  low-poly ring with vertex-colour gradient, all fog-tinted.

## Sky
`ShaderMaterial` on a large inverted sphere (`depthWrite false`, rendered first): vertical
gradient (zenith, horizon, ground haze) + sun disc/halo + 2D fbm cloud bands scrolled by
`uTime`. Expose `uZenith/uHorizon` so cinematics can shift palette.

## Ambient motion
Flags (vertex shader wave), drifting clouds, a slow blimp, crowd bob, scoreboard ticker,
banners. All driven by one `world.update( dt, t )`.

## Performance
Merge static geometry by material (`mergeGeometries`). Target < 120 draw calls for the
whole stadium. `matrixAutoUpdate = false` on static meshes.
