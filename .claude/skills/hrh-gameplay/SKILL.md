---
name: hrh-gameplay
description: How Home Run Superstars' gameplay code fits together - the Game state machine in src/game.js (READY / swing / Focus / Flow, pitch timing, contact, flights), the run state and upgrades in src/run/, the pitched ball, Flight cinematics and camera ownership in src/world/, screen FX, events and the HUD. Use before changing gameplay, upgrades, pitches, flights, cameras or the HUD in this repo; it supersedes threejs-game-feel's paths (src/game/, src/core/audio.js as a "camera director") for this repo.
---

# Home Run Superstars gameplay

Plain three.js r187 ES modules, ported 1:1 from Godot (see `PORTING.md`: snake_case event
types, camelCased Godot names, `update`/`advance(dt)` called by the game, no hidden loops).
`src/main.js` boots and calls `game.frame(dt)` every rAF; `window.game` is the `Game`.

## src/game.js: the `Game` state machine

`this.state`: `'ready'` -> `'windup'` -> `'pitch'` -> (`'flight'` on a hit) -> `'result'`
-> (`'upgrade'` while `run.pendingLevels > 0`) -> `'ready'`; terminal `'over'` / `'won'`.
A miss or a take goes straight from `windup`/`pitch` to `result`. `this._t` is time in the
current state (game time, not advanced during hit-stop); `this.clock` is game time.

- **READY flow.** The big button reads READY in `ready`. `canReady()` = state `ready`,
  `_t >= 0.25` and `batter.clipName === 'idle'`. `readyUp()` -> `_startPitch()`.
  `swing()` is the one entry for button / Space / tap: in `flight` it calls
  `flight.skip()`, in `ready` it calls `readyUp()`, otherwise it swings once per pitch
  (`_swung`) in `windup`/`pitch`.
- **`_startPitch()`**: `run.tickCooldowns()`, picks `_travel` from `run.travelRange()`,
  `_mph = PITCH_M / _travel * 2.237` (`PITCH_M = 18.44`, display + Counter Hitter only),
  `_tRelease = clock + RELEASE_TIME`, `_tArrive = _tRelease + _travel`,
  `pitcher.startWindup()`, `hud.setSpeed('NN mph')`.
- **`windup`**: at `_t >= 0.55` `batter.loadSwing()`. At `clock >= _tRelease`: `_released`,
  `fx.releasePoint` = `pitcher.releasePoint()`, `fx.pitch(_tArrive - clock)`, engage an
  armed Focus, re-time an early swing, state `pitch`.
- **`pitch`**: unswung and `clock > _tArrive + 0.3` -> `batter.unload()`, `_resolve('take')`.
- **`result`**: after `_t >= 1.1`, flight inactive and the batter back in `idle`/`admire`/
  `relaxed`: win screen, run-over screen, `_showOffers()`, or back to `ready`.
