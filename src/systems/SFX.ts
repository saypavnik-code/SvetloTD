// ─────────────────────────────────────────────────────────────────────────────
// SFX.ts — Procedural sound effects via Web Audio API. Zero audio files.
//
// Instance class (not static) — one instance owned by GameScene.
// Throttle: max 3 identical sounds per 100ms window (canPlay guard).
// Includes hero ability sounds for future use.
// ─────────────────────────────────────────────────────────────────────────────

export class SFX {
  private ctx:           AudioContext;
  private output:        GainNode;
  private lastPlayTimes: Map<string, number[]> = new Map();

  constructor(sfxGainNode: GainNode) {
    this.ctx    = sfxGainNode.context as AudioContext;
    this.output = sfxGainNode;
  }

  // Throttle guard — max 3 identical sounds per 100ms
  private canPlay(id: string): boolean {
    const now   = performance.now();
    const times = (this.lastPlayTimes.get(id) ?? []).filter(t => now - t < 100);
    if (times.length >= 3) return false;
    times.push(now);
    this.lastPlayTimes.set(id, times);
    return true;
  }

  // ── Towers ──────────────────────────────────────────────────────────────────

  shootArrow(): void {
    if (!this.canPlay('arrow')) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.07);
  }

  shootCannon(): void {
    if (!this.canPlay('cannon')) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.25);
  }

  shootMagic(): void {
    if (!this.canPlay('magic')) return;
    const now     = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.1);
    const buf     = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d       = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(f).connect(g).connect(this.output);
    src.start(now);
  }

  shootIce(): void {
    if (!this.canPlay('ice')) return;
    const now     = this.ctx.currentTime;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buf     = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d       = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(f).connect(g).connect(this.output);
    src.start(now);
  }

  shootAcid(): void {
    if (!this.canPlay('acid')) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(f).connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.15);
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  enemyDeath(): void {
    if (!this.canPlay('death')) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.12);
  }

  goldEarned(): void {
    if (!this.canPlay('gold')) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1108, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.25);
  }

  build(): void {
    const now = this.ctx.currentTime;
    ([0, 0.08] as const).forEach(offset => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = offset === 0 ? 300 : 400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(g).connect(this.output);
      osc.start(now + offset); osc.stop(now + offset + 0.1);
    });
  }

  enemyLeak(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 110;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.9);
  }

  waveComplete(): void {
    const now = this.ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.12);
      g.gain.linearRampToValueAtTime(0.07, now + i * 0.12 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
      osc.connect(g).connect(this.output);
      osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.45);
    });
  }

  bossAlert(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(65, now + 1.0);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.3);
    g.gain.linearRampToValueAtTime(0.08, now + 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(f).connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 1.6);
  }

  uiClick(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.04, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.05);
  }

  sell(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.18);
  }

  upgrade(): void {
    const now = this.ctx.currentTime;
    [400, 600, 800].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.08);
      g.gain.linearRampToValueAtTime(0.06, now + i * 0.08 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(g).connect(this.output);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.25);
    });
  }

  // ── Hero abilities (Stage 5) ─────────────────────────────────────────────────

  shockwave(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.25);
  }

  amberShield(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g).connect(this.output);
    osc.start(now); osc.stop(now + 0.45);
  }
}
