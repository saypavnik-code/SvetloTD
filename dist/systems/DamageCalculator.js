// ─────────────────────────────────────────────────────────────────────────────
// DamageCalculator.ts — Applies damage matrix + armor reduction stacking.
// ─────────────────────────────────────────────────────────────────────────────
import { DAMAGE_MATRIX } from '../data/damageMatrix';
import { DAMAGE_CONFIG } from '../config/damage';
export class DamageCalculator {
    /**
     * @param baseDamage     Raw damage from tower
     * @param damageType     Tower's damage type
     * @param armorType      Enemy's armor type
     * @param armorReduction Stacked armor_reduce debuff total
     */
    calculate(baseDamage, damageType, armorType, armorReduction = 0) {
        const row = DAMAGE_MATRIX[damageType];
        const mult = row[armorType] ?? row['unarmored'];
        const armorBonus = 1 + armorReduction * DAMAGE_CONFIG.armorReducePerStack;
        return Math.max(1, Math.round(baseDamage * mult * armorBonus));
    }
}
// Singleton — import this everywhere; don't re-instantiate
export const dmgCalc = new DamageCalculator();
