// One symmetrical, authoritative 18x18 square battlefield (Burbenog-style, see docs/GAME_DESIGN.md).
//
// Four spawns sit on the corners of a square road ring. Every enemy runs through the zones of all four
// seats (three full sides and part of the fourth), then leaves the ring on its own spur and enters the
// shared 2x2 base in the middle. The map is symmetric under 90-degree rotation, never mirrored: that is
// what makes the four seats equal.
import { GRID_COLS, GRID_ROWS, GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE } from '../config';

export type CellType = 'E' | 'P' | 'B';
export interface Cell { row: number; col: number; }

if (GRID_COLS !== GRID_ROWS) throw new Error('The square map needs a square grid');
const N = GRID_COLS;

export const BASE_TILE_COL = N / 2 - 1;
export const BASE_TILE_ROW = N / 2 - 1;
export const BASE_CENTER_X = GRID_OFFSET_X + GRID_COLS * TILE_SIZE / 2;
export const BASE_CENTER_Y = GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE / 2;

// Distance (in tiles) between the field edge and the road ring; towers also fit outside the ring.
export const RING_INSET = 2;
export const SPAWN_COUNT = 4;

const rotateCell = (cell: Cell, turns: number): Cell => {
  let { row, col } = cell;
  for (let i = 0; i < turns; i++) { [row, col] = [col, N - 1 - row]; }   // 90 degrees clockwise
  return { row, col };
};

// Route of spawn 0: starts on the north-west ring corner and runs clockwise; it leaves the ring on the west
// side at the base row and walks the spur east into the base. Spawns 1-3 are this route rotated.
function baseRoute(): Cell[] {
  const lo = RING_INSET, hi = N - 1 - RING_INSET, spurRow = BASE_TILE_ROW;
  const cells: Cell[] = [];
  for (let col = lo; col <= hi; col++) cells.push({ row: lo, col });                    // north side, eastward
  for (let row = lo + 1; row <= hi; row++) cells.push({ row, col: hi });                // east side, southward
  for (let col = hi - 1; col >= lo; col--) cells.push({ row: hi, col });                // south side, westward
  for (let row = hi - 1; row >= spurRow; row--) cells.push({ row, col: lo });           // west side, northward
  for (let col = lo + 1; col < BASE_TILE_COL; col++) cells.push({ row: spurRow, col }); // spur into the base
  return cells;
}

// One cell list per spawn, in clockwise corner order: north-west, north-east, south-east, south-west.
export const SPAWN_ROUTES: Cell[][] = Array.from({ length: SPAWN_COUNT }, (_, turns) =>
  baseRoute().map(cell => rotateCell(cell, turns)));

const roadKeys = new Set(SPAWN_ROUTES.flat().map(({ row, col }) => `${row},${col}`));

export const MAP_DATA: CellType[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col): CellType => {
    const base = (col === BASE_TILE_COL || col === BASE_TILE_COL + 1) && (row === BASE_TILE_ROW || row === BASE_TILE_ROW + 1);
    if (base) return 'B';
    return roadKeys.has(`${row},${col}`) ? 'P' : 'E';
  }),
);
