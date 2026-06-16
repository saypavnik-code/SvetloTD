// TutorialOverlay.ts — extracted from GameScene (Priority 2 refactor)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, FONT_FAMILY } from '../config';

const FONT = FONT_FAMILY;
const MESSAGES = [
  'Ставьте башни вдоль путей\n(клавиши 1–6).\nРазные башни эффективны\nпротив разной брони.',
  'Кликните на башню для\nинформации. Улучшайте\nбашни кнопкой U.',
  'Управляйте героем правой\nкнопкой мыши.\nQ — ударная волна,\nW — щит башням.',
];
const BTN_LABELS = ['Понятно →', 'Далее →', 'Начать игру!'];

export class TutorialOverlay {
  private readonly _scene: Phaser.Scene;
  private _root!:   Phaser.GameObjects.Container;
  private _active   = false;
  private _onClose?: () => void;

  constructor(scene: Phaser.Scene, onClose?: () => void) {
    this._scene   = scene;
    this._onClose = onClose;
    this._root    = scene.add.container(0, 0)
      .setDepth(DEPTH.OVERLAY + 10).setVisible(false);
  }

  get isActive(): boolean { return this._active; }

  showIfNeeded(): void {
    if (!localStorage.getItem('tutorial_done')) this._show(0);
  }

  private _show(step: number): void {
    this._active = true;
    const s = this._scene;
    const root = this._root;
    root.removeAll(true); root.setVisible(true);

    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const pw = 340, ph = 220;

    const dim = s.add.graphics();
    dim.fillStyle(COLORS.walnutDark, 0.60); dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    root.add(dim);

    const panel = s.add.graphics();
    panel.fillStyle(COLORS.bgPanel, 1); panel.fillRoundedRect(cx-pw/2, cy-ph/2, pw, ph, 12);
    panel.lineStyle(2, COLORS.amberDeep, 0.6); panel.strokeRoundedRect(cx-pw/2, cy-ph/2, pw, ph, 12);
    root.add(panel);

    for (let i=0;i<3;i++){
      const dot=s.add.graphics();
      dot.fillStyle(i===step?COLORS.amberWarm:COLORS.walnutLight, i===step?1:0.4);
      dot.fillCircle(cx-16+i*16, cy-ph/2+20, 5); root.add(dot);
    }

    root.add(s.add.text(cx, cy-30, MESSAGES[step], {
      fontFamily:FONT, fontSize:'14px', color:COLORS.textPrimary_css, align:'center', lineSpacing:6,
    }).setOrigin(0.5));

    const bw=160, bh=40;
    const btnG=s.add.graphics();
    btnG.fillStyle(COLORS.amberWarm,1); btnG.fillRoundedRect(cx-bw/2, cy+ph/2-bh-16, bw, bh, 8);
    root.add(btnG);
    root.add(s.add.text(cx, cy+ph/2-bh/2-16, BTN_LABELS[step], {
      fontFamily:FONT, fontSize:'14px', color:COLORS.walnutDark_css, fontStyle:'bold',
    }).setOrigin(0.5));

    const zone=s.add.zone(cx-bw/2, cy+ph/2-bh-16, bw, bh).setOrigin(0).setInteractive({useHandCursor:true});
    zone.on('pointerdown', () => { if(step<2) this._show(step+1); else this._close(); });
    root.add(zone);

    root.setAlpha(0); s.tweens.add({ targets:root, alpha:1, duration:200 });
  }

  private _close(): void {
    this._active = false;
    this._scene.tweens.add({
      targets: this._root, alpha: 0, duration: 200,
      onComplete: () => { this._root.setVisible(false); this._onClose?.(); },
    });
    try { localStorage.setItem('tutorial_done', 'true'); } catch { /**/ }
  }
}
