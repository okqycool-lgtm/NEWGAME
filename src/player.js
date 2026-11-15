// Runner controller: custom AABB physics tuned for an auto-runner.
// No rendering here — the game reads state + events and animates from them.
import { BASE_SPEED, colliders, walls, clampAt, killY, speedMult, checkpoints, VAN } from './level.js';

export const HW = 0.35;      // half width
export const HD = 0.3;       // half depth
export const H_STAND = 1.7;
export const H_LOW = 0.75;
const G = 32;
const JUMP_V = 11;
const DJUMP_V = 10;
const STEP_UP = 0.45;
const LEDGE_REACH = 1.6;
const VAULT_RANGE = 3.3;
const ROLL_DROP = 6.5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const topAt = (c, d) => (c.kind === 'ramp' ? c.yA + (c.yB - c.yA) * clamp((d - c.d0) / (c.d1 - c.d0), 0, 1) : c.y1);

export class Player {
  constructor() {
    this.events = [];
    this.reset(false);
  }

  emit(type, data) { this.events.push({ type, ...data }); }
  setState(s) { if (s !== this.state) { this.state = s; this.stateT = 0; } }
  get height() { return this.state === 'slide' || this.state === 'roll' ? H_LOW : H_STAND; }

  reset(retry) {
    Object.assign(this, {
      x: 0, y: 34, d: retry ? -9.5 : -12, vx: 0, vy: 0, speed: BASE_SPEED,
      grounded: true, state: 'ready', stateT: 0, autoKick: retry, kickPhase: 0,
      usedDouble: false, jumpBuf: 0, slideBuf: 0, coyote: 0,
      invuln: 0, slowT: 0, hardT: 0, boostT: 0, stumbleT: 0,
      kickT: 0, kickDur: 0.45, kickVx: 0, assistT: 0, assistVx: 0,
      wall: null, wallT: 0, wallCd: 0, awayT: 0,
      peakY: 34, blockedT: 0, ghosts: new Set(), cp: checkpoints[0],
      phase: 0, firstLanding: true, frontLimit: Infinity, vanSpeed: VAN.speed,
      vault: null, ledge: null, ground: null, djT: 9, landT: 9, landKind: '', steer: 0, glassBroken: false,
    });
  }

  respawn() {
    const cp = this.cp;
    Object.assign(this, {
      x: cp.x, y: cp.y, d: cp.d, vx: 0, vy: 0, speed: 4, grounded: true,
      usedDouble: false, jumpBuf: 0, slideBuf: 0, coyote: 0,
      invuln: 1.6, slowT: 0, hardT: 0, boostT: 0, stumbleT: 0, kickT: 0, assistT: 0,
      wall: null, wallCd: 0, peakY: cp.y, blockedT: 0, vault: null, ledge: null,
    });
    this.ghosts.clear();
    this.setState('run');
  }

  // ------------------------------------------------------------ queries
  groundUnder(x, d, maxY) {
    let best = null, bestTop = -Infinity;
    for (const c of colliders) {
      if (c.kind === 'over' || this.ghosts.has(c.id)) continue;
      if (x + 0.25 <= c.x0 || x - 0.25 >= c.x1 || d + 0.25 <= c.d0 || d - 0.25 >= c.d1) continue;
      const top = topAt(c, d);
      if (top <= maxY && top > bestTop) { bestTop = top; best = c; }
    }
    return best ? { c: best, top: bestTop } : null;
  }

  canStand() {
    for (const c of colliders) {
      if (c.kind !== 'over' || this.ghosts.has(c.id)) continue;
      if (this.x + HW > c.x0 && this.x - HW < c.x1 && this.d + HD + 0.35 > c.d0 && this.d - HD - 0.35 < c.d1 &&
          this.y + H_STAND > c.y0 && this.y < c.y1) return false;
    }
    return true;
  }

  onSlope() {
    const g = this.ground;
    return this.grounded && !!g && g.kind === 'ramp' && g.yB < g.yA && this.d < g.d1 - 0.3;
  }

  findVault() {
    let best = null, bestGap = Infinity;
    for (const c of colliders) {
      if (c.kind !== 'low' || this.ghosts.has(c.id)) continue;
      if (c.y1 - c.y0 > 1.3 || Math.abs(c.y0 - this.y) > 0.3) continue;
      if (this.x + 0.45 <= c.x0 || this.x - 0.45 >= c.x1) continue;
      const gap = c.d0 - (this.d + HD);
      if (gap >= -0.25 && gap <= VAULT_RANGE && gap < bestGap) { best = c; bestGap = gap; }
    }
    return best;
  }

