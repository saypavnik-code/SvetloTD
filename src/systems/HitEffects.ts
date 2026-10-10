// ─────────────────────────────────────────────────────────────────────────────
// HitEffects.ts — Applies a tower's on-hit specials to the enemies it hits.
//
// Single authoritative place that turns TowerSpecial data into status effects:
//   slow / armor_reduce / poison → applied to the enemy that was hit.
//   aoe_slow                     → a 'slow' applied to every live enemy within
//                                  `radius` of the hit enemy (hit enemy included).
//
// The area slow uses its own sourceId, so it never overwrites the primary slow
// of the same tower; StatusEffectSystem keeps the strongest active slow.
// Pure logic: no Phaser dependency, covered by tests/simulation.test.mjs.
// ─────────────────────────────────────────────────────────────────────────────

import type { TowerSpecial } from '../data/towers';
import type { Enemy } from '../entities/Enemy';

export const AREA_SLOW_SOURCE_SUFFIX = ':area';

export function applyHitSpecials(
  target: Enemy,
  specials: readonly TowerSpecial[],
  sourceId: string,
  enemies: readonly Enemy[],
): void {
  for (const special of specials) {
    if (special.type === 'aoe_slow') {
      applyAreaSlow(target, special, sourceId + AREA_SLOW_SOURCE_SUFFIX, enemies);
      continue;
    }
    target.applyEffect({
      type: special.type,
      value: special.value,
      duration: special.duration,
      sourceId,
    });
  }
}

function applyAreaSlow(
  center: Enemy,
  special: TowerSpecial,
  sourceId: string,
  enemies: readonly Enemy[],
): void {
  const radius = special.radius ?? 0;
  const radiusSq = radius * radius;
  for (const enemy of enemies) {
    if (!enemy.isActive || enemy.isDead) continue;
    const dx = enemy.x - center.x;
    const dy = enemy.y - center.y;
    if (dx * dx + dy * dy > radiusSq) continue;
    enemy.applyEffect({ type: 'slow', value: special.value, duration: special.duration, sourceId });
  }
}
