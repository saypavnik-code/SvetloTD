// Tower.ts — Stage 8. Phaser Container for selection/range rings only.
// Gameplay logic pure TS; shape drawn to towerGfx batch.

import Phaser from 'phaser';
import { type TowerData, type TowerId, TOWER_DEFS } from '../data/towers';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { ObjectPool } from '../utils/ObjectPool';
import { TILE_SIZE, DEPTH, COLORS } from '../config';
import { BASE_CENTER_X, BASE_CENTER_Y } from '../data/mapData';
import { GameSpeed } from '../systems/GameSpeed';
import { EventBus, GameEvents } from '../utils/EventBus';

export enum TargetPriority { FIRST, LAST, STRONGEST, WEAKEST, NEAREST }

const TARGET_TICK = 200;
const BODY_SIZE   = 34;

export interface TowerBuff {
  type:      'attack_speed';
  value:     number;    // fractional bonus, e.g. 0.25 = +25 %
  duration:  number;    // total seconds (reference)
  remaining: number;    // seconds left
}

export class Tower {
  // World position
  readonly x: number;
  readonly y: number;
  readonly gridCol: number;
  readonly gridRow: number;
  readonly data: TowerData;
  readonly towerId: TowerId;
  totalInvested: number;
  targetPriority: TargetPriority = TargetPriority.FIRST;

  // Stats tracking
  totalDamageDealt = 0;
  totalKills       = 0;

  // Active buffs (from hero skill W or aura towers)
  private _buffs:    TowerBuff[] = [];
  // Aura bonus — set/cleared by AuraSystem each second (not a timed buff)
  private _auraBuff  = 0;

  // Spawn bounce animation
  private _spawnTimer = 0.25;

  // Range ring — still a Phaser object (needed for interactive overlay)
  private readonly _scene: Phaser.Scene;
  private _rangeCircle!: Phaser.GameObjects.Graphics;
  private _bladesAngle = 0;
  private _selected    = false;

  private _target:          Enemy | null = null;
  private _targetTick       = 0;
  private _fireCooldown     = 0;
  private _projPool:        ObjectPool<Projectile>;
  private _activeEnemiesFn: () => Enemy[];

