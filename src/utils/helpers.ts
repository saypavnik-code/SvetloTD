// ─────────────────────────────────────────────────────────────────────────────
// helpers.ts — Pure utility functions. No Phaser imports here so these
// can be unit-tested without a DOM.
// ─────────────────────────────────────────────────────────────────────────────

import { TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y } from '../config';

// ── Grid ↔ World conversion ───────────────────────────────────────────────────

/** Grid cell (col, row) → world pixel center */
export function gridToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
    y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** World pixel → grid cell (floored — top-left corner of the cell) */
export function worldToGrid(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor((x - GRID_OFFSET_X) / TILE_SIZE),
    row: Math.floor((y - GRID_OFFSET_Y) / TILE_SIZE),
  };
}

// ── Math helpers ─────────────────────────────────────────────────────────────

/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Linear interpolation between a and b by t ∈ [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Euclidean distance between two points. */
export function distance(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Squared distance — faster when you only need comparisons. */
export function distanceSq(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/** Convert degrees to radians. */
export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/** Convert radians to degrees. */
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Random integer in [min, max] (inclusive). */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
export function randPick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

// ── String helpers ────────────────────────────────────────────────────────────

/** Format a gold amount with the ₿ symbol: "250 g" */
export const formatGold = (n: number): string => `${n} g`;

/** Zero-pad a number: zeroPad(3, 2) → "03" */
export const zeroPad = (n: number, width: number): string =>
  String(n).padStart(width, '0');

// ── Color helpers ─────────────────────────────────────────────────────────────

/**
 * Interpolate between two hex colors.
 * @param colorA  Phaser hex color (0xRRGGBB)
 * @param colorB  Phaser hex color
 * @param t       0 → colorA, 1 → colorB
 */
export function lerpColor(colorA: number, colorB: number, t: number): number {
  const ar = (colorA >> 16) & 0xff;
  const ag = (colorA >>  8) & 0xff;
  const ab =  colorA        & 0xff;

  const br = (colorB >> 16) & 0xff;
  const bg = (colorB >>  8) & 0xff;
  const bb =  colorB        & 0xff;

  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const b = Math.round(lerp(ab, bb, t));

  return (r << 16) | (g << 8) | b;
}
