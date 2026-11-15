---
name: hrh-project
description: Project map and conventions for Home Run Superstars (this repo) - directory layout, what each module does, coordinates, colour/material rules, events, quality tiers and the frame-rate guard, the performance budget, npm scripts, the dist/ build and Cloudflare deploy, git workflow. Read first in any session here; it supersedes the paths in the threejs-* skills (written for "Home Run Ascension", src/chars/, src/game/), which do not exist in this repo.
---

# Home Run Superstars: project map

Arcade baseball roguelike in plain ES modules + three.js r187 (`vendor/three/`, VERSION
0.187.0). No framework, no bundler in dev; esbuild bundles the release into `dist/`.
Live: https://home-run-hero.pages.dev (Cloudflare Pages serves `dist/` from `main`).
Ported from Godot 4 (history up to commit 5824900). **PORTING.md** holds the full
Godot -> three.js conventions (transforms, winding, shaders, instancing, particles, names):
read it before writing new geometry or shaders. README.md has the gameplay design.

## Layout

```
index.html, style.css   page shell; import map for dev ("three" -> vendor/three/three.module.js)
src/main.js             boot: tier, fonts + textures, Stage, Game; the rAF loop (advances shared.time); window.game
src/game.js             Game: pitch cycle, swing judging, flights, results, level-ups, Focus/Flow,
                        applyQuality + _guardFrameRate, test bot (autoOffset/autoFocus/autoFlow/autoPick/debugFt)
src/core/  (shared; ask before changing, add helpers in your own files)
  stage.js       renderer, scene, camera (fov 30, vertical), sun/fill/ambient, Godot Filmic tone map, shared.time
  quality.js     TIERS high/medium/low, ORDER, isMobile(), initialTier() (?quality=), lowerTier()
  materials.js   settings.tier; lit() (Standard on high, Lambert otherwise), unlit() (Basic)
  util.js        Godot-style maths (clamp, lerp, smoothstep, moveToward...), RNG, srgb/srgbArr,
                 darkened/lightened/mixc/luminance, setRotationDeg (YXZ), V3
  particles.js   Particles: CPUParticles3D knobs on one InstancedMesh
  text.js        loadFonts(), FONTS, font(), drawText (outlined Arcade.label style)
  textures.js    preloadTextures(), texture(name) for assets/tex/*.png
  models.js      preloadModels(), model(name) for assets/models/*.glb (Blender exports; null if missing)
  audio.js       Sfx: WebAudio play/playHit/roar/crowd/duckCrowd, music( 'menu' | 'game' ); one volume
                 controller (setMuted = the player, setSilent / setPaused = the host); unlock() on first gesture
  platform.js    Platform: the host (Playgama Bridge SDK, CrazyGames SDK, or the plain browser): saves, mute, pause, ad breaks
src/run/
  profile.js     Profile: what lasts between runs (coins, lumber, training, unlocked powers, bats, the look)
  tutorial.js    Tutorial: the first-time walk-through (the game, then the menu and two purchases)
  run_state.js   RunState: level/XP, count, owned upgrades, cooldowns, streak, hit model; timing
                 windows PERFECT_MS 22 / GOOD_MS 55 / FOUL_MS 85; milestones; RunState.goal
  upgrades.js    ALL: the upgrade catalogue (ACTIVE / PASSIVE / SYNERGY)
src/batter/
  blocky_body.js BlockyBody: skeleton + one skinned vertex-coloured mesh; DEFAULT_LOOK, PRESETS (uniform, hoodie)
  batter_rig.js  BatterRig: pose channels -> Mixamo-named bones, IK arms onto the bat, gripError, clearance
  swing_clips.js key poses (idle, load, swing, after_hit, after_miss, relaxed, reset, reset_hit...)
  batter.js      Batter state machine: loadSwing/swing/reportHit/advance; events contact_frame, swing_finished
  bat_mesh.js    lathed bat along +Y, knob at origin
src/world/
  dims.js        shared constants: PLATE, WALL_R, UNIT_FT, BAT_LENGTH 0.80, SWEET_SPOT 0.72, SUN, HAZE
  field.js       Field: turf, dirt, mound, chalk, bases (merged mesh) + the Stadium
  grass.js       turf shader (Lambert + onBeforeCompile)
  stadium.js     stands, crowd, flags, wall, light towers, city; board()/showStats()/cheer()/heightAt()
  stadium_board.js / stadium_geo.js   centre-field video board; mesh-merge + winding helpers
  outfield_crowd.js  instanced 3D bleacher fans (shader-animated), setDensity(), fireworks
  fielders.js    seven baked, instanced fielders that chase hits
  pitcher_mock.js    the pitcher (blocky figure, purple): startWindup/releasePoint/knockOut/setShadows
  flight.js      batted-ball flight: physics in the park, launch cinematic, milestones; events landed/milestone/impact_fx
  flight_mats.js shared ribbons/lines/instanced unlit materials for flight, hit_fx, aura
  globe_trip.js  the globe goal's sixteen lands slid past the ball (run/route.js is the route's table;
                 scenery_layout.js the lie of the land and the prop placer; biome_pieces.js the pieces made in code)
  hit_fx.js      HitFX: pitched ball, hit-stop, sparks, bat trail, camera kick
src/fx/   aura.js (Flow State aura), screen_fx.js (ScreenFX: impact frame, speed lines, focus vignette; own WebGL canvas)
src/ui/   hud.js (RunHUD, HTML/SVG on a 1280x720 layout), arcade.js (HUD kit), upgrade_icon.js (SVG emblems),
          menu_pages.js (the menu's picture tiles and pages: training, powers, bats, locker room),
          coach.js (the tutorial's arrow, ring and bubble)
assets/   fonts/ (SIL OFL), sfx/ and music/ (MP3 only: Playgama takes no WAV; music is CC0, see music/CREDITS.txt), tex/ (Godot-baked PNGs), models/ (Blender .glb)
vendor/three/   three.module.js, three.core.js, addons/ (don't edit)
lab/      test pages (see hrh-testing)      tests/   Playwright scripts (see hrh-testing)
tools/    build.mjs, check_dist.mjs, link-three.mjs, serve.mjs; blender/ (asset scripts, see below)
dist/     the built site (committed; Cloudflare serves it)
```

