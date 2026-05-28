// ─────────────────────────────────────────────────────────────────────────────
// GameSpeed.ts — Global time-scale multiplier.
//
// All gameplay systems multiply their delta by GameSpeed.adjust().
// UI animations (floating text, button hovers) use raw delta — they never
// call adjust(), so they stay at real-time regardless of game speed.
//
// Usage:
//   const dt = GameSpeed.adjust(delta) / 1000;
//   this.x += speed * dt;
// ─────────────────────────────────────────────────────────────────────────────
export class GameSpeed {
    static get speed() { return this._speed; }
    static set(value) {
        const clamped = Math.max(1, Math.min(3, Math.round(value)));
        this._speed = clamped;
    }
    /** Multiply raw Phaser delta (ms) by current speed multiplier. */
    static adjust(delta) {
        return delta * this._speed;
    }
    static reset() { this._speed = 1; }
}
Object.defineProperty(GameSpeed, "_speed", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1
});
