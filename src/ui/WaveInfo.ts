// WaveInfo.ts — Stage 8. Full-width bottom wave bar (52px). Amber palette.

import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { EconomyManager } from '../systems/EconomyManager';
import { WAVES, type WaveData } from '../data/waves';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, FONT_FAMILY, COLORS } from '../config';

const BAR_H   = 52;
const BAR_Y   = GAME_HEIGHT - BAR_H;
const FONT    = FONT_FAMILY;
const EARLY_BONUS_MULT = 1.2;

const ARMOR_COLORS: Record<string, string> = {
  unarmored: COLORS.textMuted_css,
  light:     COLORS.seaMuted_css,
  medium:    COLORS.walnut_css,
  heavy:     COLORS.walnutDark_css,
  fortified: COLORS.amberDeep_css,
  heroic:    COLORS.danger_css,
};

export class WaveInfo {
  private readonly _scene:   Phaser.Scene;
  private readonly _wm:      WaveManager;
  private readonly _economy: EconomyManager;

  // Countdown state
  private _cdRoot!:      Phaser.GameObjects.Container;
  private _cdTitle!:     Phaser.GameObjects.Text;
  private _cdTimer!:     Phaser.GameObjects.Text;
  private _cdBarBg!:     Phaser.GameObjects.Graphics;
  private _cdBarFill!:   Phaser.GameObjects.Graphics;
  private _cdBtnGfx!:    Phaser.GameObjects.Graphics;
  private _cdBtnLbl!:    Phaser.GameObjects.Text;
  private _cdHint!:      Phaser.GameObjects.Text;
  private _cdBgFlash!:   Phaser.GameObjects.Graphics;

  // Active wave state
  private _waveRoot!:    Phaser.GameObjects.Container;
  private _waveTitleTxt!:Phaser.GameObjects.Text;
  private _waveBarBg!:   Phaser.GameObjects.Graphics;
  private _waveBarFill!: Phaser.GameObjects.Graphics;

  private _countdownFull = 20;
  private _pulseT = 0;

  constructor(scene: Phaser.Scene, wm: WaveManager, economy: EconomyManager) {
    this._scene   = scene;
    this._wm      = wm;
    this._economy = economy;

    this._buildBackground();
    this._buildCountdownPanel();
    this._buildActivePanel();
    this._wireCallbacks();
    this._showCountdown();
  }

  private _buildBackground(): void {
    const g = this._scene.add.graphics().setDepth(DEPTH.HUD - 1);
    g.fillStyle(COLORS.bgPanel, 1); g.fillRect(0, BAR_Y, GAME_WIDTH, BAR_H);
    g.lineStyle(1, COLORS.amberDeep, 0.15); g.beginPath(); g.moveTo(0, BAR_Y); g.lineTo(GAME_WIDTH, BAR_Y); g.strokePath();
  }

  private _buildCountdownPanel(): void {
    const s = this._scene;
    this._cdRoot = s.add.container(0,0).setDepth(DEPTH.PANEL+1);

    this._cdBgFlash = s.add.graphics().setDepth(DEPTH.HUD-1).setVisible(false);
    this._cdRoot.add(this._cdBgFlash);

    // Wave preview text (left side)
    this._cdTitle = s.add.text(16, BAR_Y+16, '', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textPrimary_css, wordWrap: { width: 480 },
    }).setDepth(DEPTH.PANEL+2);
    this._cdRoot.add(this._cdTitle);

    this._cdHint = s.add.text(16, BAR_Y+32, '', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL+2);
    this._cdRoot.add(this._cdHint);

    // Progress bar
    this._cdBarBg = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._cdBarBg.fillStyle(COLORS.walnutLight, 0.15); this._cdBarBg.fillRect(16, BAR_Y+44, 420, 6);
    this._cdRoot.add(this._cdBarBg);
    this._cdBarFill = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._cdRoot.add(this._cdBarFill);

    // Timer text
    this._cdTimer = s.add.text(444, BAR_Y+38, '20с', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL+2);
    this._cdRoot.add(this._cdTimer);

    // Start button
    const btnW=180, btnH=34, btnX=GAME_WIDTH-btnW-16, btnY=BAR_Y+8;
    this._cdBtnGfx = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._cdBtnGfx.fillStyle(COLORS.amberWarm, 1); this._cdBtnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    this._cdRoot.add(this._cdBtnGfx);

    this._cdBtnLbl = s.add.text(btnX+btnW/2, btnY+btnH/2, '▶ Начать сейчас', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.walnutDark_css, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTH.PANEL+3);
    this._cdRoot.add(this._cdBtnLbl);

