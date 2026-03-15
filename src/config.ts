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

// ── Baltic Amber Palette ──────────────────────────────────────────────────────
export const COLORS = {
  // Backgrounds
  bgPrimary:    0xF0EEE9,
  bgGameField:  0xE8E2D6,
  bgPanel:      0xE6DFD3,
  bgPanelHover: 0xDDD5C5,
  bgDark:       0x3E2723,

  // Amber — primary accent
  amberBright:  0xFFBF00,
  amberWarm:    0xF5A623,
  amberDeep:    0xC68E17,
  amberGlow:    0xFFD700,
  amberPale:    0xF2D98B,

  // Walnut browns
  walnut:       0x5D4037,
  walnutLight:  0x8D6E63,
  walnutDark:   0x2E1A12,

  // Functional
  danger:       0xC0392B,
  dangerSoft:   0xD4726A,
  success:      0x6B8E6B,
  successSoft:  0xA8C5A0,

  // Baltic sea
  seaMuted:     0x5F8A8B,
  seaLight:     0x8FB8B0,
  seaLight_css: '#8FB8B0',
  seaDark:      0x3D6B6C,

  // Enemies (dark silhouettes against warm bg)
  enemyDefault: 0x4A3728,
  enemyFast:    0x2C4A3E,
  enemyHeavy:   0x5C3A21,
  enemyFlying:  0x3B3456,
  enemyBoss:    0x1A0A05,

  // Path
  pathMain:     0xC9B896,
  pathBorder:   0xB0A07A,

  // Grid
  gridLine:     0xD8D0C2,
  gridHighlight:0xF5A623,

  // Text
  textPrimary:  0x2E1A12,
  textSecondary:0x8D6E63,
  textGold:     0xC68E17,
  textDanger:   0xC0392B,
  textMuted:    0xA89B8C,

  // CSS string versions
  bgPrimary_css:    '#F0EEE9',
  bgPanel_css:      '#E6DFD3',
  bgPanelHover_css: '#DDD5C5',
  bgDark_css:       '#3E2723',
  amberBright_css:  '#FFBF00',
  amberWarm_css:    '#F5A623',
  amberDeep_css:    '#C68E17',
  amberGlow_css:    '#FFD700',
  amberPale_css:    '#F2D98B',
  walnut_css:       '#5D4037',
  walnutLight_css:  '#8D6E63',
  walnutDark_css:   '#2E1A12',
  danger_css:       '#C0392B',
  dangerSoft_css:   '#D4726A',
  success_css:      '#6B8E6B',
  successSoft_css:  '#A8C5A0',
  seaMuted_css:     '#5F8A8B',
  textPrimary_css:  '#2E1A12',
  textSecondary_css:'#8D6E63',
  textGold_css:     '#C68E17',
  textDanger_css:   '#C0392B',
  textMuted_css:    '#A89B8C',
  pathMain_css:     '#C9B896',
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
