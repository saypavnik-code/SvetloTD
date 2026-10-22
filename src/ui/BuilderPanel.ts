// ─────────────────────────────────────────────────────────────────────────────
// BuilderPanel.ts — The builders section of the build panel (v0.20.0): one row per builder of the active seat.
// An owned builder shows its mastery (research for lumber, then the ultimate tower opens); a builder the seat does not
// own shows its license price; a placeholder says "soon". Display and input only: prices and rules come from
// BuilderManager, which is also the only place that spends the lumber. Rows live in the container of the build panel,
// so they hide together with it while a tower is selected.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY } from '../config';
import { BUILDERS, BUILDER_IDS, MASTERY_LUMBER, type BuilderId } from '../data/builders';
import { TOWER_DEFS } from '../data/towers';
import type { BuilderManager } from '../systems/BuilderManager';
import type { LumberManager } from '../systems/LumberManager';
import type { Seats } from '../systems/Seats';
import { BUILDER_ROW_H, SIDE, buildersTop } from './layout';

const PAD = 16;
const FONT = FONT_FAMILY;

interface Row {
  swatch: Phaser.GameObjects.Image;
  name:   Phaser.GameObjects.Text;
  action: Phaser.GameObjects.Text;
  zone:   Phaser.GameObjects.Zone;
}

export class BuilderPanel {
  private readonly _scene:    Phaser.Scene;
  private readonly _builders: BuilderManager;
  private readonly _lumber:   LumberManager;
  private readonly _seats:    Seats;
  private readonly _rows:     Row[] = [];
  private readonly _hint:     Phaser.GameObjects.Text;
  private _drawn = '';

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, builders: BuilderManager, lumber: LumberManager, seats: Seats) {
    this._scene = scene; this._builders = builders; this._lumber = lumber; this._seats = seats;
    const top = buildersTop(seats.count);

    const title = scene.add.text(SIDE.x + PAD, top, 'СТРОИТЕЛИ', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textGold_css, fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(DEPTH.PANEL + 1);
    parent.add(title);
    const rule = scene.add.graphics().setDepth(DEPTH.PANEL + 1);
    rule.lineStyle(2, COLORS.amberDeep, 0.35);
    rule.beginPath(); rule.moveTo(SIDE.x + PAD, top + 20); rule.lineTo(SIDE.x + SIDE.w - PAD, top + 20); rule.strokePath();
    parent.add(rule);

    BUILDER_IDS.forEach((id, index) => {
      const y = top + 24 + index * BUILDER_ROW_H;
      const swatch = scene.add.image(SIDE.x + PAD + 10, y + BUILDER_ROW_H / 2, `builder_${id}`).setDisplaySize(20, 20).setDepth(DEPTH.PANEL + 2);
      const name = scene.add.text(SIDE.x + PAD + 26, y + 3, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textPrimary_css, fontStyle: 'bold' })
        .setDepth(DEPTH.PANEL + 2);
      const action = scene.add.text(SIDE.x + SIDE.w - PAD, y + 3, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textGold_css, fontStyle: 'bold', align: 'right' })
        .setOrigin(1, 0).setDepth(DEPTH.PANEL + 2);
      const zone = scene.add.zone(SIDE.x + 6, y, SIDE.w - 12, BUILDER_ROW_H).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.PANEL + 3);
      zone.on('pointerover', () => this._hint.setText(this._describe(id)));
      zone.on('pointerout', () => this._hint.setText(''));
      zone.on('pointerdown', () => this._press(id));
      parent.add(swatch); parent.add(name); parent.add(action); parent.add(zone);
      this._rows.push({ swatch, name, action, zone });
    });
    this._hint = scene.add.text(SIDE.x + PAD, top + 24 + BUILDER_IDS.length * BUILDER_ROW_H + 2, '', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted_css, wordWrap: { width: SIDE.w - 2 * PAD },
    }).setDepth(DEPTH.PANEL + 2);
    parent.add(this._hint);
    this.refresh();
  }

  private _describe(id: BuilderId): string {
    const def = BUILDERS[id];
    const ultimate = def.ultimate ? ` Ультимейт: ${TOWER_DEFS[def.ultimate].name}.` : '';
    return `${def.summary}${ultimate}`;
  }

  /** Buy the license of a builder the seat does not own, or research the mastery of one it owns. The rules refuse a bad click. */
  private _press(id: BuilderId): void {
    const seat = this._seats.active;
    if (this._builders.owns(seat, id)) this._builders.research(seat, id);
    else this._builders.buyLicense(seat, id);
    this.refresh();
  }

  /** Called every frame; redraws only when what the rows say has changed. */
  refresh(): void {
    const seat = this._seats.active;
    const lumber = this._lumber.lumberOf(seat);
    const licenseCost = this._builders.nextLicenseCost(seat);
    const parts = BUILDER_IDS.map(id => `${id}:${this._builders.owns(seat, id) ? 1 : 0}${this._builders.hasMastery(seat, id) ? 1 : 0}`);
    const key = `${seat}|${lumber}|${licenseCost}|${parts.join(',')}`;
    if (key === this._drawn) return;
    this._drawn = key;
    BUILDER_IDS.forEach((id, index) => {
      const def = BUILDERS[id], row = this._rows[index];
      const owned = this._builders.owns(seat, id);
      row.swatch.setAlpha(def.open ? (owned ? 1 : 0.45) : 0.2);
      row.name.setText(`${def.name} · ${def.element}`);
      row.name.setColor(owned ? COLORS.textPrimary_css : COLORS.textMuted_css);
      let label = '', affordable = true;
      if (!def.open) label = 'скоро';
      else if (!owned) { label = `Лицензия ${licenseCost}д`; affordable = licenseCost !== null && lumber >= licenseCost; }
      else if (def.ultimate === null) label = '';
      else if (this._builders.hasMastery(seat, id)) label = '✓ Мастерство';
      else { label = `Мастерство ${MASTERY_LUMBER}д`; affordable = lumber >= MASTERY_LUMBER; }
      row.action.setText(label);
      row.action.setColor(!def.open || !affordable ? COLORS.textMuted_css : label.startsWith('✓') ? COLORS.successSoft_css : COLORS.textGold_css);
    });
  }
}
