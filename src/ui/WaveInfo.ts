// WaveInfo.ts — Stage 10 Phase 5: Premium bottom action bar.
//
// Bottom 52px bar spans full width.
// LEFT: countdown/wave progress, next-wave preview with armor badge.
// RIGHT: "Start now" button with early bonus indicator.
// ACTIVE: enemy kill progress bar + wave stats.

import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { EconomyManager } from '../systems/EconomyManager';
import { WAVES, type WaveData } from '../data/waves';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, FONT_FAMILY, COLORS } from '../config';

const BAR_H = 52;
const BAR_Y = GAME_HEIGHT - BAR_H;
const FONT  = FONT_FAMILY;

const ARMOR_COLORS: Record<string, string> = {
  unarmored: COLORS.textMuted_css,
  light:     COLORS.seaLight_css,
  medium:    COLORS.textSecondary_css,
  heavy:     COLORS.walnutLight_css,
  fortified: COLORS.textGold_css,
  heroic:    COLORS.textDanger_css,
};
const ARMOR_LABELS: Record<string, string> = {
  unarmored: 'без брони', light: 'лёгкая', medium: 'средняя',
  heavy: 'тяжёлая', fortified: 'укреплённая', heroic: 'героическая',
};
const EFFECTIVE_VS: Record<string, string> = {
  unarmored: 'любой', light: 'колющий', medium: 'нормальный',
  heavy: 'магический', fortified: 'осадный', heroic: 'хаос',
};

export class WaveInfo {
  private readonly _scene:   Phaser.Scene;
  private readonly _wm:      WaveManager;
  private readonly _economy: EconomyManager;

  private _cdRoot!:       Phaser.GameObjects.Container;
  private _cdTitle!:      Phaser.GameObjects.Text;
  private _cdSubtitle!:   Phaser.GameObjects.Text;
  private _cdBarFill!:    Phaser.GameObjects.Graphics;
  private _cdTimer!:      Phaser.GameObjects.Text;
  private _cdBossFlash!:  Phaser.GameObjects.Graphics;
  private _cdBtnGfx!:     Phaser.GameObjects.Graphics;
  private _cdBtnLbl!:     Phaser.GameObjects.Text;

  private _waveRoot!:     Phaser.GameObjects.Container;
  private _waveTitle!:    Phaser.GameObjects.Text;
  private _waveBarFill!:  Phaser.GameObjects.Graphics;
  private _waveKillTxt!:  Phaser.GameObjects.Text;

  private _cdFull = 20;
  private _cdSecs = 20;

  constructor(scene: Phaser.Scene, wm: WaveManager, economy: EconomyManager) {
    this._scene   = scene;
    this._wm      = wm;
    this._economy = economy;
    this._buildBg();
    this._buildCountdownPanel();
    this._buildActivePanel();
    this._wireCallbacks();
    this._showCountdown();
  }

  // ── Background bar ─────────────────────────────────────────────────────────
  private _buildBg(): void {
    const g = this._scene.add.graphics().setDepth(DEPTH.HUD - 2);
    // Multi-layer glass bar
    g.fillStyle(0x0E0B08, 0.95);
    g.fillRect(0, BAR_Y, GAME_WIDTH, BAR_H);
    // Top sheen
    g.fillStyle(0x1E1812, 0.55);
    g.fillRect(0, BAR_Y, GAME_WIDTH, 7);
    // Top amber accent line
    g.lineStyle(2, COLORS.amberWarm, 0.88);
    g.beginPath(); g.moveTo(0, BAR_Y); g.lineTo(GAME_WIDTH, BAR_Y); g.strokePath();
    g.lineStyle(1, COLORS.amberGlow, 0.22);
    g.beginPath(); g.moveTo(0, BAR_Y + 2); g.lineTo(GAME_WIDTH, BAR_Y + 2); g.strokePath();
  }

  // ── Countdown panel ─────────────────────────────────────────────────────────
  private _buildCountdownPanel(): void {
    const s    = this._scene;
    this._cdRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1);

    // Boss alert flash
    this._cdBossFlash = s.add.graphics().setDepth(DEPTH.HUD - 1).setVisible(false);
    this._cdRoot.add(this._cdBossFlash);

    // Wave title — large
    this._cdTitle = s.add.text(16, BAR_Y + 10, '', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
      color: COLORS.textPrimary_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdTitle);