- **Timing.** `swing()` computes `tContact = clock + batter.timeToContact()` and
  `delta = tContact - _tArrive` (< 0 early), then `_res = run.judge(delta, _focused,
  _flowing, _mph, rng)`. The judgement is made at the press; the contact frame only acts on
  it. `batter.contactPoint` (sweet spot at the swing clip's contact pose, character space)
  is where `HitFX.pitch()` aims the ball. On a non-miss, `fx.retime(...)` (the "magnet")
  re-speeds the rest of the pitch so ball and sweet spot meet exactly.
- **Focus** (`useFocus`, Q): needs `run.focusReady()`. Before release it only sets
  `_focusArmed` (slowing the windup would just make the player wait); at release
  `_engageFocus()` sets `_focused`, `run.focusCd = run.focusCooldown()`,
  `_tsTarget = run.focusTimeScale()`. `step()` eases `timeScale` toward `_tsTarget`.
  `_endFocus(perfect)` at contact (or a take); a perfect snaps back with a flash and sets
  `_focusedSnap` (Overdrive: recharge Flow).
- **Flow** (`useFlow`, E): `_flowing`, `run.flowCd = run.flowCooldown()`, `aura.ignite()`;
  released at contact (`aura.release()`). `aura.focusBat` (0..1 as the ball nears) is set in
  `step()`; `_flowView` widens the fov while the aura is full-body.
- **Contact** (`batter` `contact_frame` -> `_onContact()`): miss -> `batter.reportHit(false)`,
  `fx.onContact(false)`, `_resolve('miss')`. Hit -> `from = fx.ballPosition()` (so the ball
  never jumps), `fx.onContact(true, NaN, NaN, NaN, true)` (handoff: HitFX hides its ball,
  does hit-stop + sparks), `_swingDirection(_res)` -> `[yaw, launch]`,
  `flight.launch(_res, from, yaw, launch)`, state `flight`, hit sound/crowd/`screen.impact`.
- **Landing**: `flight` `landed` -> `_onLanded(ft)` picks the title (FOUL / HIT! / HOME
  RUN! / globe biome titles from `GLOBE_TITLES` / space titles), stadium cheer/fireworks/
  board, then `_resolve(outcome, ft, title, sub, color, notes, hr)` -> `run.record(...)`,
  `hud.banner`, `hud.xpPop`, `hud.setRun`, state `result`.
- **`step(realDt)`** order: time scale, fov (`fx.camHome[2]` from Flow/Focus), hit-stop
  (`fx.hitstopLeft`; `frozen` holds batter, pitcher, flight, fielders), `fx.advance`,
  `flight.advance`, `fielders`, `screen.advance(realDt)`, aura, bat glow, stadium, sfx,
  the state switch, then HUD (`setAbilities`, `setSwingMode`) and `_bot()`.
- **`frame(dt)`**: `step(min(dt, 1/20))`, `hud.tickFps`, `_guardFrameRate(dt)`, render.
  `_guardFrameRate` averages 1.5 s windows: < 48 fps lowers render height (to 75% of the
  tier's `renderH`), then `applyQuality(lowerTier(...))`, then down to 400 px; >= 57 fps
  for a while raises it back. `?fps` shows the readout; `?quality=low|medium|high` forces a tier.
- **Bot / test hooks**: `autoOffset` (NaN = off; swing so the barrel arrives this many s
  after the ball), `autoFocus` (only in `pitch`, so it never exercises arming), `autoFlow`,
  `autoPick` (first card), `debugFt` (forces the hit distance). `_bot()` runs at the end of
  every `step()`. `tests/play.mjs` replaces `game.frame` and calls `game.step(1/60)`.
- **Input**: canvas `pointerdown` -> `_tap()` (skip a flight, else `swing()`); keys and
  buttons come from the HUD as events (below). `sfx.unlock()` on the first input.
- Other: `newRun()`, `_keepGoing()` (after a win: `flight.glideHome()`, `_endless`),
  `pick(i)` -> `run.take(id)` + `_refreshBat()` (Heavy Lumber reddens the bat),
  `_updateBoard()` (scoreboard stats, redrawn only on change). `CAMERA` (exported) is the
  batting camera `[pos, look, fov]`.

## src/run/run_state.js: `RunState`

Fields: `level, xp, strikes, outs, owned {id: lv}, streak, pitches, hits, homeRuns,
perfects, bestFt, milestones {}, focusCd, flowCd` (pitches until ready), `pendingLevels,
firstOffer, won`. Static `RunState.goal` (`'globe'` default, `'space'` via `?goal=space`),
`milestoneList()`, `winFt()`, `formatFt(ft)`.
Constants: `PERFECT_MS 22, GOOD_MS 55, FOUL_MS 85, FENCE_FT 330, WORLD_FT, MOON_FT,
PLANET_FT, GLOBE_MILESTONES, MILESTONES` (`[ft, id, title]`).

- `lv(id)`, windows `perfectWindow()/goodWindow()/foulWindow()/afterimageWindow()` (s).
- `focusReady() flowReady() focusTimeScale() focusCooldown() flowCooldown() tickCooldowns()`.
- `judge(delta, focused, flowing, mph, rng)` -> `{ kind: 'perfect'|'good'|'foul'|'miss',
  delta, quality, distanceFt, power, distMult, notes[], impacts, rocket, zerog, flow,
  cascade, afterimage, wraparound }`. Power multipliers `p` and distance multipliers `m`
  each push a `notes` string; base 255-325 ft (perfect) or 110-260 (good);
  `distanceFt = base * p * m` (good: `^0.85`). There is no `distanceFt()` function: it is
  this result field (and `landed`'s `distanceFt`).
- `record(outcome, ft, hr)` -> `{ xp, levels, strikeout, runOver, milestones }`; levels up
  into `pendingLevels`; sets `won` at `winFt()`. `take(id)` raises a level, clears
  `firstOffer`, consumes a pending level, and readies Focus/Flow when bought.
- `travelRange()` -> `{min, max}` pitch travel seconds, 0.56-0.64 at level 1 down to
  0.42-0.52 by level 19.

## src/run/upgrades.js

`ALL[id] = { name, kind: 'ACTIVE'|'PASSIVE'|'SYNERGY', color (sRGB), max, weight, needs?,
desc: [per level] }`. `offer(owned, rng, first)` returns 3 weighted ids (first offer is
fixed: `focus, flow, second`; `needs` gates synergies; `limit` gets weight 30 once <= 8
remain). `desc(id, level)`. Upgrades have no apply hooks: effects read `run.lv(id)` where
they matter (`judge`, windows, cooldowns, `record` for wildfire, `game._refreshBat`,
`game._onContact` for overdrive, `Flight` via the `judge` result's `impacts/rocket/zerog/
cascade/flow`, `hud.setRun` for the streak plate).

## src/world: pitch, contact, flight

- **`pitcher_mock.js`**: `PitcherMock` (`startWindup, releasePoint, advance, isIdle,
  headPosition, knockOut(dir), reset, setShadows`). `RELEASE_TIME = 1.1` s must match the
  release key (t 1.10) in `KEYS`. No events.
- **`hit_fx.js`** `HitFX(batter, cam, camHome)`: `pitch(travel)` (ball from `releasePoint`
  to the contact point), `retime(timeLeft)`, `timeToPlate()`, `ballPosition()` (null unless
  pitched), `onContact(hit, yaw, launch, speed, handoff)`, `advance(dt, frozen)`,
  `hitstopLeft` (`HITSTOP = 0.035`), `focus` (bigger, slower-spinning ball). A missed ball
  carries on along `_pitchVelocity` and shrinks away near the catcher
  (`smoothstep(-3.6, -1.4, x)`). Toggles `hitstop sparks trail headTrack camFollow
  ballBoost` (the game turns off the last three). `pitchForSwing()`, `PITCH_TIME`, `MOUND`
  and the `ball_result` event are for the standalone demo (`lab/fx_hit.js`) only.
- **`flight.js`** `Flight(cam, camHome, env, batter)`; the game sets `pitcher`, `groundAt`,
  `blocks`. `launch(res, from, yawDeg, launchDeg)`, `advance(dt)`, `skip()` (x4 after
  0.5 s), `resetView()`, `glideHome()`, `ballInPark()`, `compileShaders()`, `active`,
  `shownFt`, `holdView`. `_mode`:
  - `'phys'` (<= `PHYSICAL_MAX_FT` 1000): `_solveSpeed` bisects a launch speed so
    `_simulate` lands at `distanceFt`; Second Impact / rocket / zero-g in `_stepPhys`.
  - `'launch'` -> `'stage'` (`_enterStage`, log-paced `_segs`, `_stageCamera`,
    `_stageEnding` by `_end`: `drift`, `moon`, `planet`, `land`, `world`) -> `'return'`
    (globe win: Bezier into `pitcher.knockOut`, then `holdView`).
  - `_finish(ft)`: phys -> `'settle'` (bounce/roll/fade, glide home), else -> `'veil'`
    (fade through the sky colour, `resetView`). Emits `landed`. `'glide'` = `glideHome()`.
    `_done()` ends a flight. (The `_mode` field comment lists only the first five.)
- **`globe_trip.js`**: `GlobeTrip` landscape in the stage (`setTrack`, `setReveal`,
  `skyAt`), `BIOMES` (sixteen lands, from `run/route.js` `ROUTE`, the one table the stops,
  ribbons, callouts and flight segments all come from), `BAND`, `GROUND_Y`, `biomeAt`; `citySkirt()` is the city ground
  around the park (added in the `Game` constructor).

## Camera ownership (important)

Every frame `HitFX.advance` -> `_updateCamera` puts the camera back at `camHome[0]`
(plus shake) with eased look and `camHome[2]` fov. `Flight.advance` runs after it and
overrides while active (or while `holdView`). So any flight shot must call `setFov` +
`lookFrom` (from `flight_mats.js`) **every frame**, and anything that must remember a
camera pose across frames snapshots it (`_finish` stores `_settle.camPos`, `camQuat`,
`fov`) because `cam.position` already reads the home pose next frame. During hit-stop
frames `flight.advance` is skipped (HitFX's shake shows), and the launch frame is held by
`_holdFirst`. Note: `Flight` gets the shared `CAMERA` (fov 30), `HitFX` a copy whose fov
the game changes for Focus/Flow.

## src/fx

- **`aura.js`** `FlowAura(camera)` (child of the batter): `ignite()`, `release()`,
  `advance(realDt, bat.matrixWorld)`, `focusBat`.
- **`screen_fx.js`** `ScreenFX` (own WebGL overlay canvas under `#hud`, real time):
  `impact(strength)`, `flash([r,g,b,a], len)`, `speedLines`, `focus`, `advance(dt)`.

## Events (snake_case `type`)

| Source | Type (fields) | Listener |
| --- | --- | --- |
| `Batter` | `contact_frame` | `Game._onContact`, `tests/play.mjs` |
| `Batter` | `swing_finished`, `back_in_stance` | none in game |
| `Flight` | `landed {distanceFt}` | `Game._onLanded` |
| `Flight` | `milestone {title}` | `hud.milestone` |
| `Flight` | `impact_fx {kind, strength}` (`launch second board land moon planet bonk`) | `Game._onFlightFx` |
| `HitFX` | `ball_result {kind, distanceFt}` | `lab/fx_hit.js` only |
| `RunHUD` | `swing`, `focus`, `flow`, `card_chosen {index}`, `restart`, `keep_going` | `Game` |

## src/ui

- **`hud.js`** `RunHUD`: 1280x720 layout scaled to the window, DOM touched only on change.
  Keys in `_key`: Space/Enter -> `swing`, Q `focus`, E `flow`, 1-3 `card_chosen`, F fps.
  API: `setRun(run)`, `setSwingMode('ready'|'wait'|'swing')`, `setAbilities(run, canUse,
  focused, flowing)` (called every frame), `setSpeed`, `setHint(text)` (`''` hides),
  `showDistance`, `showGlobe`, `banner`, `milestone`, `xpPop`, `showCards/hideCards`,
  `showEnd/hideEnd`, `toggleFps/tickFps`. Round buttons fire on pointer down; cards and end buttons on click.
- **`arcade.js`**: the SVG kit: `Label`, `Plate`, `Bar`, `Burst`, `Pips`, `RoundButton`
  (`setLook(color, icon, caption, makeIcon)`, `setDisabled`, `setState(caption, charge,
  active)`), `PillButton`, `buttonInput`, colours (`GOLD`, `INK`...).
- **`upgrade_icon.js`**: `makeIcon(id, color, px)`, `makePips`, `iconBody` (a `switch`
  per id; unknown ids fall back to a plain disc; `'ready'` is the READY icon).

## Recipes

- **Add an upgrade**: add an entry to `ALL` (unique id, `kind`, sRGB `color`, `max`,
  `weight`, one `desc` per level, `needs` for a synergy). Implement it by reading
  `this.lv('id')` in `RunState.judge` (push a `notes` string) / the windows / `record`, or
  add a field to the `judge` result and read it in `Flight.launch`. Add a `case 'id':` to
  `iconBody` in `src/ui/upgrade_icon.js`. An `ACTIVE` one also needs a HUD button, event,
  `Game` handler and `setAbilities` wiring. Check with `npm test` and `lab/hud_states.html`.
- **Add a HUD hint**: `this.hud.setHint('...')` from `Game` at the moment it applies
  (`newRun`, `readyUp`); `swing()` clears it. Keep it short (520 px plate); guard
  first-pitch hints with `_hinting`.
- **Change pitch speed / timing**: travel time is `RunState.travelRange()`; the windup to
  release is `RELEASE_TIME` (keep `KEYS` in step); timing windows are `PERFECT_MS`,
  `GOOD_MS`, `FOUL_MS` (+ Sweet Spot). `timeToContact()` / `contactPoint` come from the
  swing clip (`src/batter/swing_clips.js`). Verify with `node tests/play.mjs OFFSET=0`
  (prints the worst ball-to-sweet-spot gap).
- **Add a camera beat in a flight**: write it inside the mode's advance (`_advancePhys`
  camera block, `_stageCamera`, a `_stageEnding` case) or add a new `_mode` with a `case`
  in `advance()`. Time it with `_t`/`_endT` (already scaled by `skip()`), call `setFov` +
  `lookFrom` every frame, snapshot any pose you hold, and end through `_finish(ft)` (emits
  `landed` once) or `_done()`. Check in `lab/flight_lab.html?ft=420&goal=globe` and
  `node tests/hit_frames.mjs <out> FT=420`.

## Flight camera (in-park hits, Flight `_advancePhys`)

Contact beat -> the look locks on the ball (0.15 s) -> the follow shot (`FOLLOW_BACK` 9 back
on the plate->ball line, `FOLLOW_UP` above, `FOLLOW_FOV`; weight `fk` = smoothstep over
0.18..1.3 s; the back distance is capped at 0.6 x the ball's distance so the camera only ever
moves forward) -> the chase rig near the fence (`_chase` / `ck`). The shots hang off smoothed
directions (`_fdir`, `_cdir`), so a bounce or a second impact never jerks the camera. Seats /
over-the-park / the video board (`BOARD_TOP`: eases up over it) adjust the blended target
smoothly. `_finish` snapshots the camera, so the landing settle and glide home continue from
wherever it is. Check with `node tests/hit_frames.mjs <out> FT=250|420|650 EVERY=10`.

The Flow aura (src/fx/aura.js) is violet; its shell is the Blender sheath `A_aura` (see
hrh-project), tight round the stance and see-through where it faces the camera; the bat's
emissive, the screen flashes and the flow trail in flight.js match.

## Long-hit cinematic pacing (Flight stage)

Segments (`_segs`: [startFt, endFt, seconds, id], from `run/route.js` `routeSegments()`): the
city segment right after the hand-off takes `CITY_SEG` (2.2 s; the camera levels out over it,
`_stageCamera` over 1.9 s). The globe's later lands are paced by `globePacing`: the land the
ball comes down in and the one before it take `BIOME_SEG` (1.3 s), the two before those 1.0 and
0.8 s, and everything crossed earlier 0.64 s, so six more lands did not lengthen a long hit
(the full trip is still about 20.6 s) while the new ground a hit has earned goes by unhurried.
The track follows a monotone cubic through the seams (`_plotTrack`: no speed steps), a land's
ribbon fires as the ball crosses onto its ground, and a landing comes down at least 60 units
inside the land it reached (the splash reads the ground kind under that spot: water, surf,
lava). A landing dives over `LAND_TIME` (1.7 s, smoothstepped) from whatever speed it had. `setReveal` brings the props in near-first over 0.45 s so the city is there as soon as
the ground is in view.

## Continuity rules (Flight) and how to check them

- Off the bat the flight time eases in (`_age`: x0.25 -> x1 over 0.3 s) so the ball's first
  frames are small steps; the look locks on over 0.15 s of that time.
- `_finish` (phys -> settle) starts the settle look where the camera was already aiming
  (not at the ball), the look then turns onto the ball; the camera watches the ball bounce
  until it has faded (0.62..1.0 s) before gliding home.
- The globe 'land' ending blends its dive rig from the cinematic camera's current pitch
  (`_camPhi`, `_camSw`) over 0.8 s (a short hit lands while the climb camera is still tilted
  up 40 degrees: without the blend it snapped).
- Probe numerically: a script stepping `game.step(1/60)` and logging the ball's NDC, the
  camera direction and fov per frame flags jumps (see hrh-testing). Expected flags only:
  the scene swap under the fully opaque veil, and the faded ball leaving the frame.

## Fielding (catches)

`Game._planFielding()` after `flight.launch`: for fair hits staying in the park
(< FENCE_FT - 8) `flight.descent(h)` simulates where/when the ball comes down through glove
height (`fielders.catchHeight()`, from the CATCH pose); `fielders.canCatch(point, time)` picks
the nearest fielder and checks `RUN_SPEED * (time - REACT) + REACH`; then a roll against
`CATCH_CHANCE` (good 0.2, perfect 0.15; never on Flow). A catch: `fielders.planCatch` (the
fielder runs to stand under it and switches to the separately posed glove-up mesh),
`flight.planCatch(height, glove)` (the ball ends in the glove, settle pins it there), the
'landed' event carries `caught`, `_onLanded` resolves 'caught' -> `RunState.record` adds an
out (`flyout`), banner CAUGHT! / FLY OUT. Otherwise the nearest fielder runs to where it lands
(`fielders.plan`). `game.debugCatch = true` forces every reachable catch (tests).

## Menu

`Game.openMenu(start)` / `closeMenu()`; `menuOpen` pauses `frame()` (no step; it still
renders) and blocks swing / focus / flow / taps. Title screen at boot unless `?nomenu`
(tests use it); pause from the HUD's MENU button or the P / M keys, or open the shop from UPGRADES or U (`openMenu( false, true )`: the menu with only the training, powers and bats tiles) (never Escape: portals keep it for
leaving full screen). HUD events:
menu, upgrades, play, resume, new_run, goal, sound, graphics. `prefs` ({ goal, sound, graphics }) are
saved through `Platform` (core/platform.js) under 'hrh-prefs'; `?goal=` still overrides; a goal change applies now
before the first pitch, otherwise next run (`newRun` reads `prefs.goal`). Graphics 'auto' =
the device tier with the frame-rate guard; a fixed tier turns the guard off.
`_abortPlay()` stops a flight / pitch / Focus / Flow before NEW RUN.

## Out-of-the-park hand-off (launch -> stage)

Long hits leave at `LAUNCH_DEG` (14..20 deg), so the camera sees the real city at the
horizon when the stage takes over. `_enterStage` keeps the first stage frame matching it:
`_h0` = the ball's real height; the space ground starts at `-_h0` (easing to -12 over 1.6 s),
the globe landscape is offset so its ground starts at `-_h0` (easing to GROUND_Y over 1.3 s);
a copy of the stadium's horizon haze ring (`skyBand()`, placed where the plate is in stage
space) fades out over 0.6..2.4 s; the stadium's clouds (`stadium.cloudFade`, via
`flight.parkClouds`) fade out during the launch and come back under the veil; the globe trip
starts `CITY_LEAD` back inside a longer city strip with its props already revealed (reveal
0.7 -> 1). Check with `node tests/hit_frames.mjs <out> FT=5000 GOAL=globe|space START=172 EVERY=3`.

