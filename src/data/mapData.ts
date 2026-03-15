// ─────────────────────────────────────────────────────────────────────────────
// mapData.ts — 18×18 tile map. Three cell types:
//   'E' = empty  (buildable)
//   'P' = path   (enemy road, non-buildable)
//   'B' = base   (2×2 center, non-buildable)
//
// Layout — cross-shaped paths from each edge to the 2×2 base at cols 8-9, rows 8-9.
//   Top    path:  col 8, rows 0-7
//   Bottom path:  col 8, rows 10-17  (note: col 9 mirrors for symmetry — see row)
//   Left   path:  row 8, cols 0-7
//   Right  path:  row 8, cols 10-17
//
// Columns:   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17
// ─────────────────────────────────────────────────────────────────────────────

export type CellType = 'E' | 'P' | 'B';

// prettier-ignore
export const MAP_DATA: CellType[][] = [
//  0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 0
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 1
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 2
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 3
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 4
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 5
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 6
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 7
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'B', 'B', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], // row 8 ← horizontal arm
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'B', 'B', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 9 ← base row 2
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 10
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 11
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 12
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 13
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 14
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 15
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 16
  ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'P', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'], // row 17
];

// Base center in tile coords (top-left of the 2×2 block)
export const BASE_TILE_COL = 8;
export const BASE_TILE_ROW = 8;

// World-pixel center of the base (center of the 2×2 = between cols 8-9, rows 8-9)
export const BASE_CENTER_X = (BASE_TILE_COL + 1) * 40; // 360
export const BASE_CENTER_Y = (BASE_TILE_ROW + 1) * 40; // 360