Game states (`game.state`): `ready -> windup -> pitch -> flight -> result -> (upgrade) -> ready`,
ending in `over` or `won`. URL options: `?quality=low|medium|high`, `?goal=space`, `?fps`.

## Space and units

+Y up, right-handed, same as Godot. Batter at the origin facing +Z; the plate at
`PLATE = (0, 0, 0.42)`; pitcher and centre field along +X (pitcher at (10.35, 0.04, 0.42),
facing -X); first base +Z. 1 unit ~ 6.3 ft (`UNIT_FT = 330 / WALL_R`, `WALL_R = 52.5`);
the batter is ~0.98 units tall. Godot `rotation_degrees` is Euler **YXZ**: use
`setRotationDeg(obj, x, y, z)`. `Object3D.lookAt` points **+Z** at the target (cameras -Z).
Godot winding is clockwise: hand-built meshes must flip (stadium_geo.js orients by normal).

## Colour and materials

- Colours in code are Godot-style **sRGB float triples** `[r, g, b]`. `srgb(r,g,b)` -> THREE.Color;
  `lit({ color: [...] })` / `unlit({...})` convert for you.
- **Vertex colour arrays must be linear**: fill them with `srgbArr(r, g, b)`.
- Colour maths on sRGB arrays: `darkened / lightened / mixc / luminance` (util.js), convert last.
- `lit()` = MeshStandardMaterial on `high`, MeshLambertMaterial on `medium`/`low` (`settings.tier`
  is set once at boot, before anything is built). `unlit()` = MeshBasicMaterial.
- Tone mapping: stage.js patches `CustomToneMapping` with Godot's Filmic curve. Custom
  ShaderMaterials end with `#include <tonemapping_fragment>` + `#include <colorspace_fragment>`.
