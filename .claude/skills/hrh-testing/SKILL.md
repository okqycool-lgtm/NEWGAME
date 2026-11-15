---
name: hrh-testing
description: How to test Home Run Superstars headlessly - Playwright (global install) with SwiftShader WebGL, tests/shot.mjs screenshots (desktop and the 844x390 phone), the tests/play.mjs bot run, frame-dump scripts, the lab/ pages (lab/batter.html params and window.__dump), tools/serve.mjs, and the before-you-commit checklist. Use before committing any gameplay, visual or HUD change; it supersedes the threejs-testing skill (window.hra, src/game/) for this repo.
---

# Testing Home Run Superstars headlessly

## The setup

- **Playwright is not a project dependency.** Every script loads the machine's global install:
  ```js
  import { createRequire } from 'node:module';
  const { chromium, devices } = createRequire( import.meta.url )( 'playwright' );
  ```
  (resolves via `NODE_PATH`; browsers live in `PLAYWRIGHT_BROWSERS_PATH`). Don't add playwright to package.json.
- **WebGL = SwiftShader** (software, slow but exact). Launch flags used by every script:
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`
  (shot.mjs adds `--autoplay-policy=no-user-gesture-required`).
- **Server:** each script spawns `node tools/serve.mjs <random port>` itself (8800-8999) and
  kills it at the end. For manual runs: `npm start` -> http://localhost:8080 (port arg or `PORT`).
  It serves the repo root, so `/index.html`, `/lab/x.html` and the built `/dist/` all work.
- `window.game` (set in src/main.js) is the Game; tests drive it directly. Bot knobs on it:
  `autoOffset` (s, NaN = off), `autoFocus`, `autoFlow`, `autoPick`, `debugFt` (force distance).
  Step manually with `game.step(1/60)` after replacing `game.frame` with a no-op.

## tests/shot.mjs: screenshot any page

```bash
node tests/shot.mjs <path?query> <out.png> [waitMs=4000] [width=1280] [height=720] [--mobile]
node tests/shot.mjs "index.html?quality=medium" /tmp/desk.png
node tests/shot.mjs "index.html" /tmp/phone.png 6000 844 390 --mobile     # the phone check
```
- Waits for `window.__ready !== false` (lab pages set it; index.html never does), then waitMs.
- Prints console errors **and warnings** and page errors, or `no console errors`.
- `--mobile` = Playwright's `iPhone 13` device with the given viewport: touch, mobile UA
  (so `initialTier()` picks `medium`), deviceScaleFactor 3 -> an 844x390 shot is a 2532x1170 PNG.
  Look at it: HUD fits, READY/SWING button reachable, nothing clipped by the notch area.
- Takes ~20 s for the full game.

## tests/play.mjs: the bot plays a run (`npm test`)

```bash
node tests/play.mjs [PITCHES=80] [OFFSET=0] [GOAL=globe|space]
node tests/play.mjs PITCHES=8                  # quick smoke run (~7 s)
node tests/play.mjs OFFSET=0.03 GOAL=space     # late swings, height goal
```
- Loads `index.html?quality=low`, turns off the page loop, sets `autoOffset=OFFSET`,
  `autoFocus`, `autoFlow`, `autoPick`, and calls `game.step(1/60)` as fast as it can.
- `OFFSET` = seconds the barrel arrives after the ball (0 = perfect, negative = early).
  Windows: perfect 22 ms, hit 55 ms, foul 85 ms (run_state.js).
- Logs one line per pitch: `#n LV kind distanceFt count strikes-outs owned {...}`, then
  `END: over|won ...` or `END: (pitch limit)`, game time, flight time.
- **"worst ball-to-sweet-spot at contact"**: on each non-miss `contact_frame`, the distance
  from the pitched ball (`game.fx._ball`) to the bat's sweet spot (bat origin + bat +Y x
  `BAT_LENGTH 0.8 x SWEET_SPOT 0.72`); the max is printed. It's in character units x 100,
  labelled "cm" (1 unit ~ 1.9 m, so not real cm). It checks the swing animation and the pitch
  stay in sync: a jump after a batter/clip/pitch change means the ball no longer meets the
  barrel. ~10 is the current baseline at OFFSET=0.
- Prints `errors:` if the page logged any. It never exits non-zero: read the output.

## Frame dumps

```bash
node tests/hit_frames.mjs <outDir> [FT=420] [EVERY=10] [START=60] [FRAMES=600] [GOAL=globe] [Q=medium] [W=960] [H=540]
```
One perfect auto-swing with forced distance `FT`, the real game stepped at 1/60 s; saves
`f_000.png`... every EVERY frames from START. Good for contact, hit-stop and launch.

