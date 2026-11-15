# Cyber Heist — Glass District

A third-person parkour getaway in the browser. You've just robbed Kumo Bank and
have $50,000 in an overstuffed backpack; kick through the window and reach the
getaway van with as much of it as you can. One handcrafted level, about 65 seconds.

Built with Three.js + Vite. All art, text and sound are generated at runtime — no
asset downloads, no accounts, nothing to install for players.

## Run

```bash
npm install
npm run dev      # prints a local URL and a network URL (open that on a phone / Chromebook)
```

`npm run build` writes a static site to `dist/` that can be hosted from any folder.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | A / D or ← / → | left pad |
| Jump, double jump, vault, wall kick-off | Space (W / ↑) | JUMP |
| Slide, landing roll | S / ↓ | SLIDE |
| Retry | R (Space / Enter on the results screen) | RETRY |
| Mute | M | ♪ |

- **Vault:** jump when you're right at a low obstacle. Jump earlier and it's a normal jump.
- **Wall run:** jump beside the yellow billboard and steer into it; jump again on the KICK panel.
- **Roll:** tap slide just before landing from a long drop to keep your speed.
- Clip an obstacle and a $2,500 bundle flies out — chase it down to get it back.
  Falling off the route costs $5,000 and puts you back at the last checkpoint.

## Layout

- `src/level.js` — level data: colliders, obstacles, wall, zones, checkpoints
- `src/player.js` — runner physics and parkour moves
- `src/runner.js` — character model and procedural animation
- `src/world.js` — city and route visuals
- `src/main.js` — game loop, camera, HUD, cash rules
- `src/fx.js`, `src/audio.js`, `src/input.js` — particles, synthesised sound, keyboard/touch

## Tests

With the dev server running, `npm test` plays the level headlessly with a scripted
bot (both routes, the missed rooftop jump, cash loss/recovery, falls, retry, saved
bests). `tests/live.mjs` checks real keyboard and multi-touch input, and
`tests/shots.mjs` captures screenshots along the route. They need Playwright;
if it is installed globally, point `PW` at it: `PW=$(npm root -g)/playwright npm test`.
