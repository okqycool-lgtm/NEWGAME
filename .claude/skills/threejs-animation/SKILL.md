---
name: threejs-animation
description: Author character animation directly in three.js code for Home Run Ascension - key-pose clips over a fixed channel layout, monotone cubic Hermite sampling, channel-space crossfades, analytic two-bone IK for arms/legs, bat-driven grips, head look-at, additive aim offsets and frame-exact gameplay events (ball release, bat contact). Use when adding or tuning batter/pitcher animation in src/chars/clips.js or src/chars/animator.js, or syncing animation with gameplay.
---

# Animation authored in code

The characters are not animated with baked `AnimationClip`s. They use a small
**pose-space animator** (`src/chars/animator.js`) because it keeps both hands on
the bat and both feet planted through every blend, and lets gameplay bend the
swing toward the ball.

## Channels (character space)

Character space = the `Character.root` frame: faces +Z, +X is the character's
left, metres, rotations in degrees with Euler order `YXZ`. Every bone's rest
rotation is identity, so FK rotations are absolute deltas from the T-pose.

| channel | meaning |
| --- | --- |
| `hipsPos`, `hipsRot`, `spine`, `chest`, `neck`, `head`, `shoulderL/R` | FK |
| `footLPos/RPos`, `footLRot/RRot`, `kneeL/R` | foot targets (sole position), foot rotation, knee pole offset → leg IK |
| `handLPos/RPos`, `handLRot/RRot`, `elbowL/R` | free hand targets + elbow pole direction → arm IK |
| `batPos` (knob), `batRot` (yaw, pitch, roll), `gripL/R` | bat transform; grip 1 = that hand is driven by the bat handle |
| `squash`, `look` | whole-body squash/stretch, head look-at weight (`animator.lookTarget`) |

Bat yaw 0 points +Z (across the plate for the batter), +90 toward +X (the pitcher), pitch is elevation.

## Clips (`src/chars/clips.js`)

```js
{ name: 'swing', events: { contact: 0.16 }, faces: [ [ 0, 'focus' ], [ 0.15, 'shout' ] ],
  keys: [ { t: 0, ...partialPose }, { t: 0.055, footLPos: [ 0.5, 0, 0.05 ] }, { t: 0.55, hold: true } ] }
```
- Keys are partial; omitted channels carry over (first key inherits the base pose).
- Sampling is monotone cubic Hermite (auto tangents, no overshoot); `hold: true`
  zeroes the tangent at that key (ease in/out, use for settles and finishes).
- Spacing keys is how you get snap: the swing goes stance → slot → contact in 0.16 s,
  then follow-through and a held finish.
- `faces` swaps painted expressions (`idle, focus, shout, grin, hurt, smug, blink, shock`).

## Blending and playback

`animator.play( name, { fade, speed, offset, at } )` snapshots the current output and
crossfades in channel space (smoothstep over `fade` seconds) before IK runs.
`animator.update( dt )` uses the game's *scaled* dt, so hit-stop and slow motion apply
to animation, physics and FX together. Breathing is added on top every frame.

## Gameplay sync
- Pitcher clips fire `release`; `Game.onRelease` spawns the ball at the throwing hand's
  world position (`ballSocket.getWorldPosition`).
- `SWING_CONTACT` (0.15 s) is when the barrel crosses the contact plane in every swing clip
  (all swings share `launch()` in clips.js; only the finish differs: `line`, `lift`, `chop`).
  See the hitting contract in `threejs-game-feel` for how contact is planned and timed.
- `Animator.constrainBat` runs every frame for a held bat: rotates it about the hands to stay
  outside the helmet sphere and torso capsule and slides it back within arm reach, so no aim
  offset can push the bat through the body or pull the hands off the grip.
- Finishes wrap the barrel behind the shoulders below the helmet line (yaw ~230-245); the
  chibi head is too big for an over-the-head finish. Verify with `node tests/swing-check.mjs`.

## Adding a clip
1. Add the spec to `BATTER_CLIPS` / `PITCHER_CLIPS`.
2. Inspect it frozen: `node tests/lab.mjs '[["", "hra.play()", 1200], ["", "hra.freeze()", 100], ["pose", "hra.cam([0.6,1.3,-3.4],[-0.8,1,0],36); hra.pose(\"batter\",\"swing\",0.1)", 700]]'`
   (screenshots land in `tests/out/`). Use a time just before an event so the event's
   listener doesn't restart playback.
3. Check `hra.gaps()` - non-zero means an IK target was out of reach (hand left the bat).
