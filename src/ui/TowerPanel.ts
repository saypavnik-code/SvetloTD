// TowerPanel.ts — Stage 8. Premium minimal build panel with tooltip.
// All Text created once in constructor; panel rows are permanent—state toggled via alpha/color.

import Phaser from 'phaser';
import { TOWER_DEFS, BUILDABLE_TOWER_IDS, type TowerId } from '../data/towers';
import { Tower, TargetPriority } from '../entities/Tower';
import { BuildSystem } from '../systems/BuildSystem';
import { EconomyManager } from '../systems/EconomyManager';
import {
  GAME_WIDTH, GAME_HEIGHT, GRID_COLS, TILE_SIZE,
  COLORS, DEPTH, FONT_FAMILY,
} from '../config';

const PX   = GRID_COLS * TILE_SIZE;          // 720
const PW   = GAME_WIDTH - PX;               // 560
const CX   = PX + PW / 2;
const PAD  = 16;
const ROW_H = 50;
const FONT = FONT_FAMILY;
const TOP_H = 44; // HUD bar height

const PRIORITY_ORDER = [
  TargetPriority.FIRST, TargetPriority.NEAREST, TargetPriority.STRONGEST,
  TargetPriority.WEAKEST, TargetPriority.LAST,
];
const PRIORITY_LABELS: Record<TargetPriority, string> = {
  [TargetPriority.FIRST]:     'Первый',
  [TargetPriority.LAST]:      'Последний',
  [TargetPriority.STRONGEST]: 'Сильный',
  [TargetPriority.WEAKEST]:   'Слабый',
  [TargetPriority.NEAREST]:   'Ближний',
};

export class TowerPanel {
  private readonly _scene:   Phaser.Scene;
  private readonly _build:   BuildSystem;
  private readonly _economy: EconomyManager;

  // ── Build panel ───────────────────────────────────────────────────────────
  private _buildRoot!:  Phaser.GameObjects.Container;
  private _rowBgs:      Phaser.GameObjects.Graphics[] = [];
  private _selBars:     Phaser.GameObjects.Graphics[] = [];
  private _rowNameTxts: Phaser.GameObjects.Text[]     = [];
  private _rowCostTxts: Phaser.GameObjects.Text[]     = [];

  // ── Info panel ────────────────────────────────────────────────────────────
  private _infoRoot!:   Phaser.GameObjects.Container;
  private _infoTitle!:  Phaser.GameObjects.Text;
  private _infoLevel!:  Phaser.GameObjects.Text;
  private _infoSwatch!: Phaser.GameObjects.Graphics;
  private _statLines:   Phaser.GameObjects.Text[]  = [];
  private _liveStatLines: Phaser.GameObjects.Text[] = [];
  private _prioLabel!:  Phaser.GameObjects.Text;
  private _upgBtns:     Array<{ gfx: Phaser.GameObjects.Graphics; lbl: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }> = [];
  private _sellGfx!:    Phaser.GameObjects.Graphics;
  private _sellLbl!:    Phaser.GameObjects.Text;
  private _sellZone!:   Phaser.GameObjects.Zone;

  private _statsTimer = 0;

  // ── Tooltip ───────────────────────────────────────────────────────────────
  private _ttRoot!:    Phaser.GameObjects.Container;
  private _ttBg!:      Phaser.GameObjects.Graphics;
  private _ttTexts:    Phaser.GameObjects.Text[] = [];
  private _ttTimer:    Phaser.Time.TimerEvent | null = null;
  private _ttVisible   = false;

  private _tower: Tower | null = null;
  private _selectedIdx = -1;

  constructor(scene: Phaser.Scene, build: BuildSystem, economy: EconomyManager) {
    this._scene   = scene;
    this._build   = build;
    this._economy = economy;

    this._buildPanelBackground();
    this._buildBuildPanel();
    this._buildInfoPanel();
    this._buildTooltip();
    this._showBuildPanel();

    build.onTowerSelected = (t) => {
      this._tower = t;
      if (t) this._showInfoPanel(t); else this._showBuildPanel();
    };
  }