    const zone = s.add.zone(btnX, btnY, btnW, btnH).setOrigin(0).setInteractive({useHandCursor:true}).setDepth(DEPTH.PANEL+4);
    zone.on('pointerover', () => { this._cdBtnGfx.clear(); this._cdBtnGfx.fillStyle(COLORS.amberBright,1); this._cdBtnGfx.fillRoundedRect(btnX,btnY,btnW,btnH,6); });
    zone.on('pointerout',  () => { this._cdBtnGfx.clear(); this._cdBtnGfx.fillStyle(COLORS.amberWarm,1);   this._cdBtnGfx.fillRoundedRect(btnX,btnY,btnW,btnH,6); });
    zone.on('pointerdown', () => {
      this._scene.tweens.add({ targets: zone, scaleX:{from:0.96,to:1}, scaleY:{from:0.96,to:1}, duration:120 });
      this._wm.skipCountdown();
    });
    this._cdRoot.add(zone);
  }

  private _buildActivePanel(): void {
    const s = this._scene;
    this._waveRoot = s.add.container(0,0).setDepth(DEPTH.PANEL+1).setVisible(false);

    this._waveTitleTxt = s.add.text(16, BAR_Y+18, '', {
      fontFamily: FONT, fontSize: '14px', color: COLORS.textPrimary_css, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL+2);
    this._waveRoot.add(this._waveTitleTxt);

    this._waveBarBg = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._waveBarBg.fillStyle(COLORS.walnutLight, 0.15); this._waveBarBg.fillRect(16, BAR_Y+40, 600, 6);
    this._waveRoot.add(this._waveBarBg);

    this._waveBarFill = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._waveRoot.add(this._waveBarFill);
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────
  private _wireCallbacks(): void {
    this._wm.onCountdownTick = (secs) => {
      this._cdTimer.setText(`${secs}с`);
      const pct = secs / this._countdownFull;
      this._cdBarFill.clear();
      this._cdBarFill.fillStyle(COLORS.amberWarm, 1);
      this._cdBarFill.fillRect(16, BAR_Y+44, 420 * (1-pct), 6);
    };

    this._wm.onWaveStart = (wave) => {
      this._showActiveWave(wave);
    };

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

  // ── State transitions ──────────────────────────────────────────────────────
  private _showCountdown(): void {
    this._cdRoot.setVisible(true);
    this._waveRoot.setVisible(false);
    const next = this._wm.currentWaveData;
    if (!next) return;

    const isBoss    = next.isBoss;
    const isFlying  = next.enemyType === 'wyvern';
    const armorKey  = this._enemyArmorKey(next);
    const armorCol  = ARMOR_COLORS[armorKey] ?? COLORS.textMuted_css;
    const bossTag   = isBoss  ? ' 💀 БОСС'  : '';
    const flyTag    = isFlying ? ' △ ВОЗДУХ' : '';

    let title = `Волна ${this._wm.waveNumber}: ${next.preview}${bossTag}${flyTag}`;
    if (isBoss) title = title; // keep
    this._cdTitle.setText(title);
    this._cdTitle.setColor(isBoss ? COLORS.danger_css : COLORS.textPrimary_css);

    // Hint
    const hint = this._effectivenessHint(next);
    this._cdHint.setText(hint);
    this._cdHint.setColor(armorCol);

    // Early bonus label
    const bonus = Math.round(next.bonusGold * EARLY_BONUS_MULT);
    this._cdBtnLbl.setText(`▶ Начать сейчас  +${bonus}◆`);

    // Boss flash bg
    if (isBoss) {
      this._cdBgFlash.clear().setVisible(true);
      this._cdBgFlash.fillStyle(COLORS.danger, 0.06); this._cdBgFlash.fillRect(0, BAR_Y, GAME_WIDTH, BAR_H);
    } else {
      this._cdBgFlash.setVisible(false);
    }
  }

  private _showActiveWave(wave: WaveData): void {
    this._cdRoot.setVisible(false);
    this._waveRoot.setVisible(true);
    const isBoss = wave.isBoss;
    this._waveTitleTxt.setColor(isBoss ? COLORS.danger_css : COLORS.textPrimary_css);
    this._waveTitleTxt.setFontStyle(isBoss ? 'bold' : 'normal');
  }

  private _enemyArmorKey(wave: WaveData): string {
    const id = wave.enemyType;
    const defs: Record<string, string> = {
      grunt:'medium', runner:'light', golem:'heavy', wyvern:'light', boss_goliath:'fortified',
    };
    return defs[id] ?? 'unarmored';
  }

  private _effectivenessHint(wave: WaveData): string {
    const armorKey = this._enemyArmorKey(wave);
    const map: Record<string,string> = {
      unarmored: 'Эффективно: любой урон', light:     'Эффективно: колющий урон',
      medium:    'Эффективно: нормальный урон', heavy: 'Эффективно: магический урон',
      fortified: 'Эффективно: осадный урон', heroic:   'Эффективно: хаос-урон',
    };
    return map[armorKey] ?? '';
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  update(_delta: number): void {
    if (this._waveRoot.visible) {
      const active = this._wm.activeEnemies.length;
      const total  = this._wm.currentWaveData?.count ?? 1;
      const pct    = total > 0 ? Math.max(0, 1 - active/total) : 1;
      const isBoss = this._wm.currentWaveData?.isBoss ?? false;
      this._waveTitleTxt.setText(`Волна ${Math.min(this._wm.waveNumber, WAVES.length)} • Осталось: ${active}/${total}`);
      this._waveBarFill.clear();
      this._waveBarFill.fillStyle(isBoss ? COLORS.danger : COLORS.amberWarm, 1);
      this._waveBarFill.fillRect(16, BAR_Y+40, 600*pct, 6);
    }
  }
}