  constructor(
    scene: Phaser.Scene, towerId: TowerId, col: number, row: number,
    projPool: ObjectPool<Projectile>, activeEnemies: () => Enemy[], invested?: number,
  ) {
    this._scene           = scene;
    this.towerId          = towerId;
    this.data             = TOWER_DEFS[towerId];
    this.gridCol          = col;
    this.gridRow          = row;
    this.x                = col * TILE_SIZE + TILE_SIZE / 2;
    this.y                = row * TILE_SIZE + TILE_SIZE / 2;
    this.totalInvested    = invested ?? this.data.cost;
    this._projPool        = projPool;
    this._activeEnemiesFn = activeEnemies;

    this._buildRangeCircle();

    // Spawn pop animation via scale tween on range circle proxy
    this._rangeCircle.setScale(0);
    scene.tweens.add({ targets: this._rangeCircle, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private _buildRangeCircle(): void {
    this._rangeCircle = this._scene.add.graphics()
      .setPosition(this.x, this.y)
      .setDepth(DEPTH.TOWER_SELECTION)
      .setVisible(false);
    this._redrawRange(false);
  }

  private _redrawRange(selected: boolean): void {
    const g = this._rangeCircle; g.clear();
    const a = selected ? 0.30 : 0.14;
    g.lineStyle(1, this.data.color, a); g.strokeCircle(0, 0, this.data.range);
    g.fillStyle(this.data.color, a * 0.10); g.fillCircle(0, 0, this.data.range);
  }

  showRange(visible: boolean, selected = false): void {
    this._selected = selected;
    this._rangeCircle.setVisible(visible);
    if (visible) this._redrawRange(selected);
  }

  // Tab — show/hide ghost range ring at low alpha
  showRangeGhost(visible: boolean): void {
    if (this._selected) return;  // don't override selection ring
    this._rangeCircle.setVisible(visible);
    if (visible) {
      const g = this._rangeCircle; g.clear();
      g.lineStyle(1, this.data.color, 0.20);
      g.strokeCircle(0, 0, this.data.range);
      g.fillStyle(COLORS.amberPale, 0.06);
      g.fillCircle(0, 0, this.data.range);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(delta: number): void {
    const gd = GameSpeed.adjust(delta);
    this._targetTick   += gd;
    this._fireCooldown -= gd;
    if (this.towerId === 'slow_t1' || this.towerId === 'slow_t2') this._bladesAngle += gd * 0.003;
    if (this._spawnTimer > 0) this._spawnTimer = Math.max(0, this._spawnTimer - gd / 1000);

    // Tick active buffs (dt in seconds)
    this._tickBuffs(gd / 1000);

    if (this._targetTick >= TARGET_TICK) { this._targetTick = 0; this._findTarget(); }
    if (this._fireCooldown <= 0 && this._target) {
      // Use effective attack speed so buff applies
      this._fireCooldown = 1000 / this._effectiveAttackSpeed();
      this._fire();
    }
  }

  // ── Buff API (called by Hero.useSkillW) ────────────────────────────────────
  applyBuff(buff: TowerBuff): void {
    const existing = this._buffs.find(b => b.type === buff.type);
    if (existing) {
      // Refresh — take the longer remaining time
      existing.remaining = Math.max(existing.remaining, buff.remaining);
      existing.duration  = buff.duration;
    } else {
      this._buffs.push({ ...buff });
    }
  }

  /** Called by AuraSystem before each scan to reset stale bonus */
  clearAuraBuff(): void { this._auraBuff = 0; }

  /** Called by AuraSystem when this tower is within an aura source's radius */
  applyAuraBuff(bonus: number): void {
    // Take the highest aura bonus if multiple aura towers overlap
    this._auraBuff = Math.max(this._auraBuff, bonus);
  }

  get isAuraBoosted(): boolean { return this._auraBuff > 0; }

  get isBuffed(): boolean { return this._buffs.length > 0 || this._auraBuff > 0; }

  private _tickBuffs(dtSecs: number): void {
    for (let i = this._buffs.length - 1; i >= 0; i--) {
      this._buffs[i].remaining -= dtSecs;
      if (this._buffs[i].remaining <= 0) this._buffs.splice(i, 1);
    }
  }

  private _effectiveAttackSpeed(): number {
    let speed = this.data.attackSpeed;
    for (const b of this._buffs) {
      if (b.type === 'attack_speed') speed *= (1 + b.value);
    }
    // Aura bonus stacks additively with hero buff
    if (this._auraBuff > 0) speed *= (1 + this._auraBuff);
    return speed;
  }

  private _findTarget(): void {
    // Aura towers don't attack
    if (this.data.auraRadius > 0) { this._target = null; return; }

    const r2 = this.data.range * this.data.range;
    const candidates = this._activeEnemiesFn().filter(e => {
      if (!e.isActive || e.isDead) return false;
      if (e.def.isFlying  && !this.data.canTargetAir)    return false;
      if (!e.def.isFlying && !this.data.canTargetGround)  return false;
      // Phase 3: invisible enemies require canDetectInvisible
      if (e.def.isInvisible && !this.data.canDetectInvisible) return false;
      const dx = e.x - this.x, dy = e.y - this.y;
      return dx * dx + dy * dy <= r2;
    });
    if (candidates.length===0) { this._target=null; return; }
    if (this._target?.isActive&&!this._target.isDead&&candidates.includes(this._target)) return;
    this._target=this._pickTarget(candidates);
  }

  private _pickTarget(list: Enemy[]): Enemy {
    const d2=(e:Enemy)=>{const dx=e.x-BASE_CENTER_X,dy=e.y-BASE_CENTER_Y;return dx*dx+dy*dy;};
    switch (this.targetPriority) {
      case TargetPriority.FIRST:     return list.reduce((a,b)=>d2(b)<d2(a)?b:a);
      case TargetPriority.LAST:      return list.reduce((a,b)=>d2(b)>d2(a)?b:a);
      case TargetPriority.STRONGEST: return list.reduce((a,b)=>b.hp>a.hp?b:a);
      case TargetPriority.WEAKEST:   return list.reduce((a,b)=>b.hp<a.hp?b:a);
      case TargetPriority.NEAREST:   return list.reduce((a,b)=>Math.hypot(b.x-this.x,b.y-this.y)<Math.hypot(a.x-this.x,a.y-this.y)?b:a);
    }
  }

  private _fire(): void {
    if (!this._target||!this._target.isActive||this._target.isDead) { this._target=null; return; }
    const specials = this.data.special;
    const id       = this.towerId;
    const proj     = this._projPool.get();

    // Track damage + kills; also apply status effects
    proj.onEnemyHit = (e: Enemy) => {
      this.totalDamageDealt += this.data.damage;
      if (e.isDead) this.totalKills++;

      for (const sp of specials) {
        if (sp.type === 'aoe_slow') {
          // Apply slow to all enemies within radius of hit target
          const aoeR2 = (sp.radius ?? 50) * (sp.radius ?? 50);
          for (const ae of this._activeEnemiesFn()) {
            if (!ae.isActive || ae.isDead) continue;
            const dx = ae.x - e.x, dy = ae.y - e.y;
            if (dx * dx + dy * dy <= aoeR2) {
              ae.applyEffect({ type: 'slow', value: sp.value, duration: sp.duration, sourceId: id + '_aoe' });
            }
          }
        } else {
          e.applyEffect({ type: sp.type as any, value: sp.value, duration: sp.duration, sourceId: id });
        }
      }
    };

    proj.init(this.x, this.y, this._target, this.data.damage, this.data.damageType,
              this.data.splash, this.data.color, this._activeEnemiesFn(), 320);
    EventBus.emit(GameEvents.TOWER_SHOT, this.towerId);
  }

  // ── Batch draw ─────────────────────────────────────────────────────────────
  drawTo(g: Phaser.GameObjects.Graphics): void {
    const cx = this.x, cy = this.y, c = this.data.color;

    const bounce = this._spawnTimer > 0
      ? 1 + 0.18 * Math.sin((this._spawnTimer / 0.25) * Math.PI)
      : 1;
    const h = (BODY_SIZE / 2) * bounce;

    // ── Foundation plate — every tower gets a stone base ─────────────────
    g.fillStyle(0x1A1410, 0.75);
    g.fillRoundedRect(cx - h - 3, cy - h - 3, (h + 3) * 2, (h + 3) * 2, 3);
    g.lineStyle(1, 0x2E2418, 0.6);
    g.strokeRoundedRect(cx - h - 3, cy - h - 3, (h + 3) * 2, (h + 3) * 2, 3);

    // Aura buff glow ring
    if (this.isAuraBoosted) {
      g.lineStyle(2, COLORS.amberGlow, 0.55);
      g.strokeCircle(cx, cy, h + 7);
    }
    // Hero buff ring
    if (this.isBuffed && !this.isAuraBoosted) {
      g.lineStyle(2, COLORS.amberBright, 0.70);
      g.strokeRoundedRect(cx - h - 5, cy - h - 5, (h + 5) * 2, (h + 5) * 2, 4);
    }

    switch (this.towerId) {

      // ── Arrow T1 / T2 — fortified tower with arrow slits ────────────────
      case 'arrow_t1': case 'arrow_t2': {
        const isT2 = this.towerId === 'arrow_t2';
        // Tower body
        g.fillStyle(c, 0.92); g.fillRoundedRect(cx - h, cy - h, h * 2, h * 2, 3);
        // Inner dark chamber
        g.fillStyle(0x0A0806, 0.35); g.fillRect(cx - h + 4, cy - h + 4, h * 2 - 8, h * 2 - 8);
        // Top-left sheen
        g.fillStyle(0xFFFFFF, 0.06); g.fillRoundedRect(cx - h + 1, cy - h + 1, h * 2 - 2, h - 2, 2);
        // Border
        g.lineStyle(isT2 ? 2 : 1.5, isT2 ? COLORS.amberBright : COLORS.amberWarm, 0.80);
        g.strokeRoundedRect(cx - h, cy - h, h * 2, h * 2, 3);
        // Corner battlements
        const bs = 4;
        for (const [dx, dy] of [[-h, -h], [h - bs, -h], [-h, h - bs], [h - bs, h - bs]]) {
          g.fillStyle(c, 1); g.fillRect(cx + dx, cy + dy, bs, bs);
          g.lineStyle(1, isT2 ? COLORS.amberBright : COLORS.amberDeep, 0.7);
          g.strokeRect(cx + dx, cy + dy, bs, bs);
        }
        // Barrel
        const barLen = isT2 ? h + 7 : h + 5;
        g.fillStyle(COLORS.walnutDark, 0.90); g.fillRect(cx - 2, cy - h - barLen + 2, 4, barLen);
        g.lineStyle(1, COLORS.amberDeep, 0.55); g.strokeRect(cx - 2, cy - h - barLen + 2, 4, barLen);
        // Muzzle flash ring when recently fired (reuse _spawnTimer approach — simplified)
        if (isT2) { g.fillStyle(COLORS.amberGlow, 0.20); g.fillCircle(cx, cy, h - 2); }
        break;
      }

      // ── Cannon T1 / T2 — squat siege tower ──────────────────────────────
      case 'cannon_t1': case 'cannon_t2': {
        const isT2 = this.towerId === 'cannon_t2';
        // Octagonal base
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i < 8; i++) { const a = Phaser.Math.DegToRad(22.5 + i * 45); pts.push({ x: cx + Math.cos(a) * h, y: cy + Math.sin(a) * h }); }
        g.fillStyle(c, 0.90); g.fillPoints(pts, true);
        // Inner ring
        const pts2: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i < 8; i++) { const a = Phaser.Math.DegToRad(22.5 + i * 45); pts2.push({ x: cx + Math.cos(a) * (h - 4), y: cy + Math.sin(a) * (h - 4) }); }
        g.fillStyle(0x0A0806, 0.30); g.fillPoints(pts2, true);
        // Border
        g.lineStyle(isT2 ? 2 : 1.5, isT2 ? COLORS.dangerSoft : COLORS.walnutLight, 0.75); g.strokePoints(pts, true);
        // Centre dome
        g.fillStyle(isT2 ? COLORS.dangerSoft : COLORS.walnutLight, 0.5); g.fillCircle(cx, cy, 5);
        // Barrel
        g.fillStyle(COLORS.walnutDark, 1); g.fillRect(cx - 3, cy - h - 7, 6, 10);
        g.lineStyle(1, COLORS.walnutLight, 0.5); g.strokeRect(cx - 3, cy - h - 7, 6, 10);
        if (isT2) { g.lineStyle(1.5, COLORS.dangerSoft, 0.40); g.strokeCircle(cx, cy, h + 4); }
        break;
      }

      // ── Magic T1 / T2 — arcane crystal spire ────────────────────────────
      case 'magic_t1': case 'magic_t2': {
        const isT2 = this.towerId === 'magic_t2';
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i < 6; i++) { const a = Phaser.Math.DegToRad(i * 60); pts.push({ x: cx + Math.cos(a) * h, y: cy + Math.sin(a) * h }); }
        g.fillStyle(c, 0.88); g.fillPoints(pts, true);
        g.fillStyle(0xFFFFFF, 0.07); // top facet sheen
        const sheen = pts.slice(0, 3);
        g.fillPoints(sheen, true);
        g.lineStyle(isT2 ? 2 : 1.5, isT2 ? COLORS.amberBright : COLORS.amberGlow, 0.80); g.strokePoints(pts, true);
        // Floating crystal core
        const coreR = isT2 ? 6 : 4;
        g.fillStyle(isT2 ? COLORS.amberGlow : COLORS.amberWarm, 0.95); g.fillCircle(cx, cy, coreR);
        g.fillStyle(0xFFFFFF, 0.35); g.fillCircle(cx - 1, cy - 1, coreR * 0.4);
        // Glow halo
        g.lineStyle(isT2 ? 3 : 2, c, 0.25); g.strokeCircle(cx, cy, h + 3);
        break;
      }

      // ── Slow T1 / T2 — cryo windmill ────────────────────────────────────
      case 'slow_t1': case 'slow_t2': {
        const isT2 = this.towerId === 'slow_t2';
        // Base disc
        g.fillStyle(c, isT2 ? 0.85 : 0.72); g.fillCircle(cx, cy, h);
        // Inner ring detail
        g.fillStyle(0x7EC8E3, 0.12); g.fillCircle(cx, cy, h - 3);
        g.lineStyle(isT2 ? 2.5 : 1.5, COLORS.seaDark, 0.85); g.strokeCircle(cx, cy, h);
        // Blades — 4 swept arcs
        for (let i = 0; i < 4; i++) {
          const a  = this._bladesAngle + Phaser.Math.DegToRad(i * 90);
          const bx2 = cx + Math.cos(a) * (h - 2);
          const by2 = cy + Math.sin(a) * (h - 2);
          const pa = a + Math.PI / 2;
          const bladeW = isT2 ? 2.5 : 2;
          const bladeL = isT2 ? 7 : 5.5;
          const pts = [
            { x: bx2 + Math.cos(pa) * bladeW, y: by2 + Math.sin(pa) * bladeW },
            { x: bx2 + Math.cos(a) * bladeL,  y: by2 + Math.sin(a) * bladeL  },
            { x: bx2 - Math.cos(pa) * bladeW, y: by2 - Math.sin(pa) * bladeW },
            { x: bx2 - Math.cos(a) * (bladeL * 0.5), y: by2 - Math.sin(a) * (bladeL * 0.5) },
          ] as Phaser.Types.Math.Vector2Like[];
          g.fillStyle(isT2 ? 0xAADDFF : COLORS.seaLight, 0.92); g.fillPoints(pts, true);
          g.lineStyle(1, isT2 ? 0x88BBDD : COLORS.seaDark, 0.6); g.strokePoints(pts, true);
        }
        // Hub
        g.fillStyle(COLORS.seaDark, 1); g.fillCircle(cx, cy, isT2 ? 5 : 4);
        g.fillStyle(0xBBEEFF, 0.6); g.fillCircle(cx, cy, isT2 ? 2.5 : 2);
        if (isT2) { g.lineStyle(1, 0x7EC8E3, 0.30); g.strokeCircle(cx, cy, h + 5); }
        break;
      }
    }

    // Note: range circle is drawn by the dedicated _rangeCircle Phaser Graphics object
  }

  destroy(): void {
    this._rangeCircle.destroy();
  }

  sellValue(refundRate: number): number { return Math.floor(this.totalInvested * refundRate); }
}