  // ------------------------------------------------------------ main step
  step(dt, inp) {
    this.stateT += dt;
    this.steer = inp.steer;
    this.jumpBuf = inp.jump ? 0.14 : this.jumpBuf - dt;
    this.slideBuf = inp.slide ? 0.24 : this.slideBuf - dt;
    for (const k of ['invuln', 'slowT', 'hardT', 'boostT', 'stumbleT', 'kickT', 'assistT', 'wallCd', 'coyote']) {
      if (this[k] > 0) this[k] -= dt;
    }
    this.djT += dt; this.landT += dt;

    switch (this.state) {
      case 'done': case 'busted': return;
      case 'ready': return this.stepReady(dt);
      case 'kick': return this.stepKick(dt);
      case 'ledge': return this.stepLedge(dt);
      case 'vault': this.moveLateral(dt, inp.steer); return this.stepVault(dt);
    }

    this.handleJump();
    if (this.state === 'vault') return;
    this.handleSlide(inp);

    if (this.state === 'wallrun') {
      this.moveForward(dt);
      if (this.state === 'wallrun') this.stepWall(dt, inp);
    } else {
      this.moveLateral(dt, inp.steer);
      this.moveForward(dt);
      if (this.state !== 'ledge' && this.state !== 'done') this.moveVertical(dt, inp);
    }
    this.phase += this.speed * dt * 1.3;
    this.postChecks(dt);
  }

  // ------------------------------------------------------------ intro
  stepReady(dt) {
    this.d = Math.min(-5, this.d + this.speed * dt);
    this.phase += this.speed * dt * 1.3;
    if (this.jumpBuf > 0 || (this.autoKick && this.d >= -5)) {
      this.jumpBuf = 0;
      this.setState('kick');
      this.kickPhase = 0;
      this.emit('kickstart');
    }
  }

  stepKick(dt) {
    if (this.kickPhase === 0) {           // short dash to the launch mark
      this.d += 16 * dt;
      this.phase += 16 * dt * 1.3;
      if (this.d >= -5) { this.kickPhase = 1; this.vy = 5.5; this.grounded = false; this.stateT = 0; this.emit('kicklaunch'); }
      return;
    }
    this.d += 14 * dt;
    this.vy -= G * dt;
    this.y += this.vy * dt;
    if (!this.glassBroken && this.d + 0.9 >= 0) { this.glassBroken = true; this.emit('glass'); }
    if (this.d > 1.2) {
      this.speed = 14; this.peakY = this.y; this.usedDouble = false;
      this.setState('air');
    }
  }

  // ------------------------------------------------------------ actions
  handleJump() {
    if (this.jumpBuf <= 0) return;
    if (this.state === 'wallrun') {
      const w = this.wall;
      this.vy = 10.5; this.vx = 0;
      this.kickVx = -w.side * 6.5; this.kickT = this.kickDur;
      this.usedDouble = false; this.wallCd = 0.6; this.boostT = 1.5;
      this.wall = null; this.peakY = this.y; this.jumpBuf = 0;
      this.setState('air');
      this.emit('kickoff', { good: this.d >= w.kickFrom - 6 });
      return;
    }
    const low = this.state === 'slide' || this.state === 'roll';
    if ((this.grounded || this.coyote > 0) && (!low || this.canStand())) {
      this.jumpBuf = 0; this.coyote = 0;
      const v = this.grounded && !low ? this.findVault() : null;
      if (v) {
        this.vault = { c: v, d0: this.d, y0: this.y, dEnd: v.d1 + 1.4, speed: Math.max(this.speed, BASE_SPEED) * 1.08 };
        this.grounded = false; this.boostT = 1.4;
        this.setState('vault');
        this.emit('vault');
        return;
      }
      this.vy = JUMP_V; this.grounded = false; this.peakY = this.y;
      this.setState('air');
      this.emit('jump');
    } else if (!this.grounded && this.state === 'air' && !this.usedDouble) {
      this.jumpBuf = 0;
      this.vy = DJUMP_V; this.usedDouble = true; this.djT = 0;
      this.emit('djump');
    }
  }

  handleSlide(inp) {
    if (this.state === 'run' && this.grounded && this.slideBuf > 0) {
      this.slideBuf = 0;
      this.setState('slide');
      this.emit('slide');
    } else if (this.state === 'slide') {
      // on a downhill slope the slide carries all the way to the bottom
      if (this.onSlope()) this.boostT = Math.max(this.boostT, 1.2);
      else if (this.stateT > 0.5 && (!inp.slideHeld || this.stateT > 1.3) && this.canStand()) this.setState('run');
    } else if (this.state === 'roll') {
      if (this.stateT > 0.5 && this.canStand()) this.setState('run');
    }
  }

  clip(c) {
    this.ghosts.add(c.id);
    if (this.invuln > 0) return;
    const before = this.speed;
    this.invuln = 1.2; this.slowT = 0.7; this.stumbleT = 0.55;
    this.speed *= 0.5;
    this.emit('clip', { c, before });
  }