- Light intensities are Godot energies x `LIGHT_SCALE` (PI). Don't add lights; stage.js owns them.
- Animated shaders read `uniforms: { time: shared.time }` (core/stage.js); main.js advances it.
- Canvas textures: `colorSpace = SRGBColorSpace`, `needsUpdate` only when content changes.

## Events

Godot signals -> `THREE.EventDispatcher` (classes extend Object3D or EventDispatcher):
`this.dispatchEvent({ type: 'snake_case_name', ...args })`, `obj.addEventListener(name, fn)`.
Examples: Batter `contact_frame`, `swing_finished`; Flight `landed {distanceFt}`,
`milestone {title}`, `impact_fx {kind, strength}`; RunHUD `swing`, `focus`, `flow`,
`card_chosen {index}`, `restart`, `keep_going` (RunHUD hand-rolls the same API, not a
subclass). Keys (Space/Enter, Q, E, 1-3, F) come from the HUD.
Per-frame work is an explicit `update(dt)` / `advance(dt)` the game calls; no hidden loops.

## Quality tiers and the frame-rate guard

`src/core/quality.js`: `high` (desktop: renderH 1080, MSAA, sun shadows, fans 1.0, Standard),
`medium` (phones: 720, MSAA, blob shadows, 0.7, Lambert), `low` (540, no MSAA, 0.4).
`initialTier()` = `?quality=` or `isMobile() ? 'medium' : 'high'`. `Game.applyQuality(tier)`
sets render height, shadows (blob shadows when off), crowd density. MSAA is fixed at load.
`Game._guardFrameRate` (every 1.5 s): below 48 fps lower renderH in 90 px steps to 75% of the
tier's, then drop a tier, then down to 400 px; at >= 57 fps for ~12 s, raise 45 px back up.

## Performance budget

- **40+ fps on phones is a hard requirement.**
- One draw call per figure (the batter is one skinned mesh; fielders one InstancedMesh);
  merge static geometry, instance repeats, keep the Godot vertex counts.
- No per-frame allocation in hot loops: reuse module-level Vector3/Matrix4 scratch objects.
- No per-frame canvas redraws or DOM writes unless content changed.
- Only batter, bat and pitcher cast shadows (high tier). `?fps` / F shows fps, tier, render height.

## npm scripts

```bash
npm install          # esbuild + postinstall: tools/link-three.mjs links node_modules/three -> vendor/three
npm start            # node tools/serve.mjs 8080  -> http://localhost:8080 (modules from src/)
npm run dist         # node tools/build.mjs [outDir]: esbuild src/main.js -> dist/game.js + page + assets
npm run playgama     # node tools/build.mjs --playgama: build/playgama/ + build/home-run-superstars-playgama.zip
                     # (the Bridge SDK first in <head>, boot.js starts the game after bridge.initialize(),
                     # playgama-bridge-config.json, no localStorage in the bundle; build/ is not committed)
npm run crazygames   # node tools/build.mjs --crazygames: build/crazygames/ + build/home-run-superstars-crazygames.zip
                     # (their SDK v3 first in <head>; Platform initializes it while the game loads)
npm run build        # node tools/check_dist.mjs: what Cloudflare runs; dist/index.html + game.js exist, files < 25 MiB
npm test             # node tests/play.mjs: bot plays 80 pitches (globe goal)
npm run shot -- "index.html?quality=medium" out.png   # node tests/shot.mjs
```

## Build and deploy

- `tools/build.mjs` strips the `<!-- dev: ... -->` import map from index.html, points the
  script at `./game.js`, copies style.css and assets/ into dist/.
- Cloudflare Pages builds `main` with `npm run build`, which does **not** build: it only checks
  the committed dist/. So **run `npm run dist` and commit dist/ with any gameplay, visual,
  asset or page change**, or the live site won't change (or will be stale against src/).
- Check the bundle locally: `npm start`, then open http://localhost:8080/dist/.

## Git workflow

