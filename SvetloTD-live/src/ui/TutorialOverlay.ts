// ─────────────────────────────────────────────────────────────────────────────
// TutorialOverlay.ts — Three-step tutorial (Phase 4 extraction from GameScene).
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, FONT_MAIN } from '../config';
import { SFX } from '../systems/SFX';

const FONT = FONT_MAIN;

const MESSAGES = [
  'Ставьте башни вдоль путей\n(клавиши 1–5).\nРазные башни эффективны\nпротив разной брони.',
  'Кликните на башню для\nинформации. Улучшайте\nбашни кнопкой U.',
  'Управляйте героем правой\nкнопкой мыши.\nQ — ударная волна,\nW — щит башням.',
];
const BTN_LABELS = ['Понятно →', 'Далее →', 'Начать игру!'];

export class TutorialOverlay {
  private readonly _scene: Phaser.Scene;
  private _root!:   Phaser.GameObjects.Container;
  private _active  = false;
  private _sfx:    SFX | null = null;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._root  = scene.add.container(0, 0)
      .setDepth(DEPTH.OVERLAY + 10)
      .setVisible(false);
  }

  get isActive(): boolean { return this._active; }

  setSfx(sfx: SFX | null): void { this._sfx = sfx; }

  /** Show if tutorial hasn't been completed yet. */
  showIfNeeded(): void {
    if (!localStorage.getItem('tutorial_done')) this._showStep(0);
  }

  private _showStep(step: number): void {
    this._active = true;
    const root = this._root;
    root.removeAll(true);
    root.setVisible(true);

    const s  = this._scene;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const pw = 340, ph = 220;

    const dim = s.add.graphics();
    dim.fillStyle(COLORS.walnutDark, 0.60);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    root.add(dim);

    const panel = s.add.graphics();
    panel.fillStyle(COLORS.bgPanel, 1);
    panel.fillRoundedRect(cx - pw/2, cy - ph/2, pw, ph, 12);
    panel.lineStyle(2, COLORS.amberDeep, 0.6);
    panel.strokeRoundedRect(cx - pw/2, cy - ph/2, pw, ph, 12);
    root.add(panel);

    for (let i = 0; i < 3; i++) {
      const dot = s.add.graphics();
      dot.fillStyle(i === step ? COLORS.amberWarm : COLORS.walnutLight, i === step ? 1 : 0.4);
      dot.fillCircle(cx - 16 + i * 16, cy - ph/2 + 20, 5);
      root.add(dot);
    }

    const msg = s.add.text(cx, cy - 30, MESSAGES[step], {
      fontFamily: FONT, fontSize: '14px',
      color: COLORS.textPrimary_css, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    root.add(msg);

    const bw = 160, bh = 40;
    const btnG = s.add.graphics();
    btnG.fillStyle(COLORS.amberWarm, 1);
    btnG.fillRoundedRect(cx - bw/2, cy + ph/2 - bh - 16, bw, bh, 8);
    root.add(btnG);

    const btnTxt = s.add.text(cx, cy + ph/2 - bh/2 - 16, BTN_LABELS[step], {
      fontFamily: FONT, fontSize: '14px',
      color: COLORS.walnutDark_css, fontStyle: 'bold',
    }).setOrigin(0.5);
    root.add(btnTxt);

    const zone = s.add.zone(cx - bw/2, cy + ph/2 - bh - 16, bw, bh)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this._sfx?.uiClick();
      if (step < 2) this._showStep(step + 1);
      else          this._close();
    });
    root.add(zone);

    root.setAlpha(0);
    s.tweens.add({ targets: root, alpha: 1, duration: 200 });
  }

  private _close(): void {
    this._active = false;
    this._scene.tweens.add({
      targets: this._root, alpha: 0, duration: 200,
      onComplete: () => this._root.setVisible(false),
    });
    try { localStorage.setItem('tutorial_done', 'true'); } catch { /* private browse */ }
  }
}