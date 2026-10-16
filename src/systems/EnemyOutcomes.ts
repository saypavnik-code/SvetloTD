// ─────────────────────────────────────────────────────────────────────────────
// EnemyOutcomes.ts — What an enemy's death or escape pays and costs.
//
//   ENEMY_KILLED      → bounty gold, plus the enemy type's lumberYield
//   ENEMY_REACHED_END → lives lost = the enemy type's livesCost
//
// These rules used to live in GameScene's event handlers and were copied by hand into the
// headless test harnesses, where the copy drifted (golem and boss lumber was never counted).
// GameScene now keeps only the presentation (floating text, sound, shake).
//
// Create it right after WaveManager: listeners run in registration order and WaveManager has
// to count the enemy as removed before anything else reacts to the same event.
// ─────────────────────────────────────────────────────────────────────────────

import type { Enemy } from '../entities/Enemy';
import { GameEvents } from '../utils/EventBus';
import { Subscriptions } from '../utils/Subscriptions';
import type { EconomyManager } from './EconomyManager';
import type { LumberManager } from './LumberManager';

export class EnemyOutcomes {
  private readonly _economy: EconomyManager;
  private readonly _lumber:  LumberManager;
  private readonly _subs = new Subscriptions();

  constructor(economy: EconomyManager, lumber: LumberManager) {
    this._economy = economy;
    this._lumber  = lumber;
    this._subs.on(GameEvents.ENEMY_KILLED,      this._onKilled);
    this._subs.on(GameEvents.ENEMY_REACHED_END, this._onLeaked);
  }

  private _onKilled = (data: unknown): void => {
    const { enemy, goldReward } = data as { enemy: Enemy; goldReward: number };
    this._economy.addGold(goldReward);
    const lumberYield = enemy.def?.lumberYield ?? 0;
    if (lumberYield > 0) this._lumber.add(lumberYield);
  };

  private _onLeaked = (enemy: unknown): void => {
    this._economy.loseLife((enemy as Enemy).def?.livesCost ?? 1);
  };

  destroy(): void {
    this._subs.dispose();
  }
}
