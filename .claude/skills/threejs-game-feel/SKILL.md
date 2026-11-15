---
name: threejs-game-feel
description: Arcade baseball gameplay and juice in three.js - fixed-timestep simulation, pitch trajectories solved from target and break, plate-crossing timing judgement, contact quality tiers, exit velocity / launch angle / drag ball flight and home run detection, hit-stop, slow motion, camera shake, camera director with cinematic shots, particles/shockwaves/trails, and WebAudio synthesized sound. Use when touching src/game/ or src/core/audio.js.
---

# Game feel

## Time
- `sim` runs fixed `STEP = 1/240` with an accumulator fed by `realDt * timeScale`.
- `timeScale` comes from one controller: hit-stop (0 for 40-90 ms), slow-mo ramps
  (`slowmo( scale, duration, easeBack )`). Physics, animation mixers, FX and camera all use
  scaled dt; UI and audio use real dt.

## Pitches (`src/game/pitch.js`)
Solve the launch velocity so the ball reaches a target in the zone at flight time `T` with
constant acceleration `a = gravity + break`:
`v0 = ( target - p0 - 0.5 * a * T² ) / T`. Fastball T≈0.42 s / small rise, curve T≈0.62 s
big drop + glove-side break, changeup T≈0.66 s with fade, special pitch zig-zag + energy.
Because flight time is known, the plate-crossing time is exact for timing judgement.

## Swing → contact → launch (the hitting contract)

Read this before touching batting: what the player sees and what the game decides
must stay the same thing.

1. **Input time.** `Input.queueSwing` stores the event timestamp; `Game.handleInput`
   maps it into the frame's sim interval, so the swing starts at the press, not the frame.
2. **Fixed interval.** Every swing clip shares one launch; the barrel crosses the contact
   plane `SWING_CONTACT` (0.15 s) after the press. Hits may play the swing at 0.85-1.2x
   (bounded forgiveness); misses always play at 1x.
3. **Judgement** (`judgeSwing`): timing tier from `dt = barrel arrival - ball arrival`
   (windows in `windows()`), aim tier from reticle vs ball on the contact plane; tier = worse
   of the two. `launchShape` sets launch angle from where the bat meets the ball vertically
   (reticle under the ball → lift) and picks the kind: ground < 8°, line < 22°, fly.
4. **Swept contact** (`Game.judgeNow`): searches the *drawn* bat (IK + reach + clearance
   constraints) over the hitting window for the moment the barrel (0.42-0.84 m from the knob)
   passes closest to the ball's path → `tContact`. Early swings meet it out front with the
   barrel pulled around, late swings deeper with it trailing.
5. **Plan** (`Game.planSwing`): an additive offset (bat shift + tilt, hips, chest) peaking at
   that clip time, iterated against a dry-run of the real pose until the drawn barrel touches
   the ball. If it still can't (off the end), the swing becomes a miss (`why: 'reach'`).
6. **Contact frame.** `Game.frame` clamps the step so sim time lands exactly on `tContact`;
   `doContact` then launches from the ball's position at that instant, with sound, glow and
   hit-stop on the same frame. Spray comes from the barrel's real angle (`planSwing().batSpray`).
7. **Reveal.** The plate shot holds (`flightInfo.hold`: ground 0.26 s, line 0.30, fly 0.42,
   HR 0.5) with a gentle push-in that tilts with the launch, then `CameraDirector` follows per kind.

Checks: `node tests/contact-sweep.mjs` (barrel-to-ball on every awarded hit, clearance on
every miss, 60 vs 10 fps), `node tests/swing-check.mjs` (grip gaps, bat vs helmet/torso/
shoulders for every swing clip and aim), `node tests/record-hits.mjs [--clean] [--closeup]`
(frame-exact recordings → `tests/out/rec/*.mp4`).

## Juice
- Hit-stop (25-80 ms, holds the contact frame), small camera shake, a contact glow that stays
  where the ball was hit for ~0.25 s, sparks; ring shockwave + screen flash + slow motion only for
  perfect contact and Home Run Clash. Trails are time-based (0.08-0.16 s) so the ball stays findable.
- Camera director: `batting` (behind-right of batter, mirrored for lefties), `follow`
  (spring-chases the ball with look-ahead), `cine` (scripted shot list with eased
  position/target/fov keys). Transitions blend with `smoothstep` over 0.3-0.6 s.

## Audio (`src/core/audio.js`)
All synthesized with WebAudio: bat crack (noise burst + resonant band-pass + sine thump),
mitt pop, whoosh, crowd bed (looping filtered noise with gain swells), shockwave boom
(sine sweep down + noise), UI ticks. Unlock the AudioContext on first input.
