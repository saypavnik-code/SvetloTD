// ─────────────────────────────────────────────────────────────────────────────
// AudioManager.ts — Web Audio API singleton.
//
// Rules:
//   • AudioContext is created ONLY on first user gesture (MenuScene play click).
//   • All other audio subsystems grab ctx / gain nodes from here.
//   • Volume persisted to localStorage; loaded on init.
//
// Graph:
//   OscillatorNode / BufferSourceNode
//     → [per-sound gain]
//     → sfxGain | musicGain
//     → masterGain
//     → ctx.destination
// ─────────────────────────────────────────────────────────────────────────────

export class AudioManager {
  private static _ctx:        AudioContext | null = null;
  private static _master:     GainNode;
  private static _music:      GainNode;
  private static _sfx:        GainNode;
  private static _ready       = false;

  // ── Init — call once on first user click ────────────────────────────────────
  static init(): void {
    if (this._ready) return;

    // Safari still needs the webkit prefix in some versions
    const Ctx = (window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext);

    this._ctx = new Ctx();

    // Master → destination
    this._master = this._ctx.createGain();
    this._master.gain.value = 0.7;
    this._master.connect(this._ctx.destination);

    // Music sub-bus
    this._music = this._ctx.createGain();
    this._music.gain.value = 0.30;
    this._music.connect(this._master);

    // SFX sub-bus
    this._sfx = this._ctx.createGain();
    this._sfx.gain.value = 0.50;
    this._sfx.connect(this._master);

    // Restore saved volumes
    const sm = localStorage.getItem('vol_music');
    const ss = localStorage.getItem('vol_sfx');
    if (sm !== null) this._music.gain.value = Math.max(0, Math.min(1, parseFloat(sm)));
    if (ss !== null) this._sfx.gain.value   = Math.max(0, Math.min(1, parseFloat(ss)));

    // Resume context if browser auto-suspended it
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => { /* silent */ });
    }

    this._ready = true;
  }

  // ── Accessors ───────────────────────────────────────────────────────────────
  static get context():   AudioContext | null { return this._ctx; }
  static get musicGain(): GainNode | null     { return this._ready ? this._music : null; }
  static get sfxGain():   GainNode | null     { return this._ready ? this._sfx   : null; }
  static get isReady():   boolean             { return this._ready; }

  // ── Volume control ─────────────────────────────────────────────────────────
  static setMusicVolume(v: number): void {
    if (!this._music) return;
    this._music.gain.value = Math.max(0, Math.min(1, v));
    localStorage.setItem('vol_music', String(v));
  }

  static setSfxVolume(v: number): void {
    if (!this._sfx) return;
    this._sfx.gain.value = Math.max(0, Math.min(1, v));
    localStorage.setItem('vol_sfx', String(v));
  }

  static setMasterVolume(v: number): void {
    if (!this._master) return;
    this._master.gain.value = Math.max(0, Math.min(1, v));
  }
}
