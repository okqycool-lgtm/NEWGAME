# three.js skills for Home Run Ascension

The game runs in three.js (the `threejs-*` skills). Characters, bat, ball and the
stadium structures are built in Blender with the `blender-*` skills (copied from
the 3d-games repo, MIT, see LICENSE-blender-skills) by the scripts in `blender/`.

| Skill | Use it when |
| --- | --- |
| `threejs-core` | Starting any three.js work: vendored build, import map, renderer, loop, API lookup in the 3d-games fork. |
| `threejs-procedural-characters` | Building or changing the batter / pitcher: skinned tube bodies, heads, painted faces, equipment. |
| `threejs-animation` | Key-pose clips, pose-space blending + IK animator, gameplay-synced events. |
| `threejs-toon-rendering` | Materials, toon ramps, rim light, outlines, lights, shadows, post-processing, colour grade. |
| `threejs-procedural-environments` | Stadium, crowd, sky, canvas textures, instancing, ambient motion. |
| `threejs-game-feel` | Fixed-step physics, pitch/ball maths, contact, hit-stop, slow motion, camera director, cinematics, audio. |
| `threejs-performance-mobile` | Quality tiers, draw calls, shadows, pixel ratio, touch input, mobile layout. |
| `threejs-testing` | Headless Playwright runs, screenshots, the `window.hra` debug hooks, full-flow tests. |

The three.js source of truth is the fork at `okqycool-lgtm/3d-games`
(`src/`, `examples/jsm/`, `docs/llms-full.txt`). `tools/vendor-three.mjs`
copies the build and needed addons from it into `vendor/three/`.
