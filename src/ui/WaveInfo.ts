import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { EconomyManager } from '../systems/EconomyManager';
import { WAVES, type WaveData } from '../data/waves';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, FONT_FAMILY, COLORS } from '../config';

const BAR_H = 52;
const BAR_Y = GAME_HEIGHT - BAR_H;
const FONT = FONT_FAMILY;
const EARLY_BONUS_MULT = 1.2;

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
  private readonly _economy: EconomyManager;

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

  constructor(scene: Phaser.Scene, wm: WaveManager, economy: EconomyManager) {
    this._scene = scene;
    this._wm = wm;
    this._economy = economy;

    this._buildBackground();
    this._buildCountdownPanel();
    this._buildActivePanel();
    this._wireCallbacks();
    this._showCountdown();
  }

  private _buildBackground(): void {
    const g = this._scene.add.graphics().setDepth(DEPTH.HUD - 1);
    g.fillStyle(COLORS.bgPanel, 1);
    g.fillRect(0, BAR_Y, GAME_WIDTH, BAR_H);
    g.fillStyle(COLORS.bgDark, 0.45);
    g.fillRect(0, BAR_Y, GAME_WIDTH, 6);
    g.lineStyle(2, COLORS.walnutLight, 0.7);
    g.beginPath(); g.moveTo(0, BAR_Y); g.lineTo(GAME_WIDTH, BAR_Y); g.strokePath();
    g.lineStyle(1, COLORS.amberDeep, 0.9);
    g.beginPath(); g.moveTo(0, BAR_Y + 1); g.lineTo(GAME_WIDTH, BAR_Y + 1); g.strokePath();
  }

  private _buildCountdownPanel(): void {
    const s = this._scene;
    this._cdRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1);

    this._cdBgFlash = s.add.graphics().setDepth(DEPTH.HUD - 1).setVisible(false);
    this._cdRoot.add(this._cdBgFlash);

    this._cdTitle = s.add.text(16, BAR_Y + 10, '', {
      fontFamily: FONT, fontSize: '14px', color: COLORS.textPrimary_css, wordWrap: { width: 560 }, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdTitle);

    this._cdHint = s.add.text(16, BAR_Y + 30, '', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdHint);

    this._cdBarBg = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._cdBarBg.fillStyle(COLORS.bgDark, 0.55);
    this._cdBarBg.fillRoundedRect(16, BAR_Y + 44, 450, 6, 2);
    this._cdBarBg.lineStyle(1, COLORS.walnutLight, 0.6);
    this._cdBarBg.strokeRoundedRect(16, BAR_Y + 44, 450, 6, 2);
    this._cdRoot.add(this._cdBarBg);

    this._cdBarFill = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdBarFill);

    this._cdTimer = s.add.text(474, BAR_Y + 36, '20с', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdTimer);

    const btnW = 210;
    const btnH = 34;
    const btnX = GAME_WIDTH - btnW - 16;
    const btnY = BAR_Y + 8;
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

    this._waveTitleTxt = s.add.text(16, BAR_Y + 14, '', {
      fontFamily: FONT, fontSize: '14px', color: COLORS.textPrimary_css, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL + 2);
    this._waveRoot.add(this._waveTitleTxt);

    this._waveBarBg = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._waveBarBg.fillStyle(COLORS.bgDark, 0.6);
    this._waveBarBg.fillRoundedRect(16, BAR_Y + 40, 620, 8, 2);
    this._waveBarBg.lineStyle(1, COLORS.walnutLight, 0.6);
    this._waveBarBg.strokeRoundedRect(16, BAR_Y + 40, 620, 8, 2);
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
      this._cdBarFill.fillRoundedRect(16, BAR_Y + 44, 450 * (1 - pct), 6, 2);
    };

    this._wm.onWaveStart = (wave) => this._showActiveWave(wave);

    this._wm.onWaveComplete = (_wave, bonusGold) => {
      this._economy.addGold(bonusGold);
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

    const bossTag = isBoss ? ' 💀 БОСС' : '';
    const flyTag = isFlying ? ' △ ВОЗДУХ' : '';
    this._cdTitle.setText(`Волна ${this._wm.waveNumber}: ${next.preview}${bossTag}${flyTag}`);
    this._cdTitle.setColor(isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);

    this._cdHint.setText(this._effectivenessHint(next));
    this._cdHint.setColor(armorCol);

    const bonus = Math.round(next.bonusGold * EARLY_BONUS_MULT);
    this._cdBtnLbl.setText(`▶ Начать сейчас  +${bonus}◆`);

    if (isBoss) {
      this._cdBgFlash.clear().setVisible(true);
      this._cdBgFlash.fillStyle(COLORS.danger, 0.08);
      this._cdBgFlash.fillRect(0, BAR_Y, GAME_WIDTH, BAR_H);
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
    this._waveBarFill.fillRoundedRect(16, BAR_Y + 40, 620 * pct, 8, 2);
  }
}
