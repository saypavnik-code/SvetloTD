import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { WAVES, type WaveData } from '../data/waves';
import { DEPTH, FONT_FAMILY, COLORS } from '../config';
import { BOTTOM_BAR, SIDE, SKILL_SLOT, skillSlotRect } from './layout';

// The bar is the bottom of the right column (v0.20.0): the last tile row of the field is never covered.
const BAR_H = BOTTOM_BAR.h;
const BAR_Y = BOTTOM_BAR.y;
const FONT = FONT_FAMILY;
const LEFT = skillSlotRect(1).x + SKILL_SLOT + 10;   // the hero skill slots (Q/W) sit at the left edge of the bar
const BTN_W = 140;
const BTN_X = SIDE.x + SIDE.w - BTN_W - 12;
const CD_W = 200;     // countdown bar width
const WAVE_W = 270;   // wave progress bar width

const ARMOR_COLORS: Record<string, string> = {
  unarmored: COLORS.textMuted_css,
  light: COLORS.seaLight_css,
  medium: COLORS.textSecondary_css,
  heavy: COLORS.walnutLight_css,
  fortified: COLORS.textGold_css,
  heroic: COLORS.textDanger_css,
};

export class WaveInfo {
  private readonly _scene: Phaser.Scene;
  private readonly _wm: WaveManager;

  private _cdRoot!: Phaser.GameObjects.Container;
  private _cdTitle!: Phaser.GameObjects.Text;
  private _cdTimer!: Phaser.GameObjects.Text;
  private _cdBarBg!: Phaser.GameObjects.Graphics;
  private _cdBarFill!: Phaser.GameObjects.Graphics;
  private _cdBtnGfx!: Phaser.GameObjects.Graphics;
  private _cdBtnLbl!: Phaser.GameObjects.Text;
  private _cdHint!: Phaser.GameObjects.Text;
  private _cdBgFlash!: Phaser.GameObjects.Graphics;

  private _waveRoot!: Phaser.GameObjects.Container;
  private _waveTitleTxt!: Phaser.GameObjects.Text;
  private _waveBarBg!: Phaser.GameObjects.Graphics;
  private _waveBarFill!: Phaser.GameObjects.Graphics;

  private _countdownFull = 20;

  constructor(scene: Phaser.Scene, wm: WaveManager) {
    this._scene = scene;
    this._wm = wm;

    this._buildBackground();
    this._buildCountdownPanel();
    this._buildActivePanel();
    this._wireCallbacks();
    this._showCountdown();
  }

  private _buildBackground(): void {
    const g = this._scene.add.graphics().setDepth(DEPTH.PANEL + 1);   // above the side panel background
    g.fillStyle(COLORS.bgDark, 0.35);
    g.fillRect(SIDE.x + 6, BAR_Y, SIDE.w - 12, BAR_H - 6);
    g.lineStyle(2, COLORS.walnutLight, 0.7);
    g.beginPath(); g.moveTo(SIDE.x + 10, BAR_Y); g.lineTo(SIDE.x + SIDE.w - 10, BAR_Y); g.strokePath();
    g.lineStyle(1, COLORS.amberDeep, 0.9);
    g.beginPath(); g.moveTo(SIDE.x + 10, BAR_Y + 1); g.lineTo(SIDE.x + SIDE.w - 10, BAR_Y + 1); g.strokePath();
  }

  private _buildCountdownPanel(): void {
    const s = this._scene;
    this._cdRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1);

    this._cdBgFlash = s.add.graphics().setDepth(DEPTH.PANEL + 1).setVisible(false);
    this._cdRoot.add(this._cdBgFlash);

    this._cdTitle = s.add.text(LEFT, BAR_Y + 6, '', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textPrimary_css, wordWrap: { width: BTN_X - LEFT - 4 }, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdTitle);

    this._cdHint = s.add.text(LEFT, BAR_Y + 24, '', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdHint);

    this._cdBarBg = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._cdBarBg.fillStyle(COLORS.bgDark, 0.55);
    this._cdBarBg.fillRoundedRect(LEFT, BAR_Y + 44, CD_W, 6, 2);
    this._cdBarBg.lineStyle(1, COLORS.walnutLight, 0.6);
    this._cdBarBg.strokeRoundedRect(LEFT, BAR_Y + 44, CD_W, 6, 2);
    this._cdRoot.add(this._cdBarBg);

