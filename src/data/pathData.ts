// ─────────────────────────────────────────────────────────────────────────────
// pathData.ts — The 4 fixed enemy routes, each as world-pixel waypoints
// (centre of each tile the enemy passes through).
//
// Convention: every path ends at BASE_CENTER (360, 360).
// TILE_SIZE = 40.  Centre of tile (col, row) = (col*40+20, row*40+20)
// ─────────────────────────────────────────────────────────────────────────────

export interface Waypoint {
  x: number;
  y: number;
}

const T = 40; // TILE_SIZE — avoid importing to keep data files pure
const cx = (col: number) => col * T + T / 2;
const cy = (row: number) => row * T + T / 2;

// ── Path 0 — TOP → BASE (col 8, rows 0..8, enters base at row 8) ─────────────
export const PATH_TOP: Waypoint[] = [
  { x: cx(8), y: cy(0)  },
  { x: cx(8), y: cy(1)  },
  { x: cx(8), y: cy(2)  },
  { x: cx(8), y: cy(3)  },
  { x: cx(8), y: cy(4)  },
  { x: cx(8), y: cy(5)  },
  { x: cx(8), y: cy(6)  },
  { x: cx(8), y: cy(7)  },
  { x: cx(8), y: cy(8)  }, // base entry
  { x: cx(8), y: cy(9)  }, // base center
];

// ── Path 1 — BOTTOM → BASE (col 8, rows 17..9) ───────────────────────────────
export const PATH_BOTTOM: Waypoint[] = [
  { x: cx(8), y: cy(17) },
  { x: cx(8), y: cy(16) },
  { x: cx(8), y: cy(15) },
  { x: cx(8), y: cy(14) },
  { x: cx(8), y: cy(13) },
  { x: cx(8), y: cy(12) },
  { x: cx(8), y: cy(11) },
  { x: cx(8), y: cy(10) },
  { x: cx(8), y: cy(9)  }, // base entry
  { x: cx(8), y: cy(8)  }, // base center
];

// ── Path 2 — LEFT → BASE (row 8, cols 0..8) ──────────────────────────────────
export const PATH_LEFT: Waypoint[] = [
  { x: cx(0),  y: cy(8) },
  { x: cx(1),  y: cy(8) },
  { x: cx(2),  y: cy(8) },
  { x: cx(3),  y: cy(8) },
  { x: cx(4),  y: cy(8) },
  { x: cx(5),  y: cy(8) },
  { x: cx(6),  y: cy(8) },
  { x: cx(7),  y: cy(8) },
  { x: cx(8),  y: cy(8) }, // base entry
  { x: cx(9),  y: cy(8) }, // base center
];

// ── Path 3 — RIGHT → BASE (row 8, cols 17..10) ───────────────────────────────
export const PATH_RIGHT: Waypoint[] = [
  { x: cx(17), y: cy(8) },
  { x: cx(16), y: cy(8) },
  { x: cx(15), y: cy(8) },
  { x: cx(14), y: cy(8) },
  { x: cx(13), y: cy(8) },
  { x: cx(12), y: cy(8) },
  { x: cx(11), y: cy(8) },
  { x: cx(10), y: cy(8) },
  { x: cx(9),  y: cy(8) }, // base entry
  { x: cx(8),  y: cy(8) }, // base center
];

// Convenience index array — pathIndex 0..3
export const ALL_PATHS: Waypoint[][] = [
  PATH_TOP,
  PATH_BOTTOM,
  PATH_LEFT,
  PATH_RIGHT,
];

// Spawn position = first waypoint of each path
export const SPAWN_POSITIONS = ALL_PATHS.map(p => p[0]);
