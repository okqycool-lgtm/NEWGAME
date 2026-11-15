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

  bindTouch({ root, steer, knob, jump, slide }) {
    const show = () => { if (!this.touchMode) { this.touchMode = true; } root.classList.add('on'); };
    if (matchMedia('(pointer: coarse)').matches) show();
    addEventListener('touchstart', show, { passive: true });

    // steering pad: where the thumb is on the pad = how hard to steer
    let steerId = null;
    const setSteer = (e) => {
      const r = steer.getBoundingClientRect();
      const v = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.3)));
      this.touchSteer = Math.abs(v) < 0.12 ? 0 : v;
      knob.style.transform = `translateX(${v * r.width * 0.3}px)`;
    };
    steer.addEventListener('pointerdown', (e) => {
      e.preventDefault(); steerId = e.pointerId; steer.setPointerCapture(e.pointerId); steer.classList.add('down'); setSteer(e); this.onAny?.();
    });
    steer.addEventListener('pointermove', (e) => { if (e.pointerId === steerId) setSteer(e); });
    const endSteer = (e) => {
      if (e.pointerId !== steerId) return;
      steerId = null; this.touchSteer = 0; knob.style.transform = ''; steer.classList.remove('down');
    };
    steer.addEventListener('pointerup', endSteer); steer.addEventListener('pointercancel', endSteer);

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
