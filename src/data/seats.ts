// Seats: the players of the square map (Burbenog track step B2, see docs/GAME_DESIGN.md).
//
// The field is split into four quadrant zones, numbered clockwise from the north-west like the spawns. A seat owns the
// zones it can defend: one human owns all four, two humans two each, four humans one each. Pure data, no Phaser.
import { GRID_COLS, GRID_ROWS } from '../config';

export type SeatId = 0 | 1 | 2 | 3;
export type ZoneId = 0 | 1 | 2 | 3;
export const SEAT_COUNTS = [1, 2, 4] as const;
export type SeatCount = typeof SEAT_COUNTS[number];

/** What one click on a give button moves from the active seat to another seat. */
export const GIVE_GOLD_STEP = 25;
export const GIVE_LUMBER_STEP = 1;

export const SEAT_NAMES = ['I', 'II', 'III', 'IV'] as const;
export const SEAT_COLORS = [0x4aa3df, 0xe3b15a, 0xd9644f, 0x6dbf67] as const;   // blue, amber, red, green

/** Quadrant of a tile: 0 north-west, 1 north-east, 2 south-east, 3 south-west (a 90-degree turn adds 1). */
export function zoneOfCell(row: number, col: number): ZoneId {
  const north = row < GRID_ROWS / 2, west = col < GRID_COLS / 2;
  return north ? (west ? 0 : 1) : (west ? 3 : 2);
}

/** The seat that owns a zone when `seatCount` humans play. */
export function seatOfZone(zone: number, seatCount: SeatCount): SeatId {
  return Math.floor(zone * seatCount / 4) as SeatId;
}

export function seatOfCell(row: number, col: number, seatCount: SeatCount): SeatId {
  return seatOfZone(zoneOfCell(row, col), seatCount);
}

/** Splits an integer so that nothing is lost: the first seats get the remainder. */
export function splitEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts), extra = total - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < extra ? 1 : 0));
}
