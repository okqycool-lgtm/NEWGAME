---
name: hrh-world
description: The Home Run Superstars rendering setup and ballpark scenery - src/core/ (Stage, quality tiers, lit/unlit materials, particles, canvas text, baked textures, Sfx) and src/world/ (dims, field, grass, stadium + board + GeoBuilder, outfield crowd, fielders, flight_mats, globe_trip), plus how to add scenery within the phone budget and check it with lab/world_view.html. Use when touching the stage, lighting, colours, materials or anything in src/world/; for this repo it supersedes the paths and APIs in threejs-procedural-environments / threejs-performance-mobile (written for a different layout).
---

# Home Run Superstars: stage, materials and the ballpark

Plain three.js r187 (`vendor/three/`, import map `three`), no bundler in dev, ported 1:1
from Godot. PORTING.md is the source of truth for conventions (axes, winding, YXZ Euler via
`setRotationDeg`, colours, shaders, instancing). Space: +Y up, plate at `PLATE` (0,0,0.42),
pitcher and centre field along +X, first base +Z, 1 unit ~ 6.3 ft. PORTING.md: ask before
changing `src/core/`; add helpers in your own files.

## src/core/

**stage.js**
- `Stage(canvas, tier)`: `renderer` (WebGLRenderer, `antialias` = tier MSAA, fixed at load;
  `outputColorSpace` sRGB; `toneMapping = CustomToneMapping`), `scene` (background =
  `srgb(...SKY)`), `camera` (Perspective, vertical fov 30, near 0.05, far 4000), `ambient`,
  `sun` (DirectionalLight 0.9*LIGHT_SCALE from `SUN_DIR_DEG` [-55,-60,0], PCF shadow map 2048,
  ortho box +-14 round the batter), `fill` (cool 0.22*LIGHT_SCALE from the other side).
