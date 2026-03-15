// ─────────────────────────────────────────────────────────────────────────────
// AmbientMusic.ts — Procedural LoFi ambient for Svetlogorsk TD.
//
// Three simultaneous layers:
//
//   LAYER 1 — PAD   : warm sine drone (two oscillators + fifth interval).
//                     Slowly migrates between C3/D3/F3/G3 every 12-20 s.
//
//   LAYER 2 — ARP   : sparse triangle-wave notes (C-major pentatonic, C4-A4).
//                     Delay + feedback for Baltic echo feel.
//                     Never repeats the previous note.
//
//   LAYER 3 — SEA   : white noise through heavy low-pass + slow LFO.
//                     Simulates distant surf (0.08 Hz wave cycle ~12 s).
//
// All timers use REAL milliseconds — NOT game-speed adjusted.
// Call update(realDeltaMs) from GameScene.update() with the raw delta arg.
// ─────────────────────────────────────────────────────────────────────────────

export class AmbientMusic {
  private readonly ctx:    AudioContext;
  private readonly output: GainNode;        // = AudioManager.musicGain

  private _playing  = false;
  private _stopped  = false;

  // ── Timer state ─────────────────────────────────────────────────────────────
  private _arpTimer = 2.0;     // seconds until next arp note
  private _padTimer = 15.0;    // seconds until next pad note change
  private _lastArpIdx = -1;

  // ── Note tables ─────────────────────────────────────────────────────────────
  // PAD: C3  D3     F3     G3
  private readonly PAD_NOTES  = [130.81, 146.83, 174.61, 196.00];
  // ARP: C4    D4     E4     G4    A4
  private readonly ARP_NOTES  = [261.63, 293.66, 329.63, 392.00, 440.00];
  // Quintal ratio (perfect fifth, just intonation 3:2)
  private readonly FIFTH      = 1.4983;

  // ── Persistent audio nodes ──────────────────────────────────────────────────
  // PAD
  private _padOsc1!:   OscillatorNode;
  private _padOsc2!:   OscillatorNode;
  private _padGain!:   GainNode;
  // ARP shared FX chain
  private _arpFilter!: BiquadFilterNode;
  private _arpDelay!:  DelayNode;
  private _arpFb!:     GainNode;
  private _arpOut!:    GainNode;
  // SEA
  private _seaSrc!:    AudioBufferSourceNode;
  private _seaFilter!: BiquadFilterNode;
  private _seaGain!:   GainNode;
  private _lfoOsc!:    OscillatorNode;
  private _lfoGain!:   GainNode;

