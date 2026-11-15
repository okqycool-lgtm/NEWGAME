---
name: threejs-procedural-characters
description: Build stylized anime/arcade characters entirely in three.js code - a THREE.Skeleton rig, continuous SkinnedMesh bodies made from swept tube profiles with automatic skin weights, sculpted heads, canvas-painted anime faces, hair, caps, gloves, cleats and bats. Use when creating or editing the batter, pitcher or any character model in src/chars/.
---

# Procedural characters in three.js

The batter and pitcher are generated in `src/chars/` with no external files.
Quality bar: continuous smooth bodies (no visible ball-and-stick joints), big
expressive heads (~1/3.2 of body height), compact muscular torso, oversized
hands/cleats/helmet, strong silhouette, readable from the batting camera.

## Rig (`src/chars/rig.js`)

- Build a `THREE.Bone` hierarchy in a **T-pose rest** (arms along ±X, legs down -Y,
  character faces +Z). Names are the contract with animation clips:
  `hips, spine, chest, neck, head, shoulder.L/R, upperArm.L/R, foreArm.L/R, hand.L/R,
  thigh.L/R, shin.L/R, foot.L/R, toe.L/R` (+ `bat` / `ball` attach bones under hands).
- Bone rest positions come from a proportions object (`design.body`): leg length,
  torso length, shoulder width, head size. Changing the design re-rigs automatically.
- The hips bone lives directly under `Character.root`; call `root.updateMatrixWorld( true )`
  before `new THREE.Skeleton( list )` so bone inverses come from the rest pose, then
  `mesh.bind( skeleton, new THREE.Matrix4() )` for every body mesh (they all share it).

## Skinned tube bodies

`sweepSkinned( chain, profile, opts )` builds one continuous tube along a bone
chain (e.g. `chest → upperArm → foreArm → hand`):
- Rings every few cm along the chain polyline; ring radius from a profile function
  `r(t)` (bulging deltoid, bicep, tapered wrist) with optional elliptical
  cross-section (`rx`, `rz`) for flattened torsos and forearms.
- Skin weights per ring: weight to the segment's bone, cross-fading with the next
  bone over a blend window around each joint (smoothstep). Max 2 influences per
  vertex is plenty and keeps it cheap. `skinIndex`/`skinWeight` are `Uint16`/`Float32`
  `BufferAttribute`s of item size 4.
- Cap ends with a hemisphere so tube ends never show holes.
- Merge all body pieces that share a material with `BufferGeometryUtils.mergeGeometries`
  so each character is ~4-6 draw calls (skin, uniform, dark trim, accents, face).

## Rigid parts

Helmet, cap, bat, glove, cleats, belt buckle are rigid: plain `Mesh` parented to a
bone (`bone.add( mesh )`). Use `LatheGeometry` for round shapes (bat profile, helmet
shell, cleat toe), `ExtrudeGeometry` with bevel for brims and logos, and
`SphereGeometry` warped in a vertex loop for organic forms (hair tufts, gloves).

## Heads and faces

- Head = sphere warped per vertex: wider cheeks, tapered chin, flattened back,
  slight jaw. Do it in a vertex loop over `position` then `computeVertexNormals()`.
- Face is a **canvas texture** projected onto the front of the head (planar UVs from
  x/y of front-facing vertices) or a slightly larger decal shell. Paint large anime
  eyes (dark lash line, iris gradient, two highlight dots), brows, mouth, blush.
- Expressions: `src/chars/face.js` paints 8 faces into a 4x2 canvas atlas and swaps
  `texture.offset` (idle, focus, shout, grin, hurt, smug, blink, shock). Clips call
  `char.setFace( name )` through their `faces` track.
- Keep hair, scalp cap, helmet shell and ear flap clear of the eye band: the eyes sit at
  about -0.04 R and the brows at +0.36 R of the head radius. Check with a front close-up.
- Hair: several stretched, curved spike meshes (cones bent in a vertex loop) merged into
  one geometry; outline it like the body.

## Mirroring (left/right-handed)

Mirror a whole character with `group.scale.x = -1`; three.js flips winding
automatically for negative-determinant matrices. Avoid asymmetric text on uniforms
(we use the number 8, which reads the same mirrored).

## Checklist
- [ ] Silhouette reads at 60 px tall from the gameplay camera.
- [ ] No gaps at shoulders/hips/knees in extreme poses (test the swing finish pose).
- [ ] Outline (inverted hull) present on body, head, hair, bat.
- [ ] `castShadow` on body parts; `frustumCulled = false` on SkinnedMesh (bounds don't follow bones).
