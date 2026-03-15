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
const ROW_H = 48;
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
    g.fillStyle(COLORS.bgPanel, 1); g.fillRect(PX, 0, PW, GAME_HEIGHT);
    g.lineStyle(2, COLORS.amberDeep, 0.45); g.beginPath(); g.moveTo(PX, 0); g.lineTo(PX, GAME_HEIGHT); g.strokePath();
  }

  // ── Build panel ───────────────────────────────────────────────────────────
  private _buildBuildPanel(): void {
    const s = this._scene;
    this._buildRoot = s.add.container(0, 0).setDepth(DEPTH.PANEL + 1);

    // Title
    const titleY = TOP_H + 16;
    const title = s.add.text(PX + PAD, titleY, 'ОБОРОНА', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textPrimary_css,
      fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(DEPTH.PANEL + 1);
    this._buildRoot.add(title);

    // Divider
    const divG = s.add.graphics().setDepth(DEPTH.PANEL + 1);
    divG.lineStyle(1, COLORS.amberDeep, 0.20);
    divG.beginPath(); divG.moveTo(PX+PAD, titleY+22); divG.lineTo(PX+PW-PAD, titleY+22); divG.strokePath();
    this._buildRoot.add(divG);

    const rowY0 = titleY + 30;

    BUILDABLE_TOWER_IDS.forEach((id, i) => {
      const data = TOWER_DEFS[id];
      const ry   = rowY0 + i * ROW_H;
      const rx   = PX;

      // Row hover background (full width)
      const rowBg = s.add.graphics().setDepth(DEPTH.PANEL + 1);
      rowBg.setVisible(false); // only shown on hover
      rowBg.fillStyle(COLORS.bgPanelHover, 1); rowBg.fillRect(rx+2, ry, PW-4, ROW_H-2);
      this._buildRoot.add(rowBg); this._rowBgs.push(rowBg);

      // Selected bar (3px left stripe)
      const selBar = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      selBar.setVisible(false);
      selBar.fillStyle(COLORS.amberWarm, 1); selBar.fillRect(PX+2, ry+4, 3, ROW_H-10);
      this._buildRoot.add(selBar); this._selBars.push(selBar);

      // Hotkey box
      const hkG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      hkG.lineStyle(1, COLORS.walnutLight, 0.5); hkG.strokeRect(PX+PAD, ry+13, 22, 22);
      this._buildRoot.add(hkG);
      const hkLbl = s.add.text(PX+PAD+11, ry+24, `${i+1}`, {
        fontFamily: FONT, fontSize: '12px', color: COLORS.walnut_css,
      }).setOrigin(0.5).setDepth(DEPTH.PANEL + 2);
      this._buildRoot.add(hkLbl);

      // Color swatch
      const swG = s.add.graphics().setDepth(DEPTH.PANEL + 2);
      swG.fillStyle(data.color, 0.9); swG.fillRect(PX+PAD+30, ry+18, 12, 12);
      this._buildRoot.add(swG);

      // Name
      const nameTxt = s.add.text(PX+PAD+50, ry+12, data.name, {
        fontFamily: FONT, fontSize: '14px', color: COLORS.textPrimary_css,
      }).setDepth(DEPTH.PANEL + 2);
      this._buildRoot.add(nameTxt); this._rowNameTxts.push(nameTxt);

      // Subtitle
      const sub = s.add.text(PX+PAD+50, ry+30, data.description, {
        fontFamily: FONT, fontSize: '11px', color: COLORS.textSecondary_css,
      }).setDepth(DEPTH.PANEL + 2);
      this._buildRoot.add(sub);

      // Cost
      const costTxt = s.add.text(PX+PW-PAD, ry+18, `${data.cost}◆`, {
        fontFamily: FONT, fontSize: '14px', color: COLORS.textGold_css, align: 'right',
      }).setOrigin(1, 0).setDepth(DEPTH.PANEL + 2);
      this._buildRoot.add(costTxt); this._rowCostTxts.push(costTxt);

      // Interactive zone
      const zone = s.add.zone(rx, ry, PW, ROW_H).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 3);
      zone.on('pointerover', () => {
        rowBg.setVisible(true);
        this._showTooltip(id, PX, ry);
      });
      zone.on('pointerout', () => { rowBg.setVisible(false); this._hideTooltip(); });
      zone.on('pointerdown', () => {
        if (this._economy.gold < data.cost) return;
        this._selectedIdx = i;
        this._selBars.forEach((b,j) => b.setVisible(j===i));
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
    this._infoRoot = s.add.container(0,0).setDepth(DEPTH.PANEL+1).setVisible(false);

    const iy = TOP_H + PAD;

    // Swatch
    this._infoSwatch = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._infoRoot.add(this._infoSwatch);

    // Title + level
    this._infoTitle = s.add.text(PX+PAD+20, iy, '—', {
      fontFamily: FONT, fontSize: '15px', color: COLORS.textPrimary_css, fontStyle: 'bold',
    }).setDepth(DEPTH.PANEL+2);
    this._infoRoot.add(this._infoTitle);
    this._infoLevel = s.add.text(PX+PW-PAD, iy, 'I', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css, align: 'right',
    }).setOrigin(1,0).setDepth(DEPTH.PANEL+2);
    this._infoRoot.add(this._infoLevel);

    // Divider
    const div = s.add.graphics().setDepth(DEPTH.PANEL+2);
    div.lineStyle(1, COLORS.amberDeep, 0.20);
    div.beginPath(); div.moveTo(PX+PAD, iy+24); div.lineTo(PX+PW-PAD, iy+24); div.strokePath();
    this._infoRoot.add(div);

    // Stat lines (6 rows: damage, speed, range, dps, type, splash/special)
    const statLabels = ['Урон','Скорость','Дальность','DPS','Тип урона','Эффект'];
    const statY0 = iy + 32;
    statLabels.forEach((lbl, i) => {
      const y = statY0 + i*20;
      const lblTxt = s.add.text(PX+PAD, y, lbl, {
        fontFamily: FONT, fontSize: '12px', color: COLORS.textSecondary_css,
      }).setDepth(DEPTH.PANEL+2);
      const valTxt = s.add.text(PX+PAD+120, y, '—', {
        fontFamily: FONT, fontSize: '12px', color: COLORS.textPrimary_css, fontStyle: 'bold',
      }).setDepth(DEPTH.PANEL+2);
      this._infoRoot.add(lblTxt); this._infoRoot.add(valTxt);
      this._statLines.push(valTxt);
    });

    // Live stats: damage dealt + kills (rows 6 & 7)
    const liveY0 = statY0 + 6*20 + 2;
    const liveLabels = ['Нанесено урона', 'Уничтожено'];
    liveLabels.forEach((lbl, i) => {
      const y = liveY0 + i * 18;
      const lblTxt = s.add.text(PX+PAD, y, lbl, {
        fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted_css,
      }).setDepth(DEPTH.PANEL+2);
      const valTxt = s.add.text(PX+PAD+120, y, '0', {
        fontFamily: FONT, fontSize: '11px', color: COLORS.textSecondary_css,
      }).setDepth(DEPTH.PANEL+2);
      this._infoRoot.add(lblTxt); this._infoRoot.add(valTxt);
      this._liveStatLines.push(valTxt);
    });

    // Stats section divider
    const div2 = s.add.graphics().setDepth(DEPTH.PANEL+2);
    div2.lineStyle(1, COLORS.amberDeep, 0.15);
    div2.beginPath(); div2.moveTo(PX+PAD, statY0+6*20+4); div2.lineTo(PX+PW-PAD, statY0+6*20+4); div2.strokePath();
    this._infoRoot.add(div2);

    // Priority label + arrows
    const prioY = statY0 + 6*20 + 16;
    const prioStaticLbl = s.add.text(PX+PAD, prioY, 'Цель:', {
      fontFamily: FONT, fontSize: '12px', color: COLORS.textSecondary_css,
    }).setDepth(DEPTH.PANEL+2);
    this._infoRoot.add(prioStaticLbl);

    const leftArr = s.add.text(PX+PAD+60, prioY, '◀', {
      fontFamily: FONT, fontSize: '14px', color: COLORS.amberWarm_css,
    }).setInteractive({useHandCursor:true}).setDepth(DEPTH.PANEL+3);
    leftArr.on('pointerdown', () => this._cyclePriority(-1));
    this._infoRoot.add(leftArr);

    this._prioLabel = s.add.text(CX, prioY, '—', {
      fontFamily: FONT, fontSize: '12px', color: COLORS.textPrimary_css, align:'center',
    }).setOrigin(0.5,0).setDepth(DEPTH.PANEL+2);
    this._infoRoot.add(this._prioLabel);

    const rightArr = s.add.text(PX+PW-PAD-14, prioY, '▶', {
      fontFamily: FONT, fontSize: '14px', color: COLORS.amberWarm_css,
    }).setInteractive({useHandCursor:true}).setDepth(DEPTH.PANEL+3);
    rightArr.on('pointerdown', () => this._cyclePriority(1));
    this._infoRoot.add(rightArr);

    // Upgrade buttons (max 2) — built once, shown/hidden as needed
    const upgY = prioY + 32;
    for (let i=0; i<2; i++) {
      const ux = PX+PAD + i*(PW/2-PAD/2);
      const uw = PW/2 - PAD*1.5;
      const ugfx = s.add.graphics().setDepth(DEPTH.PANEL+2).setVisible(false);
      const ulbl = s.add.text(ux+uw/2, upgY+16, '', {
        fontFamily: FONT, fontSize: '12px', color: COLORS.textPrimary_css, align:'center',
      }).setOrigin(0.5).setDepth(DEPTH.PANEL+3).setVisible(false);
      const uzone = s.add.zone(ux, upgY, uw, 36).setOrigin(0).setInteractive({useHandCursor:true}).setDepth(DEPTH.PANEL+4).setVisible(false);
      this._infoRoot.add(ugfx); this._infoRoot.add(ulbl); this._infoRoot.add(uzone);
      this._upgBtns.push({gfx:ugfx, lbl:ulbl, zone:uzone});
    }

    // Sell button
    const sellY = GAME_HEIGHT - 80 - 44; // above WAVE BAR (52px) and top bar
    const sellW = PW - PAD*2;
    this._sellGfx = s.add.graphics().setDepth(DEPTH.PANEL+2);
    this._sellLbl = s.add.text(PX+PAD+sellW/2, sellY+13, '✕ Продать  35◆', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.dangerSoft_css, align:'center',
    }).setOrigin(0.5).setDepth(DEPTH.PANEL+3);
    this._sellZone = s.add.zone(PX+PAD, sellY, sellW, 36).setOrigin(0).setInteractive({useHandCursor:true}).setDepth(DEPTH.PANEL+4);
    this._sellZone.on('pointerover',  () => { this._sellGfx.clear(); this._sellGfx.fillStyle(COLORS.dangerSoft,0.20); this._sellGfx.fillRoundedRect(PX+PAD,sellY,sellW,36,6); this._sellGfx.lineStyle(1,COLORS.dangerSoft,0.8); this._sellGfx.strokeRoundedRect(PX+PAD,sellY,sellW,36,6); });
    this._sellZone.on('pointerout',   () => this._redrawSellBtn(this._tower));
    this._sellZone.on('pointerdown',  () => this._build.sellSelected());
    this._infoRoot.add(this._sellGfx); this._infoRoot.add(this._sellLbl); this._infoRoot.add(this._sellZone);
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
    const iy   = TOP_H + PAD;

    // Swatch
    this._infoSwatch.clear();
    this._infoSwatch.fillStyle(data.color, 1);
    this._infoSwatch.fillRect(PX+PAD, iy, 14, 14);

    this._infoTitle.setText(data.name.toUpperCase());
    this._infoLevel.setText('Ур. I');

    const dps = (data.damage * data.attackSpeed).toFixed(1);
    const specialLabel = ((): string => {
      if (data.special.length === 0) return data.splash > 0 ? `AoE ${data.splash}px` : '—';
      return data.special.map(s => `${s.type} ${s.value}`).join(', ');
    })();
    const vals = [
      `${data.damage}`,
      `${data.attackSpeed} атк/с`,
      `${data.range}`,
      dps,
      data.damageType,
      specialLabel,
    ];
    vals.forEach((v,i) => this._statLines[i]?.setText(v));
    this._prioLabel.setText(PRIORITY_LABELS[tower.targetPriority]);

    // Upgrade buttons
    this._upgBtns.forEach((btn,i) => {
      const upId = data.upgradeTo[i];
      if (!upId) { btn.gfx.setVisible(false); btn.lbl.setVisible(false); btn.zone.setVisible(false); return; }
      const upData   = TOWER_DEFS[upId];
      const canAfford = this._economy.gold >= upData.cost;
      const ux = PX+PAD + i*(PW/2-PAD/2);
      const uw = PW/2 - PAD*1.5;
      const upgY = TOP_H + PAD + 6*20 + 16 + 32;
      btn.gfx.setVisible(true).clear();
      btn.gfx.fillStyle(canAfford ? COLORS.success : COLORS.walnutLight, canAfford ? 0.25 : 0.12);
      btn.gfx.fillRoundedRect(ux, upgY, uw, 36, 6);
      btn.gfx.lineStyle(1, canAfford ? COLORS.success : COLORS.walnutLight, canAfford ? 0.8 : 0.25);
      btn.gfx.strokeRoundedRect(ux, upgY, uw, 36, 6);
      btn.lbl.setVisible(true).setText(`⬆ ${upData.name}\n${upData.cost}◆`);
      btn.lbl.setColor(canAfford ? COLORS.textPrimary_css : COLORS.textMuted_css);
      btn.lbl.setPosition(ux+uw/2, upgY+8);
      btn.zone.setVisible(canAfford).setPosition(ux, upgY).setSize(uw, 36);
      btn.zone.removeAllListeners('pointerdown');
      btn.zone.on('pointerdown', () => this._build.upgradeSelected(upId));
    });

    this._redrawSellBtn(tower);
  }

  private _redrawSellBtn(tower: Tower | null): void {
    if (!tower) return;
    const sellY = GAME_HEIGHT - 80 - 44;
    const sellW = PW - PAD*2;
    this._sellGfx.clear();
    this._sellGfx.lineStyle(1, COLORS.dangerSoft, 0.55); this._sellGfx.strokeRoundedRect(PX+PAD, sellY, sellW, 36, 6);
    this._sellLbl.setText(`✕ Продать  ${tower.sellValue}◆`);
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
      this._ttBg.fillStyle(COLORS.bgDark, 0.96); this._ttBg.fillRoundedRect(tx,ty,TW,TH,6);
      this._ttBg.lineStyle(1,COLORS.amberDeep,0.4); this._ttBg.strokeRoundedRect(tx,ty,TW,TH,6);
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