  constructor(musicGainNode: GainNode) {
    // GainNode.context is typed as BaseAudioContext; we know it's AudioContext here.
    this.ctx    = musicGainNode.context as AudioContext;
    this.output = musicGainNode;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  start(): void {
    if (this._playing || this._stopped) return;
    this._playing = true;

    this._setupPad();
    this._setupSea();
    this._setupArpChain();

    // Stagger first arp note slightly so it doesn't fire on frame 1
    this._arpTimer = 2.0 + Math.random() * 1.5;
    this._padTimer = 14.0 + Math.random() * 6.0;
  }

  /**
   * Fade out all layers over `durationMs` then permanently stop all nodes.
   * After stop() the instance is dead — create a new one to restart.
   */
  stop(durationMs = 2000): void {
    if (!this._playing || this._stopped) return;
    this._stopped = true;
    this._playing = false;

    const now  = this.ctx.currentTime;
    const secs = durationMs / 1000;

    // Fade the pad
    this._padGain.gain.cancelScheduledValues(now);
    this._padGain.gain.setValueAtTime(this._padGain.gain.value, now);
    this._padGain.gain.linearRampToValueAtTime(0, now + secs);

    // Fade sea
    this._seaGain.gain.cancelScheduledValues(now);
    this._seaGain.gain.setValueAtTime(this._seaGain.gain.value, now);
    this._seaGain.gain.linearRampToValueAtTime(0, now + secs);

    // Fade arp output bus
    this._arpOut.gain.cancelScheduledValues(now);
    this._arpOut.gain.setValueAtTime(this._arpOut.gain.value, now);
    this._arpOut.gain.linearRampToValueAtTime(0, now + secs);

    // Stop persistent source nodes after the fade
    const stopAt = now + secs + 0.1;
    try { this._padOsc1.stop(stopAt); } catch { /* already stopped */ }
    try { this._padOsc2.stop(stopAt); } catch { /* already stopped */ }
    try { this._seaSrc.stop(stopAt);  } catch { /* already stopped */ }
    try { this._lfoOsc.stop(stopAt);  } catch { /* already stopped */ }
  }

  /**
   * Must be called every frame from GameScene.update().
   * @param realDeltaMs Raw (un-adjusted) delta in milliseconds.
   */
  update(realDeltaMs: number): void {
    if (!this._playing) return;
    const dt = realDeltaMs / 1000;   // seconds

    this._arpTimer -= dt;
    if (this._arpTimer <= 0) {
      this._playArpNote();
      // Humanise the rhythm slightly
      this._arpTimer = 2.0 + Math.random() * 2.0;
    }

    this._padTimer -= dt;
    if (this._padTimer <= 0) {
      this._changePadNote();
      this._padTimer = 12.0 + Math.random() * 8.0;
    }
  }

  // ── Layer 1: PAD ────────────────────────────────────────────────────────────
  private _setupPad(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low-pass colouring
    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value         = 1.0;

    // Gain envelope — gentle fade-in from silence
    this._padGain = ctx.createGain();
    this._padGain.gain.setValueAtTime(0, now);
    this._padGain.gain.linearRampToValueAtTime(0.08, now + 3.0);

    // Root oscillator (C3 by default)
    this._padOsc1 = ctx.createOscillator();
    this._padOsc1.type            = 'sine';
    this._padOsc1.frequency.value = this.PAD_NOTES[0];

    // Fifth oscillator (G3)
    this._padOsc2 = ctx.createOscillator();
    this._padOsc2.type            = 'sine';
    this._padOsc2.frequency.value = this.PAD_NOTES[0] * this.FIFTH;

    // Connect: osc → filter → gain → master output
    this._padOsc1.connect(filter);
    this._padOsc2.connect(filter);
    filter.connect(this._padGain);
    this._padGain.connect(this.output);

    this._padOsc1.start(now);
    this._padOsc2.start(now);
  }

  private _changePadNote(): void {
    const note = this.PAD_NOTES[
      Math.floor(Math.random() * this.PAD_NOTES.length)
    ];
    const now = this.ctx.currentTime;

    // Fade out → ramp frequency → fade in
    // Use cancelAndHoldAtTime if available (Chrome 57+), fall back to setValueAtTime
    this._padGain.gain.cancelScheduledValues(now);
    this._padGain.gain.setValueAtTime(this._padGain.gain.value, now);
    this._padGain.gain.linearRampToValueAtTime(0,    now + 2.0);
    this._padGain.gain.linearRampToValueAtTime(0.08, now + 4.0);

    this._padOsc1.frequency.setValueAtTime(note,               now + 2.0);
    this._padOsc2.frequency.setValueAtTime(note * this.FIFTH,  now + 2.0);
  }

  // ── Layer 2: ARP effects chain (shared across notes) ──────────────────────
  private _setupArpChain(): void {
    const ctx = this.ctx;

    // Low-pass filter
    this._arpFilter = ctx.createBiquadFilter();
    this._arpFilter.type            = 'lowpass';
    this._arpFilter.frequency.value = 1200;
    this._arpFilter.Q.value         = 0.8;

    // Delay line (0.4 s)
    this._arpDelay = ctx.createDelay(1.0);
    this._arpDelay.delayTime.value = 0.40;

    // Feedback gain (0.3 → gentle single echo)
    this._arpFb = ctx.createGain();
    this._arpFb.gain.value = 0.30;

    // Output gain bus (so stop() can fade the whole arp bus)
    this._arpOut = ctx.createGain();
    this._arpOut.gain.value = 1.0;

    // Feedback loop: delay → fb → delay (closed loop)
    this._arpDelay.connect(this._arpFb);
    this._arpFb.connect(this._arpDelay);

    // Signal path: filter → delay → out → master
    //               filter → out directly (dry signal)
    this._arpFilter.connect(this._arpDelay);
    this._arpDelay.connect(this._arpOut);
    this._arpFilter.connect(this._arpOut);   // dry path
    this._arpOut.connect(this.output);
  }

  private _playArpNote(): void {
    // Pick a note that is different from the last one
    let idx: number;
    do {
      idx = Math.floor(Math.random() * this.ARP_NOTES.length);
    } while (idx === this._lastArpIdx && this.ARP_NOTES.length > 1);
    this._lastArpIdx = idx;

    const freq = this.ARP_NOTES[idx];
    const now  = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type            = 'triangle';
    osc.frequency.value = freq;

    // ADSR envelope
    // attack 0.3 s → sustain level 0.04 at 0.8 s → release to 0 at 2.3 s
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0,    now);
    env.gain.linearRampToValueAtTime(0.06, now + 0.30);   // attack peak
    env.gain.linearRampToValueAtTime(0.04, now + 0.80);   // sustain
    env.gain.linearRampToValueAtTime(0,    now + 2.30);   // release

    osc.connect(env);
    env.connect(this._arpFilter);

    // Auto-cleanup: node is garbage-collected after stop
    osc.start(now);
    osc.stop(now + 2.5);
  }

