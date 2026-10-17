// ─────────────────────────────────────────────────────────────────────────────
// Seats.ts — Who plays: the number of seats, the active seat of a shared screen (hot seat) and the zone rule.
// It owns no money: wallets live in EconomyManager and LumberManager, keyed by seat.
// ─────────────────────────────────────────────────────────────────────────────

import { EventBus, GameEvents } from '../utils/EventBus';
import { SEAT_COUNTS, seatOfCell, type SeatCount, type SeatId } from '../data/seats';

export class Seats {
  readonly count: SeatCount;
  private _active: SeatId = 0;

  constructor(count: SeatCount = 1) {
    this.count = count;
  }

  get active(): SeatId { return this._active; }

  /** Hot-seat switch. Returns false (and emits nothing) for a seat that does not exist or is already active. */
  setActive(seat: number): boolean {
    if (!Number.isInteger(seat) || seat < 0 || seat >= this.count || seat === this._active) return false;
    this._active = seat as SeatId;
    EventBus.emit(GameEvents.SEAT_CHANGED, seat);
    return true;
  }

  ownerOfCell(row: number, col: number): SeatId { return seatOfCell(row, col, this.count); }

  /** A seat builds only inside its own zones. */
  canBuild(seat: number, row: number, col: number): boolean { return this.ownerOfCell(row, col) === seat; }
}

/** `?seats=2` or `?seats=4` starts a shared-screen game; anything else is the usual one-seat game. */
export function parseSeatCount(search: string): SeatCount {
  const value = Number(new URLSearchParams(search).get('seats'));
  return (SEAT_COUNTS as readonly number[]).includes(value) ? (value as SeatCount) : 1;
}