    this._cdBarFill = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdBarFill);

    this._cdTimer = s.add.text(LEFT + CD_W + 8, BAR_Y + 34, '20с', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdTimer);

    const btnW = BTN_W;
    const btnH = 34;
    const btnX = BTN_X;
    const btnY = BAR_Y + 9;
    this._cdBtnGfx = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._redrawStartBtn(false, btnX, btnY, btnW, btnH);
    this._cdRoot.add(this._cdBtnGfx);

    this._cdBtnLbl = s.add.text(btnX + btnW / 2, btnY + btnH / 2, '▶ Начать сейчас', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.walnutDark_css, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
    this._cdRoot.add(this._cdBtnLbl);

    const zone = s.add.zone(btnX, btnY, btnW, btnH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 4);
    zone.on('pointerover', () => this._redrawStartBtn(true, btnX, btnY, btnW, btnH));
    zone.on('pointerout', () => this._redrawStartBtn(false, btnX, btnY, btnW, btnH));
    zone.on('pointerdown', () => this._wm.skipCountdown());
    this._cdRoot.add(zone);
  }

  private _redrawStartBtn(hover: boolean, x: number, y: number, w: number, h: number): void {
    this._cdBtnGfx.clear();
    this._cdBtnGfx.fillStyle(hover ? COLORS.amberBright : COLORS.amberWarm, 0.95);
    this._cdBtnGfx.fillRoundedRect(x, y, w, h, 6);
    this._cdBtnGfx.lineStyle(2, hover ? COLORS.amberGlow : COLORS.amberDeep, 0.95);
    this._cdBtnGfx.strokeRoundedRect(x, y, w, h, 6);
  }

  private _buildActivePanel(): void {
    const s = this._scene;
    this._waveRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1).setVisible(false);

    this._waveTitleTxt = s.add.text(LEFT, BAR_Y + 12, '', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textPrimary_css, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL + 2);
    this._waveRoot.add(this._waveTitleTxt);

    this._waveBarBg = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._waveBarBg.fillStyle(COLORS.bgDark, 0.6);
    this._waveBarBg.fillRoundedRect(LEFT, BAR_Y + 40, WAVE_W, 8, 2);
    this._waveBarBg.lineStyle(1, COLORS.walnutLight, 0.6);
    this._waveBarBg.strokeRoundedRect(LEFT, BAR_Y + 40, WAVE_W, 8, 2);
    this._waveRoot.add(this._waveBarBg);

    this._waveBarFill = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._waveRoot.add(this._waveBarFill);
  }

  private _wireCallbacks(): void {
    this._wm.onCountdownTick = (secs) => {
      this._cdTimer.setText(`${secs}с`);
      const pct = secs / this._countdownFull;
      this._cdBarFill.clear();
      this._cdBarFill.fillStyle(COLORS.amberWarm, 0.95);
      this._cdBarFill.fillRoundedRect(LEFT, BAR_Y + 44, CD_W * (1 - pct), 6, 2);
    };

    this._wm.onWaveStart = (wave) => this._showActiveWave(wave);

    // Presentation only: gold is paid by InterestSystem (single owner of the wave bonus).
    this._wm.onWaveComplete = () => {
      this._countdownFull = 20;
      this._showCountdown();
    };

    this._wm.onVictory = () => {
      this._waveRoot.setVisible(false);
      this._cdRoot.setVisible(false);
    };
  }

  private _showCountdown(): void {
    this._cdRoot.setVisible(true);
    this._waveRoot.setVisible(false);

    const next = this._wm.currentWaveData;
    if (!next) return;

    const isBoss = next.isBoss;
    const isFlying = next.enemyType === 'wyvern';
    const armorKey = this._enemyArmorKey(next);
    const armorCol = ARMOR_COLORS[armorKey] ?? COLORS.textMuted_css;

    const bossTag = isBoss && !next.preview.includes('БОСС') ? ' 💀 БОСС' : '';   // the preview of a boss wave says it already
    const flyTag = isFlying ? ' △ ВОЗДУХ' : '';
    this._cdTitle.setText(`Волна ${this._wm.waveNumber}: ${next.preview}${bossTag}${flyTag}`);
    this._cdTitle.setColor(isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);

    this._cdHint.setText(this._effectivenessHint(next));
    this._cdHint.setColor(armorCol);

    this._cdBtnLbl.setText('▶ Начать сейчас');   // no early-start bonus exists, so the label must not promise one

    if (isBoss) {
      this._cdBgFlash.clear().setVisible(true);
      this._cdBgFlash.fillStyle(COLORS.danger, 0.08);
      this._cdBgFlash.fillRect(SIDE.x + 6, BAR_Y, SIDE.w - 12, BAR_H - 6);
    } else {
      this._cdBgFlash.setVisible(false);
    }
  }

  private _showActiveWave(wave: WaveData): void {
    this._cdRoot.setVisible(false);
    this._waveRoot.setVisible(true);
    this._waveTitleTxt.setColor(wave.isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);
  }

  private _enemyArmorKey(wave: WaveData): string {
    const defs: Record<string, string> = {
      grunt: 'medium',
      runner: 'light',
      golem: 'heavy',
      wyvern: 'light',
      boss_goliath: 'fortified',
    };
    return defs[wave.enemyType] ?? 'unarmored';
  }

  private _effectivenessHint(wave: WaveData): string {
    const armorKey = this._enemyArmorKey(wave);
    const map: Record<string, string> = {
      unarmored: 'Эффективно: любой урон',
      light: 'Эффективно: колющий урон',
      medium: 'Эффективно: нормальный урон',
      heavy: 'Эффективно: магический урон',
      fortified: 'Эффективно: осадный урон',
      heroic: 'Эффективно: хаос-урон',
    };
    return map[armorKey] ?? '';
  }

  update(_delta: number): void {
    if (!this._waveRoot.visible) return;

    const active = this._wm.activeEnemies.length;
    const total = this._wm.currentWaveData?.count ?? 1;
    const pct = total > 0 ? Math.max(0, 1 - active / total) : 1;
    const isBoss = this._wm.currentWaveData?.isBoss ?? false;

    this._waveTitleTxt.setText(`Волна ${Math.min(this._wm.waveNumber, WAVES.length)} • Осталось: ${active}/${total}`);
    this._waveBarFill.clear();
    this._waveBarFill.fillStyle(isBoss ? COLORS.danger : COLORS.amberWarm, 0.95);
    this._waveBarFill.fillRoundedRect(LEFT, BAR_Y + 40, WAVE_W * pct, 8, 2);
  }
}