  // ------------------------------------------------------------ movement
  moveLateral(dt, steer) {
    const tv = steer * (this.grounded ? 9.5 : 8.5);
    this.vx += (tv - this.vx) * Math.min(1, dt * (this.grounded ? 16 : 10));
    let ext = 0;
    if (this.kickT > 0) ext += this.kickVx * (this.kickT / this.kickDur);
    if (this.assistT > 0) { ext += this.assistVx; this.vx = 0; }   // awning bounce carries the runner predictably
    const px = this.x;
    this.x += (this.vx + ext) * dt;
    const cl = clampAt(this.d);
    if (cl) this.x = clamp(this.x, cl[0] + HW, cl[1] - HW);

    const h = this.height;
    for (const c of colliders) {
      if (c.kind === 'ramp' || c.kind === 'over' || this.ghosts.has(c.id)) continue;
      if (this.d + HD <= c.d0 || this.d - HD >= c.d1) continue;
      if (this.y + h <= c.y0 || this.y + 0.5 >= c.y1) continue;
      if (this.x + HW <= c.x0 || this.x - HW >= c.x1) continue;
      if (px + HW <= c.x0 + 0.05) { this.x = c.x0 - HW; this.vx = Math.min(this.vx, 0); }
      else if (px - HW >= c.x1 - 0.05) { this.x = c.x1 + HW; this.vx = Math.max(this.vx, 0); }
    }

    // wall-run attach
    if (!this.grounded && this.state === 'air' && this.wallCd <= 0) {
      for (const w of walls) {
        if (this.d < w.d0 || this.d > w.d1 - 1) continue;
        if (this.y + 0.9 < w.y0 || this.y + 0.9 > w.y1) continue;
        if (steer * w.side < 0.3) continue;
        if (Math.abs(this.x - (w.x - w.side * HW)) > 0.3) continue;
        this.wall = w; this.wallT = 0; this.awayT = 0;
        this.x = w.x - w.side * HW; this.vx = 0;
        this.vy = Math.max(this.vy * 0.4, 2);
        this.usedDouble = false;
        this.setState('wallrun');
        this.emit('wallrun');
        break;
      }
    }
  }

  moveForward(dt) {
    let target = BASE_SPEED * speedMult(this.d, this.y);
    if (this.boostT > 0) target *= 1.15;
    if (this.state === 'wallrun') target = Math.max(target, BASE_SPEED * 1.12);
    if (this.state === 'slide' && this.onSlope()) target = BASE_SPEED * 1.4;      // gravity does the work
    if (this.slowT > 0) target *= 0.5;
    if (this.hardT > 0) target *= 0.6;
    // momentum carries through the air: launching off a slope keeps its speed
    this.speed += clamp(target - this.speed, (this.grounded ? -40 : -4) * dt, 26 * dt);

    const pd = this.d;
    this.d += this.speed * dt;
    const h = this.height;
    let blocked = false;
    for (const c of colliders) {
      if (c.kind === 'ramp' || this.ghosts.has(c.id)) continue;
      if (this.x + HW <= c.x0 + 0.02 || this.x - HW >= c.x1 - 0.02) continue;
      if (this.d + HD <= c.d0 || this.d - HD >= c.d1) continue;
      if (this.y + h <= c.y0 || this.y >= c.y1 - 0.001) continue;
      if (c.kind === 'over') { this.clip(c); continue; }
      const rise = c.y1 - this.y;
      if (c.kind === 'low') {
        if (rise <= STEP_UP) { this.y = c.y1; if (this.vy < 0) this.vy = 0; }
        else this.clip(c);
        continue;
      }
      if (rise <= STEP_UP) { this.y = c.y1; if (this.vy < 0) this.vy = 0; continue; }
      if (pd + HD > c.d0 + 0.3) continue;            // already inside laterally; not a frontal hit
      if (rise <= LEDGE_REACH && this.state !== 'wallrun') {
        this.ledge = { x: this.x, y: this.y, d: c.d0 - HD, top: c.y1, dEnd: c.d0 + 0.5 };
        this.d = c.d0 - HD; this.vy = 0; this.vx = 0; this.grounded = false;
        this.setState('ledge');
        this.emit('ledge');
        return;
      }
      this.d = c.d0 - HD; this.speed = 0; blocked = true;
    }
    this.blockedT = blocked && this.grounded ? this.blockedT + dt : 0;

    // getaway van: an invisible moving bumper until the runner jumps in
    if (this.d + HD > this.frontLimit) {
      if (!this.grounded && this.y >= VAN.bedY - 0.5) {
        this.setState('done');
        this.emit('van');
      } else {
        this.d = this.frontLimit - HD;
        this.speed = Math.min(this.speed, this.vanSpeed);
      }
    }
  }