- `main` is what deploys. Work on a feature branch (`claude/...`), push it, open a PR to main.
- Commit src/ changes and the rebuilt dist/ together; don't hand-edit dist/.
- Don't edit vendor/three/. `node_modules/` is ignored (`.gitignore`).
- Run the hrh-testing checklist before committing.

## Blender assets (tools/blender/)

Assets are made by Python scripts with Blender's data API (bpy), never by hand, so they can
be regenerated: `tools/blender/city_kit.py` builds the city kit and writes
`assets/models/city.glb` (read by `src/world/city.js`); `tools/blender/stadium_kit.py`
writes `assets/models/stadium.glb` (in GAME units, not metres): the outfield wall segment
`W_wall` (stadium.js `_buildWallModel` bends 48 copies round the arc), the bleacher fan
`F_fan` (outfield_crowd.js `fanGeometry`; uv = part, paint), the video board's structure
`S_board` (stadium_board.js) and the field pieces `X_plate`, `X_base`, `X_rubber`,
`X_mound` (field.js). `part(model, object, { blenderV })` in src/core/models.js returns one
object's geometry (glTF stores v flipped; `blenderV` restores Blender's v, which these
assets use as data). Each user falls back to its old procedural geometry if the model is
missing. `tools/blender/biome_kit.py` writes `assets/models/biomes.glb` (the globe trip's landscapes; see hrh-world). Blender here cannot render (no EGL), so look at kits in three.js: `lab/kit.html?model=<name>`. `tools/blender/fx_kit.py` writes `assets/models/fx.glb`: `A_aura`, the Flow
aura's flame sheath (src/fx/aura.js draws it with its own additive shader; uv = round/up,
colour R = into a flame tongue, G = its phase). Read the script's header for its
conventions (one object per building `B_*` / prop `P_*`, origin at the bottom centre, front
-Y, metres; materials `M_<facade>` with tiling textures and `M_trim` with vertex colours).

- Blender here is the `bpy` module (download.blender.org is blocked by the network policy;
  PyPI is not): `python3 -m venv /opt/bpyenv && /opt/bpyenv/bin/pip install bpy==5.2.3 numpy`
  (Python 3.13), then `/opt/bpyenv/bin/python tools/blender/city_kit.py [--blend out.blend]`.
- QA before committing an asset: the blender-asset-qa skill's `qa_check.run()` from that
  Python (open the `--blend` first). Report tris / sizes; look at it in the game
  (`lab/world_view.html`).
- glTF loading: `vendor/three/addons/loaders/GLTFLoader.js` (+ `utils/SkeletonUtils.js`),
  copied from the three@0.187.0 npm package (the vendored three is r187). No meshopt /
  Draco: keep exports plain (WebP images are fine).
- New model: add its name to `NAMES` in src/core/models.js, preload in any lab page that
  needs it (`preloadModels( '../assets/models/' )`), and fall back gracefully when
  `model(name)` is null.

## Mobile input

style.css puts `touch-action: none` on `html, body, body *` (it is not inherited) and
src/main.js `noZoom()` cancels iOS gesture events, multi-touch starts and a quick second
tap off the buttons, so double taps and pinches never zoom the page. Buttons fire on
pointerdown / click (src/ui/arcade.js), which these leave alone. Nothing on the page scrolls;
if a scrolling panel is ever added, give it `touch-action: pan-y`.

## Loading: what the first frame waits for, and what it does not

- **Before the first frame** (main.js `boot`): the three fonts, six small textures, the
  `city`, `stadium` and `fx` models (the WebGL context is made while they download), then
  `new Game` (the ballpark, the cast, the HUD). The loading screen goes when the first frame
  has been drawn.
