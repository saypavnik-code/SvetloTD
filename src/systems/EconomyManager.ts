// ─────────────────────────────────────────────────────────────────────────────
// EconomyManager.ts — Gold per seat and the lives all seats share. Both emit EventBus events on change.
// Phase 2: starting gold from GameConfig, sell refund tracks build phase.
// Seats (v0.18.0): a one-seat game has exactly the old single wallet (seat 0). With more seats the starting gold is
// split between them without losing a coin, and every payment names the seat it belongs to.
// ─────────────────────────────────────────────────────────────────────────────

import { GameConfig }     from '../config/difficulty';
import { splitEvenly, type SeatCount } from '../data/seats';
import { EventBus, GameEvents } from '../utils/EventBus';
import { Subscriptions } from '../utils/Subscriptions';

export class EconomyManager {
  readonly seatCount: SeatCount;
  private readonly _gold: number[];
  private _lives  = GameConfig.difficulty.startingLives;   // one pool for the team: the same for one, two or four seats
  // 1.0 during build phase (100% refund), 0.7 during combat (70% refund)
  private _sellRefundRate = 0.7;
  private readonly _subs = new Subscriptions();

  constructor(seatCount: SeatCount = 1) {
    this.seatCount = seatCount;
    this._gold = splitEvenly(GameConfig.difficulty.startingGold, seatCount);
    this._subs.on(GameEvents.BUILD_PHASE_START, this._onBuildStart);
    this._subs.on(GameEvents.BUILD_PHASE_END,   this._onBuildEnd);
  }

  /** Gold of seat 0, the only seat of a one-seat game. Code that acts for a seat must use goldOf(seat). */
  get gold():           number { return this._gold[0]; }
  get totalGold():      number { return this._gold.reduce((sum, gold) => sum + gold, 0); }
  get lives():          number { return this._lives; }
  get sellRefundRate(): number { return this._sellRefundRate; }

  goldOf(seat: number): number { return this._gold[seat] ?? 0; }

  private _validSeat(seat: number): boolean { return Number.isInteger(seat) && seat >= 0 && seat < this.seatCount; }

  addGold(amount: number, seat = 0): void {
    if (!Number.isSafeInteger(amount) || amount <= 0 || !this._validSeat(seat)) return;
    this._gold[seat] += amount;
    EventBus.emit(GameEvents.GOLD_CHANGED, this._gold[seat], seat);
  }

  spendGold(amount: number, seat = 0): boolean {
    if (!Number.isSafeInteger(amount) || amount < 0 || !this._validSeat(seat) || this._gold[seat] < amount) return false;
    this._gold[seat] -= amount;
    EventBus.emit(GameEvents.GOLD_CHANGED, this._gold[seat], seat);
    return true;
  }

  /** Give gold to another seat. Nothing is created or lost; returns false (and moves nothing) for a bad request. */
  transferGold(amount: number, from: number, to: number): boolean {
    if (!this._validSeat(from) || !this._validSeat(to) || from === to) return false;
    if (!Number.isSafeInteger(amount) || amount <= 0 || this._gold[from] < amount) return false;
    this._gold[from] -= amount;
    this._gold[to]   += amount;
    EventBus.emit(GameEvents.GOLD_CHANGED, this._gold[from], from);
    EventBus.emit(GameEvents.GOLD_CHANGED, this._gold[to], to);
    return true;
  }

  loseLife(amount = 1): void {
    if (!Number.isSafeInteger(amount) || amount <= 0 || this._lives === 0) return;
    this._lives = Math.max(0, this._lives - amount);
    EventBus.emit(GameEvents.LIVES_CHANGED, this._lives);
    if (this._lives <= 0) {
      EventBus.emit(GameEvents.GAME_OVER, { victory: false });
    }
  }

  private _onBuildStart = (): void => { this._sellRefundRate = 1.0; };
  private _onBuildEnd   = (): void => { this._sellRefundRate = 0.7; };

  destroy(): void {
    this._subs.dispose();
  }
}
