// ─────────────────────────────────────────────────────────────────────────────
// damageMatrix.ts — Damage multiplier table. DamageType × ArmorType → float.
// Source: Warcraft III damage system, adapted for Svetlogorsk TD.
// ─────────────────────────────────────────────────────────────────────────────

import type { ArmorType } from './enemies';
import type { DamageType } from './towers';

export const DAMAGE_MATRIX: Record<DamageType, Record<ArmorType, number>> = {
  //            unarmored  light   medium  heavy  fortified  heroic
  normal:   { unarmored:1.0, light:1.0,  medium:1.5,  heavy:1.0, fortified:0.7,  heroic:0.7 },
  piercing: { unarmored:1.0, light:2.0,  medium:0.75, heavy:1.0, fortified:0.35, heroic:0.5 },
  magic:    { unarmored:1.0, light:1.25, medium:0.75, heavy:2.0, fortified:0.35, heroic:0.5 },
  siege:    { unarmored:1.0, light:0.5,  medium:0.5,  heavy:1.0, fortified:1.5,  heroic:0.5 },
  chaos:    { unarmored:1.0, light:1.0,  medium:1.0,  heavy:1.0, fortified:1.0,  heroic:1.0 },
};
