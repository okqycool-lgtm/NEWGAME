---
name: hrh-characters
description: How Home Run Superstars' characters are built and animated - the blocky batter/fielder body (src/batter/blocky_body.js: one skinned vertex-coloured mesh, looks and presets, anime hair strands), the painted anime face with expressions (src/batter/face.js), BatterRig pose channels and IK (batter_rig.js), the key-pose clips (swing_clips.js), the Batter wrapper (expressions, blinking, events) and how to check a change keeps the swing intact. Use before touching anything in src/batter/ or the fielders' look; it supersedes threejs-procedural-characters / threejs-animation (src/chars/ paths) for this repo.
---

# Characters (src/batter/)

| File | What it is |
|---|---|
| `blocky_body.js` | `BlockyBody`: builds the toy-brick figure in code. A `THREE.Skeleton` (Mixamo bone names, prefix `mixamorig_`) plus **one** skinned, vertex-coloured mesh (one draw call). Looks/presets, hair, helmet, uniform. `PROFILE` = the measurements the rig needs. |
| `face.js` | The anime face: an 8-expression canvas atlas on a thin patch over the head front, parented to the Head bone. `EXPRESSIONS`, `paintAtlas(look)`, `build(look, headFront, headRest)`. |
| `batter_rig.js` | `BatterRig`: poses the skeleton every frame from **pose channels** (hips, chest, head, bat, elbow poles, feet), with two-bone IK for arms and legs, grip IK onto the bat, and colliders keeping the bat out of the helmet/torso. |
| `swing_clips.js` | Key-pose clips (`idle`, `load`, `swing`, `after_hit`, `admire`, `after_miss`, `relaxed`, `reset`, `reset_hit`) as channel values over time; `clip(name)`, `sample(clip, t)`; `swing` has a `contact` time. |
| `batter.js` | `Batter` (an Object3D): owns the model, bat (`bat_mesh.js`), rig and clip playback; blends clips; events; expressions. |
| `bat_mesh.js` | The bat (lathe profile, `radiusAt`). |