    // Subtitle — armor hint
    this._cdSubtitle = s.add.text(16, BAR_Y + 31, '', {
      fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted_css, letterSpacing: 1,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdSubtitle);

    // Countdown bar track
    const barBg = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    barBg.fillStyle(0x1A1510, 0.70); barBg.fillRoundedRect(16, BAR_Y + 44, 480, 5, 2);
    barBg.lineStyle(1, COLORS.walnutLight, 0.22); barBg.strokeRoundedRect(16, BAR_Y + 44, 480, 5, 2);
    this._cdRoot.add(barBg);

    this._cdBarFill = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdBarFill);

    // Timer text
    this._cdTimer = s.add.text(504, BAR_Y + 38, '20с', {
      fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._cdRoot.add(this._cdTimer);

    // "Start now" button
    const btnW = 200, btnH = 36;
    const btnX = GAME_WIDTH - btnW - 14;
    const btnY = BAR_Y + (BAR_H - btnH) / 2;
    this._cdBtnGfx = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._drawBtn(false, btnX, btnY, btnW, btnH);
    this._cdRoot.add(this._cdBtnGfx);

    this._cdBtnLbl = s.add.text(btnX + btnW / 2, btnY + btnH / 2, '▶  Начать сейчас', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.walnutDark_css,
    }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
    this._cdRoot.add(this._cdBtnLbl);

    const zone = s.add.zone(btnX, btnY, btnW, btnH)
      .setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 4);
    zone.on('pointerover', () => this._drawBtn(true,  btnX, btnY, btnW, btnH));
    zone.on('pointerout',  () => this._drawBtn(false, btnX, btnY, btnW, btnH));
    zone.on('pointerdown', () => this._wm.skipCountdown());
    this._cdRoot.add(zone);
  }

  private _drawBtn(hover: boolean, x: number, y: number, w: number, h: number): void {
    const g = this._cdBtnGfx; g.clear();
    if (hover) {
      g.fillStyle(COLORS.amberBright, 1.0); g.fillRoundedRect(x, y, w, h, 8);
      g.fillStyle(0xFFFFFF, 0.12); g.fillRoundedRect(x + 2, y + 2, w - 4, h / 2 - 2, 6);
      g.lineStyle(2, COLORS.amberGlow, 1.0); g.strokeRoundedRect(x, y, w, h, 8);
    } else {
      g.fillStyle(COLORS.amberWarm, 0.95); g.fillRoundedRect(x, y, w, h, 8);
      g.fillStyle(0xFFFFFF, 0.07); g.fillRoundedRect(x + 2, y + 2, w - 4, h / 2 - 2, 6);
      g.lineStyle(1.5, COLORS.amberDeep, 0.80); g.strokeRoundedRect(x, y, w, h, 8);
    }
  }

  // ── Active wave panel ───────────────────────────────────────────────────────
  private _buildActivePanel(): void {
    const s = this._scene;
    this._waveRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1).setVisible(false);

