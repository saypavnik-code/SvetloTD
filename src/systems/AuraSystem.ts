// ─────────────────────────────────────────────────────────────────────────────
// AuraSystem.ts — Passive aura scanner (Phase 3).
//
// Every SCAN_INTERVAL ms finds all "aura towers" (auraRadius > 0) and applies
// a TowerBuff to every tower within radius. Runs at 1 Hz to avoid per-frame
// O(n²) cost.
//
// Integration: call update(delta) from GameScene.update(). Call destroy() on
// scene shutdown.
// ─────────────────────────────────────────────────────────────────────────────

import { Tower } from '../entities/Tower';

const SCAN_INTERVAL = 1000; // ms

export class AuraSystem {
  private _getTowers: () => Tower[];
  private _elapsed   = 0;

  constructor(getTowers: () => Tower[]) {
    this._getTowers = getTowers;
  }

  update(deltaMs: number): void {
    this._elapsed += deltaMs;
    if (this._elapsed < SCAN_INTERVAL) return;
    this._elapsed = 0;
    this._scan();
  }

  private _scan(): void {
    const towers = this._getTowers();

    // Collect aura sources
    const auraSources = towers.filter(t => t.data.auraRadius > 0);
    if (auraSources.length === 0) return;

    // Reset all aura buffs before re-applying (prevents stacking across scans)
    for (const t of towers) t.clearAuraBuff();

    for (const src of auraSources) {
      const r2 = src.data.auraRadius * src.data.auraRadius;
      for (const t of towers) {
        if (t === src) continue;
        if (t.data.auraRadius > 0) continue; // aura towers don't buff each other
        const dx = t.x - src.x, dy = t.y - src.y;
        if (dx * dx + dy * dy <= r2) {
          t.applyAuraBuff(src.data.auraBuff);
        }
      }
    }
  }

  destroy(): void { /* no subscriptions — nothing to clean up */ }
}