```bash
node tests/flight_frames.mjs <dump.jsonl> <outdir> [every=8] [goal=globe] [w=960] [h=540] [maxFrames] [page=lab/flight_lab.html]
```
Replays a **Godot** flight dump (JSON lines, first line the launch) in lab/flight_lab.html,
writes `rows.jsonl`, `w_00000.png`..., and prints camera smoothness (worst turn/frame, worst
ball move/frame, values at mode hand-offs). No dump files are in the repo; Godot is gone.

```bash
node tests/flight_fx_aura_frames.mjs <outdir> [cam=game|close] [frames=90] [every=6] [releaseAt=-1]   # Flow aura (lab/fx_aura.html)
node tests/flight_fx_hit_frames.mjs <outdir> [result=hit|miss] [frames=90] [every=3]                 # pitch+swing (lab/fx_hit.html)
node tests/hud_shots.mjs <outDir> [width=1280] [height=720] [--mobile] [states=play,banner,banner2,flight,cards,won,lost,fx,fx_impact]
node tests/hud_events.mjs [--mobile]     # HUD input checks (ok/FAIL lines); --mobile = touch at 844x390
```

## lab/ pages

One `x.html` (+ `x.js`) per thing tested; each imports from `../src`, builds a `Stage` and
sets `window.__ready = true` once rendered (lab/README.md). New page: copy `lab/_template.html`.
Screenshot any of them with shot.mjs.

