// ─────────────────────────────────────────────────────────────────────────────
// damage.ts — Configurable damage coefficients (Phase 4 prep, used now).
// Previously hardcoded as 0.05 inside DamageCalculator.
// ─────────────────────────────────────────────────────────────────────────────

export const DAMAGE_CONFIG = {
  /** Each stack of armor_reduce increases final damage by this fraction. */
  armorReducePerStack: 0.05,
} as const;