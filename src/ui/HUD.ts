import Phaser from 'phaser';
import {
  GAME_WIDTH, GRID_COLS, TILE_SIZE,
  COLORS, DEPTH, FONT_FAMILY, STARTING_LIVES,
} from '../config';
import { EconomyManager } from '../systems/EconomyManager';
import { WaveManager } from '../systems/WaveManager';
import { GameSpeed } from '../systems/GameSpeed';
import { WAVES } from '../data/waves';

const BAR_H = 44;
const FONT = FONT_FAMILY;

export class HUD {
  private readonly _scene: Phaser.Scene;
  private readonly _economy: EconomyManager;
  private readonly _wm: WaveManager;

  private _livesNum!: Phaser.GameObjects.Text;
  private _goldNum!: Phaser.GameObjects.Text;
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

    const bg = s.add.graphics().setDepth(DEPTH.HUD - 1);
    bg.fillStyle(COLORS.bgPanel, 1);
    bg.fillRect(0, 0, GAME_WIDTH, BAR_H);
    bg.fillStyle(COLORS.bgDark, 0.45);
    bg.fillRect(0, 0, GAME_WIDTH, 6);

    bg.lineStyle(2, COLORS.walnutLight, 0.7);
    bg.beginPath(); bg.moveTo(0, BAR_H); bg.lineTo(GAME_WIDTH, BAR_H); bg.strokePath();
    bg.lineStyle(1, COLORS.amberDeep, 0.9);
    bg.beginPath(); bg.moveTo(0, BAR_H - 1); bg.lineTo(GAME_WIDTH, BAR_H - 1); bg.strokePath();

    bg.lineStyle(3, COLORS.walnutDark, 0.9);
    bg.beginPath(); bg.moveTo(GRID_COLS * TILE_SIZE, 0); bg.lineTo(GRID_COLS * TILE_SIZE, BAR_H); bg.strokePath();
    bg.lineStyle(1, COLORS.amberDeep, 0.7);
    bg.beginPath(); bg.moveTo(GRID_COLS * TILE_SIZE + 2, 0); bg.lineTo(GRID_COLS * TILE_SIZE + 2, BAR_H); bg.strokePath();

    s.add.text(14, 13, '❤', { fontFamily: FONT, fontSize: '18px', color: COLORS.textDanger_css }).setDepth(DEPTH.HUD);
    this._livesNum = s.add.text(38, 14, `${STARTING_LIVES}`, {
      fontFamily: FONT, fontSize: '16px', color: COLORS.textDanger_css, fontStyle: 'bold',
    }).setDepth(DEPTH.HUD);

    s.add.text(110, 13, '◆', { fontFamily: FONT, fontSize: '18px', color: COLORS.amberWarm_css }).setDepth(DEPTH.HUD);
    this._goldDisplay = this._economy.gold;
    this._goldNum = s.add.text(134, 14, `${this._economy.gold}`, {
      fontFamily: FONT, fontSize: '16px', color: COLORS.textGold_css, fontStyle: 'bold',
    }).setDepth(DEPTH.HUD);

    this._waveText = s.add.text(GAME_WIDTH / 2, 21, `Волна 1 / ${WAVES.length}`, {
      fontFamily: FONT,
      fontSize: '15px',
      color: COLORS.textPrimary_css,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const speeds = [1, 2, 3];
    const btnW = 42;
    const btnH = 28;
    const startX = GAME_WIDTH - 16 - speeds.length * (btnW + 6);
    speeds.forEach((spd, i) => {
      const bx = startX + i * (btnW + 6);
      const by = (BAR_H - btnH) / 2;
      const bgG = s.add.graphics().setDepth(DEPTH.HUD);
      const lbl = s.add.text(bx + btnW / 2, by + btnH / 2, `×${spd}`, {
        fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(DEPTH.HUD + 1);
      this._speedBtns.push({ bg: bgG, label: lbl, speed: spd });
      this._redrawSpeedBtn(i, spd === 1);

      const zone = s.add.zone(bx, by, btnW, btnH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD + 2);
      zone.on('pointerdown', () => {
        GameSpeed.set(spd);
        this._speedBtns.forEach((b, j) => this._redrawSpeedBtn(j, b.speed === spd));
      });
    });
  }

  private _redrawSpeedBtn(idx: number, active: boolean): void {
    const entry = this._speedBtns[idx];
    const speeds = [1, 2, 3];
    const btnW = 42;
    const btnH = 28;
    const startX = GAME_WIDTH - 16 - speeds.length * (btnW + 6);
    const bx = startX + idx * (btnW + 6);
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
