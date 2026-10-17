// Routes share the exact mathematical center of the 2x2 base.
import { GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE } from '../config';
import { BASE_CENTER_X, BASE_CENTER_Y, SPAWN_ROUTES } from './mapData';

export interface Waypoint { x: number; y: number; }
const center: Waypoint = { x: BASE_CENTER_X, y: BASE_CENTER_Y };

// One waypoint per road tile (dense on purpose: slot ranking and range checks walk the tiles), then the base center.
export const ALL_PATHS: Waypoint[][] = SPAWN_ROUTES.map(route => [
  ...route.map(({ row, col }) => ({
    x: GRID_OFFSET_X + (col + 0.5) * TILE_SIZE,
    y: GRID_OFFSET_Y + (row + 0.5) * TILE_SIZE,
  })),
  { ...center },
]);
// Spawn order is clockwise from the north-west corner. The four legacy lane names stay as aliases of the
// spawn paths so that call sites and tests only need "some path".
export const [PATH_TOP, PATH_BOTTOM, PATH_LEFT, PATH_RIGHT] = ALL_PATHS;
export const SPAWN_POSITIONS: Waypoint[] = ALL_PATHS.map(path => path[0]);

// Remaining walking distance from waypoint `index` to the end of the route (cached per route: routes never change).
const suffixCache = new WeakMap<Waypoint[], number[]>();
export function routeSuffixLengths(route: Waypoint[]): number[] {
  let sums = suffixCache.get(route);
  if (!sums) {
    sums = new Array<number>(route.length).fill(0);
    for (let i = route.length - 2; i >= 0; i--) {
      sums[i] = sums[i + 1] + Math.hypot(route[i + 1].x - route[i].x, route[i + 1].y - route[i].y);
    }
    suffixCache.set(route, sums);
  }
  return sums;
}