    this._waveTitle = s.add.text(16, BAR_Y + 10, '', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: COLORS.textPrimary_css,
    }).setDepth(DEPTH.PANEL + 2);
    this._waveRoot.add(this._waveTitle);

    this._waveKillTxt = s.add.text(16, BAR_Y + 32, '', {
      fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted_css, letterSpacing: 1,
    }).setDepth(DEPTH.PANEL + 2);
    this._waveRoot.add(this._waveKillTxt);

    // Kill progress bar
    const barTrack = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    barTrack.fillStyle(0x1A1510, 0.70); barTrack.fillRoundedRect(16, BAR_Y + 44, 680, 5, 2);
    barTrack.lineStyle(1, COLORS.walnutLight, 0.22); barTrack.strokeRoundedRect(16, BAR_Y + 44, 680, 5, 2);
    this._waveRoot.add(barTrack);

    this._waveBarFill = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._waveRoot.add(this._waveBarFill);
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────
  private _wireCallbacks(): void {
    this._wm.onCountdownTick = (secs) => {
      this._cdSecs = secs;
      this._cdTimer.setText(`${secs}с`);
      const pct = secs / this._cdFull;
      this._cdBarFill.clear();
      // Colour shifts from amber → danger as time ticks down
      const col = pct > 0.4 ? COLORS.amberWarm : pct > 0.15 ? COLORS.amberBright : COLORS.danger;
      this._cdBarFill.fillStyle(col, 0.90);
      this._cdBarFill.fillRoundedRect(16, BAR_Y + 44, 480 * (1 - pct), 5, 2);
      // Leading glow dot
      const fw = 480 * (1 - pct);
      if (fw > 6) {
        this._cdBarFill.fillStyle(0xFFFFFF, 0.6);
        this._cdBarFill.fillCircle(16 + fw, BAR_Y + 46.5, 2.5);
      }
    };

    this._wm.onWaveStart = (wave) => {
      this._showActiveWave(wave);
    };

    // NOTE: bonusGold is now handled by InterestSystem — do NOT re-add here
    this._wm.onWaveComplete = (_wave, _bonus) => {
      this._cdFull = 20;
      this._showCountdown();
    };

    this._wm.onVictory = () => {
      this._cdRoot.setVisible(false);
      this._waveRoot.setVisible(false);
    };
  }

  private _showCountdown(): void {
    this._cdRoot.setVisible(true);
    this._waveRoot.setVisible(false);
    const next = this._wm.currentWaveData;
    if (!next) return;

    const isBoss   = next.isBoss ?? false;
    const armorKey = this._armorKey(next.enemyType);
    const armorCol = ARMOR_COLORS[armorKey] ?? COLORS.textMuted_css;
    const effectiveDmg = EFFECTIVE_VS[armorKey] ?? '—';

    const modTag = next.modifier === 'fast'    ? '  ⚡ быстрые'
                 : next.modifier === 'healing' ? '  💚 регенерация'
                 : '';
    const bossTag = isBoss ? '  💀 БОСС' : '';
    this._cdTitle.setText(`Волна ${this._wm.waveNumber} · ${next.preview}${bossTag}${modTag}`);
    this._cdTitle.setColor(isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);

    const armorLabel = ARMOR_LABELS[armorKey] ?? armorKey;
    this._cdSubtitle.setText(`Броня: ${armorLabel}  ·  Эффективен: ${effectiveDmg} урон  ·  Мобов: ${next.count}`);
    this._cdSubtitle.setColor(armorCol);

    // Bonus display (now just the wave base bonus; interest shown as floating text)
    this._cdBtnLbl.setText(`▶  Начать сейчас  +${next.bonusGold}◆`);

    // Boss alert overlay
    if (isBoss) {
      this._cdBossFlash.clear().setVisible(true);
      this._cdBossFlash.fillStyle(COLORS.danger, 0.10);
      this._cdBossFlash.fillRect(0, BAR_Y, GAME_WIDTH, BAR_H);
    } else {
      this._cdBossFlash.setVisible(false);
    }
  }

  private _showActiveWave(wave: WaveData): void {
    this._cdRoot.setVisible(false);
    this._waveRoot.setVisible(true);
    this._waveTitle.setColor(wave.isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  update(_delta: number): void {
    if (!this._waveRoot.visible) return;
    const active   = this._wm.activeEnemies.length;
    const total    = this._wm.currentWaveData?.count ?? 1;
    const killed   = Math.max(0, total - active);
    const pct      = total > 0 ? killed / total : 1;
    const isBoss   = this._wm.currentWaveData?.isBoss ?? false;

    this._waveTitle.setText(
      `Волна ${Math.min(this._wm.waveNumber, WAVES.length)} / ${WAVES.length}  ·  ${this._wm.currentWaveData?.preview ?? ''}`
    );
    this._waveKillTxt.setText(`Уничтожено: ${killed} / ${total}`);

    // Segmented progress bar — colour by kill fraction
    const col = isBoss ? COLORS.danger : pct > 0.66 ? COLORS.success : pct > 0.33 ? COLORS.amberWarm : COLORS.textSecondary;
    this._waveBarFill.clear();
    this._waveBarFill.fillStyle(col, 0.88);
    this._waveBarFill.fillRoundedRect(16, BAR_Y + 44, 680 * pct, 5, 2);
    if (pct > 0.02) {
      this._waveBarFill.fillStyle(0xFFFFFF, 0.40);
      this._waveBarFill.fillCircle(16 + 680 * pct, BAR_Y + 46.5, 2.5);
    }
  }

  private _armorKey(enemyId: string): string {
    const m: Record<string, string> = {
      grunt: 'medium', runner: 'light', golem: 'heavy',
      wyvern: 'light', boss_goliath: 'fortified',
      phantom: 'unarmored', nether_drake: 'heroic', mountain_giant: 'fortified',
    };
    return m[enemyId] ?? 'unarmored';
  }
}
