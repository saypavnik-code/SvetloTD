// ─────────────────────────────────────────────────────────────────────────────
// InterestSystem.ts — Gold interest + wave completion bonus.
//
// Listens for WAVE_COMPLETED. On each event:
//   1. Calculates interest = floor(currentGold * interestRate)
//   2. Calculates waveBonus = round(WaveData.bonusGold * waveBonusMult), so the
//      difficulty preset scales the hand-crafted reward of every wave
//   3. Adds both sums to EconomyManager via addGold()
//   4. Emits INTEREST_AWARDED and WAVE_BONUS_AWARDED for HUD floating text
//
// All rates come from GameConfig.difficulty — zero coupling to scenes.
// ─────────────────────────────────────────────────────────────────────────────

import { EventBus, GameEvents }      from '../utils/EventBus';
import { Subscriptions }             from '../utils/Subscriptions';
import { EconomyManager }            from './EconomyManager';
import { LumberManager }             from './LumberManager';
import { GameConfig }                from '../config/difficulty';
import { type WaveData }             from '../data/waves';
import { splitEvenly }               from '../data/seats';

export class InterestSystem {
  private readonly _economy: EconomyManager;
  private readonly _lumber:  LumberManager;
  private readonly _subs = new Subscriptions();

  constructor(economy: EconomyManager, lumber: LumberManager) {
    this._economy = economy;
    this._lumber  = lumber;
    this._subs.on(GameEvents.WAVE_COMPLETED, this._onWaveCompleted);
  }

  private _onWaveCompleted = (...args: unknown[]): void => {
    const waveNumber = args[0] as number;                 // 1-based
    const waveData   = args[1] as WaveData | undefined;
    const cfg        = GameConfig.difficulty;

    // ── 1. Interest on unspent gold ───────────────────────────────────────────
    // Every seat earns interest on its own unspent gold; the event carries the sum.
    const seats = this._economy.seatCount;
    let interestGold = 0;
    for (let seat = 0; seat < seats; seat++) {
      const interest = Math.floor(this._economy.goldOf(seat) * cfg.interestRate);
      if (interest > 0) { this._economy.addGold(interest, seat); interestGold += interest; }
    }
    if (interestGold > 0) {
      EventBus.emit(GameEvents.INTEREST_AWARDED, interestGold);
    }

    // ── 2. Wave completion bonus ───────────────────────────────────────────────
    const waveBonus = waveData ? Math.round(waveData.bonusGold * cfg.waveBonusMult) : 0;

    // The bonus is split between the seats without losing a coin (a one-seat game gets all of it).
    splitEvenly(waveBonus, seats).forEach((share, seat) => this._economy.addGold(share, seat));
    EventBus.emit(GameEvents.WAVE_BONUS_AWARDED, waveBonus);

    // ── 3. Lumber every 5 waves ────────────────────────────────────────────────
    if (waveNumber % 5 === 0) {
      for (let seat = 0; seat < seats; seat++) this._lumber.add(1, seat);
    }
  };

  destroy(): void {
    this._subs.dispose();
  }
}
