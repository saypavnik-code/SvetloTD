// ─────────────────────────────────────────────────────────────────────────────
// config.ts — Single source of truth for all game constants.
// Stage 6: Svetlogorsk TD full rebrand — amber/walnut Baltic palette.
// ─────────────────────────────────────────────────────────────────────────────

export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

export const TILE_SIZE  = 40;
export const GRID_COLS  = 18;
export const GRID_ROWS  = 18;
export const GRID_OFFSET_X = 0;
export const GRID_OFFSET_Y = 0;
export const UI_PANEL_WIDTH = GAME_WIDTH - GRID_COLS * TILE_SIZE; // 560

export const WAVE_COUNTDOWN_MS    = 5_000;
export const ENEMY_SPAWN_INTERVAL = 800;

export const STARTING_GOLD  = 150;
export const STARTING_LIVES = 20;

// ── Baltic RTS Palette (dark stone + amber accents) ─────────────────────────
export const COLORS = {
  // Backgrounds
  bgPrimary:    0x1C1917,
  bgGameField:  0x2A2622,
  bgPanel:      0x2D2823,
  bgPanelHover: 0x3A342D,
  bgDark:       0x130F0C,

  // Amber — primary accent
  amberBright:  0xFFC95B,
  amberWarm:    0xE3A63A,
  amberDeep:    0xAD731E,
  amberGlow:    0xFFD682,
  amberPale:    0xE8C483,

  // Walnut browns
  walnut:       0x5A4332,
  walnutLight:  0x806049,
  walnutDark:   0x221811,

  // Functional
  danger:       0xB34838,
  dangerSoft:   0xCF7C6E,
  success:      0x7C9C5A,
  successSoft:  0xA7C07D,

  // Baltic sea
  seaMuted:     0x5F766F,
  seaLight:     0x8EA39A,
  seaLight_css: '#8EA39A',
  seaDark:      0x304842,

  // Enemies (dark silhouettes against warm bg)
  enemyDefault: 0x4A3728,
  enemyFast:    0x2C4A3E,
  enemyHeavy:   0x5C3A21,
  enemyFlying:  0x3B3456,
  enemyBoss:    0x1A0A05,

  // Path
  pathMain:     0x8D7654,
  pathBorder:   0x675539,

  // Grid
  gridLine:     0x4B433A,
  gridHighlight:0xE3A63A,

  // Text
  textPrimary:  0xE6DCCB,
  textSecondary:0xBCAC94,
  textGold:     0xE3B15A,
  textDanger:   0xE08172,
  textMuted:    0x8E826F,

  // CSS string versions
  bgPrimary_css:    '#1C1917',
  bgPanel_css:      '#2D2823',
  bgPanelHover_css: '#3A342D',
  bgDark_css:       '#130F0C',
  amberBright_css:  '#FFC95B',
  amberWarm_css:    '#E3A63A',
  amberDeep_css:    '#AD731E',
  amberGlow_css:    '#FFD682',
  amberPale_css:    '#E8C483',
  walnut_css:       '#5A4332',
  walnutLight_css:  '#806049',
  walnutDark_css:   '#221811',
  danger_css:       '#B34838',
  dangerSoft_css:   '#CF7C6E',
  success_css:      '#7C9C5A',
  successSoft_css:  '#A7C07D',
  seaMuted_css:     '#5F766F',
  textPrimary_css:  '#E6DCCB',
  textSecondary_css:'#BCAC94',
  textGold_css:     '#E3B15A',
  textDanger_css:   '#E08172',
  textMuted_css:    '#8E826F',
  pathMain_css:     '#8D7654',
  enemyFlying_css:  '#3B3456',
} as const;

// ── Depth / Z-order ───────────────────────────────────────────────────────────
export const DEPTH = {
  BACKGROUND:       0,
  PATH:             5,
  PATH_DECORATION:  6,
  GRID:             7,
  BASE:             8,
  TOWER_BASE:       10,
  TOWER:            15,
  TOWER_SELECTION:  16,
  ENEMY_SHADOW:     18,
  ENEMY:            20,
  ENEMY_FLYING:     22,
  ENEMY_HEALTHBAR:  23,
  PROJECTILE_TRAIL: 29,
  PROJECTILE:       30,
  EFFECT:           35,
  VFX:              36,
  HERO:             38,
  RANGE_INDICATOR:  40,
  FLOATING_TEXT:    45,
  HUD:             100,
  PANEL:           101,
  OVERLAY:         200,
  OVERLAY_UI:      210,
} as const;

// ── Fonts ─────────────────────────────────────────────────────────────────────
export const FONT_MAIN = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = '"Cascadia Code", "Fira Code", monospace';
// Legacy alias — keep existing code compiling without touching every file
export const FONT_FAMILY = FONT_MAIN;

// ── Physics ───────────────────────────────────────────────────────────────────
export const PHYSICS_BOUNDS = {
  x: GRID_OFFSET_X, y: GRID_OFFSET_Y,
  width: GRID_COLS * TILE_SIZE, height: GRID_ROWS * TILE_SIZE,
} as const;
