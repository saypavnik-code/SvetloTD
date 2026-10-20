import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_MAIN } from '../config';
import { AudioManager } from '../systems/AudioManager';
import { DIFFICULTY_IDS, DIFFICULTY_PRESETS, GameConfig, bestResultKey, parseDifficulty, type DifficultyId } from '../config/difficulty';

interface Dust {
  x: number; y: number;
  size: number; speed: number; alpha: number;
}

export class MenuScene extends Phaser.Scene {
  private _dust: Dust[] = [];
  private _dustGfx!: Phaser.GameObjects.Graphics;
  private _glowT = 0;

  private _logoText!: Phaser.GameObjects.Text;
  private _playBtn!: Phaser.GameObjects.Text;
  private _bestTxt!: Phaser.GameObjects.Text;
  private _blurbTxt!: Phaser.GameObjects.Text;
  private _difficultyGfx: Phaser.GameObjects.Graphics[] = [];
  private _difficultyLbl: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this._dust = [];
    this._glowT = 0;
    this.cameras.main.setBackgroundColor(COLORS.bgDark);

    this._buildBackdrop();
    this._buildDust();
    this._buildDecorFrame();
    this._buildLogo();
    this._buildSubtitle();      // creates the best-result line the difficulty row refreshes
    this._buildDifficulty();
    this._buildPlayButton();
    this._buildVersionTag();

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    this._drawDust();

