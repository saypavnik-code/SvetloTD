// ─────────────────────────────────────────────────────────────────────────────
// EconomyManager.ts — Gold and lives. Both emit EventBus events on change.
// ─────────────────────────────────────────────────────────────────────────────

import { STARTING_GOLD, STARTING_LIVES } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';

export class EconomyManager {
  private _gold  = STARTING_GOLD;
  private _lives = STARTING_LIVES;

  get gold():  number { return this._gold; }
  get lives(): number { return this._lives; }

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
}
