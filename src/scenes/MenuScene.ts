// ─────────────────────────────────────────────────────────────────────────────
// MenuScene.ts  —  Main menu. Procedural visuals: no sprites.
//
// Layout:
//   • Animated amber-dust particle field (replaces old blue starfield)
//   • Procedural glowing СВЕТЛОГОРСК logo
//   • Decorative bracket frame
//   • ИГРАТЬ button with hover state
//   • Version tag bottom-right
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_MAIN } from '../config';
import { AudioManager } from '../systems/AudioManager';

interface Dust {
  x: number; y: number;
  size: number; speed: number; alpha: number;
}

export class MenuScene extends Phaser.Scene {
  private _dust:     Dust[] = [];
  private _dustGfx!: Phaser.GameObjects.Graphics;
  private _glowT  = 0;

  private _logoText!: Phaser.GameObjects.Text;
  private _playBtn!:  Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.walnutDark);

    this._buildDust();
    this._buildDecorFrame();
    this._buildLogo();
    this._buildPlayButton();
    this._buildSubtitle();
    this._buildVersionTag();

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    this._drawDust();

    this._glowT += delta * 0.001;
    // Gentle alpha pulse on the logo
    this._logoText.setAlpha(0.88 + Math.sin(this._glowT * 2.1) * 0.12);
    this._playBtn.setAlpha(0.80 + Math.sin(this._glowT * 3.4) * 0.20);
  }

  // ── dust particles ─────────────────────────────────────────────────────────
  private _buildDust(): void {
    this._dustGfx = this.add.graphics();
    for (let i = 0; i < 100; i++) {
      this._dust.push({
        x:     Math.random() * GAME_WIDTH,
        y:     Math.random() * GAME_HEIGHT,
        size:  Math.random() * 1.4 + 0.3,
        speed: Math.random() * 0.25 + 0.04,
        alpha: Math.random() * 0.45 + 0.1,
      });
    }
  }

  private _drawDust(): void {
    const g = this._dustGfx;
    g.clear();
    for (const d of this._dust) {
      g.fillStyle(COLORS.amberPale, d.alpha);
      g.fillCircle(d.x, d.y, d.size);
      d.y -= d.speed;
      if (d.y < -2) {
        d.y = GAME_HEIGHT + 2;
        d.x = Math.random() * GAME_WIDTH;
      }
    }
  }

  // ── decorative bracket frame ───────────────────────────────────────────────
  private _buildDecorFrame(): void {
    const g   = this.add.graphics();
    const cx  = GAME_WIDTH  / 2;
    const cy  = GAME_HEIGHT / 2;
    const LX  = cx - 340;
    const RX  = cx + 340;
    const TY  = cy - 100;
    const BY  = cy + 115;
    const BL  = 28;      // bracket arm length
    const COL = COLORS.amberDeep;

    // Horizontal rules
    g.lineStyle(1, COL, 0.2);
    g.beginPath(); g.moveTo(LX, TY); g.lineTo(RX, TY); g.strokePath();
    g.beginPath(); g.moveTo(LX, BY); g.lineTo(RX, BY); g.strokePath();

    // Corner brackets
    g.lineStyle(2, COL, 0.55);
    const corners: [number, number, number, number][] = [
      [LX, TY,  1,  1],
      [RX, TY, -1,  1],
      [LX, BY,  1, -1],
      [RX, BY, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(x + dx * BL, y);
      g.lineTo(x, y);
      g.lineTo(x, y + dy * BL);
      g.strokePath();
    }

    // Centre diamond ornament
    const DS = 6;
    g.fillStyle(COLORS.amberDeep, 0.7);
    g.fillRect(cx - DS * 0.7, TY - DS * 0.7, DS * 1.4, DS * 1.4);
  }

  // ── logo ───────────────────────────────────────────────────────────────────
  private _buildLogo(): void {
    const cx = GAME_WIDTH  / 2;
    const cy = GAME_HEIGHT / 2;

    // Sub-label
    this.add.text(cx, cy - 74, 'TOWER  DEFENSE', {
      fontFamily: FONT_MAIN,
      fontSize:   '11px',
      color:      COLORS.textMuted_css,
      letterSpacing: 6,
    }).setOrigin(0.5);

    // Main title
    this._logoText = this.add.text(cx, cy - 28, 'СВЕТЛОГОРСК', {
      fontFamily: FONT_MAIN,
      fontSize:   '52px',
      fontStyle:  'bold',
      color:      COLORS.amberWarm_css,
      stroke:     COLORS.walnutDark_css,
      strokeThickness: 6,
      shadow: {
        offsetX: 0, offsetY: 2,
        color:   COLORS.amberDeep_css,
        blur:    18,
        fill:    true,
      },
    }).setOrigin(0.5);

    // Small Baltic-coast tagline
    this.add.text(cx, cy + 44, '— Балтийское побережье, 1944 —', {
      fontFamily: FONT_MAIN,
      fontSize:   '10px',
      color:      COLORS.walnutLight_css,
      letterSpacing: 1,
    }).setOrigin(0.5);
  }

  // ── play button ────────────────────────────────────────────────────────────
  private _buildPlayButton(): void {
    const cx = GAME_WIDTH  / 2;
    const cy = GAME_HEIGHT / 2;
    const PW = 240;
    const PH = 52;
    const PY = cy + 132;  // panel top-left Y

    const panel = this.add.graphics();
    panel.setPosition(cx - PW / 2, PY);
    const _drawPanel = (hover: boolean) => {
      panel.clear();
      panel.fillStyle(hover ? COLORS.amberWarm : COLORS.walnut, hover ? 0.18 : 0.22);
      panel.fillRoundedRect(0, 0, PW, PH, 6);
      panel.lineStyle(2, hover ? COLORS.amberWarm : COLORS.walnutLight, hover ? 1.0 : 0.6);
      panel.strokeRoundedRect(0, 0, PW, PH, 6);
    };
    _drawPanel(false);

    this._playBtn = this.add.text(cx, PY + PH / 2, '▶   ИГРАТЬ', {
      fontFamily: FONT_MAIN,
      fontSize:   '17px',
      color:      COLORS.amberWarm_css,
    }).setOrigin(0.5);

    // Invisible interactive zone covers the panel
    const zone = this.add
      .zone(cx, PY + PH / 2, PW, PH)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      _drawPanel(true);
      this._playBtn.setColor(COLORS.amberBright_css);
    });
    zone.on('pointerout', () => {
      _drawPanel(false);
      this._playBtn.setColor(COLORS.amberWarm_css);
    });
    zone.on('pointerdown', () => {
      // First user gesture — safe to create AudioContext here
      AudioManager.init();
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }

  // ── footer texts ───────────────────────────────────────────────────────────
  private _buildSubtitle(): void {
    this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 220,
      'Постройте оборону. Защитите берег.',
      {
        fontFamily: FONT_MAIN,
        fontSize:   '10px',
        color:      COLORS.textMuted_css,
      }
    ).setOrigin(0.5);

    // Best result from localStorage
    try {
      const stored = localStorage.getItem('best_result');
      if (stored) {
        const best = JSON.parse(stored) as {
          isVictory: boolean; wavesCompleted: number;
          livesRemaining: number; enemiesKilled: number;
        };
        const line = best.isVictory
          ? `✦ Победа! Волна ${best.wavesCompleted} • ❤ ${best.livesRemaining} • ☠ ${best.enemiesKilled}`
          : `Лучший: Волна ${best.wavesCompleted} • ❤ ${best.livesRemaining} • ☠ ${best.enemiesKilled}`;
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 238, line, {
          fontFamily: FONT_MAIN,
          fontSize:   '10px',
          color:      best.isVictory ? COLORS.amberWarm_css : COLORS.textSecondary_css,
        }).setOrigin(0.5);
      }
    } catch { /* storage unavailable */ }
  }

  private _buildVersionTag(): void {
    this.add.text(GAME_WIDTH - 14, GAME_HEIGHT - 10, 'v0.1.0', {
      fontFamily: FONT_MAIN,
      fontSize:   '8px',
      color:      COLORS.walnutLight_css,
    }).setOrigin(1, 1);
  }
}
