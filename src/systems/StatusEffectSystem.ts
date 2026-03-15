// ─────────────────────────────────────────────────────────────────────────────
// StatusEffectSystem.ts — Manages active status effects on a single enemy.
// Instantiated per-enemy; Enemy holds a reference.
//
// Rules:
//   slow        → max wins (no stack). Enemy speed = base * (1 - value).
//   armor_reduce → stacks per unique sourceId. Total = sum of all stacks.
//   poison      → stacks per unique sourceId. DoT = chaos damage / second.
// ─────────────────────────────────────────────────────────────────────────────

import type { DamageType } from '../data/towers';

export type EffectType = 'slow' | 'armor_reduce' | 'poison';

export interface StatusEffect {
  type:      EffectType;
  value:     number;     // slow=fraction, armor_reduce=units, poison=dmg/sec
  duration:  number;     // total seconds (const reference)
  remaining: number;     // seconds left
  sourceId:  string;     // tower ID — same source refreshes, different stacks
}

export class StatusEffectSystem {
  readonly effects: StatusEffect[] = [];

  // ── Apply an incoming effect ───────────────────────────────────────────────
  apply(effect: Omit<StatusEffect, 'remaining'>): void {
    const { type, sourceId } = effect;

    // For slow: same-source refresh only
    // For armor_reduce / poison: refresh same source, stack different sources
    const existing = this.effects.find(e => e.type === type && e.sourceId === sourceId);

    if (existing) {
      // Refresh duration (take max value for slow, keep new value for others)
      if (type === 'slow') existing.value = Math.max(existing.value, effect.value);
      else existing.value = effect.value;
      existing.remaining = effect.duration;
    } else {
      this.effects.push({ ...effect, remaining: effect.duration });
    }
  }

  // ── Per-frame tick ─────────────────────────────────────────────────────────
  /**
   * @param delta   ms since last frame
   * @param takeDmg callback to deal poison damage to the owner
   * @returns       { slowFraction, armorReduction } for owner to apply
   */
  update(
    delta: number,
    takeDmg: (amount: number, type: DamageType) => void,
  ): { slowFraction: number; armorReduction: number } {
    const dt = delta / 1000;
    let poisonAccum = 0;

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.remaining -= dt;

      if (e.type === 'poison') {
        poisonAccum += e.value * dt; // damage per second → damage this frame
      }

      if (e.remaining <= 0) {
        this.effects.splice(i, 1);
      }
    }

    // Apply accumulated poison damage (chaos type bypasses armor matrix)
    if (poisonAccum >= 1) {
      takeDmg(Math.floor(poisonAccum), 'chaos');
    }

    return {
      slowFraction:  this._maxSlow(),
      armorReduction: this._totalArmorReduce(),
    };
  }

  // ── Derived stat queries ───────────────────────────────────────────────────

  /** Highest active slow fraction (0 if none) */
  private _maxSlow(): number {
    let max = 0;
    for (const e of this.effects) {
      if (e.type === 'slow' && e.value > max) max = e.value;
    }
    return max;
  }

  /** Sum of all stacked armor_reduce values */
  private _totalArmorReduce(): number {
    let total = 0;
    for (const e of this.effects) {
      if (e.type === 'armor_reduce') total += e.value;
    }
    return total;
  }

  hasSlow():        boolean { return this.effects.some(e => e.type === 'slow'); }
  hasArmorReduce(): boolean { return this.effects.some(e => e.type === 'armor_reduce'); }
  hasPoison():      boolean { return this.effects.some(e => e.type === 'poison'); }

  reset(): void { this.effects.length = 0; }
}