- Methods: `setBackground(c)`, `setAmbient(c)` (THREE.Color or sRGB triple; used by
  world/flight.js), `setRenderHeight(h)` (pixel ratio = renderH / window height, clamped
  0.3..2), `setShadows(on)` (toggles the shadow map and marks every material `needsUpdate`),
  `shadowFocus(p)` (re-centres the sun's shadow box; game calls it on the batter), `resize()`,
  `render()`.
- Exports: `SKY` [0.4,0.67,0.95], `AMBIENT`, `SUN_DIR_DEG`, `shared` (`{ time: { value } }`,
  advanced by main.js each frame: put `time: shared.time` in shader uniforms, never your own
  clock), `LIGHT_SCALE = Math.PI` (Godot energy -> three intensity).
- Custom tone map: the module patches `ShaderChunk.tonemapping_pars_fragment` so
  `CustomToneMapping` is Godot 4 Filmic (white 1.0). Any ShaderMaterial must end with
  `#include <tonemapping_fragment>` + `#include <colorspace_fragment>` (`OUT_GLSL`) to match.
- Do not add lights: the whole look is sun + fill + ambient + flat sky.

**quality.js** - `TIERS` and `ORDER = ['high','medium','low']`:

| tier | renderH | msaa | shadows | fans | lit |
|---|---|---|---|---|---|
| high (desktop) | 1080 | yes | real-time sun | 1.0 | standard |
| medium (phones) | 720 | yes | blob | 0.7 | lambert |
| low (fallback) | 540 | no | blob | 0.4 | lambert |

`initialTier()` (`?quality=low|medium|high` overrides; else `isMobile()` -> medium),
`lowerTier(t)`. Game.applyQuality / _guardFrameRate (src/game.js) drop render height, then
the tier, when fps < 48, and climb back at >= 57.

**materials.js** - `settings.tier` is set once at boot (main.js, labs) before anything is
built. `lit({color, vertexColors, roughness, metalness, map, side, transparent, opacity})` ->
MeshStandardMaterial on `lit: 'standard'`, else MeshLambertMaterial. `unlit({...,
depthWrite, blending})` -> MeshBasicMaterial. `color` is an sRGB triple (converted).
Note: lit() reads the tier at construction, so a runtime tier drop does not swap material
types. Ground (turf, FieldMarks) deliberately uses MeshLambertMaterial on every tier.

**util.js** - `srgb(r,g,b)` -> linear THREE.Color; `srgbArr(r,g,b)` -> linear `[r,g,b]`;
`darkened/lightened/mixc/luminance` work on sRGB triples (Godot semantics); `RNG` (seeded:
`randf, randfRange, randi`), `setRotationDeg`, `V3`, `DEG`, `TAU`, `lerp`, `clamp`, `smoothstep`.

**particles.js** - `Particles extends Object3D`: Godot CPUParticles3D knobs (amount,
lifetime, oneShot, explosiveness, shape, direction, spread, velocity, gravity, damping, scale,
scaleCurve, colorRamp in sRGB+alpha, size, texture, blending, or geometry+material). One
InstancedMesh, frustumCulled false. `emitting`, `restart()`, `update(dt)` every frame,
`setColorRamp()`, `active`. Hide idle emitters (`visible = false`) so they cost no draw call
(OutfieldCrowd fireworks do this).

**text.js** - `loadFonts()` (Inter Display Black/Italic, Inter Bold as `FONTS.black/italic/bold`),
`font(kind, size)`, `drawText(ctx, text, x, y, {kind,size,color,outline,outlineColor,align,
baseline,shadow})` (Arcade.label look), `measure()`, `css(c, a)` (sRGB triple -> css), `INK`, `GOLD`.

**textures.js** - `preloadTextures()` loads assets/tex/*.png (`aura_flame aura_puff ball city
cloud_puff earth grass_noise moon planet_ignis`), sRGB except `grass_noise` (data),
RepeatWrapping, anisotropy 4. `texture(name)` returns the shared cached texture (throws if
not preloaded). Adding a texture = a PNG plus an entry in NAMES. The ballpark's own artwork
is not a PNG: see stadium_art.js below.

**audio.js** - `Sfx`: `init()`, `loadMusic()`, `music( 'menu' | 'game' | '' )` (crossfaded, gapless loop), `setMuted` / `setSilent` / `setPaused`, `unlock()` (after a gesture), `play(name, db, pitch, bus)`,
`playHit(kind, intensity)`, `roar()`, `crowd(kind, strength)`, `duckCrowd()`, `setMuted()`,
`update(dt)`. Pre-rendered WAV/MP3 in assets/sfx. Not a world concern; listed for completeness.

## src/world/

- **dims.js** - shared constants: `PLATE`, `PITCHER_DIST` 10, `SCALE` 1.75, `WALL_R` 52.5,
  `WALL_H` 1.4, `UNIT_FT`, `BLEACH_R/BLEACH_D/BLEACH_TOP/BLEACH_FRONT`, `BOARD_X`, `BOARD_W` 32,
  `FENCE/FENCE_H` (home-run test), `SUN` (towards-sun vector for hand-shaded shaders), `HAZE`
  (sRGB), `BAT_LENGTH`, `SWEET_SPOT`. Use these; never hard-code park sizes.
- **field.js** - `Field` (Object3D): builds `Stadium`, the turf (`stadium.turfMesh()` +
  `groundMaterial(SKY)`), and one merged `FieldMarks` mesh (dirt circles, chalk, plate, boxes,
  bases, rubber, on-deck circles) via GeoBuilder + `srgbArr` colours. `update(dt)` -> stadium.
- **grass.js** - turf as one MeshLambertMaterial with `onBeforeCompile` replacing
  `diffuseColor` (mowing stripes, patches, dirt and track painted in, haze) so three still
  lights and shadows it. Exports `COMMON` GLSL (reused by globe_trip), `grassUniforms()`,
  `noiseTexture()`, `groundMaterial(haze)`, `DIRT_R`, `MOUND_X`, `MOUND_R`.
- **stadium_geo.js** - `GeoBuilder(attrs)`: `vert(p, {n, uv, c, ...extra})`, `tri(a, b, c,
  orient)` (orients CCW toward `orient`, fixing Godot's CW winding), `geometry(g, matrix,
  linearColor)`, `box(size, matrix, srgbColor)` (converts for you), `build()`. Also `xfYaw(p,
  yaw, scale)`, `SRGB_GLSL` (`toLinear()`), `OUT_GLSL`, `rawTexture(t)` (NoColorSpace copy for
  shaders that mix in sRGB space).
- **stadium.js** - `Stadium`: sky band, clouds (instanced billboards), the stands bowl (one
  unshaded ShaderMaterial mesh, profile blended decks -> bleachers, zones in `aZone`, crowd and
  seats textures, LED ribbon animated by `shared.time`, `cheer` uniform), dugouts, padded wall
  with the sponsor banners, `330` plates and pennants (one alpha-cut canvas sheet on merged quads), party decks +
  umbrellas, bunting, flags, foul poles, light towers + `LampBanks`, plain city blocks
  (InstancedMesh; only beyond `city.OUTER` when the Blender city loaded). The stands' outside
  is the brick ballpark front drawn in `STAND_FS` (`facade()`: pilastered bays, arcade,
  arched windows, banners, frieze, cornice); the facade/rail segments take u from their own
  perimeter (`outerArc`), so bays keep their width round the curves.
- **`City.strip({ x0, x1, span, ... })`** (city.js): the same kit laid out as a strip of
  blocks along +X for the long-hit cinematics (30-unit blocks, 4-wide streets on the grid
  lines; packed walk-ups near the path, towers further out, parked cars), merged into
  `chunks` meshes along X, optional dither `fade` uniforms. Used by globe_trip.js (the
  'city' band, dithered in with the other props; ~56k / 80k / 97k tris low / medium / high)
  and flight.js (on the space climb's ground plane, which uses the globe trip's city ground
  shader so the streets line up). The kit (templates + texture array) is built once and
  shared (`kit()`).
- **Globe trip landscapes** (globe_trip.js `_buildKitBand`): every biome but the city is laid
  out from the Blender kit `assets/models/biomes.glb` (tools/blender/biome_kit.py: houses,
  barns, silos, tractors, pines / firs / round trees, peaks and hills, mesas and cacti, ships,
  bergs and igloos, palms, broadleaf trees, temples, islands, huts, lighthouses; game units,
  some pieces "height 1" scaled per instance). One InstancedMesh per piece per band with the
  kit material (`_mats.kit`: vertex colours, sharing the props' dither-reveal uniforms),
  optional instance tints; density x0.55 / 0.8 / 1 on low / medium / high. Pieces the kit
  does not have (turbines, jetties, balloons, buttes, an arch, pyramids, volcano cones and
  steam) are built in code, `src/world/biome_pieces.js`, flat-shaded and vertex-coloured to
  match; `_kitGeo` falls back to it. Moving ones (rotors, bobbing balloons, lava glow, smoke)
  use the `moveFade` material, animated in the vertex shader off `shared.time`: nothing on the
  CPU. Without the model the old primitive props are used (the six newest lands then show
  bare ground). Preview a kit: `lab/kit.html?model=biomes[&only=H_,T_]`.
- **Blender stadium pieces** (`assets/models/stadium.glb`, tools/blender/stadium_kit.py): the
  outfield wall (`_buildWallModel`: padded bevelled cushions under the rotating ads, seams,
  kick plate, rounded cap, yellow home-run line; uv.y < 0 = plain vertex-colour parts), the
  fans (`fanGeometry`: hair cap, eyes, hands, trousers; FAN_VS reads uv.y as the paint),
  the board structure (gold bevelled frame, crown + light bar, pylons, catwalk below the
  ticker, ribbed back; it must stay within the batting view's top edge) and the field's
  plate / bases / rubber / mound. Fans also fill the rows behind the board now (`_noFan`
  skips only the board's footprint).
- **grass.js** also paints the grass lip at the dirt edge, rake lines and scuffs in the
  infield dirt, and a speckled warning track.
- **city.js** - `City.build()`: the Blender city kit (`model('city')`) on a street grid round
  the park: packed blocks (walk-ups, shops, pastel / stone blocks, scaled `PACK_SCALE`), a
  `*_lod1` ring past `DETAIL[tier]`, towers out to `OUTER`, parked cars, plaza trees and
  lamps. One material for everything (the facade images become a `DataArrayTexture`, a
  per-vertex `aLayer` picks the layer; trim uses a white layer x vertex colour), merged into
  `SECTORS` (8) wedges so it is <= 8 draw calls and frustum-culled by wedge. Also the
  road-grid ground ring and the plaza at `GROUND_Y` (-0.22: well clear of the skirt at -0.5,
  or they z-fight at a distance); `Stadium.heightAt` returns `GROUND_Y` outside the park.
  Keep everything under 30 units tall (the flights' open-sky hand-offs).
  Every static lit box goes into one GeoBuilder `_solid` -> mesh `StadiumSolids`. API:
  `cheer(s)`, `fireworks()`, `board(title, sub)`, `showStats(s)`, `heightAt(p)`, `blocks(p)`,
  `update(dt)`, `turfMesh()`; `crowd` is the OutfieldCrowd. The header comment lists the draw
  call per piece: keep it current.
- **stadium_art.js** - the park's painted artwork, drawn on canvases at load (after
  `loadFonts`), each a cached CanvasTexture: `wallAds()` (eight sponsor banners in a row,
  4096x256, each drawn in a 1200x256 space; the sponsors are the run's powers), `ribbonArt()`
  (LED messages: top strip scrolls, bottom strip is the cheer), `crowdArt()` / `seatsArt()`
  (1024x256, 8 rows x `CROWD_COLS` 64 seats, sections of 16 with an aisle; wrap both ways),
  `signsArt()` (4 fan signs), `bannerArt()` (`{ texture, plate, badge, pennants[] }` uv
  rects: one alpha-cut sheet for the wall's 330 plate, the team badge and six pennants),
  `lampArt()`. House palette: navy / gold / cream / red (the constants at its top). Preview
  them flat with `lab/art.html[?only=wallAds,ribbonArt]`. To change a banner edit its
  function in `ADS`; keep eight (the wall shader slides by 1/8 of u every 6 s).
- **The wall's rhythm** (`_buildWallModel`): 96 cushions (two per kit segment); six carry a
  banner, then two are plain navy, a navy pair centred on dead centre, so navy panels fall
  every 7.5 degrees: `_buildMarkers` puts the 330 plate on those at 0, +-22.5, +-37.5 and
  the badge on the rest (alphaTest quads just proud of the cushions, mesh `WallMarkers`,
  which also carries the pennants under the roof edge (`this._rafters`) and along the
  party decks).
- **The roof** over the two-deck stands (`ROOF_BACK`, `ROOF_FRONT`, `ROOF_REACH`): extra
  strips in the stands mesh with zones > 1 in `STAND_FS` (1.1 canopy: white on top, trussed
  underneath; 1.3 its navy front edge; 1.5 the glazed wall behind the top rows). No
  `discard` in that shader (it covers much of the screen on phones).
- **Light towers / foul poles**: `L_mast` (30 tall, scaled in Y), `L_head`, `P_foul` from
  the stadium kit, appended to `_solid` with their own vertex colours (`geometry(g, m, null)`).
- **stadium_board.js** - `StadiumBoard(parent, gb)`: cabinet/trim/base boxes into the solid
  GeoBuilder; one canvas atlas [left panel | main 640x216 | right badge] on one `BoardScreens`
  mesh (CanvasTexture, sRGB, no mipmaps); `BoardTicker` (its own canvas, scrolled in the shader
  by `shared.time`); `BoardMarquee` (shader bulbs, `cheer` via `setCheer`). `board()` redraws
  the main screen (flash mode: "HOME RUN!" + distance); `showStats({homeRuns, longest, hits,
  perfects, streak, level, pitches, hitPct})` redraws main + left and redraws the ticker only
  if its text changed. Change detection for stats lives in `Game._updateBoard()` (JSON compare)
  - canvases are re-uploaded only on calls, never per frame. `board.box` is the hit volume.
- **outfield_crowd.js** - `OutfieldCrowd(height, skip, extra)`: a couple of thousand seated blocky
  fans (`fanGeometry()`, 64 verts, field-facing faces only) in one InstancedMesh `Fans`, signs
  in another (`Signs`), seven fireworks `Particles`. All motion (idle, 22 s stadium wave,
  cheer jumps) is in the vertex shader. Per-instance data: `iColor` (shirt, **sRGB**, the shader
  converts with `toLinear`) and `iCustom` (skin, hair, phase, angle). Instances are shuffled so
  `setDensity(d)` just sets `mesh.count = total * d` (party-deck fans come first, always shown);
  Stadium applies `TIERS[settings.tier].fans`, Game.applyQuality re-applies it on a tier drop.
- **fielders.js** - `Fielders(looks)`: seven fielders (SPOTS), each a skinned figure posed
  every frame from blended channel poses (see the hrh-characters skill); one InstancedMesh
  for the blob shadows. `track(p)`, `release()`, `advance(dt)`, `plan / canCatch / planCatch /
  glove / catchHeight`. `randomLooks(n, rng)` makes the visitors' looks. Added by game.js,
  not by Field (so not in lab/world_view).
- **flight_mats.js** - helpers for flight / hit_fx / aura: `toLinear(c)`, `lookFrom`, `setFov`,
  `DynMesh` (preallocated per-frame ribbons/lines), `vcolMaterial`, `instMaterial`,
  `billboardMaterial`, `colouredInstances` + `setInstanceColour` (sRGB in, linear stored) +
  `markInstancesDirty`, `godotSphere/godotTorus/godotPrism`.
- **globe_trip.js** - the "globe" goal landscape: sixteen biomes (`BIOMES`, in the order of
  `run/route.js` `ROUTE`: city, suburbs, windfarm, farms, lakes, forest, balloons, mountains,
  canyon, desert, pyramids, ocean, volcano, ice, jungle, coast; `BAND` 300 each) along a
  track; one ground plane whose shader paints every biome, plus a few InstancedMeshes per biome
  with a dithered distance fade. `setTrack(t)` slides it (one transform + one uniform),
  `setReveal(k)`, `skyAt(t)`; `biomeAt(t)`. `citySkirt()` (the city ground round the park, at
  y -0.5) is added by game.js.

## Colours (the usual bug source)

- Code colours are Godot sRGB floats `[r, g, b]`. `lit/unlit({color})` and `GeoBuilder.box`
  convert; anything else: `srgb()` for THREE.Color (`setColorAt`, uniforms for three's
  materials), `srgbArr()` for **vertex colour arrays, which must be linear** (`gb.geometry(...,
  srgbArr(...))`, `vert(p, {c})`).
- Do colour maths (`darkened/mixc`) on sRGB triples first, convert last.
- Custom unshaded shaders in this repo work in sRGB: uniforms/attributes hold raw sRGB, sample
  textures through `rawTexture()`, and finish with `toLinear()` (SRGB_GLSL) + `OUT_GLSL`. Pick
  one convention per shader and stick to it; mixing gives washed-out or too-dark colours.
- Canvas textures: `colorSpace = THREE.SRGBColorSpace`.

## Adding scenery within budget

40+ fps on phones is a hard requirement. Reference load (batting camera, ballpark + pitcher,
`lab/world_view.html?info=1&freeze=1`, 960x540; before the Blender city): about 35 draw calls / 39k triangles on low,
51 / 75k on high (its extra calls are the shadow pass).

1. Static, opaque, lit pieces: append to the stadium's merged GeoBuilder (`this._solid.box(...)`
   / `.geometry(...)` inside a `_buildX()` called from the Stadium constructor before
   `_solid.build()`) - zero new draw calls. Otherwise one GeoBuilder -> one Mesh per material.
2. Repeats (seats, poles, signs, trees): one InstancedMesh; per-instance colour with
   `setColorAt(i, srgb(...))` or an `InstancedBufferAttribute`; build matrices once.
   `frustumCulled = false` (or a big bounding sphere) if a shader moves instances.
3. Colour by vertex colours or a tiny palette, not extra materials or textures. Reuse baked
   textures via `texture(name)`; canvas-generate small ones once at load.
4. Animation goes in shaders off `shared.time` plus a uniform (like `cheer`); no per-frame CPU
   work beyond a few matrices, no allocations in `update`, no per-frame canvas redraws (draw
   on change, set `needsUpdate` then).
5. Scenery does not cast shadows (only batter, bat, pitcher do); `receiveShadow` only for the
   ground. Lean geometry: drop faces the camera never sees (as `fanGeometry` does).
6. Tier-dependent density: scale counts with `TIERS[settings.tier]` (e.g. `mesh.count`), and
   if it must react to a tier drop, hook it into `Game.applyQuality`.
7. Name every mesh (`mesh.name`) and add it to the draw-call list in the stadium.js header.

## Checking it

- Serve: `npm start` (`node tools/serve.mjs 8080`), open `lab/world_view.html`. Params:
  `cam=x,y,z&look=x,y,z&fov=30&quality=high|medium|low&t=secs&cheer=1&flash=1&stats=0&freeze=1&info=1`
  (`info=1` overlays draw calls, triangles, fps, build ms). `window.lab` exposes stage, field,
  stadium, pitcher.
- Screenshot: `node tests/shot.mjs "lab/world_view.html?freeze=1&info=1&quality=low" out.png
  [waitMs] [w] [h] [--mobile]` (SwiftShader; prints console errors/warnings). Read the PNG;
  check inside-out faces, wrong colours, scale, and compare calls/tris before vs after on
  `quality=low` and `high`. Try a wide view too for the bowl and city:
  `cam=-30,40,0.42&look=40,0,0.42&fov=50`.
- In the game's batting view (all seven animated fielders, outlines; after the idle prep):
  61 draw calls / 150k triangles on low, 62 / 197k on medium, 67 / 295k on high. The crowd's
  fans are the biggest single item (89k on medium: an indexed 54-triangle fan x ~1,650).
  `lab/world_view.html` builds the whole city (not lazy) and has no fielders.
- New lab page: copy `lab/_template.html`, build a Stage, set `window.__ready = true` (lab/README.md).
- `npm test` (tests/play.mjs) plays a full run through the real game loop; must stay error-free.

## The lands past the city (`src/world/globe_trip.js`)

- **Layout and placement** (`src/world/scenery_layout.js`, no three.js): `LAND.<id>` holds
  each land's layout numbers (street cells, lot sizes, lane and river curves, shores), which
  are written into the ground shaders' GLSL and read by `SURFACE.<id>( x, z )`, the plain
  JavaScript mirror of what the shader paints there, so painted streets and placed houses
  cannot drift apart. `PIECES` gives every prop a footprint; `_scenery( i )` returns the
  placer (`S.place` / `S.scatter` / `S.group`, `S.begin` / `S.end`), which simply does not
  place a piece that would stand on a road, in water, on another prop, on the next land's
  ground or in the flight path. Groups are thinned together by tier (an island with its
  palms). `SEAM` shapes where one land's ground hands over to the next (always complete by
  the band's end: no line). `node tests/scenery.mjs` (through `lab/scenery.html`) checks every
  built instance on all three tiers against the same rules and must stay at 0 violations.
  Adding a land: a row in `run/route.js`, then the steps in scenery_layout.js's header.
- **Ground**: one strip per biome in the sliding `_track` object, each with its own small
  shader (`groundMaterial( ..., a, b, index )` compiles only biome `a`'s painting and the
  next one's for the blend at the band's end; bodies in `BIOME_FS` / `SEA_FS`). Never put
  all biomes back into one shader with an if-chain: flattened branches make every pixel
  pay for every biome. Cloud shadows drift over the bands past the city (one noise tap).
- **Far fade** (`FADE_PARS` / `FADE_DISCARD` / `FADE_HAZE`, `fadeUniforms()`, shared with
  the city strip's material through `city.js` `FADE`): props take on the sky's colour with
  distance (`setHaze`, fed from `Flight._setBg`) and only the last tenth is dithered away,
  so nothing stipples. `hazeAmount` 0 = dissolve only (the park's far blocks).
- **Shadows**: `_addShadows` gives each band one InstancedMesh of soft ellipses under its
  props (sized from each kit piece's bounding box; none for land forms or small clutter).
- **What is drawn**: `_cull` shows a band's props only within 86% of the props' fade
  distance and its ground only within the ground's own fade; `showAll( true )` is for
  compiling every shader (`Flight.compileShaders`).
- While the camera is away in the cinematic (`flight._mode === 'stage'`) the game hides
  the park (`Game._park`: field, players, skirt), which is never frustum-culled.
- Budget check: frame time per biome on the software renderer (render + `readPixels`)
  against the previous commit; the heaviest moment is over the city, keep the others under it.

## The Moon park and the Moon's lands

- **Tranquility Field is the Earth park re-themed**, same dimensions and cameras:
  `Stadium.setTheme` / `Field.setTheme` / the crowd's `setTheme` flip a `moon` uniform
  (grey hull facades, glass roofs over the stands, alien fans, regolith instead of grass,
  glowing base lines through `FieldLights`), and `moon_park.js` adds what Earth does not
  have: `moonKit()` (lander legs under the six light towers, dishes on the scoreboard,
  masts on the bleachers' rail, domes along the roofs, airlocks at the dugouts: one merged
  mesh), `moonSurround()` (the crater rim and the base inside it: one merged mesh, and the
  flight's "city" on the Moon) and `moonSkirt()` (the first Moon land's painter under the
  park). `Game._setParkLook` shows one set or the other and swaps sky colour, ambient and
  the pitcher.
- **Pieces** (`moon_pieces.js`, `moonPiece( name )`): flat-shaded, vertex-coloured, built
  with `Shape` (exported from biome_pieces.js), `aMove` for spin / bob / glow. Name
  prefixes: `L_` lunar base and surface, `X_` crystals, `N_` monolith valley and far side,
  `S_` station, `Q_` deep space, `R_` re-entry, `K_` park kit. (Not `M_`: the shadow pass
  skips that prefix.) Each has a footprint in `PIECES`.
- **Lands**: `LAND` / `SURFACE` / `PAINT` entries as for Earth's (moonbase, mines, landing,
  crystals, monolith, farside, station, deepspace, reentry); props in `_moonBand`. `VOID`
  lands (station, deepspace) have no ground mesh: the neighbours' ground fades out and in
  across the seam (`toVoid` / `fromVoid`). No cloud shadows on the Moon.
  `node tests/scenery.mjs` covers all 25 lands and must stay at 0 violations.
- **Sky** (`moon_sky.js` `MoonSky`): opaque star points and a lit Earth with an additive
  rim, all centred on the camera each frame (`follow( camera )`), so nothing slides at a
  hand-off between cameras. `setEarth( dir, size, show )` is the flight's; `home()` puts
  the Earth back over centre field.
- **Budget**: see hrh-project "Arenas". The kit and surround cannot be culled by wedge
  (one mesh each); the sky Earth is 40x20 + a 40x10 rim for the same reason.
