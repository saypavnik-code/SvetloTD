// ─────────────────────────────────────────────────────────────────────────────
// EconomyManager.ts — Gold and lives. Both emit EventBus events on change.
// Phase 2: starting gold from GameConfig, sell refund tracks build phase.
// ─────────────────────────────────────────────────────────────────────────────

import { STARTING_LIVES } from '../config';
import { GameConfig }     from '../config/difficulty';
import { EventBus, GameEvents } from '../utils/EventBus';

export class EconomyManager {
  private _gold:  number;
  private _lives  = STARTING_LIVES;
  // 1.0 during build phase (100% refund), 0.7 during combat (70% refund)
  private _sellRefundRate = 0.7;

  constructor() {
    this._gold = GameConfig.difficulty.startingGold;
    EventBus.on(GameEvents.BUILD_PHASE_START, this._onBuildStart, this);
    EventBus.on(GameEvents.BUILD_PHASE_END,   this._onBuildEnd,   this);
  }

  get gold():           number { return this._gold; }
  get lives():          number { return this._lives; }
  get sellRefundRate(): number { return this._sellRefundRate; }

  addGold(amount: number): void {
    this._gold += amount;
    EventBus.emit(GameEvents.GOLD_CHANGED, this._gold);
  }

  spendGold(amount: number): boolean {
    if (this._gold < amount) return false;
    this._gold -= amount;
    EventBus.emit(GameEvents.GOLD_CHANGED, this._gold);
    return true;
  }

  loseLife(amount = 1): void {
    this._lives = Math.max(0, this._lives - amount);
    EventBus.emit(GameEvents.LIVES_CHANGED, this._lives);
    if (this._lives <= 0) {
      EventBus.emit(GameEvents.GAME_OVER, { victory: false });
    }
  }

  private _onBuildStart = (): void => { this._sellRefundRate = 1.0; };
  private _onBuildEnd   = (): void => { this._sellRefundRate = 0.7; };

  destroy(): void {
    EventBus.off(GameEvents.BUILD_PHASE_START, this._onBuildStart, this);
    EventBus.off(GameEvents.BUILD_PHASE_END,   this._onBuildEnd,   this);
  }
}