  // ── Panel background (permanent) ──────────────────────────────────────────
  private _buildPanelBackground(): void {
    const g = this._scene.add.graphics().setDepth(DEPTH.PANEL);

    // Deep glass background with vertical gradient
    for (let i = 0; i < 30; i++) {
      const t  = i / 30;
      const rv = Math.round(0x15 + t * 0x08);
      const gv = Math.round(0x11 + t * 0x06);
      const bv = Math.round(0x0D + t * 0x04);
      g.fillStyle((rv << 16) | (gv << 8) | bv, 1);
      g.fillRect(PX, i * (GAME_HEIGHT / 30), PW, GAME_HEIGHT / 30 + 1);
    }

    // Inner left shadow strip (depth effect)
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x000000, 0.06 * (1 - i / 8));
      g.fillRect(PX + i, 0, 1, GAME_HEIGHT);
    }

    // Separator — double-line amber
    g.lineStyle(2, COLORS.walnutDark, 0.95);
    g.beginPath(); g.moveTo(PX, 0); g.lineTo(PX, GAME_HEIGHT); g.strokePath();
    g.lineStyle(1.5, COLORS.amberWarm, 0.80);
    g.beginPath(); g.moveTo(PX + 2, 0); g.lineTo(PX + 2, GAME_HEIGHT); g.strokePath();
    g.lineStyle(1, COLORS.amberGlow, 0.18);
    g.beginPath(); g.moveTo(PX + 4, 0); g.lineTo(PX + 4, GAME_HEIGHT); g.strokePath();

    // Rune corner diamonds
    const corners: [number, number][] = [[PX + PW / 2, 12], [PX + PW / 2, GAME_HEIGHT - 12]];
    for (const [cx2, cy2] of corners) {
      const sz = 6;
      g.fillStyle(COLORS.amberDeep, 0.7);
      g.fillPoints([
        { x: cx2, y: cy2 - sz }, { x: cx2 + sz, y: cy2 },
        { x: cx2, y: cy2 + sz }, { x: cx2 - sz, y: cy2 },
      ] as Phaser.Types.Math.Vector2Like[], true);
    }
  }

  // ── Build panel ───────────────────────────────────────────────────────────
  private _buildBuildPanel(): void {
    const s = this._scene;
    this._buildRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1);

    // Section header
    const titleY = TOP_H + 14;
    const hdrG = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    hdrG.fillStyle(COLORS.amberDeep, 0.12);
    hdrG.fillRect(PX + 10, titleY - 2, PW - 20, 24);
    hdrG.lineStyle(1, COLORS.amberDeep, 0.30);
    hdrG.beginPath(); hdrG.moveTo(PX + 10, titleY + 22); hdrG.lineTo(PX + PW - 10, titleY + 22); hdrG.strokePath();
    this._buildRoot.add(hdrG);

    const title = s.add.text(PX + PAD + 2, titleY + 10, '🔨  ПОСТРОЙКИ', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.amberWarm_css,
      fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL + 1);
    this._buildRoot.add(title);

    const hintTxt = s.add.text(PX + PW - PAD, titleY + 10, 'клавиши 1–6', {
      fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted_css,
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL + 1);
    this._buildRoot.add(hintTxt);

    const rowY0 = titleY + 30;

    BUILDABLE_TOWER_IDS.forEach((id, i) => {
      const data = TOWER_DEFS[id];
      const ry   = rowY0 + i * ROW_H;
      const rx   = PX + 8;
      const rw   = PW - 16;

      // Card base — dark glass with subtle gradient
      const cardBg = s.add.graphics().setDepth(DEPTH.PANEL + 1);
      cardBg.fillStyle(0x1A1510, 0.80);
      cardBg.fillRoundedRect(rx, ry + 3, rw, ROW_H - 6, 7);
      cardBg.lineStyle(1, COLORS.walnutLight, 0.18);
      cardBg.strokeRoundedRect(rx, ry + 3, rw, ROW_H - 6, 7);
      this._buildRoot.add(cardBg);

      // Row hover overlay (drawn over card base)
      const rowBg = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      rowBg.setVisible(false);
      rowBg.fillStyle(COLORS.amberDeep, 0.12);
      rowBg.fillRoundedRect(rx, ry + 3, rw, ROW_H - 6, 7);
      rowBg.lineStyle(1.5, COLORS.amberWarm, 0.55);
      rowBg.strokeRoundedRect(rx, ry + 3, rw, ROW_H - 6, 7);
      this._buildRoot.add(rowBg); this._rowBgs.push(rowBg);

      // Selected bar — left amber stripe
      const selBar = s.add.graphics().setDepth(DEPTH.PANEL + 3);
      selBar.setVisible(false);
      selBar.fillStyle(COLORS.amberWarm, 1);
      selBar.fillRoundedRect(rx + 1, ry + 8, 3, ROW_H - 16, 2);
      this._buildRoot.add(selBar); this._selBars.push(selBar);

      // Hotkey pill
      const hkG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      hkG.fillStyle(COLORS.walnutDark, 0.85);
      hkG.fillRoundedRect(rx + 8, ry + ROW_H / 2 - 11, 20, 20, 4);
      hkG.lineStyle(1, COLORS.walnutLight, 0.50);
      hkG.strokeRoundedRect(rx + 8, ry + ROW_H / 2 - 11, 20, 20, 4);
      this._buildRoot.add(hkG);
      const hkLbl = s.add.text(rx + 18, ry + ROW_H / 2, `${i + 1}`, {
        fontFamily: FONT, fontSize: '11px', fontStyle: 'bold',
        color: COLORS.textSecondary_css,
      }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
      this._buildRoot.add(hkLbl);

      // Color swatch — small gem shape
      const swG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      swG.fillStyle(data.color, 1);
      swG.fillRoundedRect(rx + 36, ry + ROW_H / 2 - 8, 14, 14, 3);
      // Sheen overlay
      swG.fillStyle(0xFFFFFF, 0.15);
      swG.fillRoundedRect(rx + 37, ry + ROW_H / 2 - 7, 12, 5, 2);
      this._buildRoot.add(swG);

      // Tower name
      const nameTxt = s.add.text(rx + 58, ry + ROW_H / 2 - 9, data.name, {
        fontFamily: FONT, fontSize: '14px', color: COLORS.textPrimary_css, fontStyle: 'bold',
      }).setDepth(DEPTH.PANEL + 2);
      this._buildRoot.add(nameTxt); this._rowNameTxts.push(nameTxt);

      // Damage type badge
      const typeColor: Record<string, [number, string]> = {
        piercing: [0xE3A63A, '⬡ ДРОБЯЩИЙ'],
        siege:    [0xD4726A, '💥 ОСАДНЫЙ'],
        magic:    [0x9B7AE0, '✦ МАГИЯ'],
        chaos:    [0xFFD700, '☆ ХАОС'],
        normal:   [0x8EA39A, '— НОРМАЛ'],
      };
      const [tCol, tLabel] = typeColor[data.damageType] ?? [0x8EA39A, data.damageType];
      const badgeG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      badgeG.fillStyle(tCol, 0.18);
      badgeG.fillRoundedRect(rx + 58, ry + ROW_H / 2 + 6, 90, 14, 4);
      badgeG.lineStyle(1, tCol, 0.40);
      badgeG.strokeRoundedRect(rx + 58, ry + ROW_H / 2 + 6, 90, 14, 4);
      this._buildRoot.add(badgeG);
      const badgeTxt = s.add.text(rx + 103, ry + ROW_H / 2 + 13, tLabel, {
        fontFamily: FONT, fontSize: '9px', letterSpacing: 1,
        color: `#${tCol.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
      this._buildRoot.add(badgeTxt);

      // DPS mini-bar
      const maxDps = 70;
      const dps    = data.damage * data.attackSpeed;
      const barW   = Math.min(rw - 170, Math.round((dps / maxDps) * 80));
      const dpsG   = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      const barX   = rx + 58; const barY = ry + ROW_H - 13;
      dpsG.fillStyle(COLORS.walnutDark, 0.5); dpsG.fillRoundedRect(barX, barY, 80, 4, 2);
      dpsG.fillStyle(tCol, 0.7); dpsG.fillRoundedRect(barX, barY, barW, 4, 2);
      this._buildRoot.add(dpsG);

      // Cost pill — right side
      const costW = 66;
      const costG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      costG.fillStyle(COLORS.amberDeep, 0.18);
      costG.fillRoundedRect(rx + rw - costW - 4, ry + ROW_H / 2 - 13, costW, 26, 6);
      costG.lineStyle(1, COLORS.amberDeep, 0.40);
      costG.strokeRoundedRect(rx + rw - costW - 4, ry + ROW_H / 2 - 13, costW, 26, 6);
      this._buildRoot.add(costG);
      const costTxt = s.add.text(rx + rw - costW / 2 - 6, ry + ROW_H / 2, `${data.cost} ◆`, {
        fontFamily: FONT, fontSize: '13px', color: COLORS.amberGlow_css, fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
      this._buildRoot.add(costTxt); this._rowCostTxts.push(costTxt);

      // Aura indicator
      if (data.auraRadius > 0) {
        const auG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
        auG.fillStyle(COLORS.amberWarm, 0.85);
        auG.fillCircle(rx + rw - 9, ry + 9, 5);
        auG.lineStyle(1, COLORS.amberGlow, 0.6); auG.strokeCircle(rx + rw - 9, ry + 9, 5);
        const auT = s.add.text(rx + rw - 9, ry + 9, '⊙', {
          fontFamily: FONT, fontSize: '7px', color: COLORS.walnutDark_css,
        }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
        this._buildRoot.add(auG); this._buildRoot.add(auT);
      }

      // Interactive zone
      const zone = s.add.zone(rx, ry, PW - 16, ROW_H).setOrigin(0)
        .setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 4);
      zone.on('pointerover',  () => { rowBg.setVisible(true);  this._showTooltip(id, PX, ry); });
      zone.on('pointerout',   () => { rowBg.setVisible(false); this._hideTooltip(); });
      zone.on('pointerdown', () => {
        if (this._economy.gold < data.cost) return;
        this._selectedIdx = i;
        this._selBars.forEach((b, j) => b.setVisible(j === i));
        this._build.selectTowerType(id);
        this._hideTooltip();
      });
      this._buildRoot.add(zone);
    });
  }

  refreshAffordability(): void {
    BUILDABLE_TOWER_IDS.forEach((id, i) => {
      const canAfford = this._economy.gold >= TOWER_DEFS[id].cost;
      this._rowNameTxts[i]?.setColor(canAfford ? COLORS.textPrimary_css : COLORS.textMuted_css);
      this._rowCostTxts[i]?.setColor(canAfford ? COLORS.textGold_css   : COLORS.textMuted_css);
    });
  }

  private _showBuildPanel(): void {
    this._buildRoot.setVisible(true);
    this._infoRoot.setVisible(false);
    this._selectedIdx = -1;
    this._selBars.forEach(b => b.setVisible(false));
    this.refreshAffordability();
  }

  // ── Info panel ─────────────────────────────────────────────────────────────
  private _buildInfoPanel(): void {
    const s = this._scene;
    this._infoRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1).setVisible(false);

    const iy = TOP_H + 12;

    // ── Tower header card ─────────────────────────────────────────────────
    const hdrG = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    hdrG.fillStyle(0x1A1510, 0.85);
    hdrG.fillRoundedRect(PX + 8, iy, PW - 16, 52, 8);
    hdrG.lineStyle(1.5, COLORS.amberDeep, 0.45);
    hdrG.strokeRoundedRect(PX + 8, iy, PW - 16, 52, 8);
    // Accent left stripe
    hdrG.fillStyle(COLORS.amberWarm, 1);
    hdrG.fillRoundedRect(PX + 8, iy + 8, 3, 36, 2);
    this._infoRoot.add(hdrG);

    // Swatch gem inside header
    this._infoSwatch = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._infoRoot.add(this._infoSwatch);

    this._infoTitle = s.add.text(PX + PAD + 22, iy + 10, '—', {
      fontFamily: FONT, fontSize: '15px', color: COLORS.textPrimary_css, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL + 2);
    this._infoRoot.add(this._infoTitle);

    this._infoLevel = s.add.text(PX + PW - PAD, iy + 10, 'ур. I', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.amberPale_css,
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL + 2);
    this._infoRoot.add(this._infoLevel);

    // Divider inside header
    const hdrDiv = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    hdrDiv.lineStyle(1, COLORS.amberDeep, 0.25);
    hdrDiv.beginPath(); hdrDiv.moveTo(PX + PAD + 20, iy + 33); hdrDiv.lineTo(PX + PW - PAD, iy + 33); hdrDiv.strokePath();
    this._infoRoot.add(hdrDiv);

    // ── Stat grid (2-column cards) ────────────────────────────────────────
    const STAT_ICONS = ['⚔', '⚡', '◎', '📊', '✦', '🔥'];
    const statLabels = ['Урон', 'Скорость', 'Дальность', 'DPS', 'Тип урона', 'Эффект'];
    const statY0 = iy + 62;
    const CARD_W  = (PW - 28) / 2;
    const CARD_H  = 38;
    const CARD_GAP = 6;

    statLabels.forEach((lbl, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx2 = PX + 10 + col * (CARD_W + CARD_GAP);
      const cy2 = statY0 + row * (CARD_H + CARD_GAP);

      // Card bg
      const cardG = s.add.graphics().setDepth(DEPTH.PANEL + 1);
      cardG.fillStyle(0x16120E, 0.90);
      cardG.fillRoundedRect(cx2, cy2, CARD_W, CARD_H, 6);
      cardG.lineStyle(1, COLORS.walnutLight, 0.15);
      cardG.strokeRoundedRect(cx2, cy2, CARD_W, CARD_H, 6);
      this._infoRoot.add(cardG);

      // Icon
      const iconT = s.add.text(cx2 + 8, cy2 + CARD_H / 2 - 1, STAT_ICONS[i], {
        fontFamily: FONT, fontSize: '11px',
      }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL + 2);
      this._infoRoot.add(iconT);

      // Label
      const lblT = s.add.text(cx2 + 26, cy2 + 7, lbl, {
        fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted_css, letterSpacing: 1,
      }).setDepth(DEPTH.PANEL + 2);
      this._infoRoot.add(lblT);

      // Value
      const valTxt = s.add.text(cx2 + 26, cy2 + 19, '—', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.textPrimary_css,
      }).setDepth(DEPTH.PANEL + 2);
      this._infoRoot.add(valTxt);
      this._statLines.push(valTxt);
    });

    // ── Live stats row ────────────────────────────────────────────────────
    const liveY = statY0 + 3 * (CARD_H + CARD_GAP) + 4;
    const liveG = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    liveG.fillStyle(0x16120E, 0.70);
    liveG.fillRoundedRect(PX + 10, liveY, PW - 20, 32, 6);
    liveG.lineStyle(1, COLORS.walnutLight, 0.12);
    liveG.strokeRoundedRect(PX + 10, liveY, PW - 20, 32, 6);
    this._infoRoot.add(liveG);

    const liveLabels = ['☠ Убито', '💥 Урон нанесён'];
    liveLabels.forEach((lbl, i) => {
      const lx = PX + 16 + i * ((PW - 26) / 2);
      const lt = s.add.text(lx, liveY + 5, lbl, {
        fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted_css, letterSpacing: 1,
      }).setDepth(DEPTH.PANEL + 2);
      const vt = s.add.text(lx, liveY + 17, '0', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.amberPale_css,
      }).setDepth(DEPTH.PANEL + 2);
      this._infoRoot.add(lt); this._infoRoot.add(vt);
      this._liveStatLines.push(vt);
    });

    // ── Priority control ──────────────────────────────────────────────────
    const prioY = liveY + 40;
    const prioG = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    prioG.fillStyle(0x16120E, 0.70);
    prioG.fillRoundedRect(PX + 10, prioY, PW - 20, 34, 6);
    prioG.lineStyle(1, COLORS.walnutLight, 0.12);
    prioG.strokeRoundedRect(PX + 10, prioY, PW - 20, 34, 6);
    this._infoRoot.add(prioG);

    s.add.text(PX + 18, prioY + 10, '🎯 ЦЕЛЬ', {
      fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted_css, letterSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL + 2); // static — not in container

    const leftArr = s.add.text(PX + 18, prioY + 17, '◀', {
      fontFamily: FONT, fontSize: '15px', color: COLORS.amberWarm_css,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 3);
    leftArr.on('pointerdown', () => this._cyclePriority(-1));
    this._infoRoot.add(leftArr);

    this._prioLabel = s.add.text(CX, prioY + 17, '—', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold',
      color: COLORS.textPrimary_css, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.PANEL + 2);
    this._infoRoot.add(this._prioLabel);

    const rightArr = s.add.text(PX + PW - 18, prioY + 17, '▶', {
      fontFamily: FONT, fontSize: '15px', color: COLORS.amberWarm_css,
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 3);
    rightArr.on('pointerdown', () => this._cyclePriority(1));
    this._infoRoot.add(rightArr);

    // ── Upgrade buttons ───────────────────────────────────────────────────
    const upgY = prioY + 42;
    for (let i = 0; i < 2; i++) {
      const ux  = PX + 10 + i * (CARD_W + CARD_GAP);
      const uw  = CARD_W;
      const ugfx = s.add.graphics().setDepth(DEPTH.PANEL + 2).setVisible(false);
      const ulbl = s.add.text(ux + uw / 2, upgY + 18, '', {
        fontFamily: FONT, fontSize: '12px', color: COLORS.textPrimary_css,
        align: 'center', lineSpacing: 2,
      }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3).setVisible(false);
      const uzone = s.add.zone(ux, upgY, uw, 40).setOrigin(0)
        .setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 4).setVisible(false);
      this._infoRoot.add(ugfx); this._infoRoot.add(ulbl); this._infoRoot.add(uzone);
      this._upgBtns.push({ gfx: ugfx, lbl: ulbl, zone: uzone });
    }

    // ── Sell button (bottom of panel) ─────────────────────────────────────
    const sellY = GAME_HEIGHT - 56;
    const sellW = PW - 20;
    this._sellGfx = s.add.graphics().setDepth(DEPTH.PANEL + 2);
    this._sellLbl = s.add.text(PX + 10 + sellW / 2, sellY + 18, '✕  Продать  35 ◆', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
      color: COLORS.dangerSoft_css, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.PANEL + 3);
    this._sellZone = s.add.zone(PX + 10, sellY, sellW, 38).setOrigin(0)
      .setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 4);
    this._sellZone.on('pointerover', () => {
      this._sellGfx.clear();
      this._sellGfx.fillStyle(COLORS.danger, 0.22);
      this._sellGfx.fillRoundedRect(PX + 10, sellY, sellW, 38, 8);
      this._sellGfx.lineStyle(2, COLORS.dangerSoft, 0.9);
      this._sellGfx.strokeRoundedRect(PX + 10, sellY, sellW, 38, 8);
    });
    this._sellZone.on('pointerout',  () => this._redrawSellBtn(this._tower));
    this._sellZone.on('pointerdown', () => this._build.sellSelected());
    this._infoRoot.add(this._sellGfx);
    this._infoRoot.add(this._sellLbl);
    this._infoRoot.add(this._sellZone);
  }

  private _showInfoPanel(tower: Tower): void {
    this._buildRoot.setVisible(false);
    this._infoRoot.setVisible(true);
    this._infoRoot.setAlpha(0);
    this._scene.tweens.add({ targets: this._infoRoot, alpha: 1, duration: 150 });
    this._populateInfo(tower);
  }

  private _populateInfo(tower: Tower): void {
    const data = tower.data;
    const iy   = TOP_H + 12;

    // Swatch gem in header
    this._infoSwatch.clear();
    this._infoSwatch.fillStyle(data.color, 1);
    this._infoSwatch.fillRoundedRect(PX + PAD + 2, iy + 12, 14, 22, 3);
    this._infoSwatch.fillStyle(0xFFFFFF, 0.18);
    this._infoSwatch.fillRoundedRect(PX + PAD + 3, iy + 13, 12, 7, 2);

    this._infoTitle.setText(data.name.toUpperCase());
    this._infoLevel.setText(`ур. ${data.upgradeTo.length > 0 ? 'I' : 'MAX'}`);

    const dps = (data.damage * data.attackSpeed).toFixed(1);
    const specialLabel = ((): string => {
      if (data.auraRadius > 0)       return `Аура ${data.auraRadius}px +${Math.round(data.auraBuff * 100)}%`;
      if (data.special.length === 0) return data.splash > 0 ? `AoE ${data.splash}px` : '—';
      return data.special.map(s => {
        if (s.type === 'slow')         return `замедл. ${Math.round(s.value * 100)}%`;
        if (s.type === 'aoe_slow')     return `AoE замедл.`;
        if (s.type === 'armor_reduce') return `−броня ×${s.value}`;
        if (s.type === 'poison')       return `яд ${s.value}/с`;
        return s.type;
      }).join(' · ');
    })();

    const vals = [
      `${data.damage}`,
      `${data.attackSpeed.toFixed(1)}/с`,
      `${data.range}`,
      dps,
      data.damageType,
      specialLabel,
    ];
    vals.forEach((v, i) => this._statLines[i]?.setText(v));
    this._prioLabel.setText(PRIORITY_LABELS[tower.targetPriority]);

    // Upgrade buttons — redesigned
    const CARD_W   = (PW - 28) / 2;
    const CARD_GAP = 6;
    const statY0   = iy + 62;
    const CARD_H   = 38;
    const prioBase = statY0 + 3 * (CARD_H + CARD_GAP) + 4 + 40;
    const upgY     = prioBase + 42;

    this._upgBtns.forEach((btn, i) => {
      const upId = data.upgradeTo[i];
      if (!upId) {
        btn.gfx.setVisible(false); btn.lbl.setVisible(false); btn.zone.setVisible(false);
        return;
      }
      const upData    = TOWER_DEFS[upId];
      const canAfford = this._economy.gold >= upData.cost;
      const ux = PX + 10 + i * (CARD_W + CARD_GAP);
      const uw = CARD_W;

      btn.gfx.setVisible(true).clear();
      btn.gfx.fillStyle(canAfford ? COLORS.success : COLORS.walnutLight, canAfford ? 0.14 : 0.06);
      btn.gfx.fillRoundedRect(ux, upgY, uw, 40, 7);
      btn.gfx.lineStyle(1.5, canAfford ? COLORS.success : COLORS.walnutLight, canAfford ? 0.70 : 0.18);
      btn.gfx.strokeRoundedRect(ux, upgY, uw, 40, 7);
      if (canAfford) {
        btn.gfx.fillStyle(0xFFFFFF, 0.05);
        btn.gfx.fillRoundedRect(ux + 2, upgY + 2, uw - 4, 14, 5);
      }

      btn.lbl.setVisible(true);
      btn.lbl.setText(`⬆ ${upData.name}\n${upData.cost} ◆`);
      btn.lbl.setColor(canAfford ? COLORS.textPrimary_css : COLORS.textMuted_css);
      btn.lbl.setPosition(ux + uw / 2, upgY + 8);

      btn.zone.setVisible(canAfford).setPosition(ux, upgY);
      (btn.zone as Phaser.GameObjects.Zone).setSize(uw, 40);
      btn.zone.removeAllListeners('pointerdown');
      btn.zone.on('pointerdown', () => this._build.upgradeSelected(upId));
      btn.zone.on('pointerover', () => {
        if (!canAfford) return;
        btn.gfx.clear();
        btn.gfx.fillStyle(COLORS.success, 0.25); btn.gfx.fillRoundedRect(ux, upgY, uw, 40, 7);
        btn.gfx.lineStyle(2, COLORS.successSoft, 0.9); btn.gfx.strokeRoundedRect(ux, upgY, uw, 40, 7);
      });
      btn.zone.on('pointerout', () => this._populateInfo(tower));
    });

    this._redrawSellBtn(tower);
  }

  private _redrawSellBtn(tower: Tower | null): void {
    if (!tower) return;
    const sellY = GAME_HEIGHT - 56;
    const sellW = PW - 20;
    const rate  = 1.0; // display max; actual rate applied by BuildSystem
    const refund = tower.sellValue(rate);
    this._sellGfx.clear();
    this._sellGfx.fillStyle(COLORS.walnutDark, 0.60);
    this._sellGfx.fillRoundedRect(PX + 10, sellY, sellW, 38, 8);
    this._sellGfx.lineStyle(1.5, COLORS.dangerSoft, 0.55);
    this._sellGfx.strokeRoundedRect(PX + 10, sellY, sellW, 38, 8);
    this._sellGfx.fillStyle(0xFFFFFF, 0.03);
    this._sellGfx.fillRoundedRect(PX + 12, sellY + 2, sellW - 4, 14, 6);
    this._sellLbl.setText(`✕  Продать  ${refund} ◆`);
  }

  private _cyclePriority(dir: 1 | -1): void {
    if (!this._tower) return;
    const cur = PRIORITY_ORDER.indexOf(this._tower.targetPriority);
    const next = (cur + dir + PRIORITY_ORDER.length) % PRIORITY_ORDER.length;
    this._tower.targetPriority = PRIORITY_ORDER[next];
    this._prioLabel.setText(PRIORITY_LABELS[this._tower.targetPriority]);
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  private _buildTooltip(): void {
    const s = this._scene;
    this._ttRoot = s.add.container(0,0).setDepth(DEPTH.OVERLAY_UI).setVisible(false);
    this._ttBg   = s.add.graphics();
    this._ttRoot.add(this._ttBg);
    // 6 text slots
    for (let i=0;i<8;i++) {
      const t = s.add.text(0,0,'',{fontFamily:FONT, fontSize:'11px', color: COLORS.bgPrimary_css});
      this._ttRoot.add(t); this._ttTexts.push(t);
    }
  }

  private _showTooltip(id: TowerId, panelX: number, rowY: number): void {
    if (this._ttTimer) this._ttTimer.remove();
    this._ttTimer = this._scene.time.delayedCall(400, () => {
      const data = TOWER_DEFS[id];
      const TW=220, TH=144, tx=panelX-TW-8, ty=Math.min(rowY, GAME_HEIGHT-TH-8);
      this._ttBg.clear();
      this._ttBg.fillStyle(COLORS.bgDark, 0.97); this._ttBg.fillRoundedRect(tx,ty,TW,TH,6);
      this._ttBg.lineStyle(2,COLORS.walnutLight,0.75); this._ttBg.strokeRoundedRect(tx,ty,TW,TH,6);
      this._ttBg.lineStyle(1,COLORS.amberDeep,0.9); this._ttBg.strokeRoundedRect(tx+3,ty+3,TW-6,TH-6,4);
      const lines = [
        { text: data.name, color: COLORS.amberWarm_css, size:'13px' },
        { text: `Урон: ${data.damage}   DPS: ${(data.damage*data.attackSpeed).toFixed(1)}`, color: COLORS.bgPrimary_css },
        { text: `Скорость: ${data.attackSpeed} атк/с`, color: COLORS.bgPrimary_css },
        { text: `Дальность: ${data.range}px`, color: COLORS.bgPrimary_css },
        { text: `Тип: ${data.damageType}`, color: COLORS.textMuted_css },
        { text: data.special.length > 0
            ? `Эффект: ${data.special.map(s=>`${s.type} ${s.value}`).join(', ')}`
            : (data.splash ? `AoE: ${data.splash}px` : ''),
          color: COLORS.seaLight_css },
        { text: '', color:'' },
        { text: data.description, color: COLORS.textSecondary_css },
      ];
      this._ttTexts.forEach((t,i) => {
        const l = lines[i]; if (!l) return;
        t.setText(l.text); t.setColor(l.color||COLORS.bgPrimary_css);
        if ((l as {size?:string}).size) t.setFontSize((l as {size?:string}).size!);
        t.setPosition(tx+10, ty+8+i*16);
      });
      this._ttRoot.setVisible(true); this._ttVisible=true;
    });
  }

  private _hideTooltip(): void {
    if (this._ttTimer) { this._ttTimer.remove(); this._ttTimer=null; }
    this._ttRoot.setVisible(false); this._ttVisible=false;
  }

  // ── Hotkeys ────────────────────────────────────────────────────────────────
  bindHotkeys(scene: Phaser.Scene): void {
    const codes = [
      Phaser.Input.Keyboard.KeyCodes.ONE, Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE, Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
    ];
    codes.forEach((code, i) => {
      scene.input.keyboard!.addKey(code).on('down', () => {
        const id = BUILDABLE_TOWER_IDS[i];
        if (id && this._economy.gold >= TOWER_DEFS[id].cost) {
          this._selectedIdx = i;
          this._selBars.forEach((b,j) => b.setVisible(j===i));
          this._build.selectTowerType(id);
        }
      });
    });
  }

  update(_delta: number): void {
    this.refreshAffordability();

    // Refresh live damage/kill stats ~once per second
    if (this._tower && this._infoRoot.visible) {
      this._statsTimer += _delta;
      if (this._statsTimer >= 1000) {
        this._statsTimer = 0;
        this._liveStatLines[0]?.setText(
          this._tower.totalDamageDealt.toLocaleString('ru-RU')
        );
        this._liveStatLines[1]?.setText(String(this._tower.totalKills));
      }
    }
  }
}
