// Routes share the exact mathematical center of the 2x2 base.
import { GRID_COLS, GRID_ROWS, GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE } from '../config';
import { BASE_CENTER_X, BASE_CENTER_Y } from './mapData';

export interface Waypoint { x: number; y: number; }
const colCenter = (col: number) => GRID_OFFSET_X + (col + 0.5) * TILE_SIZE;
const rowCenter = (row: number) => GRID_OFFSET_Y + (row + 0.5) * TILE_SIZE;
const center: Waypoint = { x: BASE_CENTER_X, y: BASE_CENTER_Y };
const halfCols = GRID_COLS / 2;
const halfRows = GRID_ROWS / 2;

export const PATH_TOP: Waypoint[] = [
  ...Array.from({ length: halfRows - 1 }, (_, row) => ({ x: BASE_CENTER_X, y: rowCenter(row) })),
  center,
];
export const PATH_BOTTOM: Waypoint[] = [
  ...Array.from({ length: halfRows - 1 }, (_, index) => ({ x: BASE_CENTER_X, y: rowCenter(GRID_ROWS - 1 - index) })),
  center,
];
export const PATH_LEFT: Waypoint[] = [
  ...Array.from({ length: halfCols - 1 }, (_, col) => ({ x: colCenter(col), y: BASE_CENTER_Y })),
  center,
];
export const PATH_RIGHT: Waypoint[] = [
  ...Array.from({ length: halfCols - 1 }, (_, index) => ({ x: colCenter(GRID_COLS - 1 - index), y: BASE_CENTER_Y })),
  center,
];
export const ALL_PATHS: Waypoint[][] = [PATH_TOP, PATH_BOTTOM, PATH_LEFT, PATH_RIGHT];
export const SPAWN_POSITIONS: Waypoint[] = ALL_PATHS.map(path => path[0]);