**lab/batter.html**: the batter at given clip times, tiled in a grid.
- `view=` side (default) | video | top | gloves | grip | gloves2 | legs | legs2 | hero | pitcher
- `spec=clip:t,clip:t,...` (default: idle, load, swing 0.10/0.167/0.233/0.3, after_hit, after_miss, relaxed, reset, reset_hit); `cols=` (default min(n, 6))
- `look=hoodie` (a PRESETS name in blocky_body.js; default uniform), `fielders=1`, `play=1` (live: swing every 2.5 s, alternating hit/miss)
- `cam=x,y,z&lookat=x,y,z&fov=30` overrides the view; `light=game` keeps the game's lights (default: Godot render_frames lighting); `shadows=1`
```bash
node tests/shot.mjs "lab/batter.html?view=side&spec=swing:0.10,swing:0.167,swing:0.233&cols=3" /tmp/swing.png 1000
```
`window.__dump`: `{ contact, verts, tris, frames: { 'swing:0.167': { bat, model, err: [L, R], cl, bones } } }`.
`err` = `rig.gripError` (how far each glove misses its grip; ~0 is good). `cl` = `rig.clearance`:
`bat_helmet`, `bat_torso`, `grip_helmet`, `grip_torso` (units, **negative = overlapping**),
`guard_deg`, `grip_shift`. Read it with a small Playwright script (same launch as shot.mjs):
```js
await page.goto( `http://localhost:${port}/lab/batter.html?spec=swing:0.167,swing:0.3` );
await page.waitForFunction( () => window.__ready === true );
console.log( await page.evaluate( () => window.__dump.frames ) );
```

**lab/fielding.html**: the fielders on a plain field, one followed by the camera: `who=5&seed=3&sim=1.2&run=dx,dy,dz[&catch=1][&release=1.6]&cam=x,y,z&fov=24[&live=1]` (sim = seconds simulated before the frame; `window.__lab.ms` = cost of one `advance`). **lab/cast.html**: the visitors' figures per hairstyle, front and back (`styles=`, or `seed=` for a random team). **lab/art.html**: the stadium's canvas artwork flat (`only=wallAds,ribbonArt,...`).

**lab/pitcher.html**: the pitcher at delivery / knockout times in a grid: `spec=w:0,w:0.35,w:1.1,ko:1.6&cols=4&cam=x,y,z&lookat=x,y,z&fov=30`; `window.__release` = the release point at `RELEASE_TIME`.

Other pages: `lab/world_view.html?cam=x,y,z&look=x,y,z&fov=30&t=&pitch=&ko=&cheer=1&flash=1&stats=0&freeze=1&info=1`
(park + pitcher; `info=1` draw calls/triangles), `lab/hud_states.html?state=...&sky=3d&live=1`,
`lab/flight_lab.html?ft=420&goal=globe&auto=1`, `lab/fx_aura.html?cam=game|close&auto=1`,
`lab/fx_hit.html?result=hit|miss&auto=1`.

## Before you commit

```bash
node tests/play.mjs PITCHES=20                           # no errors:, sweet-spot gap near baseline
node tests/play.mjs GOAL=space PITCHES=20                # if flights/run state changed
node tests/shot.mjs "index.html" /tmp/phone.png 6000 844 390 --mobile   # "no console errors"; look at it
node tests/shot.mjs "index.html" /tmp/desk.png                          # desktop / high tier
node tests/hud_events.mjs --mobile                       # if the HUD or input changed
node tests/orientation.mjs                               # if the page, resize or boot changed: phones upright get the turn-your-phone screen and pause; turned, the game runs at the new shape (page=dist/index.html for the build)
node tests/progression.mjs                               # if balance, prices or the route changed: pacing tables (6 s, node only)
node tests/scenery.mjs                                   # if globe trip scenery changed: 0 placement violations on all tiers
node tests/trail.mjs                                     # if flights, draw order or see-through layers changed: the ball's trail every frame (2 min; FULL=1 for the whole matrix)
node tests/play.mjs ARENA=moon PITCHES=20                # if arenas, the Moon park or its pitches changed
node tests/progression.mjs ARENA=moon                    # Moon pacing: an Earth career to its first win, then the Moon with that profile
node tests/monkey.mjs SEED=1; node tests/monkey.mjs SEED=7 ARENA=moon   # random presses incl. ARENA and NEXT STOP; ends in order, in the arena's own park
node tests/arena_tile.mjs                                # if the menu's tiles or arenas changed: the arena tile locked / opened / travelling, five tiles fit (page=dist/index.html for the build)
node tests/load_time.mjs RUNS=8                          # if the boot, assets or shaders changed: time to screen on a throttled phone (medians; see hrh-project Loading)
npm run dist && npm run build                            # rebuild dist/, check it; commit dist/ too
npm run playgama && node tests/playgama.mjs              # the Playgama package: boot order, saves, mute / pause, ad breaks
npm run crazygames && node tests/crazygames.mjs          # the CrazyGames package: SDK v3 events, saves, their ad rules
```
Also screenshot the lab page for what you changed. Then commit src/ + dist/ on a feature
branch (see hrh-project).

## The title menu

The game opens on a title menu that pauses it. Scripts that drive `window.game` load
`index.html?nomenu` (tests/play.mjs and tests/hit_frames.mjs do); `tests/shot.mjs index.html`
shows the menu, `index.html?nomenu` the game. hit_frames screenshots allow 180 s (the first
flight frame compiles shaders slowly under SwiftShader).

- `tests/play.mjs` takes `PROFILE=max|new` (default max: every power in the deck); the game
  takes `?profile=new|max` (not saved). A fresh browser context is a new profile.
- `lab/bats.html`: every bat in 3D and its menu picture. `lab/batter.html` also takes
  `bat=<id>` and `track=1`; its dump has `through` (the bat inside the body: see the
  hrh-characters skill).
- A fresh browser context now starts in the **tutorial** (the game is live, the HUD filtered): add `?tutorial=0` (or `?nomenu` / `?profile=`) to a script that wants the plain game or the title menu.

`?test` in the page URL: test mode (every purchase free, its own save; see hrh-gameplay).

`node tests/monkey.mjs [SEED=1] [STEPS=6000] [GOAL=space]`: random presses over the whole game (menus, pages, purchases, goal / graphics changes, new runs mid-flight, forced long hits); fails on any console error or if the game is not back in order afterwards. Run a couple of seeds before committing gameplay or flight changes.

`node tests/audio.mjs`: the sound across a trip to the background under iOS Safari's rules (resume only from a tap's release; the context left suspended, or "running" and silent). Run after touching core/audio.js, core/platform.js or the input bindings.

## The Moon arena in tests

- `?arena=moon` opens the Moon whatever the save says (with `?profile=max` every arena is
  open anyway). The first Moon run shows the welcome (three GOT ITs): for scripted runs
  set `game.profile.tutorial.moon = true` and call `game.moonIntro.end()` if it is up.
- `game.debugFt = RunState.winFt() * 1.0001` with `game.autoOffset = 0` plays the arena's
  winning hit; `game.debugPitch = 'warp' | 'orbit' | 'tractor'` forces the Moon pitch.
- `tests/trail.mjs` has Moon scenarios (`arena: 'moon'`: in the park, over the far side,
  adrift past the station, the whole Earth shot); `tests/scenery.mjs` checks the Moon's
  lands with Earth's.
- Draw calls: `renderer.info.autoReset = false`, `info.reset()` before each `game.frame`,
  read `info.render.calls / triangles` after; compare `?arena=moon` with Earth on each
  `?quality=` tier (batting view and the winning flight's peak).