The cinematic continues the real ball's motion (no "correction" onto the street): the
globe trip's slide speed starts at the real horizontal speed (`_hs0`) and eases to the
segment's; the flying height follows one cubic arc (`_altitude(t)`) from the real height and
climb rate (`_h0`, `_vy0`) to cruising height over `ARC_TIME` (3.2 s), and the camera's pitch
is that arc's direction (`atan2(altitude rate, speed)`), so it tips down only as the ball
does. A landing dives onto the ground wherever the arc has it. The space climb's ground
slides at `_hs0` at first (`_groundX`), easing to its own pace.

## The profile, the shop and the menu's pages

- **`src/run/profile.js`** - `Profile` (saved through `Platform` under `hrh-profile`: `save()` writes now, `save(false)` only queues - a pitch's coins, a locker tap - until the next real save; `?profile=new` = empty,
  `=max` = everything bought, neither saved): `coins`, `lumber`, `training` (id -> level),
  `powers` (bought unlocks), `bats` / `bat`, `look` (changes over the batter's default),
  `stats`. Catalogues: `TRAINING` (power, eye, study, sponsor, sawmill, headstart: `max`,
  `base`, `growth`, `desc(n)`), `POWER_COST` (the ten powers not in `STARTERS`, cheapest first:
  the order they are meant to come in; a save from before `SAVE_VERSION` 2 keeps Hot Streak,
  which was a starter then), `BATS`
  (cost in lumber, `perk`, `mods`), and the locker room's option lists. `mods()` ->
  `{ power, perfectMs, goodMs, xp, coins, lumber, startLevels }`, which `RunState(mods)`
  applies (`NO_MODS` = a fresh profile's). `unlocked(id)` gates `Upgrades.offer(...,
  unlocked)`; when fewer than three powers can be offered a `bonus` card (Signing Bonus,
  `BONUS_COINS`) fills the hand.
- **Earning**: `RunState.record` returns `coins` / `lumber` per pitch (a coin a hit, +1
  perfect, +1 home run, and for a stop `stopCoins()`: `STOP_COINS` 8 per doubling of the
  distance since the stop before, so the route pays the same however many stops it has; a
  log per home run; `WIN_COINS` 200 / `WIN_LUMBER` 20 once); `Game._resolve` banks them at once with `profile.earn` (fractions carried) and adds
  them to `run.coins` / `run.lumber` (the end screen's EARNED line, the XP pop).
- **Balance: what paces the game** (`node tests/progression.mjs` simulates careers with the
  game's own modules; run it before and after any change here, `REV=<commit>` for an older
  tree, `STOPS=<file.json>` for another route). Round the world is about 18.6 doublings of a
  325 ft hit. A new profile's deck (the six starters, every level taken) is worth about 11,
  so it tops out mid-route (about 150 miles); each power bought adds one to three. Levels
  cost 10, 15, 20... XP (`XP_CURVE` 0: a straight line; a curve past `XP_KNEE` is there for
  play in many short runs, and in one long run it leaves long lulls). A power bought joins
  the deck at once, like training and bats (`game.js` `POWERS_NEXT_RUN` false; true makes it
  wait for the next run). Income keeps up with a long run: a hit pays a coin more for every
  `DIST_DOUBLINGS` (3) doublings of its distance past the fence (`distCoins`), and when every
  power in the deck is at its top level the cards are Signing Bonuses (25 coins; a notice
  says so once). Measured: the first round-the-world win comes in one run, after about
  38-41 minutes for strong, average and weak timing alike (it was 8-11 minutes before the
  route and the deck were reworked), something new every ~40 s on average, the longest
  lull about 6-7 minutes. Three outs end a run, rarely once Focus and Sweet Spot are in
  hand. The planet goal (dev pages only) needs unlocked powers.
- **Menu** (`ui/hud.js` + `ui/menu_pages.js`): the main menu has four picture tiles
  (`menuTiles`: training, powers, bats, locker room; `portrait(look)` draws the character)
  and the wallet; `hud.showPage(name, profile, look)` / `hidePage()` show a page over it
  (`MenuPages`: header with BACK and the wallet, then tiles; rebuilt on every change). Events:
  `page {name}`, `page_back`, `buy_training {id}`, `unlock_power {id}`, `bat {id}`,
  `look {changes}`; the game handles them (`_showPage`, `_bought`, ...). Purchases apply to
  the run in hand (`run.mods`), a Head Start from the next run. While the locker room is
  open the game's camera circles the batter (`_lockerCam`), the page's left half is clear,
  and the rest of the HUD is hidden (`.hrh-locker`). The title screen has its own backdrop.
  Check with a script that emits those events on `game.hud` (profile=new, then set
  `game.profile.coins`).

## The tutorial (src/run/tutorial.js + src/ui/coach.js)

- A first-time player (`profile.isNew()`: nothing earned or bought, `profile.tutorial.done`
  false) starts **in the game**, not at the title menu, with `game.tutorial = new
  Tutorial(game)`. `?tutorial=1` / `=0` forces it on / off; `?nomenu` and `?profile=` skip
  it; the menu's TUTORIAL button replays it (`game.startTutorial()`).
- `Tutorial` is a phase machine stepped by `game.frame()` (`update(dt)`): ready -> pitch ->
  swing -> flight -> pick (the first level-up offers only Flow State: `Game._showOffers`) ->
  use_flow (tap FLOW, see it light) -> ready -> pitch -> swing -> flight (`round` 2, with
  Flow) -> pick -> count -> open_menu -> tile_training -> buy_training -> back1 -> tile_bats
  -> buy_bat -> back2 -> resume. Each phase moves on when the game shows it is done (state,
  `_flowing`, `hud.pageOpen()`, the profile), so it never gets out of step.
- **Only the pointed-at control works**: every HUD event goes through `hud.filter(type,
  extra)` (and field taps through it as 'swing'); `Tutorial.allows` passes the one the phase
  wants, then re-aims the coach in a microtask (no stale pointer for a frame). Card picks are
  always allowed while a level-up is showing.
- **The pointer only shows on a control that will answer**: if the target is `.disabled`
  (READY in its 'wait' mode until `canReady()`, a power button on cooldown) or hidden, the
  ring and arrow are withheld (for READY the words stay, with "Skip"). Any new step must keep
  this: point at X only when pressing X does something *now*, and let X itself be the thing
  to press (not a GOT IT beside it).
- The held swings cannot miss: `tutorial.frozen` stops `game.step` on the frame from which a
  swing meets the ball, and the press sets `game._tArrive` so the contact is dead on whatever
  the frame rate; `game.debugFt` makes the first one a home run. The second flies as far as
  Flow sends it.
- A welcome bonus (`WELCOME_COINS` 60, `WELCOME_LUMBER` 25, paid once:
  `profile.tutorial.bonus`, also when skipped) pays for the two purchases it asks for: a
  level of Strength and the Maple Pro. On a replay without the means, those two steps just
  show the page and ask for BACK.
- `Coach` (ui/coach.js): an arrow, a pulsing ring and a bubble (text, optional GOT IT, "Skip
  tutorial") laid over the whole HUD; `show({ target, text, ok, big, arrow })`, `update()`
  every frame (it follows the target's rect, so rebuilt pages and resizes are fine). The
  bubble is never laid over the target (its buttons would take the tap). Targets are found
  by `hud.coachTarget(name)` = `[data-coach="name"]` (swing, focus, flow, menu, count, play,
  cards, card-N, tile-<page>, back, train-<id>, power-<id>, bat-<id>).
- Test (keep a script like this): every ~70 ms, if the coach shows a target, assert it is
  not `.disabled`, is visible, and is the top element at its centre
  (`document.elementFromPoint`), then click it and require the game to change within 2.5 s;
  run it at desktop and phone sizes and under CPU throttling, and once more with random taps
  all over the screen between the real ones.

## Difficulty, and earnings seen arriving

- `DIFFICULTY` (run_state.js, 1.2): the timing windows are divided by it (`PERFECT_MS` 18,
  `GOOD_MS` 46, `FOUL_MS` 71) and `CATCH_CHANCE` (game.js) multiplied by it.
- `hud.rewards({ xp, coins, lumber })`: XP orbs burst from mid-screen and stream into the XP
  bar, coins and logs into the play HUD's wallet (`hud.setWallet(profile)`, under the speed
  gun); returns the seconds until they land. `Game._showRewards` calls it and updates the
  wallet then; `_resolve` passes that delay to `hud.setRun(run, xpDelay)` so the bar fills as
  the orbs arrive. `hud.onRewardTick(kind, k, n)` plays a tick per orb. The orbs are DOM
  elements animated with the Web Animations API (at most ~30 at once), inserted under the
  cards and menu overlays.

## The host: saves, pause, mute and ad breaks (`src/core/platform.js`)

`Platform` is the only place that knows about the Playgama Bridge SDK (`window.bridge`,
present only in the Playgama build) and the CrazyGames SDK (`window.CrazyGames.SDK`, only
in the CrazyGames build); without either: localStorage and the page's visibility.
`Platform.host` ('', 'playgama', 'crazygames') tells the game whose rules apply: on
CrazyGames (`game._crazy`) the ads go elsewhere (see hrh-project, "Shipping on CrazyGames").

- Boot (`main.js`): `await Platform.init()` -> one `Platform.load( SAVE_KEYS )` -> assets ->
  `new Game( stage, saved )` -> first frame -> `Platform.ready()` (`game_ready`) and
  `sfx.loadMusic()`.
- Saves: `Platform.save( { key: value } )` queues, `Platform.flush()` writes every queued
  key in one call. Flush only at meaningful moments (a purchase, a run's end, a level-up
  pick, the menu opening / closing, the page hidden), never per pitch or per frame.
- `Platform.onSilence` / `onPause` -> `sfx.setSilent` / `sfx.setPaused` + `game.hostPaused`
  (the platform's mute, its pause, an ad asked for or up, a hidden page). While
  `hostPaused`, `Game.frame` only renders: nothing steps, `shared.time` stands still.
- Ads (Playgama), all by the owner's decision:
  - Interstitials every `AD_EVERY` = 240 s of play. `game._adClock` counts play only (not
    menus, the tutorial, or while the host has the game stopped); once it is up,
    `game._adBreak( placement )` asks the Bridge at the next pause - `between_pitches`,
    `run_end` (unless a rewarded offer is on the end screen), `level_up`, `resume` (only if
    play is at a pause) - never over a pitch or a flight, never in the tutorial.
    `Platform.onAd`: 'opened' restarts the clock, 'failed' asks again after `AD_RETRY` s.
  - Rewarded (the player's choice, marked WATCH AD, shown only if
    `Platform.rewardedSupported`, never in the tutorial, once a run each):
    **3X COINS** (`hud.setBoost`, the button under the wallet while the game waits for
    READY; `run.boosted` triples the rest of the run's coins in `_resolve` / `pick`) and
    **2ND CHANCE** on a failed run's end screen (`run.secondChance()`: one out left).
    `game._rewarded( placement, states, grant )` grants only when `Platform.rewarded()`
    resolves true (the host's `rewarded` state). In `?test` mode they work with no ad.
  - Input and the run-changing buttons are ignored while `hostPaused`.
  (Playgama's docs prefer leaving interstitial timing to the Bridge; the owner chose the
  fixed interval knowingly. Placement ids are in `playgama-bridge-config.json`, written by
  `tools/build.mjs`.)
- Lifecycle messages: `level_started` (a run's first READY), `level_completed` /
  `level_failed`, `level_paused` / `level_resumed`.

## Long hits: one city from the bat to the cinematic (`src/world/flight.js`)

A hit over 1,000 ft leaves the park in `launch` mode and hands over to the `stage`
cinematic 0.9 s later. Nothing may change on screen at that hand-off, and the ball must
be seen flying one way throughout:

- `flight.setCity( city, farBlocks, skirt )` (game.js). At contact `_cityAlign` turns the
  real city about home plate so one of its streets runs straight out under the ball
  (`City.build` puts block centres half a cell off the plate, so streets cross there).
  From the batting view the stands hide this.
- `_preStage` / `_preLayout`: during `launch` the cinematic's landscape (GlobeTrip, or the
  space climb's ground) is already set down round the real city, turned the hit's way,
  dissolving in near-to-far (`setReveal`) while the stadium's plain far blocks dissolve out
  (`_farFade`). Its own city strip leaves the real city's disc empty (`City.strip` `skip`,
  `CITY_PLATE_X` = home plate on the track).
- `_enterStage`: the stage moves up to `STAGE` and the real city is carried with it
  (`_cityCarry`: same place relative to the ball, sliding back with the track), until it
  is behind the camera; `_cityHome` puts it back (also from `resetView` / `_beginReturn`).
- A short cinematic hit therefore lands in the real city, on the street it flew along.
- `GlobeTrip._cull` draws only the biomes within the props' draw distance.
- Check with a frame dump across the hand-off: frame-to-frame image change must show no
  spike at the `launch` -> `stage` frame.

## Test mode

`?test` on the stand-alone site (`TEST_MODE`, run/profile.js): every purchase is free
(`trainingCost` / `powerCost` / `batCost` return 0), saved under `hrh-profile-test` so the
real save is untouched; no tutorial; the menu says TEST MODE. Compiled out of the Playgama build.

## Timing as the player sees it: EYE and the timing bar

Players never see milliseconds. The stat is **EYE** (`EYE +4` = 4 ms more PERFECT window:
bats' `perk` text, the Batting Eye training, the Sweet Spot card), and `ui/timing_bar.js`
`timingBar()` draws what it means: early on the left, late on the right, gold = PERFECT,
blue = HIT, what an upgrade adds bright at its zone's edge. It is on the bat tiles with an
EYE perk, the Batting Eye tile, and the Sweet Spot / Afterimage level-up cards. Keep new
timing upgrades in that vocabulary.

Left of the speed gun are two buttons: UPGRADES (`hud._upBtn`, data-coach `upgrades`; gold,
named, with a red badge counting what the wallet can buy now, `menu_pages.js` `affordable()`,
and a pulsing glow while that is more than nothing; the tiles carry the same badges) and a
small MENU (`hud._menuBtn`, data-coach `menu`). `hud.setWallet()` returns true when the
wallet first comes within reach of something; the game then says "NEW UPGRADE IN REACH". The
tutorial points at UPGRADES to spend its welcome bonus.

## The ball is solid; sure catches

- `Flight._hitWall`: a ball that reaches the outfield wall below its top comes back off
  it (in `settle`, and in `phys` for non-home-runs; a home run is judged at the bat and
  always clears). `Flight._hitBody` (swept): a low ball stops against the pitcher or a
  fielder (`flight.bodies`); in `phys` only for balls that never got high (`_topY`) and
  with no catch planned, and it then counts for the distance it got.
- `game._planFielding`: a liner passing within `LINER_REACH` of where a fielder stands, at
  about glove height, is always caught (`flight.path()`, `planCatchAt`); a fly a fielder has
  to move no further than `EASY_CATCH` for likewise. Other catchable flies keep
  `CATCH_CHANCE`.
- (A strike zone frame over the plate was tried and removed at the owner's request: do not add one back.)
- After every swing the banner shows `timingBar` with a pin (`game._timingOf`): no
  milliseconds anywhere in the UI.

## The Super Pitch

`run.superAt` = the pitch count at which the next pitch thrown is a Super Pitch: 4 at the
start of a run (the 5th pitch), then `SUPER_EVERY` (10 to 20) pitches on. Never in the
tutorial. In `game._startPitch`: `_super`, the travel time divided by `SUPER_SPEED` (1.5,
to `SUPER_SPEED_TOP` at level 19), thunder / flash / shake, rings off the mound through the
wind-up (`_superFrame`), `fx.superPitch` (world/hit_fx.js: the ball dances up and down,
settling onto its line at the plate, with a jagged electric ribbon behind it, drawn in the
streak mesh). A good or perfect hit goes `SUPER_DISTANCE` x 325 ft x the swing's power and
multipliers (twice its best). Before a run's first one the player is given Slow-Mo Focus,
charged; the first time ever (`profile.tutorial.superPitch`) a `Coach` arrow points at FOCUS,
then at READY (`_superFrame` / `_endSuperCoach`).

## Arenas: the Moon (`RunState.arena`, `Game._setParkLook`)

- **Flow.** The first win of an arena unlocks the next (`profile.unlockArena`, in the win's
  booking); the end screen then leads with **NEXT STOP: <name>** (`hud` event `next_arena`
  -> `Game._goArena`). The menu's fifth tile is the arena tile (`menuTiles( ..., arena )`,
  `data-coach="tile-arena"`; not in the UPGRADES view): a picture of the arena a tap
  travels to (`arena` -> `_cycleArena`: at pitch 0 it switches now, mid-run it applies to
  the next run, as GOAL does), or, until a win has opened it, the next arena dimmed under a
  padlock with "Go round the world to unlock" (a tap shakes it and says why in the menu's
  tag line: `arena_locked`). The pictures are renders of the parks,
  `assets/tex/arena_<id>.jpg`: run `node tools/arena_previews.mjs` again when a park's
  look changes. `newRun` sets `RunState.arena`, `profile.arena` (whose deck and shop page) and the
  park look. The first Moon run opens with `MoonIntro` (tutorial.js: three GOT IT bubbles;
  the HUD answers to nothing else and the menu stays shut until it is done).
- **Run state.** `ARENA_MILESTONES[ arena ]` are the stops; the Moon's pitches travel
  0.54-0.62 s down to 0.38-0.49 s (108 mph at the top; Earth 100). Each Moon run starts a
  fresh deck; training, bats, coins and lumber are the profile's and carry over.
- **Powers.** `lowg` (Low-G Launch, DISTANCE x3 / x5 / x8), `boots` (Moon Boots, EYE +15),
  `meteor` (Meteor Strike: a perfect hit calls a meteor down, DISTANCE x3 / x5 / x8) have
  `arena: 'moon'` in upgrades.js: always in the Moon's deck, never dealt on Earth
  (`offer( ..., arena )`). The other powers are unlocked per arena (`profile.powers` is the
  arena in play's; `ARENA_PRICE.moon = 2` doubles the prices), so the Moon starts with the
  starters only and the shop paces it as it does Earth.
- **Pacing** (`XP_MOON` in run_state.js; `node tests/progression.mjs ARENA=moon` plays an
  Earth career to its first win, then the Moon with that profile). A player arriving has
  training, so stops alone would fly by: the cards set the pace. Up to level 4 a level
  costs what it does on Earth, then the cost rises over six levels to 10x and stays: a card
  every seven or eight pitches. Result (medians, six kinds of player): a new stop every
  2-4 minutes, the Earth shot after 33-51 minutes (37-48 for the middle four), the longest
  wait for something new about 2.6-3.1 minutes. Change the route or XP_MOON only with the
  sim's tables C, D and F in hand.
- **Pitches** (`MOON_PITCHES`, never on a Super Pitch nor in a run's first three): the
  kind is named in the hint bar and has a colour (rings off the mound in the wind-up, a
  ribbon behind the ball). `fx.pitchKind` changes only how the ball looks and where it is
  on the way: `warp` blinks out mid-flight, `orbit` loops wide and back, `tractor` brakes
  in a green beam and then comes on. The ball crosses the plate when the timing bar says,
  whatever the kind: timing judgement never reads the pitch's path. `game.debugPitch`
  forces a kind (tests).
- **Flight.** `Flight._lunar` (the arena's trip): `_lunarLayout()` places the sky's Earth
  (sinking toward the far side, ahead and growing from the station on), flashes white at
  re-entry and fires `homecoming` (the game swaps the park to Earth while the camera is
  away), so the winning hit lands in the Earth ballpark and beans the Earth pitcher; KEEP
  SWINGING puts the Moon park back behind a flash. A hit that ends over a `space: true`
  land has nothing to come down on and drifts away (`_end === 'drift'`). Meteor Strike's
  hit shows the meteor (`impact_fx` kind `meteor`).
- The other goal (`?goal=space`, dev pages) is Earth's alone: on the Moon `RunState.goal`
  is always `'globe'` and the GOAL button is hidden.

## Super Pitch delivery, Focus's punch, and what the ball breaks

- **Super Pitch**: `pitcher.startWindup( true )` is the same delivery made huge (a leap
  through a higher kick, a pillar of light and the ball charging in his hand: two additive
  meshes built on first use, `_powerFx`), all of it before `STOMP_TIME`; from there to
  `RELEASE_TIME` the keys are untouched, so the ball leaves from the same place at the same
  moment. `onStomp` -> `Game._superStomp` (shock rings, a cracked mound, the screen
  shaken); after the release he spins right round. The view draws in on the mound through
  the wind-up (`_superView`).
- **Focus**: engaging punches the fov in past its framing and back (`_focusPunch`), a ring
  of light closes on the middle (`ScreenFX.pulse`), and `Sfx.slowMo( 1 )` slows and muffles
  every sound (the music, the effects playing and those started meanwhile; a low-pass on
  the master) with a heartbeat over it; ending pops the view out and back (`_focusPop`)
  and winds the sound back up. All in real time.
- **Impacts** (`world/impacts.js`, made at the first impact: nothing at load): `impact_fx`
  events carry `at` / `speed`; `Game._damage` leaves cracks in the wall and the scoreboard
  and chunks, never a crater in the park (the field and the mound stay clean); a long
  hit's landing digs a crater in the land it reached (it follows that land: `mark(...,
  follow)`, so it stays under the ball as the landscape moves), leans the props near it away (`topple`: it rewrites a few
  instance matrices of the landscape's own InstancedMeshes; `restore()` at the next pitch)
  and cracks the walls facing it in the city (a few rays against the city strip, once).
  Cost: one draw call for all marks, one for chunks while any fly, none otherwise.

## The ad boosts: 3X COINS and 3X POWER

- Two rewarded ads, once a run each, stacked under UPGRADES on the right (`hud._coinsBoost`,
  `hud._powerBoost`, built by one helper; placed from UPGRADES' own height, so the bigger
  phone UPGRADES never covers them). Modes as before (`setBoost` / `setPowerBoost`: 'offer',
  'cards', 'on', 'off'; `Game._boostMode( done )` decides for both). 3X POWER sets
  `run.powerBoosted`: `RunState.judge` multiplies power by `POWER_BOOST` (3) and notes
  "AD POWER x3". On CrazyGames both stand over the level-up cards; `hud._fitCards` draws
  the cards row just small enough to keep clear of them on a wide screen.

