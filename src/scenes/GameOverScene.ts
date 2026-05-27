// ─────────────────────────────────────────────────────────────────────────────
// GameOverScene.ts  —  Fallback Win/Loss screen.
//
// NOTE: In Stage 8 the in-game overlay (GameScene._showEndOverlay) handles
// the end state without scene transitions.  This scene is kept as a
// safety net: GameScene calls  this.scene.start('GameOverScene', data)  only
// when the overlay approach is unavailable, or if explicitly navigated here.
//
// Receives: { victory: boolean, wave?: number, kills?: number, gold?: number }
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_MAIN } from '../config';

interface GameOverData {
  victory: boolean;
  wave?:   number;
  kills?:  number;
  gold?:   number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: GameOverData): void {
    const victory = data?.victory ?? false;
    const wave    = data?.wave    ?? 0;
    const kills   = data?.kills   ?? 0;
    const gold    = data?.gold    ?? 0;

    this.cameras.main.setBackgroundColor(COLORS.walnutDark);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    const cx = GAME_WIDTH  / 2;
    const cy = GAME_HEIGHT / 2;

    // ── Background card ───────────────────────────────────────────────────
    const CW = 360; const CH = 380;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.96);
    bg.fillStyle(COLORS.bgDark, 0.25);
    bg.fillRoundedRect(cx - CW / 2 + 8, cy - CH / 2 + 8, CW - 16, CH - 16, 10);
    bg.fillRoundedRect(cx - CW / 2, cy - CH / 2, CW, CH, 12);
    bg.lineStyle(4, COLORS.walnutDark, 0.95);
    bg.strokeRoundedRect(cx - CW / 2, cy - CH / 2, CW, CH, 12);
    bg.lineStyle(2, victory ? COLORS.amberDeep : COLORS.danger, 0.85);
    bg.strokeRoundedRect(cx - CW / 2, cy - CH / 2, CW, CH, 12);

    // ── Title ─────────────────────────────────────────────────────────────
    const titleText  = victory ? '✦  ПОБЕДА  ✦' : 'ПОРАЖЕНИЕ';
    const titleColor = victory ? COLORS.amberGlow_css : COLORS.danger_css;

    this.add.text(cx, cy - 130, titleText, {
      fontFamily: FONT_MAIN,
      fontSize:   '38px',
      fontStyle:  'bold',
      color:      titleColor,
      stroke:     COLORS.walnutDark_css,
      strokeThickness: 4,
    }).setOrigin(0.5);

    const subText = victory
      ? 'Светлогорск спасён!'
      : 'Шторм поглотил берег...';

    this.add.text(cx, cy - 78, subText, {
      fontFamily: FONT_MAIN,
      fontSize:   '14px',
      color:      COLORS.textSecondary_css,
    }).setOrigin(0.5);

    // ── Divider ───────────────────────────────────────────────────────────
    const dg = this.add.graphics();
    dg.lineStyle(2, COLORS.amberDeep, 0.5);
    dg.beginPath();
    dg.moveTo(cx - 120, cy - 52);
    dg.lineTo(cx + 120, cy - 52);
    dg.strokePath();

    // ── Stats ─────────────────────────────────────────────────────────────
    const statStyle = {
      fontFamily: FONT_MAIN, fontSize: '12px', color: COLORS.textSecondary_css,
    };
    const valStyle = {
      fontFamily: FONT_MAIN, fontSize: '12px', color: COLORS.amberWarm_css,
    };

    const stats: [string, string][] = [
      ['Волн пройдено',     `${wave}`],
      ['Врагов уничтожено', `${kills}`],
      ['Янтарь собран',     `${gold} ◆`],
    ];

    stats.forEach(([label, val], i) => {
      const y = cy - 22 + i * 28;
      this.add.text(cx - 110, y, label, statStyle).setOrigin(0, 0.5);
      this.add.text(cx + 110, y, val,   valStyle ).setOrigin(1, 0.5);
    });

    // ── Buttons ───────────────────────────────────────────────────────────
    this._makeButton(cx, cy + 100, '▶  Играть снова', COLORS.amberWarm, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });

    this._makeButton(cx, cy + 150, 'В главное меню', COLORS.walnutLight, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
    });
  }

  // ── helper: outlined text button ─────────────────────────────────────────
  private _makeButton(
    x: number, y: number, label: string,
    col: number, onClick: () => void,
  ): void {
    const BW = 200; const BH = 38;
    const bg = this.add.graphics();
    bg.setPosition(x - BW / 2, y - BH / 2);

    const _draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(col, hover ? 0.22 : 0.08);
      bg.fillRoundedRect(0, 0, BW, BH, 6);
      bg.lineStyle(1, col, hover ? 0.9 : 0.5);
      bg.strokeRoundedRect(0, 0, BW, BH, 6);
    };
    _draw(false);

    // Numeric color → CSS hex
    const hex = '#' + col.toString(16).padStart(6, '0');
    const btn = this.add.text(x, y, label, {
      fontFamily: FONT_MAIN,
      fontSize:   '13px',
      color:      hex,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => _draw(true));
    btn.on('pointerout',   () => _draw(false));
    btn.on('pointerdown',  onClick);
  }
}
