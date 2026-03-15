// ─────────────────────────────────────────────────────────────────────────────
// DamageCalculator.ts — Applies damage matrix + armor reduction stacking.
// ─────────────────────────────────────────────────────────────────────────────

import type { DamageType } from '../data/towers';
import type { ArmorType }  from '../data/enemies';
import { DAMAGE_MATRIX }   from '../data/damageMatrix';

export class DamageCalculator {
  /**
   * @param baseDamage     Raw damage from tower
   * @param damageType     Tower's damage type
   * @param armorType      Enemy's armor type
   * @param armorReduction Stacked armor_reduce debuff total (each unit = +5% damage)
   */
  calculate(
    baseDamage:     number,
    damageType:     DamageType,
    armorType:      ArmorType,
    armorReduction  = 0,
  ): number {
    const row = DAMAGE_MATRIX[damageType];
    // Fall back to unarmored if armor type somehow not in matrix
    const mult = row[armorType] ?? row['unarmored'];
    const armorBonus = 1 + armorReduction * 0.05;
    return Math.max(1, Math.round(baseDamage * mult * armorBonus));
  }
}

// Singleton — import this everywhere; don't re-instantiate
export const dmgCalc = new DamageCalculator();
