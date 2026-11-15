// All sound is synthesised with WebAudio — nothing is downloaded.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('cyberheist.muted') === '1'; } catch { /* storage unavailable */ }
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // vending-machine hum
      this.humGain = ctx.createGain(); this.humGain.gain.value = 0; this.humGain.connect(this.master);
      for (const f of [100, 151]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(this.humGain); o.start(); }
      this.step16 = 0; this.nextT = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 80);
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('cyberheist.muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }
  setHum(v) { if (this.humGain) this.humGain.gain.setTargetAtTime(v * 0.05, this.ctx.currentTime, 0.1); }

  tone(f, f2, dur, type = 'square', vol = 0.15, at = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.2, freq = 1200, kind = 'bandpass', at = 0, f2 = freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at, s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    fl.type = kind; fl.frequency.setValueAtTime(freq, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name) {
    switch (name) {
      case 'step': this.noise(0.05, 0.07, 900, 'bandpass'); break;
      case 'jump': this.tone(260, 520, 0.14, 'square', 0.09); break;
      case 'djump': this.tone(500, 1500, 0.2, 'sawtooth', 0.1); this.noise(0.25, 0.14, 3000, 'highpass', 0, 800); break;
      case 'vault': this.noise(0.22, 0.16, 600, 'bandpass', 0, 2400); this.tone(180, 90, 0.08, 'sine', 0.2); break;
      case 'slide': this.noise(0.5, 0.14, 2600, 'bandpass', 0, 500); break;
      case 'land': this.tone(120, 50, 0.1, 'sine', 0.25); break;
      case 'hard': this.tone(110, 35, 0.25, 'sine', 0.4); this.noise(0.15, 0.2, 300, 'lowpass'); break;
      case 'roll': this.noise(0.35, 0.16, 500, 'bandpass', 0, 1800); this.tone(660, 990, 0.12, 'triangle', 0.1, 0.1); break;
      case 'wallrun': this.noise(0.3, 0.12, 1500, 'bandpass', 0, 3000); this.tone(330, 440, 0.2, 'triangle', 0.1); break;
      case 'kickoff': this.tone(300, 900, 0.18, 'sawtooth', 0.12); this.tone(90, 40, 0.12, 'sine', 0.3); break;
      case 'bounce': this.tone(160, 480, 0.25, 'sine', 0.3); break;
      case 'ledge': this.tone(200, 300, 0.1, 'triangle', 0.15); break;
      case 'glass':
        this.noise(0.7, 0.4, 5000, 'highpass', 0, 1500);
        for (let i = 0; i < 9; i++) this.tone(1800 + Math.random() * 3000, 900, 0.12, 'triangle', 0.07, 0.03 + i * 0.05);
        this.tone(100, 40, 0.2, 'sine', 0.4);
        break;
      case 'clip': this.tone(220, 60, 0.3, 'sawtooth', 0.2); this.noise(0.2, 0.25, 400, 'lowpass'); break;
      case 'recover': [660, 880, 1320].forEach((f, i) => this.tone(f, f, 0.12, 'square', 0.1, i * 0.07)); break;
      case 'lost': this.tone(300, 120, 0.35, 'triangle', 0.14); break;
      case 'fall': this.tone(500, 60, 0.6, 'sawtooth', 0.16); break;
      case 'siren': for (let i = 0; i < 4; i++) this.tone(i % 2 ? 620 : 880, i % 2 ? 620 : 880, 0.16, 'square', 0.08, i * 0.16); break;
      case 'busted': this.tone(400, 70, 0.7, 'sawtooth', 0.22); this.noise(0.3, 0.3, 300, 'lowpass'); for (let i = 0; i < 6; i++) this.tone(i % 2 ? 620 : 880, i % 2 ? 620 : 880, 0.14, 'square', 0.07, 0.2 + i * 0.14); break;
      case 'finish': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.11, i * 0.09)); break;
    }
  }

  // tiny 16-step synth loop
  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    const stepDur = 60 / 126 / 4;
    const bass = [55, 0, 55, 55, 0, 55, 65.4, 0, 49, 0, 49, 49, 0, 49, 41.2, 49];
    const lead = [440, 0, 523, 0, 659, 0, 523, 0, 392, 0, 494, 0, 587, 0, 494, 659];
    while (this.nextT < ctx.currentTime + 0.25) {
      const i = this.step16 % 16, at = this.nextT - ctx.currentTime;
      if (bass[i]) this.tone(bass[i], bass[i], stepDur * 1.6, 'sawtooth', 0.085, at);
      if (i % 4 === 0) this.tone(140, 42, 0.16, 'sine', 0.28, at);
      if (i % 4 === 2) this.noise(0.04, 0.05, 7000, 'highpass', at);
      if (i % 8 === 4) this.noise(0.12, 0.09, 1800, 'bandpass', at);
      if (lead[i] && Math.floor(this.step16 / 32) % 2 === 1) this.tone(lead[i], lead[i], stepDur * 0.9, 'triangle', 0.035, at);
      this.nextT += stepDur; this.step16++;
    }
  }
}
