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

export type SpeedValue = 1 | 2 | 3;

export class GameSpeed {
  private static _speed: SpeedValue = 1;

  static get speed(): SpeedValue { return this._speed; }

  static set(value: number): void {
    const clamped = Math.max(1, Math.min(3, Math.round(value))) as SpeedValue;
    this._speed = clamped;
  }

  /** Multiply raw Phaser delta (ms) by current speed multiplier. */
  static adjust(delta: number): number {
    return delta * this._speed;
  }

  static reset(): void { this._speed = 1; }
}
