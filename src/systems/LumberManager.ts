// ─────────────────────────────────────────────────────────────────────────────
// LumberManager.ts — Secondary resource (Lumber / Дерево), one wallet per seat.
//
// Sources:
//   • Golem/boss kill  → +lumberYield from EnemyDef to the seat that made the kill (EnemyOutcomes)
//   • Every 5th wave   → +1 to every seat (InterestSystem, triggered by WAVE_COMPLETED)
//
// Spent on (BuilderManager is the only payer, through `spend`):
//   • Builder licenses, a builder's mastery and the ultimate towers (v0.20.0)
//   • Future: hero summon, aura buildings
//
// Emits LUMBER_CHANGED (new total, seat) so the HUD updates without coupling.
// ─────────────────────────────────────────────────────────────────────────────

import { EventBus, GameEvents } from '../utils/EventBus';
import type { SeatCount } from '../data/seats';

export class LumberManager {
  readonly seatCount: SeatCount;
  private readonly _lumber: number[];

  constructor(seatCount: SeatCount = 1) {
    this.seatCount = seatCount;
    this._lumber = new Array<number>(seatCount).fill(0);
  }

  /** Lumber of seat 0, the only seat of a one-seat game. Code that acts for a seat must use lumberOf(seat). */
  get lumber(): number { return this._lumber[0]; }

  lumberOf(seat: number): number { return this._lumber[seat] ?? 0; }

  private _validSeat(seat: number): boolean { return Number.isInteger(seat) && seat >= 0 && seat < this.seatCount; }

  add(amount: number, seat = 0): void {
    if (!Number.isSafeInteger(amount) || amount <= 0 || !this._validSeat(seat)) return;
    this._lumber[seat] += amount;
    EventBus.emit(GameEvents.LUMBER_CHANGED, this._lumber[seat], seat);
  }

  /** Returns false if not enough lumber — caller decides how to handle. */
  spend(amount: number, seat = 0): boolean {
    if (!Number.isSafeInteger(amount) || amount < 0 || !this._validSeat(seat) || this._lumber[seat] < amount) return false;
    this._lumber[seat] -= amount;
    EventBus.emit(GameEvents.LUMBER_CHANGED, this._lumber[seat], seat);
    return true;
  }

  /** Give lumber to another seat. Nothing is created or lost; returns false (and moves nothing) for a bad request. */
  transfer(amount: number, from: number, to: number): boolean {
    if (!this._validSeat(from) || !this._validSeat(to) || from === to) return false;
    if (!Number.isSafeInteger(amount) || amount <= 0 || this._lumber[from] < amount) return false;
    this._lumber[from] -= amount;
    this._lumber[to]   += amount;
    EventBus.emit(GameEvents.LUMBER_CHANGED, this._lumber[from], from);
    EventBus.emit(GameEvents.LUMBER_CHANGED, this._lumber[to], to);
    return true;
  }

  canAfford(amount: number, seat = 0): boolean { return this.lumberOf(seat) >= amount; }
}
