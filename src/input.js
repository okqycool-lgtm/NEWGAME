// Keyboard + multi-touch input. Steering is continuous; jump/slide are edge-triggered
// with the hold state of slide exposed for long slides.
export class Input {
  constructor() {
    this.left = false; this.right = false;
    this.touchSteer = 0; this.slideKey = false; this.slideTouch = false;
    this.jumpQ = 0; this.slideQ = 0;
    this.touchMode = false;
    this.onAny = null;        // called on any deliberate input (unlock audio etc.)
    this.onRetry = null; this.onMute = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) { if (isGameKey(e.code)) e.preventDefault(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      let used = true;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.left = true; break;
        case 'ArrowRight': case 'KeyD': this.right = true; break;
        case 'Space': case 'ArrowUp': case 'KeyW': this.jumpQ++; break;
        case 'ArrowDown': case 'KeyS': this.slideKey = true; this.slideQ++; break;
        case 'KeyR': case 'Enter': this.onRetry?.(e.code); break;
        case 'KeyM': this.onMute?.(); break;
        default: used = false;
      }
      if (used) { e.preventDefault(); this.touchMode = false; this.onAny?.(); }
    });
    addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.left = false; break;
        case 'ArrowRight': case 'KeyD': this.right = false; break;
        case 'ArrowDown': case 'KeyS': this.slideKey = false; break;
      }
    });
    addEventListener('blur', () => { this.left = this.right = this.slideKey = false; });
  }

  bindTouch({ root, zone, knob, jump, slide }) {
    const show = () => { this.touchMode = true; root.classList.add('on'); };
    if (matchMedia('(pointer: coarse)').matches) show();
    addEventListener('touchstart', show, { passive: true });

    // Steering: drag anywhere on the screen. The first touch point is the centre of a
    // virtual stick; dragging past its range slides the centre along so reversing is instant.
    const RANGE = 46;
    let steerId = null, cx = 0;
    const setSteer = (e) => {
      let dx = e.clientX - cx;
      if (dx > RANGE) { cx = e.clientX - RANGE; dx = RANGE; } else if (dx < -RANGE) { cx = e.clientX + RANGE; dx = -RANGE; }
      const v = dx / RANGE;
      this.touchSteer = Math.abs(v) < 0.14 ? 0 : v;
      knob.style.transform = `translate(${cx + dx - 28}px, ${e.clientY - 28}px)`;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (steerId !== null) return;
      e.preventDefault(); steerId = e.pointerId; cx = e.clientX;
      try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      if (e.pointerType !== 'mouse') show();
      knob.classList.add('on'); setSteer(e); this.onAny?.();
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === steerId) setSteer(e); });
    const endSteer = (e) => {
      if (e.pointerId !== steerId) return;
      steerId = null; this.touchSteer = 0; knob.classList.remove('on');
    };
    zone.addEventListener('pointerup', endSteer); zone.addEventListener('pointercancel', endSteer);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());

    const button = (el, down, up) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); down(); this.onAny?.(); });
      const end = () => { el.classList.remove('down'); up?.(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    button(jump, () => { this.jumpQ++; });
    button(slide, () => { this.slideTouch = true; this.slideQ++; }, () => { this.slideTouch = false; });
  }

  pressJump() { this.jumpQ++; }

  // Read + clear edge inputs. Called once per simulation frame.
  consume() {
    const kb = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    const r = {
      steer: kb !== 0 ? kb : this.touchSteer,
      jump: this.jumpQ > 0, slide: this.slideQ > 0,
      slideHeld: this.slideKey || this.slideTouch,
    };
    this.jumpQ = 0; this.slideQ = 0;
    return r;
  }
}
const isGameKey = (c) => ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c);
