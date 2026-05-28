// ─────────────────────────────────────────────────────────────────────────────
// EconomyManager.ts — Gold and lives. Both emit EventBus events on change.
// Phase 2: starting gold from GameConfig, sell refund tracks build phase.
// ─────────────────────────────────────────────────────────────────────────────
import { STARTING_LIVES } from '../config';
import { GameConfig } from '../config/difficulty';
import { EventBus, GameEvents } from '../utils/EventBus';
export class EconomyManager {
    constructor() {
        Object.defineProperty(this, "_gold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_lives", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: STARTING_LIVES
        });
        // 1.0 during build phase (100% refund), 0.7 during combat (70% refund)
        Object.defineProperty(this, "_sellRefundRate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.7
        });
        Object.defineProperty(this, "_onBuildStart", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { this._sellRefundRate = 1.0; }
        });
        Object.defineProperty(this, "_onBuildEnd", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { this._sellRefundRate = 0.7; }
        });
        this._gold = GameConfig.difficulty.startingGold;
        EventBus.on(GameEvents.BUILD_PHASE_START, this._onBuildStart, this);
        EventBus.on(GameEvents.BUILD_PHASE_END, this._onBuildEnd, this);
    }
    get gold() { return this._gold; }
    get lives() { return this._lives; }
    get sellRefundRate() { return this._sellRefundRate; }
    addGold(amount) {
        this._gold += amount;
        EventBus.emit(GameEvents.GOLD_CHANGED, this._gold);
    }
    spendGold(amount) {
        if (this._gold < amount)
            return false;
        this._gold -= amount;
        EventBus.emit(GameEvents.GOLD_CHANGED, this._gold);
        return true;
    }
    loseLife(amount = 1) {
        this._lives = Math.max(0, this._lives - amount);
        EventBus.emit(GameEvents.LIVES_CHANGED, this._lives);
        if (this._lives <= 0) {
            EventBus.emit(GameEvents.GAME_OVER, { victory: false });
        }
    }
    destroy() {
        EventBus.off(GameEvents.BUILD_PHASE_START, this._onBuildStart, this);
        EventBus.off(GameEvents.BUILD_PHASE_END, this._onBuildEnd, this);
    }
}
