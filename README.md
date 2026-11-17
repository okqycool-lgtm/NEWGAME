# Cyber Heist — Glass District

A third-person parkour getaway in the browser. You've just robbed Kumo Bank and
have $50,000 in an overstuffed backpack; kick through the window and reach the
getaway vehicle with as much of it as you can. Two handcrafted jobs, picked from the
title screen: **Glass District** (neon rooftops with fan launchers, zip lines and a
wall-to-wall chain, about a minute) and **Iron Harbor**
(a rain-soaked container port across the bay, about 65 seconds).

Built with Three.js + Vite. The character, vehicles, landmark buildings, neon signs and rooftop
props are modelled in Blender (scripts in `blender/`, output in `public/assets/*.glb`, about 5.5 MB);
textures, text and sound are generated at runtime. If a model fails to load the game falls back to
its original procedural boxes. No accounts, nothing to install for players.

## Run

```bash
npm install
npm run dev      # prints a local URL and a network URL (open that on a phone / Chromebook)
```

`npm run build` writes a static site to `dist/` that can be hosted from any folder.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | A / D or ← / → | drag anywhere on screen |
| Jump, double jump, vault, wall kick-off | Space (W / ↑) | swipe up, or JUMP |
| Slide, landing roll | S / ↓ | swipe down, or SLIDE |
| Retry | R (Space / Enter on the results screen) | RETRY |
| Mute | M | ♪ |
| Graphics quality | — | GFX button (Auto / High / Med / Low) |

- **Vault:** jump when you're right at a low obstacle. Jump earlier and it's a normal jump.
- **Wall run:** jump beside the yellow billboard and steer into it; jump again on the KICK panel.
- **Roll:** tap slide just before landing from a long drop to keep your speed.
- **Perfect moves:** vault at the last moment, slide just before an overhead obstacle, or roll right at touchdown for a bigger speed burst. Perfect moves within about 6 seconds of each other chain into a combo that raises the boost further; a stumble or hard landing breaks it.
- **Fans, zip lines, kickers:** run onto a rooftop fan to be thrown up a level; run into a zip handle to ride the cable down (jump lets go early); kicker ramps launch you off the lip with no input.
- **Slopes:** slide on a downhill roof and you ride it to the bottom at extra speed, and keep that speed off the lip.
- Clip an obstacle and a $2,500 bundle flies out — chase it down to get it back.
  Falling off the route costs $5,000 and puts you back at the last checkpoint.
- A stumble also puts a robot officer on your tail for 8 seconds. Stumble again before
  he drops back and you're busted: the run ends and nothing is delivered.

## Layout

- `src/level.js` — level data for both jobs: colliders, obstacles, wall, zones, checkpoints
- `src/world2.js` — Iron Harbor visuals
- `src/player.js` — runner physics and parkour moves
- `src/runner.js` — character model and procedural animation
- `src/world.js` — Glass District visuals and shared texture/batching helpers
- `src/main.js` — game loop, camera, HUD, cash rules
- `src/gfx.js` — post-processing, rain, and the automatic quality ladder
- `src/cop.js` — the robot officer
- `src/assets.js` — loads the GLB models, one palette material per file, follows the quality level
- `src/traffic.js` — instanced cars and hover cars on the traffic lanes
- `src/fx.js`, `src/audio.js`, `src/input.js` — particles, synthesised sound, keyboard/touch

## Art pipeline (Blender)

Models are built by Python scripts, not hand-saved `.blend` files, so they can be regenerated:

```bash
uv venv -p 3.13 tools/.venv && uv pip install -p tools/.venv/bin/python bpy==5.3.0 numpy pillow
tools/.venv/bin/python blender/build_runner.py      # runner.glb (rigid parts on the game's joint pivots)
tools/.venv/bin/python blender/build_vehicles.py    # getaway_van, getaway_skiff, traffic, hovercar
tools/.venv/bin/python blender/build_city.py        # buildings, signs
tools/.venv/bin/python blender/build_props.py       # props
```

- `blender/lib.py` holds the shared helpers: primitives and lofts, bevel + weighted normals, Cycles AO
  baked to vertex colours, a palette atlas that collapses each file to one material, LODs, QA, export
  and preview renders. It drives the agent skills in `blender-skills/` (export, QA, LOD scripts).
- `tools/blender` is a stand-in for the `blender` command on machines that only have the `bpy` wheel;
  point `BLENDER_EXE` at it to run the skill scripts directly.
- Set `PREVIEW_DIR` to choose where preview renders go (default `blender/preview/`).

## Tests

With the dev server running, `npm test` plays the level headlessly with a scripted
bot (both routes, the missed rooftop jump, cash loss/recovery, falls, slope slides,
the officer chase, retry, saved bests). `tests/live.mjs` checks real keyboard and multi-touch input, and
`tests/shots.mjs` captures screenshots along the route. They need Playwright;
if it is installed globally, point `PW` at it: `PW=$(npm root -g)/playwright npm test`.
