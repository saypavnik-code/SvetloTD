// ─────────────────────────────────────────────────────────────────────────────
// LumberManager.ts — Secondary resource (Lumber / Дерево).
//
// Sources:
//   • Golem/boss kill  → +lumberYield from EnemyDef  (triggered by GameScene)
//   • Every 5th wave   → +1 (triggered by WaveManager via EventBus)
//
// Spent on:
//   • Mercenary / T3 towers (BuildSystem checks canAffordLumber)
//   • Future: unlock hero, aura buildings
//
// Emits LUMBER_CHANGED so HUD updates without coupling.
// ─────────────────────────────────────────────────────────────────────────────
import { EventBus, GameEvents } from '../utils/EventBus';
export class LumberManager {
    constructor() {
        Object.defineProperty(this, "_lumber", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    get lumber() { return this._lumber; }
    add(amount) {
        if (amount <= 0)
            return;
        this._lumber += amount;
        EventBus.emit(GameEvents.LUMBER_CHANGED, this._lumber);
    }
    /** Returns false if not enough lumber — caller decides how to handle. */
    spend(amount) {
        if (this._lumber < amount)
            return false;
        this._lumber -= amount;
        EventBus.emit(GameEvents.LUMBER_CHANGED, this._lumber);
        return true;
    }
    canAfford(amount) { return this._lumber >= amount; }
}
