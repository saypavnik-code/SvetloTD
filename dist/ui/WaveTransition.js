// ─────────────────────────────────────────────────────────────────────────────
// WaveTransition.ts — "Волна X идёт!" cinematic overlay (Phase 5).
//
// Shows for SHOW_MS ms then auto-dismisses. Slides in from top, fades out.
// Triggered by WaveManager via WAVE_STARTED event.
// ─────────────────────────────────────────────────────────────────────────────
import { GAME_WIDTH, COLORS, DEPTH, FONT_MAIN } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { WAVES } from '../data/waves';
const SHOW_MS = 2600;
const SLIDE_MS = 280;
const FONT = FONT_MAIN;
const H = 88;
const Y_HIDDEN = -H - 4;
const Y_SHOWN = 0;
export class WaveTransition {
    constructor(scene) {
        Object.defineProperty(this, "_scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_root", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_sub", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_bar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_barFill", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_timer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_onWaveStarted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (waveNumber) => {
                const n = waveNumber;
                const waveData = WAVES[n - 1];
                // Title
                const prefix = waveData?.isBoss ? '💀 БОСС — ' : '';
                this._label.setText(`${prefix}ВОЛНА ${n} / ${WAVES.length}`);
                this._label.setColor(waveData?.isBoss ? '#FF4444' : COLORS.amberBright_css);
                // Subtitle preview
                const preview = waveData?.preview ?? '';
                const mod = waveData?.modifier === 'fast' ? ' ⚡ Быстрые'
                    : waveData?.modifier === 'healing' ? ' 💚 Регенерация'
                        : '';
                this._sub.setText(preview + mod);
                // Reset & slide in
                this._active = true;
                this._timer = SHOW_MS;
                this._root.y = Y_HIDDEN;
                this._scene.tweens.add({
                    targets: this._root, y: Y_SHOWN,
                    duration: SLIDE_MS, ease: 'Back.easeOut',
                });
            }
        });
        this._scene = scene;
        this._build();
        EventBus.on(GameEvents.WAVE_STARTED, this._onWaveStarted, this);
    }
    _build() {
        const s = this._scene;
        this._root = s.add.container(0, Y_HIDDEN).setDepth(DEPTH.OVERLAY - 1);
        // Dark gradient banner across full width
        const bg = s.add.graphics();
        bg.fillStyle(0x0D0A06, 0.92);
        bg.fillRect(0, 0, GAME_WIDTH, H);
        // Amber accent line bottom
        bg.fillStyle(COLORS.amberWarm, 1);
        bg.fillRect(0, H - 2, GAME_WIDTH, 2);
        // Subtle top line
        bg.fillStyle(COLORS.amberDeep, 0.4);
        bg.fillRect(0, 0, GAME_WIDTH, 1);
        this._root.add(bg);
        // Wave number — large
        this._label = s.add.text(GAME_WIDTH / 2, H / 2 - 12, '', {
            fontFamily: FONT, fontSize: '28px', fontStyle: 'bold',
            color: COLORS.amberBright_css,
        }).setOrigin(0.5);
        this._root.add(this._label);
        // Preview subtitle
        this._sub = s.add.text(GAME_WIDTH / 2, H / 2 + 18, '', {
            fontFamily: FONT, fontSize: '13px',
            color: COLORS.textSecondary_css, letterSpacing: 1,
        }).setOrigin(0.5);
        this._root.add(this._sub);
        // Countdown bar background
        this._bar = s.add.graphics();
        this._bar.fillStyle(COLORS.walnutDark, 0.55);
        this._bar.fillRect(0, H - 2, GAME_WIDTH, 2);
        this._root.add(this._bar);
        // Countdown bar fill (redrawn in update)
        this._barFill = s.add.graphics();
        this._root.add(this._barFill);
    }
    update(deltaMs) {
        if (!this._active)
            return;
        this._timer -= deltaMs;
        // Countdown bar
        const frac = Math.max(0, this._timer / SHOW_MS);
        this._barFill.clear();
        this._barFill.fillStyle(COLORS.amberWarm, 0.9);
        this._barFill.fillRect(0, H - 2, GAME_WIDTH * frac, 2);
        if (this._timer <= 0) {
            this._active = false;
            this._scene.tweens.add({
                targets: this._root, y: Y_HIDDEN,
                duration: SLIDE_MS, ease: 'Cubic.easeIn',
            });
        }
    }
    destroy() {
        EventBus.off(GameEvents.WAVE_STARTED, this._onWaveStarted, this);
    }
}