  moveVertical(dt) {
    if (this.grounded) {
      const g = this.groundUnder(this.x, this.d, this.y + STEP_UP);
      if (g && g.top >= this.y - 0.55) {
        this.y = g.top; this.ground = g.c;
        if (g.c.kind === 'bounce') this.bounce(g.c);
      } else {
        this.grounded = false; this.coyote = 0.11; this.vy = 0; this.peakY = this.y; this.ground = null;
        if (this.state === 'run') this.setState('air');
      }
      return;
    }
    this.vy = Math.max(this.vy - G * dt, -42);
    const py = this.y;
    this.y += this.vy * dt;
    if (this.y > this.peakY) this.peakY = this.y;
    if (this.vy <= 0) {
      const g = this.groundUnder(this.x, this.d, py + 0.02);
      if (g && g.top >= this.y) this.land(g);
    }
  }

  land(g) {
    const fall = this.peakY - g.top;
    this.y = g.top; this.vy = 0; this.grounded = true; this.usedDouble = false; this.ground = g.c;
    this.landT = 0; this.kickT = 0;
    if (g.c.kind === 'bounce') return this.bounce(g.c);
    const first = this.firstLanding;
    this.firstLanding = false;
    if (fall >= ROLL_DROP && !first) {
      if (this.slideBuf > 0) {
        this.slideBuf = 0; this.boostT = 1.2; this.landKind = 'roll';
        this.setState('roll');
        this.emit('land', { kind: 'roll', fall });
        return;
      }
      this.hardT = 0.45; this.speed *= 0.6; this.landKind = 'hard';
      this.setState('run');
      this.emit('land', { kind: 'hard', fall });
      return;
    }
    this.landKind = 'soft';
    if (this.state === 'slide' || this.state === 'roll') { /* keep low state */ }
    else this.setState('run');
    this.emit('land', { kind: 'soft', fall });
  }

  bounce(c) {
    this.grounded = false; this.usedDouble = false;
    this.vy = 11.5; this.peakY = this.y;
    if (this.x < c.targetX - 1) {
      this.assistT = 0.9;
      this.assistVx = (c.targetX - this.x) / 0.9;
    }
    this.setState('air');
    this.emit('bounce');
  }

  stepWall(dt, inp) {
    const w = this.wall;
    this.vy += (-1.0 - this.vy) * Math.min(1, 5 * dt);
    this.y = Math.min(this.y + this.vy * dt, w.y1 - 1.9);
    this.x = w.x - w.side * HW;
    this.wallT += dt;
    this.awayT = inp.steer * w.side < -0.5 ? this.awayT + dt : 0;
    if (this.d > w.d1 - 0.2 || this.wallT > 3.4 || this.awayT > 0.2 || this.y + 0.9 < w.y0) {
      this.wall = null; this.wallCd = 0.6; this.peakY = this.y;
      this.setState('air');
      this.emit('walloff');
    }
  }

  stepVault(dt) {
    const v = this.vault, c = v.c;
    this.speed = v.speed;
    this.d += v.speed * dt;
    this.phase += v.speed * dt * 1.3;
    const up = smooth(v.d0, Math.max(v.d0 + 0.4, c.d0 - 0.3), this.d);
    const down = 1 - smooth(c.d1 + 0.2, v.dEnd, this.d);
    this.y = v.y0 + (c.y1 - v.y0 + 0.3) * Math.min(up, down);
    if (this.d >= v.dEnd) {
      this.y = v.y0; this.vy = 0; this.grounded = true; this.vault = null; this.peakY = this.y;
      this.setState('run');
    }
  }

  stepLedge(dt) {
    const l = this.ledge, k = clamp(this.stateT / 0.36, 0, 1);
    const e = k * k * (3 - 2 * k);
    this.y = l.y + (l.top - l.y) * Math.min(1, e * 1.5);
    this.d = l.d + (l.dEnd - l.d) * Math.max(0, (e - 0.4) / 0.6);
    if (k >= 1) {
      this.y = l.top; this.d = l.dEnd; this.grounded = true; this.usedDouble = false;
      this.speed = BASE_SPEED * 0.8; this.ledge = null; this.peakY = this.y;
      this.setState('run');
    }
  }

  postChecks() {
    if (this.grounded) {
      for (const cp of checkpoints) {
        if (cp.d <= this.cp.d || this.d < cp.d || this.d > cp.d + 30) continue;
        if (Math.abs(this.y - cp.y) > 0.6) continue;
        if (cp.x0 !== undefined && (this.x < cp.x0 || this.x > cp.x1)) continue;
        this.cp = cp;
      }
    }
    if (this.y < killY(this.d)) this.emit('fall', { why: 'fell' });
    else if (this.blockedT > 0.7) this.emit('fall', { why: 'stuck' });
  }
}
