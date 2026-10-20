import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY } from '../config';
import { HUD_STRIP } from './layout';
import { EconomyManager } from '../systems/EconomyManager';
import { WaveManager } from '../systems/WaveManager';
import { GameSpeed } from '../systems/GameSpeed';
import { WAVES } from '../data/waves';

const BAR_H = HUD_STRIP.h;
const X0 = HUD_STRIP.x;                  // the strip is the top of the right column: the field below-left stays uncovered
const D = DEPTH.PANEL + 2;               // above the side panel background
const FONT = FONT_FAMILY;
const SPEEDS = [1, 2, 3];
const BTN_W = 42, BTN_H = 28;
const speedBtnX = (index: number): number => X0 + HUD_STRIP.w - 12 - SPEEDS.length * (BTN_W + 6) + 6 + index * (BTN_W + 6);

export class HUD {
  private readonly _scene: Phaser.Scene;
  private readonly _economy: EconomyManager;
  private readonly _wm: WaveManager;

  private _livesNum!: Phaser.GameObjects.Text;
  private _goldNum!:  Phaser.GameObjects.Text;
  private _lumberNum!: Phaser.GameObjects.Text;
  private _waveText!: Phaser.GameObjects.Text;
  private _speedBtns: Array<{ bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; speed: number }> = [];

  private _goldTween: Phaser.Tweens.Tween | null = null;
  private _goldDisplay = 0;
  private _wavePulseT = 0;
  private _waveIsBoss = false;

  constructor(scene: Phaser.Scene, economy: EconomyManager, wm: WaveManager) {
    this._scene = scene;
    this._economy = economy;
    this._wm = wm;
    this._build();
  }

  private _build(): void {
    const s = this._scene;

    // Only a divider under the strip: the side panel already paints the background of the column.
    const bg = s.add.graphics().setDepth(D);
    bg.lineStyle(2, COLORS.walnutLight, 0.7);
    bg.beginPath(); bg.moveTo(X0 + 10, BAR_H); bg.lineTo(X0 + HUD_STRIP.w - 10, BAR_H); bg.strokePath();
    bg.lineStyle(1, COLORS.amberDeep, 0.9);
    bg.beginPath(); bg.moveTo(X0 + 10, BAR_H - 1); bg.lineTo(X0 + HUD_STRIP.w - 10, BAR_H - 1); bg.strokePath();

    s.add.image(X0 + 26, 22, 'icon_heart').setDisplaySize(24, 24).setDepth(D);
    this._livesNum = s.add.text(X0 + 44, 14, `${this._economy.lives}`, {
      fontFamily: FONT, fontSize: '16px', color: COLORS.textDanger_css, fontStyle: 'bold',
    }).setDepth(D);

    s.add.image(X0 + 112, 22, 'icon_gold').setDisplaySize(24, 24).setDepth(D);
    this._goldDisplay = this._economy.goldOf(0);
    this._goldNum = s.add.text(X0 + 130, 14, `${this._economy.goldOf(0)}`, {
      fontFamily: FONT, fontSize: '16px', color: COLORS.textGold_css, fontStyle: 'bold',
    }).setDepth(D);

    // Lumber counter — shown after gold
    s.add.image(X0 + 204, 22, 'icon_lumber').setDisplaySize(26, 26).setDepth(D);
    this._lumberNum = s.add.text(X0 + 222, 14, '0', {
      fontFamily: FONT, fontSize: '16px', color: '#7CBA5C', fontStyle: 'bold',
    }).setDepth(D);

    this._waveText = s.add.text(X0 + 336, 21, `Волна 1 / ${WAVES.length}`, {
      fontFamily: FONT,
      fontSize: '15px',
      color: COLORS.textPrimary_css,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(D);

    SPEEDS.forEach((spd, i) => {
      const bx = speedBtnX(i), btnW = BTN_W, btnH = BTN_H;
      const by = (BAR_H - btnH) / 2;
      const bgG = s.add.graphics().setDepth(D);
      const lbl = s.add.text(bx + btnW / 2, by + btnH / 2, `×${spd}`, {
        fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(D + 1);
      this._speedBtns.push({ bg: bgG, label: lbl, speed: spd });
      this._redrawSpeedBtn(i, spd === 1);

      const zone = s.add.zone(bx, by, btnW, btnH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 2);
      zone.on('pointerdown', () => {
        GameSpeed.set(spd);
        this._speedBtns.forEach((b, j) => this._redrawSpeedBtn(j, b.speed === spd));
      });
    });
  }

  private _redrawSpeedBtn(idx: number, active: boolean): void {
    const entry = this._speedBtns[idx];
    const btnW = BTN_W, btnH = BTN_H;
    const bx = speedBtnX(idx);
    const by = (BAR_H - btnH) / 2;

    const bg = entry.bg;
    bg.clear();
    if (active) {
      bg.fillStyle(COLORS.amberWarm, 0.92);
      bg.fillRoundedRect(bx, by, btnW, btnH, 5);
      bg.lineStyle(2, COLORS.amberGlow, 0.9);
      bg.strokeRoundedRect(bx, by, btnW, btnH, 5);
      entry.label.setColor(COLORS.walnutDark_css);
    } else {
      bg.fillStyle(COLORS.bgDark, 0.6);
      bg.fillRoundedRect(bx, by, btnW, btnH, 5);
      bg.lineStyle(1, COLORS.walnutLight, 0.6);
      bg.strokeRoundedRect(bx, by, btnW, btnH, 5);
      entry.label.setColor(COLORS.textSecondary_css);
    }
  }

  setLumber(n: number): void {
    this._lumberNum.setText(`${n}`);
  }

  setLives(n: number): void {
    this._livesNum.setText(`${n}`);
    const ox = this._livesNum.x;
    this._scene.tweens.add({
      targets: this._livesNum,
      x: { from: ox - 3, to: ox },
      duration: 180,
      yoyo: true,
      repeat: 2,
      onComplete: () => this._livesNum.setX(ox),
    });
  }

  setGold(n: number): void {
    if (this._goldTween) this._goldTween.stop();
    const obj = { val: this._goldDisplay };
    this._goldTween = this._scene.tweens.add({
      targets: obj,
      val: n,
      duration: 280,
      ease: 'Linear',
      onUpdate: () => {
        this._goldDisplay = Math.round(obj.val);
        this._goldNum.setText(`${this._goldDisplay}`);
      },
      onComplete: () => {
        this._goldDisplay = n;
        this._goldNum.setText(`${n}`);
      },
    });
  }

  setWave(waveNum: number, isBoss: boolean): void {
    this._waveIsBoss = isBoss;
    this._wavePulseT = 0;
    this._waveText.setText(`Волна ${Math.min(waveNum, WAVES.length)} / ${WAVES.length}`);
    this._waveText.setColor(isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);
  }

  update(delta: number): void {
    if (this._waveIsBoss) {
      this._wavePulseT += delta * 0.004;
      const a = 0.68 + Math.sin(this._wavePulseT * Math.PI * 2) * 0.32;
      this._waveText.setAlpha(a);
    } else {
      this._waveText.setAlpha(1);
    }
  }
}
