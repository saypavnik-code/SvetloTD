// ─────────────────────────────────────────────────────────────────────────────
// layout.ts — Where the interface may draw (v0.20.0).
//
// The playfield is the 18 x 18 tile square at the left (720 x 720). Before v0.20.0 the top bar, the wave bar and the
// hero skill slots lay on top of it and hid or clipped the first and last tile rows. Now every interface element lives in
// the right column (SIDE), and the field is never covered. Pure numbers, no Phaser: tests/layout.test.mjs checks them.
// ─────────────────────────────────────────────────────────────────────────────
import { GAME_HEIGHT, GAME_WIDTH, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../config';

export interface Rect { x: number; y: number; w: number; h: number }

export const FIELD: Rect = { x: 0, y: 0, w: GRID_COLS * TILE_SIZE, h: GRID_ROWS * TILE_SIZE };
export const SIDE: Rect  = { x: FIELD.w, y: 0, w: GAME_WIDTH - FIELD.w, h: GAME_HEIGHT };

/** Lives, gold, lumber, wave number and the speed buttons. */
export const HUD_STRIP: Rect = { x: SIDE.x, y: 0, w: SIDE.w, h: 44 };
/** Wave title, progress or countdown, start button and the hero skill slots. */
export const BOTTOM_BAR: Rect = { x: SIDE.x, y: GAME_HEIGHT - 52, w: SIDE.w, h: 52 };

export const SKILL_SLOT = 42;
export const SKILL_GAP  = 8;
export function skillSlotRect(index: number): Rect {
  return { x: SIDE.x + 12 + index * (SKILL_SLOT + SKILL_GAP), y: BOTTOM_BAR.y + 5, w: SKILL_SLOT, h: SKILL_SLOT };
}

/** Seat chips and their give buttons (shared screen only) sit under the HUD strip. */
export const SEAT_BAR_Y = HUD_STRIP.h + 6;
export const SEAT_BAR_H = 50;

/** Top of the build list: under the strip, and under the seat bar when several seats play. */
export function panelTop(seatCount: number): number {
  return HUD_STRIP.h + 4 + (seatCount > 1 ? SEAT_BAR_H + 6 : 0);
}

export const ROW_H = 50;
export const LIST_ROWS = 6;
/** Header of the list, then the rows. */
export function listTop(seatCount: number): number { return panelTop(seatCount) + 46; }
export function listBottom(seatCount: number): number { return listTop(seatCount) + LIST_ROWS * ROW_H; }

export const BUILDER_ROW_H = 24;
/** The builders section: a header, then one row per builder, between the list and the bottom bar. */
export function buildersTop(seatCount: number): number { return listBottom(seatCount) + 8; }
export function buildersBottom(seatCount: number): number { return buildersTop(seatCount) + 22 + 6 * BUILDER_ROW_H; }

export function inside(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