The whole cast uses this figure (anime face and hair), the visitors in purple (`fielders.js` `LOOK`, cap, mitt), each visitor their own look: `randomLooks(n, rng)` (fielders.js) deals the hairstyles round (`HAIR_STYLES`), hair colours out of a shuffled bag, skin tones round from a shuffled deck of five (so the seven fielders always show all five) and a number; the pitcher is dealt separately and always has the batter's light skin tone (game.js); `LOOK.brow` is fixed so they all share one face atlas. The game draws a new crew every load (`?cast=N` fixes it).
- **Fielders** (`src/world/fielders.js`): seven real skinned figures (`BlockyBody.build(look, 1)`, lod 1, outline, face: three draw calls each), each posed every frame by its own `BatterRig` from **blended channel poses**: `READY` (with a slow weight shift) -> `WATCH` (up out of the crouch while someone else chases) -> `stride(out, phase, amp, reach)` (the run cycle: feet by leg IK, arms as a bar through both fists swung about the spine, `rig.gripSpacing` widened) -> `CATCH` -> `SECURE` (glove pulled in, a grin, held 0.8 s). Movement eases (`ACCEL` / `DECEL`), the head turns to the ball ahead of the body, and a fielder turning on the spot steps round. Still fielders are posed every third frame. `glove()` / `catchHeight()` come from the `CATCH` pose measured once (`_gloveAt`). Check with `lab/fielding.html?who=5&sim=1.2&run=6,0,-8[&catch=1&release=1.6]` (`window.__lab.ms` = cost of one `advance`).
- **Pitcher** (`src/world/pitcher_mock.js`): `BlockyBody.build(look with mitt: 'right')` scaled by `SCALE` (1.2) and turned to face -X. The delivery and knockout are keyed as joint angles in the old primitive limb layout (`KEYS`: eleven poses, 16 channels incl. `spineYaw` = shoulders against hips and `armsIn` = hands together in the set), each channel run through its keys on a monotone cubic (`TANGENTS`) so the arm is still accelerating at the release; `_joint(part, x, y, z)` maps them onto bones (conjugating by the quarter turn `_F`, and the arm hang `_HL`/`_HR`; the torso is spread over Spine/Spine1/Spine2, the head over Neck/Head and it undoes the body's turn so the eyes stay on the plate). He breathes and sways in the set position (`_pose(0, idle)`). The throwing arm is the figure's **left** arm; `releasePoint()` is a node at its grip. **The key at `RELEASE_TIME` fixes where the ball leaves: do not change it** (check `window.__release` on `lab/pitcher.html?spec=w:1.1` before / after). Check with `lab/pitcher.html` (`spec=w:t,...,ko:t`).
- Looks: `mitt` is `true`/`'left'` or `'right'`.
- Preview the hairstyles / a random team: `lab/cast.html[?styles=long,curly][&seed=7]`.

## Character space

Batter at the origin facing **+Z** (the plate at z 0.42), **+X toward the pitcher** (the batter's left), +Y up, feet at y 0. About 0.95 units to the helmet top. Rest pose = T-pose with every bone rotation identity, so a bone's bind inverse is just a translation (`_skeleton()`).

Key constants (top of `blocky_body.js`): `HIP_Y`, `TORSO_Y`, `TORSO_W`, `TORSO_D`, `SHOULDER`, `ARM_T`, `ELBOW_X`, `WRIST_X`, `HAND`, `LEG_X`, `LEG_T`, `KNEE_Y`, `ANKLE`, `BALL`, `HEAD_C`, `HEAD`, `HEAD_R`, `GRIP`.

## Building geometry (BlockyBody)

All parts are appended into flat arrays and become one BufferGeometry in `_mesh()`:
- `_rbox(center, size, r, colour, weights, div, basis)`: rounded box; `colour` = sRGB `[r,g,b]` **or** `(pos, normal) => [r,g,b]` (gradients); `basis` = a Quaternion about the centre.
- `_poly(pts, n, col, weights)` flat convex polygon; `_spike(c, e1, e2, s, tip, col, tipCol, weights)` pyramid.
- `_strand(root, mid, tip, w, th, weights)`: a tapered hair strand along a quadratic curve (diamond cross-section, dark root to light tip). The root must sit inside the head or headwear.
- `_faceDecal` / `_faceStrip`: flat decals wrapped on the head front (`_headFront(x, y)` gives the surface point and normal for head-front offsets).
- Skin weights: `this._rigid('Head')`, or `this._ramp(axis, [[coord, bone], ...], width)` to blend along an axis (torso: `_torsoWeights()`; legs blend at the knee, arms at the elbow).
- `_tri(a, b, c, n)` winds each triangle to face `n` (three is CCW-front), so you never hand-wind.
- Colours are sRGB triples in code; `_vert` converts to linear (`srgbArr`) and caches.

## Looks

`DEFAULT_LOOK` keys (snake_case, kept from Godot): `outfit` (`uniform`/`hoodie`), `headwear` (`helmet`/`cap`/`none`), `hair_style` (`anime`/`long`/`swept`/`ponytail`/`curly`/`short`/`spiky`), `face_style` (`anime`/`smile`), `number`, colours `skin hair face eyes top pants shoes accent trim`, `gloves`, `mitt`. `PRESETS` merge over it (`{ preset: 'hoodie' }`). `fullLook(look)` fills defaults.
- `BlockyBody.build(look, lod)` -> root with `.skeleton`, `.body`, `.face` (anime face mesh or null).
- `BlockyBody.applyLook(model, look)` rebuilds the mesh in place (same skeleton) and re-attaches the face. `Batter.setLook(changes)` wraps it.
- The Moon's pitcher is `{ preset: 'alien' }`: green skin, `hair_style: 'antennae'` (two
  hair strands with bulbs), `look.alien` (face.js `paintAlienEye`: big dark eyes, no
  brows), a silver uniform and `headwear: 'bowl'` (a collar on the body; the glass bowl
  itself is a separate see-through mesh the pitcher adds, `pitcher_mock.js`
  `setLook( look, own )`). Same skeleton and windup as every other body. The crowd's
  aliens are `stadium_art.js` `crowdArt( true )`; the fielders keep their Earth looks.
- Adding a look option: add the key + a default to `DEFAULT_LOOK` (document it in the comment block), branch on `this.look.<key>` in the builder, and set fielders' `LOOK` explicitly if their look should not change.

## Hair (`_animeHair(hw, top, hat)`)

Brown by default (`look.hair`); shades `HAIR_ROOT` (dark) to `HAIR_LIGHT`. Under a helmet/cap: a fringe of overlapping strands from under the brim to the eyes, temple strands, flicks out from under the shell over the ears (behind the ear flap on +X), two layers fanning down the back of the neck, and dark base boxes so no skin shows between strands. Bare-headed: crown strands, side flares and a back fall. Keep strands clear of the helmet's outer shell (they should emerge from under it, not through it) and above the collar (y > ~0.72) so head turns don't push them into the back.

Variants of `_animeHair` (`style`): `long` (parted fringe, locks to the shoulders), `swept` (fringe combed to +X, cropped back), `ponytail` (parted, short sides, a tail with a band out of the back of the cap); `_curlyHair` is round puffs over a mass.

## Face and expressions (face.js)

- The atlas is `COLS x ROWS` = 4 x 2 cells of 256 px; cell layout constants `EYE_X`, `EYE_Y`, `EYE_W`, `BROW_Y`, `MOUTH_Y` (pixels; the patch spans head-front x, y in +/-`FACE_HALF` = 0.09). The eyes sit just under the helmet brim; brows mostly hide under the fringe.
- Expressions are data in `LOOKS` (lid heights `top`/`bot`, `slant` of the inner corner, `iris` radius, `dy`; `closed: 'line' | 'happy' | 'squeeze'`; `brow: [outer, inner]`; `mouth: frown | flat | smirk | wavy | o | open | grit`; `blush`). Add one by adding a `LOOKS` entry **and** its name to `EXPRESSIONS` (the atlas has 8 cells; grow `ROWS` past 8).
- Figures painted alike (same `eyes`, `brow` or `hair`, `face`) share one atlas image: each face gets a clone of the texture (its own offset, the same upload).
- Switching is a texture offset (`face.userData.setExpression(name)`), no redraw. The material is `lit({ map, transparent })` with `depthWrite: false` and polygon offset; the patch is lifted 1.4 mm off the head.
- `Batter`: `batter.mood` = resting expression (the game sets `'focus'` during windup/pitch and Focus/Flow, else `'neutral'`); `batter.emote(name, secs)` overrides for a while (game: `effort` on swing, `annoyed` on miss/foul, `grin` on a hit, `happy` on a home run, `shock` past a mile). Blinks every 2.2-5.2 s on open-eyed expressions. `BlockyBody.setExpression(model, name)` is the low-level call.

## Animation (BatterRig + SwingClips)

- Clips are channel values, not bone rotations: `hx hy hz hipYaw hipLean hipSide shoulders chestLean chestSide headYaw headPitch headSide gx gy gz heading elev elLx.. elRz rollL rollR spin fLx fLz fRx fRz f?yaw f?heel f?lift` (see the header of `batter_rig.js` for meanings and signs).
- The **bat** is placed from `gx gy gz heading elev` in character space, independent of body proportions; the hands reach it by IK (`gripError` reports any miss), the feet are planted by leg IK. So reshaping the body rarely changes the swing, but check.
- `Batter` events: `contact_frame` (the barrel at the contact point; the game answers with `reportHit(bool)`), `swing_finished`, `back_in_stance`. `batter.contactPoint` (character space) is measured from the swing clip at construction and drives pitch timing.
- Clip flow: `idle -> load -> swing -> after_hit -> admire -> reset_hit -> idle`, or `swing -> after_miss -> relaxed -> reset -> idle`.

## Checking a change

```sh
node tools/serve.mjs 8080 &          # then:
node tests/shot.mjs "lab/batter.html?view=hero&spec=idle:0,swing:0.167,after_hit:0.4&cols=3" /tmp/b.png 1500 1200 600
# face close-up, every expression (third spec field = expression):
node tests/shot.mjs "lab/batter.html?cam=0.75,0.8,0.2&lookat=0,0.78,0.02&fov=24&spec=idle:0:neutral,idle:0:blink,idle:0:focus,idle:0:happy,idle:0:grin,idle:0:shock,idle:0:annoyed,idle:0:effort&cols=4" /tmp/e.png 1500 1600 800
node tests/play.mjs PITCHES=40       # the bot plays; worst ball-to-sweet-spot should stay ~10-11
```

- Compare `window.__dump` on `lab/batter.html` before/after (per clip time: bat position/direction, `err` = grip errors, `cl` = clearances; `contact`). A body change should keep grip errors under ~0.01 and the bat path within a cm or two.
- Look at the batter from the game camera too (`node tests/shot.mjs index.html out.png 6000 844 390 --mobile`): it is seen mostly from behind, so the back of the helmet/hair matters most.
- The fielders (lod 1) are built from the same code: check `lab/batter.html?fielders=1` or the game view after changing shared geometry.
- Budget: the batter is ~8-9k vertices in one draw call plus the face patch; keep new detail at lod 0 only (`this._lod > 0` skips it).

## Outlines, gloves, logos (src/batter/outline.js)

Every figure has a soft dark outline (inverted hull: `outline(mesh, { width, child })` adds a
back-faced copy pushed out along the normals before skinning / instancing; batter body 0.009,
bat 0.006, pitcher 0.009, fielders 0.02 (instanced: the copy shares `instanceMatrix`; the
catching figure's is a child)). `BlockyBody.applyLook` keeps the outline's geometry in step.
Looks: `gloves` (white batting gloves with an accent wrist strap by default; fielders null),
`logo` (a block letter on the helmet / cap front via `_number`'s `_LETTERS`: 'H' home, 'P'
the visitors).

Lighting (src/core/stage.js): the ambient is split into a flat part and a sky / ground
hemisphere (`setAmbient` keeps the split; `stage.ambientBase` is the colour as set).

## The swing smear (src/batter/swing_trail.js)

`batter.trail` (`SwingTrail`): a soft white ribbon swept out by the outer half of the bat,
shown whenever the bat turns faster than ~7 rad/s (the swing, the spin after a miss; never
the waggle), fading over 0.13 s. `Batter.advance` feeds it the bat's position and rotation
after the pose is applied; samples are filled in along the arc between frames. Purely
visual: the clips, the bat path and `contactPoint` are untouched.

## The bat (src/batter/bat_mesh.js) and keeping it out of the body

- A turned wooden bat: `rings()` (knob, a smooth body curve, a cupped end) lathed with uv
  (round, along); finishes painted on a 256 x 1024 canvas per bat in `STYLES` (`wood()`,
  `band()`, `fade()`, `tape()`, `brand()`): ash (default), maple, birch, hickory, cherry,
  gold, cosmic, and the fantasy / far-future rack (frost, dragon, neon, magma, photon) - the twelve bats of run/profile.js (`BAT_ORDER`, cheapest first; a new bat = a `STYLES` painter + a `BATS` entry). `build(id)`, `restyle(bat, id)`
  (`batter.setBat(id)`), `batImage(id, w, h)` (the menu's side-on picture). `PROFILE` /
  `radiusAt` (the rig's collider outline) are unchanged. Preview: `lab/bats.html`,
  `lab/batter.html?bat=maple`. The game tints the same material (Heavy Lumber, Flow's glow).
- **`guard` channel** (0..1, batter_rig.js): how much the bat and the elbows keep clear of
  the figure's bulk beyond the slim colliders - capsules down the torso's sides
  (`torso_side`), a ball at each shoulder (`shoulder_r`), and the arms themselves
  (`arm_r`: `_clearElbow` swings an elbow round the shoulder-wrist line, the hand staying on
  the handle). 0 in the stance and the swing (their keyed path is exact: check with a
  before / after dump), ramping to 1 from the extension into the finish, and 1 through the
  follow-throughs.
- **after_miss**: the spin carries the batter a full turn on the front foot with the bat
  still wrapped over the left shoulder as the swing finished (`wrapped`), then stands it up
  in front of the chest and lowers it. Do not route the bat behind the neck: the blocky
  arms cannot reach round it without the bat passing through them.
- **Measuring it**: `window.__dump.frames[item].through` on lab/batter.html =
  `{ inside, at, rays, part }`: rays up the bat's surface against the posed body mesh (how
  much of the bat is inside, and which bone's part). Everything but a hair strand grazing
  (< 0.015, part Head) should read 0 outside the swing's downswing. `track=1` keeps the
  spinning figure in its cell.

## Bats with shapes of their own (bat_mesh.js SHAPES, MODS)

- Every bat but the ash starter adds parts to the turned shape: `SHAPES.<id>( p )` builds
  them from `Parts` primitives (`rod`, `tube`, `spike`, `crystal`, `ball`, `torus`, `fin`;
  flat-shaded, a colour per corner, a fourth colour number over 1 = glow). They are merged
  into the bat's one geometry (still one draw call, and one for its outline) and mapped to a
  white swatch under the finish (`SWATCH` rows of the canvas), so vertex colours show as
  they are. `MODS.<id>` reshapes the turned body itself (the club, the blade's slim core).
- `restyle()` swaps the geometry too (cached per bat). `PROFILE` / `radiusAt` (the rig's
  colliders, the timing) are the same for every bat: keep parts within about 0.085 of the
  axis and clear of the hands (y 0.03 to 0.36).
- `batImage()` draws the parts too (projected from the brand's side, behind / in front of
  the turned shape); a bat that reaches past 0.80 is drawn a little smaller, all of it.
  Check with `lab/bats.html` and the BATS page.