    this._glowT += delta * 0.001;
    this._logoText.setAlpha(0.86 + Math.sin(this._glowT * 2.2) * 0.14);
    this._playBtn.setAlpha(0.82 + Math.sin(this._glowT * 3.2) * 0.18);
  }

  private _buildBackdrop(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bgPrimary, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    g.fillStyle(COLORS.walnutDark, 0.48);
    g.fillRect(0, GAME_HEIGHT * 0.55, GAME_WIDTH, GAME_HEIGHT * 0.45);

    g.lineStyle(2, COLORS.amberDeep, 0.14);
    for (let i = 0; i < 5; i++) {
      const y = 70 + i * 120;
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(GAME_WIDTH - 40, y + Phaser.Math.Between(-8, 8));
      g.strokePath();
    }
  }

  private _buildDust(): void {
    this._dustGfx = this.add.graphics();
    for (let i = 0; i < 90; i++) {
      this._dust.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 1.6 + 0.3,
        speed: Math.random() * 0.28 + 0.05,
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

  private _buildDecorFrame(): void {
    const g = this.add.graphics();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const lx = cx - 380;
    const rx = cx + 380;
    const ty = cy - 122;
    const by = cy + 140;

    g.fillStyle(COLORS.bgPanel, 0.58);
    g.fillRoundedRect(lx, ty, rx - lx, by - ty, 8);

    g.lineStyle(4, COLORS.walnutLight, 0.7);
    g.strokeRoundedRect(lx, ty, rx - lx, by - ty, 8);
    g.lineStyle(2, COLORS.amberDeep, 0.8);
    g.strokeRoundedRect(lx + 6, ty + 6, rx - lx - 12, by - ty - 12, 6);

    g.lineStyle(2, COLORS.amberDeep, 0.3);
    g.beginPath(); g.moveTo(lx + 20, cy + 4); g.lineTo(rx - 20, cy + 4); g.strokePath();

    g.fillStyle(COLORS.amberWarm, 0.9);
    g.fillTriangle(cx - 8, ty + 14, cx + 8, ty + 14, cx, ty + 28);
  }

  private _buildLogo(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 84, 'BALTIC COAST TOWER DEFENSE', {
      fontFamily: FONT_MAIN,
      fontSize: '11px',
      color: COLORS.textMuted_css,
      letterSpacing: 4,
    }).setOrigin(0.5);

    this._logoText = this.add.text(cx, cy - 28, 'СВЕТЛОГОРСК', {
      fontFamily: FONT_MAIN,
      fontSize: '56px',
      fontStyle: 'bold',
      color: COLORS.amberWarm_css,
      stroke: COLORS.walnutDark_css,
      strokeThickness: 6,
      shadow: {
        offsetX: 0,
        offsetY: 2,
        color: COLORS.amberDeep_css,
        blur: 16,
        fill: true,
      },
    }).setOrigin(0.5);

    this.add.text(cx, cy + 48, '— Янтарный рубеж Светлогорска —', {
      fontFamily: FONT_MAIN,
      fontSize: '11px',
      color: COLORS.textSecondary_css,
      letterSpacing: 1,
    }).setOrigin(0.5);
  }

  /** The difficulty row (v0.21.0): lives and wave order as in the original. `?difficulty=` and the last choice are remembered. */
  private _buildDifficulty(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const bw = 150, bh = 28, gap = 10, y = cy + 90;
    const x0 = cx - (DIFFICULTY_IDS.length * bw + (DIFFICULTY_IDS.length - 1) * gap) / 2;

    this.add.text(cx, cy + 74, 'СЛОЖНОСТЬ', {
      fontFamily: FONT_MAIN, fontSize: '10px', color: COLORS.textMuted_css, letterSpacing: 4,
    }).setOrigin(0.5);
    this._blurbTxt = this.add.text(cx, cy + 128, '', {
      fontFamily: FONT_MAIN, fontSize: '11px', color: COLORS.textSecondary_css,
    }).setOrigin(0.5);

    let stored: string | null = null;
    try { stored = localStorage.getItem('difficulty'); } catch { /* storage unavailable */ }
    const start = parseDifficulty(window.location.search) ?? parseDifficulty(`?difficulty=${stored ?? ''}`) ?? GameConfig.difficulty.id;
    GameConfig.setDifficulty(start);

    DIFFICULTY_IDS.forEach((id, index) => {
      const x = x0 + index * (bw + gap);
      const gfx = this.add.graphics();
      const label = this.add.text(x + bw / 2, y + bh / 2, `${DIFFICULTY_PRESETS[id].label} · ${DIFFICULTY_PRESETS[id].startingLives}❤`, {
        fontFamily: FONT_MAIN, fontSize: '12px', fontStyle: 'bold', color: COLORS.textPrimary_css,
      }).setOrigin(0.5);
      this._difficultyGfx.push(gfx); this._difficultyLbl.push(label);
      const zone = this.add.zone(x, y, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._chooseDifficulty(id));
      gfx.setPosition(x, y);
    });
    this._refreshDifficulty();
  }

  private _chooseDifficulty(id: DifficultyId): void {
    GameConfig.setDifficulty(id);
    try { localStorage.setItem('difficulty', id); } catch { /* storage unavailable */ }
    this._refreshDifficulty();
  }

  private _refreshDifficulty(): void {
    const current = GameConfig.difficulty.id;
    DIFFICULTY_IDS.forEach((id, index) => {
      const selected = id === current;
      const gfx = this._difficultyGfx[index];
      gfx.clear();
      gfx.fillStyle(selected ? COLORS.amberDeep : COLORS.bgPanelHover, selected ? 0.55 : 0.6);
      gfx.fillRoundedRect(0, 0, 150, 28, 6);
      gfx.lineStyle(selected ? 3 : 2, selected ? COLORS.amberBright : COLORS.walnutLight, 0.9);
      gfx.strokeRoundedRect(0, 0, 150, 28, 6);
      this._difficultyLbl[index].setColor(selected ? COLORS.amberGlow_css : COLORS.textPrimary_css);
    });
    this._blurbTxt.setText(GameConfig.difficulty.blurb);
    this._refreshBest();
  }

  /** The best result of the chosen difficulty only. */
  private _refreshBest(): void {
    let line = '';
    try {
      const stored = localStorage.getItem(bestResultKey(GameConfig.difficulty.id));
      if (stored) {
        const best = JSON.parse(stored) as { isVictory: boolean; wavesCompleted: number; livesRemaining: number; enemiesKilled: number };
        line = best.isVictory
          ? `✦ Победа! Волна ${best.wavesCompleted} • ❤ ${best.livesRemaining} • ☠ ${best.enemiesKilled}`
          : `Лучший рубеж: Волна ${best.wavesCompleted} • ❤ ${best.livesRemaining} • ☠ ${best.enemiesKilled}`;
        this._bestTxt.setColor(best.isVictory ? COLORS.amberWarm_css : COLORS.textSecondary_css);
      }
    } catch { /* storage unavailable */ }
    this._bestTxt.setText(line);
  }

  private _buildPlayButton(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const pw = 250;
    const ph = 54;
    const py = cy + 146;

    const panel = this.add.graphics();
    panel.setPosition(cx - pw / 2, py);

    const draw = (hover: boolean) => {
      panel.clear();
      panel.fillStyle(hover ? COLORS.amberDeep : COLORS.bgPanelHover, hover ? 0.38 : 0.8);
      panel.fillRoundedRect(0, 0, pw, ph, 8);
      panel.lineStyle(3, hover ? COLORS.amberBright : COLORS.walnutLight, 0.9);
      panel.strokeRoundedRect(0, 0, pw, ph, 8);
      panel.lineStyle(1, hover ? COLORS.amberGlow : COLORS.amberDeep, 0.7);
      panel.strokeRoundedRect(4, 4, pw - 8, ph - 8, 6);
    };
    draw(false);

    this._playBtn = this.add.text(cx, py + ph / 2, '▶  НАЧАТЬ ОБОРОНУ', {
      fontFamily: FONT_MAIN,
      fontSize: '17px',
      fontStyle: 'bold',
      color: COLORS.textGold_css,
    }).setOrigin(0.5);

    const zone = this.add.zone(cx, py + ph / 2, pw, ph).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      draw(true);
      this._playBtn.setColor(COLORS.amberGlow_css);
    });
    zone.on('pointerout', () => {
      draw(false);
      this._playBtn.setColor(COLORS.textGold_css);
    });
    zone.on('pointerdown', () => {
      AudioManager.init();
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
    });
  }

  private _buildSubtitle(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 230, 'Постройте линию башен. Удержите берег от штурма.', {
      fontFamily: FONT_MAIN,
      fontSize: '10px',
      color: COLORS.textMuted_css,
    }).setOrigin(0.5);

    this._bestTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 248, '', {
      fontFamily: FONT_MAIN, fontSize: '10px', color: COLORS.textSecondary_css,
    }).setOrigin(0.5);
    this._refreshBest();
  }

  private _buildVersionTag(): void {
    this.add.text(GAME_WIDTH - 14, GAME_HEIGHT - 10, 'v0.1.0', {
      fontFamily: FONT_MAIN,
      fontSize: '8px',
      color: COLORS.walnutLight_css,
    }).setOrigin(1, 1);
  }
}