- **Shaders** (the biggest single cost on a phone): only what is visible is compiled before
  the first frame, in batches the GPU works on while the game is still being built
  (`Game._compileVisible`: after the park, after the cast, at the end; a batch, never one
  at a time as a first render would). Everything else (hidden: the flights, effects, cards)
  is compiled a few frames later (`Game._warmRest`). When the title menu is the first
  screen, the 3D view is held (`stage.held`: only the sky's colour) behind it until
  `renderer.compileAsync` says the visible programs are ready, so the title shows as soon
  as the game is built; a new player's tutorial is drawn whole from the first frame.
- **The screen effects overlay** (fx/screen_fx.js) makes its own WebGL context and shader
  only when first drawn (about a second after load, invisibly, to warm it). Frame times are
  never negative (main.js: the first rAF timestamp can be older than `performance.now()`);
  a negative one once ran the overlay's fades backwards and drew it at load (~1 s).
- **In the background** (nothing waits): the sounds (`Sfx.init`, started in the Game
  constructor; `play()` is silent until a buffer is in), the `biomes` model (`whenModel`),
  the Earth / Moon / Planet textures (`texture()` hands out the object at once).
- **In idle frames** (`Game._prep`, one piece a frame while in the menu or waiting for READY /
  a card): the part of the city the stands hide (8 wedges), then the current goal's long-hit
  world (`flight.prepare()`: the globe's ten bands of props, or the space climb's city strip)
  and its shaders (`flight.compileShaders`). `game._prepGoal === RunState.goal` when done. A
  long hit that comes first makes the flight finish the job itself (`prepare( true )`, a
  hitch once). Frames that built something are not counted by the frame-rate guard. Tests
  that measure draw calls or switch cameras should wait for `_prepGoal`.
- **The city from the field** (`City.build({ lazy })`, city.js `seenFromField`): the blocks
  whose roofs show over the stands are one set of wedges; the rest (most of it, plus the
  street ground and the plaza) is under `CityLow`, hidden while `Game.viewFromField(cam)` is
  true (camera low, between the foul lines, inside the wall): 42k fewer triangles and 6 fewer
  draw calls in the batting view on phones, pixel-identical (checked over a grid of on-field
  cameras). If the stands or the cameras change, re-check that.
- **The release** (`tools/build.mjs`): every asset URL carries `?v=<hash of assets + src>`
  (`core/assets.js` `asset(url)`; use it for any new fetch), `dist/_headers` caches
  `/assets/*`, `game.js` and `style.css` for a year (immutable) and the page not at all;
  the models are also written gzipped (`*.glb.gz`, a fifth of the size: Cloudflare does not
  compress .glb) and `core/models.js` inflates them with `DecompressionStream` (falling back
  to the plain file); `index.html` preloads the boot models and fonts and modulepreloads
  `game.js`. Long non-timing sounds are MP3; the bat cracks and UI ticks stay WAV.
- Numbers (throttled 4G + 4x slower CPU in headless Chromium): playable in 4.3 s (was 6.4),
  677 KB fetched by then (was 2,072 KB; 1,162 KB in all).
- **Measuring**: `node tests/load_time.mjs [RUNS=8] [pages=old/index.html,dist/index.html]`
  serves the build compressed as Cloudflare does, throttles to a 4G phone (9 Mbit/s, 70 ms)
  and a 4x slower CPU, a new browser per run (no cached shaders); it reports when the screen
  was up, when the park was drawn, the bytes, and each boot phase (`window.__boot` marks).
  The software GPU here makes single runs noisy (seconds apart): compare medians of 8 runs,
  interleaved, against the previous build (`git worktree` + `node tools/build.mjs`, copied
  to `old/`, which is git-ignored locally).

## Shipping on Playgama

The game is published on Playgama as **Home Run Superstars** (the title shown in the game
must match the submitted one). `npm run playgama` makes the zip to upload (`index.html`
at its root). Rules that shape the code (https://wiki.playgama.com/playgama/game-requirements,
pages readable with `curl -L <url>.md`):

- SDK first in `<head>`, `bridge.initialize()` done before the game loads anything;
  `game_ready` when the first playable frame is up.
- Saves only through `bridge.storage` (one read at boot, batched writes): the Playgama
  bundle must contain no `localStorage` / `sessionStorage` / `indexedDB` (grep it).
- Interstitials only at pauses in play. (The owner has the game ask for one every 240 s of
  play, at the next pause, and offer two rewarded ads: see hrh-gameplay; Playgama's docs would leave the timing to the Bridge.)
- The platform's mute / pause / a hidden page / an ad silence and stop the game.
- Background music is required; audio ships as MP3 / OGG, never WAV.
- No Escape key, no long-press selection or context menu, layout must work in a square
  window, no external requests (the SDK's CDN aside), no external links.
- `node tests/playgama.mjs` checks all of the above against a stand-in SDK
  (`BRIDGE_JS=<path to the npm package's dist/playgama-bridge.js>` adds a real-SDK pass).

## One goal in every release

Every built package (`HRH_PACKED`: the site's `dist/`, Playgama, CrazyGames) has only the
round-the-world goal: `ONE_GOAL` in `run/run_state.js` forces `prefs.goal = 'globe'`, hides
the menu's GOAL button and ignores `?goal=space`. The owner removed the "destroy a planet"
mode from play; its code is still there and the dev pages (unbundled `src/`) still take
`?goal=space`, which is what `tests/play.mjs GOAL=space` and the monkey test use.

## Shipping on CrazyGames

`npm run crazygames` makes the zip (`index.html` at its root, 48 files, under 4 MB: their
limits are 1500 files / 50 MB initial download, 20 MB for the mobile home page). Their
docs are at https://docs.crazygames.com/ (requirements/*, sdk/*; the host must be allowed
in the session's network settings). `Platform.host === 'crazygames'` (`game._crazy`) is
what switches the game to their rules, which differ from Playgama's:

- SDK v3 script in `<head>`; `await CrazyGames.SDK.init()` (in `Platform._initCrazy`, while
  the game loads). `SDK.environment` is 'crazygames' on their site, 'local' on localhost
  (fake ads), 'disabled' anywhere else (every call throws: the game runs stand-alone).
- `game.loadingStart()` / `loadingStop()` around the load; `gameplayStart()` whenever play
  begins or resumes and `gameplayStop()` at every break (menu, level-up cards, end screen,
  an ad): `Platform.gameplay( bool )`, called every frame from `Game.frame`. Their first
  gameplayStart is what they time the "initial download" to. Not sent for a hidden tab.
- Saves in their data module (`SDK.data.getItem / setItem`, the account's or the guest's
  browser), nowhere else; if the module is off (the submission did not tick "Progress
  Save: data module") it throws and the game keeps its save in localStorage instead.
- `SDK.game.settings.muteAudio` (+ its change listener) silences the game and wins over
  the game's own sound setting.
- Device from `SDK.user.systemInfo.device.type` (never from touch detection):
  `initialTier( Platform )`.
- Midgame ads (`SDK.ad.requestAd( 'midgame', ... )`) only where a level or a run ends:
  after a level-up pick, on the end screen (or with NEW RUN when the end screen offered
  the rewarded second chance: never both at one break). Never between two pitches, never
  on a menu button, never in the tutorial, and not before `AD_EVERY_CRAZY` = 180 s of
  play since the last ad (their SDK allows one every 3 minutes and refuses the rest).
- The game holds from the request (a spinner, `#wait`, if it takes a moment) but goes
  silent only on `adStarted`; `adError` (unfilled, adblock, adCooldown, adsDisabled) just
  lets the game go on.
- Rewarded ads: the button may not sit on the playing screen, so **3X COINS** is offered
  on the level-up cards (`hud.setBoost( 'cards' )`, same corner); **2ND CHANCE** on the end
  screen, not at the end of two runs in a row, with the same reward for `CHANCE_COINS` = 50
  coins beside it (they ask for a way without an ad) and every button there the same size
  and colour. `adError` never pays: a notice says no ad was available. Once the SDK says
  ads are off for the session (`adsDisabled`: their Basic Launch; or an ad blocker) the
  rewarded buttons are not shown again (`Platform.rewardedOff`).
- No full-screen button of the game's own, no Escape, no links out, `user-select: none`,
  the wheel / arrow keys / Space never scroll the page, the HUD inside
  `--safe-area-inset-*` (their app sets them).
- `happytime()` and `reportGameCompletedPercentage( 100 )` when a run's goal is reached.
- `node tests/crazygames.mjs` checks all of this against a stand-in SDK
  (`CRAZY_SDK_JS=<a copy of crazygames-sdk-v3.js>` adds a pass with the real SDK's local mode).
- In the submission form: Progress Save = data module; orientation = landscape.

## Starting graphics tier

`core/quality.js` `initialTier()` -> `tierFor( { mobile, ua, memory, cores, renderer } )`: low
for a software renderer or 2 GB / 2 cores or less; medium for phones, tablets, Chromebooks
(`CrOS` in the user agent) and anything with 4 GB or less (four cores or fewer where memory is
not reported); high otherwise. `?quality=` still forces one, and the frame-rate guard
corrects it while playing. Headless test browsers have no GPU, so tests start on low unless
they pass `?quality=`.

## Landscape only on phones and tablets

The game plays in landscape. `src/main.js` `portraitGuard()` shows `#rotate` (index.html,
style.css: "TURN YOUR PHONE", with a hint about the rotation lock) on a phone or tablet held
upright (the host's device type, else a touch-only pointer) and holds the game behind it with
`Platform.setPortrait( true )`: paused and silent like a hidden tab, and no gameplay for
CrazyGames. A desktop window of any shape is left alone. iOS Safari reports the new size a
moment after its rotation events, so the stage (`Stage.resize`, which measures the canvas)
and the HUD measure again as it settles (`orientationchange`, `visualViewport`, a
ResizeObserver). A web page cannot lock or force the orientation on iOS: if the phone's
rotation lock is on the player has to turn it off, which the screen says.
`node tests/orientation.mjs` checks it.

## Arenas (Earth, the Moon)

- An arena is a park + a pitcher + a route. `src/run/route.js` holds one table per arena
  (`ROUTES.earth`, `ROUTES.moon`; `ARENAS` is the unlock order) and everything else derives
  from the arena in play: `RunState.arena` (static, set by `Game.newRun` from
  `prefs.arena`), `RunState.milestoneList()` / `winFt()`, `routeSegments( arena )`,
  `ROUTE_CALLOUTS`, the simulation's stops. Earth's table must not change by accident: the
  Earth numbers in `tests/progression.mjs` are the regression check.
- One landscape track holds every arena's lands in a row (`ROUTE_LANDS`: Earth's 16, then
  the Moon's 9); an arena's trip runs over its own stretch (`landRange( arena )`,
  `GlobeTrip.setArena`, `scenery_layout.js` `setStretch`). Land ids are unique across arenas.
- Moon files: `src/world/moon_park.js` (what turns the park into Tranquility Field: kit,
  crater surround, regolith skirt), `moon_pieces.js` (every Moon prop, built in code),
  `moon_sky.js` (stars and the Earth, centred on the camera). The park itself is themed by
  uniforms and visibility, never rebuilt: `Game._setParkLook( 'earth' | 'moon' )`.
- `tools/arena_previews.mjs` renders the menu's arena pictures (`assets/tex/arena_<id>.jpg`,
  480x208, about 30 KB each) from the parks themselves.
- Saves: `profile.arenas` (unlocked), `prefs.arena` (last played), `arenaPowers` (each later
  arena's own power unlocks; `powers` stays Earth's), `tutorial.moon`. A save without them
  loads as Earth only. `?arena=moon` forces the arena for a session (tests, screenshots).
- Budget: the Moon batting view is held to the Earth park's draw calls and triangles on
  every tier (65 / 65 / 70 draw calls at 844x390; fewer triangles than Earth's 127k / 184k /
  297k), and the Earth-shot flight peaks where Earth's winning flight does (the homecoming
  over the Earth park draws the same list as Earth's own return). The crater surround and
  the park kit are one merged mesh each, drawn whole: adding to them means taking something
  out. Re-measure with `renderer.info` (`autoReset = false`, reset per frame) after changes.
