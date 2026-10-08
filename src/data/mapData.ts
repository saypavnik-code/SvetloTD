// One symmetrical, authoritative 18x18 four-lane battlefield.
import { GRID_COLS, GRID_ROWS, GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE } from '../config';

export type CellType = 'E' | 'P' | 'B';
export const BASE_TILE_COL = GRID_COLS / 2 - 1;
export const BASE_TILE_ROW = GRID_ROWS / 2 - 1;
export const BASE_CENTER_X = GRID_OFFSET_X + GRID_COLS * TILE_SIZE / 2;
export const BASE_CENTER_Y = GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE / 2;

// Both central rows and columns are roads; their intersection is the 2x2 base.
export const MAP_DATA: CellType[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col): CellType => {
    const vertical = col === BASE_TILE_COL || col === BASE_TILE_COL + 1;
    const horizontal = row === BASE_TILE_ROW || row === BASE_TILE_ROW + 1;
    if (vertical && horizontal) return 'B';
    return vertical || horizontal ? 'P' : 'E';
  }),
);
