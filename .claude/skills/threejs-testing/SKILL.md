---
name: threejs-testing
description: Test the three.js game headlessly - Playwright with the preinstalled Chromium (SwiftShader WebGL), serving the static site, screenshots of states/cinematics, deterministic debug hooks on window.hra (seeded RNG, auto-perfect swings, jump to clash, time control), and the full-flow test from first pitch to the next encounter. Use before committing gameplay or visual changes.
---

# Testing

- Serve: `node tools/serve.mjs 8080` (or `npm start`).
- Flow test: `node tests/flow.mjs` - loads the game, plays pitches with the auto-swing hook,
  asserts hits/home runs register, Resolve drops, Clash triggers, cinematic finishes, upgrade
  screen appears, an upgrade applies and encounter 2 starts. Writes screenshots to
  `tests/out/` (git-ignored).
- Inspection: `node tests/lab.mjs '<json [[name, js, waitMs], ...]>' [w] [h] [query]` runs
  steps in one page and saves `tests/out/<name>.png` per named step. `tests/shoot.mjs` is the
  single-shot version; `tests/fps.mjs [low|medium|high]` prints fps and renderer.info.

## Hitting checks (run after touching swings, contact, camera or ball flight)
- `node tests/contact-sweep.mjs` - forced pitches (middle/high/low/inside/outside, fast/curve/change)
  x timings x aims, at 60 fps and 10 fps: every awarded hit must show the drawn barrel within 6 cm of
  the drawn ball on the contact frame; every miss must stay > 8 cm away.
- `node tests/swing-check.mjs` - every swing clip at 240 Hz, plain and bent toward low/high/inside/
  outside pitches: hand-to-grip gap < 1 cm, bat clear of helmet, torso and shoulders.
- `node tests/record-hits.mjs [--clean] [--closeup] [--only a,b]` - frame-exact recordings of
  miss / grounder / liner / deepfly / early / ontime / late from the gameplay camera into
  `tests/out/rec/*.mp4` (+ `-quarter.mp4`); `--clean` hides HUD, trails and impact effects;
  `--closeup` steps 1/240 s around contact from a side camera. `python3 tests/sheet.py` makes
  contact sheets from the frame folders.

## Debug hooks (`window.hra`, always present, harmless in production)
- `hra.state()` → `{ phase, resolve, strikes, outs, encounter, lastHit }`
- `hra.play()` - presses PLAY BALL.
- `hra.autoSwing( tier )` - swings at the exact sim time for the requested quality
  ('perfect' | 'excellent' | 'good' | 'weak' | 'miss'); `null` turns it off.
- `hra.setResolve( v )` (≤ 25% arms Home Run Clash), `hra.pickUpgrade( id )`, `hra.setHand( ±1 )`.
- `hra.manual()` + `hra.step( n, dt )` drive the game at a fixed step (deterministic recordings);
  `hra.forcePitch( type, x, y )`, `hra.swingAt( { dt, dy, dx } )` (dt = barrel minus ball arrival, s;
  dy/dx = ball minus reticle, m), `hra.clean( true )` hides HUD/effects, `hra.contact()` returns the
  last contact diagnostics (barrel-to-ball distance, contact point, spray, launch angle).
- `hra.freeze()` stops the game flow; `hra.pose( 'batter'|'pitcher', clip, t )` holds a pose;
  `hra.cam( [x,y,z], [lookX,lookY,lookZ], fov )` sets a fixed camera; `hra.gaps()` reports IK reach gaps.
- `?seed=123` makes pitch selection deterministic.

## Headless notes
- Chromium runs WebGL through SwiftShader: slow (~5-15 fps). Tests must wait on game state
  (`page.waitForFunction( () => hra.state().phase === 'upgrade' )`), not on wall-clock sleeps.
- Launch with `args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']`.
- Use `deviceScaleFactor: 1` for checks you only read yourself; 2 for screenshots for people.
- Collect `page.on('console')` / `pageerror` and fail on any error.