  // ── Layer 3: SEA (white noise + LFO-modulated LP filter) ─────────────────
  private _setupSea(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Generate 2 seconds of white noise in a mono buffer
    const sampleRate  = ctx.sampleRate;
    const bufferLen   = sampleRate * 2;
    const buffer      = ctx.createBuffer(1, bufferLen, sampleRate);
    const data        = buffer.getChannelData(0);
    for (let i = 0; i < bufferLen; i++) data[i] = Math.random() * 2 - 1;

    // Looping source
    this._seaSrc           = ctx.createBufferSource();
    this._seaSrc.buffer    = buffer;
    this._seaSrc.loop      = true;

    // Heavy low-pass: cutoff 400 Hz, Q 0.5 → surf rumble
    this._seaFilter = ctx.createBiquadFilter();
    this._seaFilter.type            = 'lowpass';
    this._seaFilter.frequency.value = 400;
    this._seaFilter.Q.value         = 0.5;

    // Output gain — fade in gently
    this._seaGain = ctx.createGain();
    this._seaGain.gain.setValueAtTime(0, now);
    this._seaGain.gain.linearRampToValueAtTime(0.04, now + 5.0);

    // LFO: 0.08 Hz sine (one cycle ≈ 12.5 s) — modulates filter cutoff
    // AudioParam for frequency.value range is in Hz, so we need a GainNode
    // to scale the LFO from ±1 to ±200, centred at 400 Hz → range [200, 600].
    this._lfoOsc = ctx.createOscillator();
    this._lfoOsc.type            = 'sine';
    this._lfoOsc.frequency.value = 0.08;   // ~12.5 s period

    this._lfoGain = ctx.createGain();
    this._lfoGain.gain.value = 200;        // ±200 Hz modulation depth

    this._lfoOsc.connect(this._lfoGain);
    this._lfoGain.connect(this._seaFilter.frequency);   // modulate the cutoff

    // Connect: noise → filter → gain → master
    this._seaSrc.connect(this._seaFilter);
    this._seaFilter.connect(this._seaGain);
    this._seaGain.connect(this.output);

    this._seaSrc.start(now);
    this._lfoOsc.start(now);
  }
}
