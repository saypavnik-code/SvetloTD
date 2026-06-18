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

  // Active buffs (from hero skill W)
  private _buffs: TowerBuff[] = [];
  private _auraBuff = 0; // set by AuraSystem each second

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
    if (this.towerId === 'slow_t1') this._bladesAngle += gd * 0.003;
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

  get isBuffed(): boolean { return this._buffs.length > 0 || this._auraBuff > 0; }

  // ── Aura API (called by AuraSystem 1×/sec) ─────────────────────────────────
  clearAuraBuff(): void  { this._auraBuff = 0; }
  applyAuraBuff(v: number): void { this._auraBuff = Math.max(this._auraBuff, v); }
  get isAuraBoosted(): boolean { return this._auraBuff > 0; }

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
    if (this._auraBuff > 0) speed *= (1 + this._auraBuff);
    return speed;
  }

  private _findTarget(): void {
    const r2 = this.data.range * this.data.range;
    const candidates = this._activeEnemiesFn().filter(e => {
      if (!e.isActive||e.isDead) return false;
      if (e.def.isFlying&&!this.data.canTargetAir)   return false;
      if (!e.def.isFlying&&!this.data.canTargetGround) return false;
      const dx=e.x-this.x, dy=e.y-this.y;
      return dx*dx+dy*dy<=r2;
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
      // Damage dealt is calculated inside Enemy.takeDamage; we approximate from base
      // For splash, this fires per-enemy hit — accurate aggregate tracking
      this.totalDamageDealt += this.data.damage;
      if (e.isDead) this.totalKills++;

      for (const sp of specials) {
        e.applyEffect({ type: sp.type, value: sp.value, duration: sp.duration, sourceId: id });
      }
    };

    proj.init(this.x, this.y, this._target, this.data.damage, this.data.damageType,
              this.data.splash, this.data.color, this._activeEnemiesFn(), 320);
    EventBus.emit(GameEvents.TOWER_SHOT, this.towerId);
  }

  // ── Batch draw ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  // drawTo — 2027-quality vector models. Each tower has:
  //   • Stone foundation plate with bevel shadow
  //   • Unique silhouette per type (not just rectangles)
  //   • T2 variants are visibly more imposing
  //   • Buff rings (hero W = amber glow, aura = teal ring)
  //   • Spawn-bounce scale animation
  // ══════════════════════════════════════════════════════════════════════════
  drawTo(g: Phaser.GameObjects.Graphics): void {
    const cx = this.x, cy = this.y, c = this.data.color;
    const bounce = this._spawnTimer > 0
      ? 1 + 0.20 * Math.sin((this._spawnTimer / 0.25) * Math.PI) : 1;
    const h = (BODY_SIZE / 2) * bounce;
    const t2 = this.towerId.endsWith('_t2');

    // ── Foundation plate — stone square under every tower ──────────────────
    const fp = h + 4;
    g.fillStyle(0x18140F, 0.82); g.fillRoundedRect(cx-fp, cy-fp, fp*2, fp*2, 3);
    g.lineStyle(1, 0x2E2418, 0.55);
    g.beginPath(); g.moveTo(cx-fp, cy+fp); g.lineTo(cx-fp, cy-fp); g.lineTo(cx+fp, cy-fp); g.strokePath();
    g.lineStyle(1, 0x0A0806, 0.70);
    g.beginPath(); g.moveTo(cx+fp, cy-fp); g.lineTo(cx+fp, cy+fp); g.lineTo(cx-fp, cy+fp); g.strokePath();

    // ── Buff rings ──────────────────────────────────────────────────────────
    if (this.isAuraBoosted) {
      g.lineStyle(2.5, 0x44CCAA, 0.60); g.strokeCircle(cx, cy, h + 7);
      g.lineStyle(1.0, 0x88FFDD, 0.20); g.strokeCircle(cx, cy, h + 10);
    }
    if (this.isBuffed && !this.isAuraBoosted) {
      g.lineStyle(2.5, COLORS.amberGlow, 0.75); g.strokeCircle(cx, cy, h + 7);
      g.lineStyle(1.0, COLORS.amberBright, 0.25); g.strokeCircle(cx, cy, h + 11);
    }

    // ── Per-tower models ────────────────────────────────────────────────────
    switch (this.towerId) {

      // Arrow T1: compact square keep with a single forward barrel
      case 'arrow_t1': {
        // Tower body
        g.fillStyle(c, 0.90); g.fillRoundedRect(cx-h, cy-h, h*2, h*2, 2);
        // Inner dark chamber
        g.fillStyle(0x0A0806, 0.32); g.fillRect(cx-h+4, cy-h+4, h*2-8, h*2-8);
        // Top-left sheen
        g.fillStyle(0xFFFFFF, 0.07); g.fillRoundedRect(cx-h+1, cy-h+1, h*2-2, h-2, 1);
        // Border
        g.lineStyle(1.5, COLORS.amberDeep, 0.70); g.strokeRoundedRect(cx-h, cy-h, h*2, h*2, 2);
        // Corner merlons
        for (const [dx,dy] of [[-h,-h],[h-5,-h],[-h,h-5],[h-5,h-5]] as [number,number][]) {
          g.fillStyle(c, 1); g.fillRect(cx+dx, cy+dy, 5, 5);
          g.lineStyle(1, COLORS.amberDeep, 0.6); g.strokeRect(cx+dx, cy+dy, 5, 5);
        }
        // Barrel — points up
        g.fillStyle(0x2A2018, 1); g.fillRoundedRect(cx-2.5, cy-h-7, 5, 10, 1);
        g.lineStyle(1, 0x5A4A28, 0.6); g.strokeRoundedRect(cx-2.5, cy-h-7, 5, 10, 1);
        // Muzzle ring
        g.lineStyle(1.5, COLORS.amberDeep, 0.50); g.strokeCircle(cx, cy-h-7, 3.5);
        break;
      }

      // Arrow T2: taller keep, double barrel, gold trim
      case 'arrow_t2': {
        const th = h * 1.05;
        g.fillStyle(c, 0.95); g.fillRoundedRect(cx-th, cy-th, th*2, th*2, 2);
        g.fillStyle(0x0A0806, 0.28); g.fillRect(cx-th+4, cy-th+4, th*2-8, th*2-8);
        g.fillStyle(0xFFFFFF, 0.08); g.fillRoundedRect(cx-th+1, cy-th+1, th*2-2, th-2, 1);
        g.lineStyle(2, COLORS.amberBright, 0.85); g.strokeRoundedRect(cx-th, cy-th, th*2, th*2, 2);
        // Gold stripe
        g.lineStyle(1.5, COLORS.amberGlow, 0.40); g.beginPath(); g.moveTo(cx-th, cy); g.lineTo(cx+th, cy); g.strokePath();
        for (const [dx,dy] of [[-th,-th],[th-6,-th],[-th,th-6],[th-6,th-6]] as [number,number][]) {
          g.fillStyle(COLORS.amberBright, 1); g.fillRect(cx+dx, cy+dy, 6, 6);
        }
        // Twin barrels
        for (const bx of [-4, 4]) {
          g.fillStyle(0x2A2018, 1); g.fillRoundedRect(cx+bx-2, cy-th-9, 4, 12, 1);
          g.lineStyle(1, COLORS.amberGlow, 0.55); g.strokeRoundedRect(cx+bx-2, cy-th-9, 4, 12, 1);
        }
        // Star gem centre
        g.fillStyle(COLORS.amberBright, 0.9); g.fillCircle(cx, cy, 4);
        g.fillStyle(0xFFFFFF, 0.5); g.fillCircle(cx-1, cy-1, 1.5);
        break;
      }

      // Cannon T1: heavy octagonal siege tower, short wide barrel
      case 'cannon_t1': {
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i=0;i<8;i++){const a=Phaser.Math.DegToRad(22.5+i*45); pts.push({x:cx+Math.cos(a)*h, y:cy+Math.sin(a)*h});}
        g.fillStyle(c, 0.88); g.fillPoints(pts, true);
        g.fillStyle(0x0A0806, 0.30); g.fillCircle(cx, cy, h-5);
        g.lineStyle(2, COLORS.walnutLight, 0.65); g.strokePoints(pts, true);
        // Bolt lines
        g.lineStyle(1, 0x2A2018, 0.40);
        for (let i=0;i<4;i++){const a=Phaser.Math.DegToRad(i*90);g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*(h-2),cy+Math.sin(a)*(h-2));g.strokePath();}
        // Barrel (short, wide, pointing up)
        g.fillStyle(0x1A1410, 1); g.fillRoundedRect(cx-4, cy-h-7, 8, 11, 2);
        g.lineStyle(1.5, COLORS.walnutLight, 0.50); g.strokeRoundedRect(cx-4, cy-h-7, 8, 11, 2);
        g.fillStyle(0x0A0806, 1); g.fillCircle(cx, cy-h-7, 3.5);
        break;
      }

      // Cannon T2: massive siege platform, red-hot barrel, blast ring
      case 'cannon_t2': {
        const th = h * 1.06;
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i=0;i<8;i++){const a=Phaser.Math.DegToRad(22.5+i*45); pts.push({x:cx+Math.cos(a)*th, y:cy+Math.sin(a)*th});}
        g.fillStyle(c, 0.92); g.fillPoints(pts, true);
        g.fillStyle(0x0A0806, 0.25); g.fillCircle(cx, cy, th-5);
        g.lineStyle(2.5, COLORS.dangerSoft, 0.75); g.strokePoints(pts, true);
        g.lineStyle(1, COLORS.danger, 0.25); g.strokeCircle(cx, cy, th+4); // blast ring
        for (let i=0;i<4;i++){const a=Phaser.Math.DegToRad(i*90);g.lineStyle(1.5,0x2A2018,0.35);g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*(th-2),cy+Math.sin(a)*(th-2));g.strokePath();}
        // Hot barrel (red tip)
        g.fillStyle(0x2A1810, 1); g.fillRoundedRect(cx-5, cy-th-9, 10, 14, 2);
        g.lineStyle(1.5, COLORS.danger, 0.65); g.strokeRoundedRect(cx-5, cy-th-9, 10, 14, 2);
        g.fillStyle(COLORS.danger, 0.85); g.fillCircle(cx, cy-th-9, 4);
        g.fillStyle(0xFF8866, 0.60); g.fillCircle(cx, cy-th-9, 2);
        // Centre core
        g.fillStyle(COLORS.dangerSoft, 0.7); g.fillCircle(cx, cy, 5);
        g.fillStyle(0xFFAAAA, 0.4); g.fillCircle(cx-1, cy-1, 2);
        break;
      }

      // Magic T1: arcane crystal hexagon spire
      case 'magic_t1': {
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i=0;i<6;i++){const a=Phaser.Math.DegToRad(i*60); pts.push({x:cx+Math.cos(a)*h, y:cy+Math.sin(a)*h});}
        g.fillStyle(c, 0.88); g.fillPoints(pts, true);
        // Facet sheen (top-left 3 vertices)
        const sheen = pts.slice(0, 3);
        g.fillStyle(0xFFFFFF, 0.09); g.fillPoints(sheen, true);
        g.lineStyle(1.5, COLORS.amberGlow, 0.75); g.strokePoints(pts, true);
        // Floating crystal core — pulsing
        g.fillStyle(COLORS.amberGlow, 0.95); g.fillCircle(cx, cy, 5);
        g.fillStyle(0xFFFFFF, 0.50); g.fillCircle(cx-1, cy-1, 2);
        // Energy spire on top
        g.lineStyle(1.5, COLORS.amberDeep, 0.55);
        g.beginPath(); g.moveTo(cx, cy-h); g.lineTo(cx, cy-h-8); g.strokePath();
        g.fillStyle(COLORS.amberWarm, 0.85); g.fillCircle(cx, cy-h-8, 2.5);
        break;
      }

      // Magic T2: chaos crystal — gold, larger, double spire, glow halo
      case 'magic_t2': {
        const th = h * 1.05;
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i=0;i<6;i++){const a=Phaser.Math.DegToRad(i*60); pts.push({x:cx+Math.cos(a)*th, y:cy+Math.sin(a)*th});}
        // Outer glow
        g.lineStyle(4, c, 0.18); g.strokePoints(pts, true);
        g.fillStyle(c, 0.92); g.fillPoints(pts, true);
        g.fillStyle(0xFFFFFF, 0.08); g.fillPoints(pts.slice(0, 3), true);
        g.lineStyle(2, COLORS.amberBright, 0.88); g.strokePoints(pts, true);
        // Chaos rune — inner triangle
        const inner: Phaser.Types.Math.Vector2Like[] = [];
        for (let i=0;i<3;i++){const a=Phaser.Math.DegToRad(30+i*120); inner.push({x:cx+Math.cos(a)*(th*0.4), y:cy+Math.sin(a)*(th*0.4)});}
        g.lineStyle(1, COLORS.amberGlow, 0.35); g.strokePoints(inner, true);
        // Twin spires
        for (const bx of [-4, 4]) {
          g.lineStyle(1.5, COLORS.amberGlow, 0.60);
          g.beginPath(); g.moveTo(cx+bx, cy-th); g.lineTo(cx+bx, cy-th-10); g.strokePath();
          g.fillStyle(COLORS.amberBright, 0.90); g.fillCircle(cx+bx, cy-th-10, 3);
          g.fillStyle(0xFFFFFF, 0.55); g.fillCircle(cx+bx-0.5, cy-th-11, 1.2);
        }
        // Pulsing chaos core
        g.fillStyle(COLORS.amberBright, 1); g.fillCircle(cx, cy, 6);
        g.fillStyle(0xFFFFFF, 0.65); g.fillCircle(cx-1, cy-1, 2.5);
        break;
      }

      // Slow T1: cryo windmill — icy disc with 4 swept blades
      case 'slow_t1': {
        g.fillStyle(c, 0.72); g.fillCircle(cx, cy, h);
        g.fillStyle(0x88CCDD, 0.10); g.fillCircle(cx, cy, h-3);
        g.lineStyle(2, COLORS.seaDark, 0.80); g.strokeCircle(cx, cy, h);
        // Ice ring detail
        g.lineStyle(1, 0x7EC8E3, 0.22); g.strokeCircle(cx, cy, h-4);
        // 4 swept blades
        for (let i=0;i<4;i++){
          const a = this._bladesAngle + Phaser.Math.DegToRad(i*90);
          const bx = cx+Math.cos(a)*(h-2), by2 = cy+Math.sin(a)*(h-2);
          const pa = a+Math.PI/2;
          const pts: Phaser.Types.Math.Vector2Like[] = [
            {x:bx+Math.cos(pa)*2.5, y:by2+Math.sin(pa)*2.5},
            {x:bx+Math.cos(a)*7,    y:by2+Math.sin(a)*7},
            {x:bx-Math.cos(pa)*2.5, y:by2-Math.sin(pa)*2.5},
            {x:bx-Math.cos(a)*3,    y:by2-Math.sin(a)*3},
          ];
          g.fillStyle(COLORS.seaLight, 0.90); g.fillPoints(pts, true);
          g.lineStyle(1, COLORS.seaDark, 0.55); g.strokePoints(pts, true);
        }
        // Hub + gem
        g.fillStyle(COLORS.seaDark, 1); g.fillCircle(cx, cy, 4);
        g.fillStyle(0xBBEEFF, 0.8); g.fillCircle(cx, cy, 2);
        break;
      }

      // Slow T2: ice fortress — larger, AoE ring indicator, blue-white blades
      case 'slow_t2': {
        g.fillStyle(0x7EC8E3, 0.85); g.fillCircle(cx, cy, h);
        g.fillStyle(0xAADDFF, 0.15); g.fillCircle(cx, cy, h-3);
        g.lineStyle(2.5, COLORS.seaDark, 0.88); g.strokeCircle(cx, cy, h);
        g.lineStyle(1, 0x7EC8E3, 0.35); g.strokeCircle(cx, cy, h+5); // AoE hint
        for (let i=0;i<4;i++){
          const a = this._bladesAngle + Phaser.Math.DegToRad(i*90);
          const bx = cx+Math.cos(a)*(h-1), by2 = cy+Math.sin(a)*(h-1);
          const pa = a+Math.PI/2;
          const pts: Phaser.Types.Math.Vector2Like[] = [
            {x:bx+Math.cos(pa)*3, y:by2+Math.sin(pa)*3},
            {x:bx+Math.cos(a)*9,  y:by2+Math.sin(a)*9},
            {x:bx-Math.cos(pa)*3, y:by2-Math.sin(pa)*3},
            {x:bx-Math.cos(a)*4,  y:by2-Math.sin(a)*4},
          ];
          g.fillStyle(0xAADDFF, 0.92); g.fillPoints(pts, true);
          g.lineStyle(1, 0x5599BB, 0.65); g.strokePoints(pts, true);
        }
        g.fillStyle(0x2A4A5A, 1); g.fillCircle(cx, cy, 5);
        g.fillStyle(0xCCEEFF, 0.9); g.fillCircle(cx, cy, 2.5);
        break;
      }

      // Acid T1: alchemist diamond — poison green, drip effect
      case 'acid_t1': {
        const pts: Phaser.Types.Math.Vector2Like[] = [
          {x:cx, y:cy-h*1.25}, {x:cx+h, y:cy}, {x:cx, y:cy+h*0.9}, {x:cx-h, y:cy}
        ];
        g.fillStyle(c, 0.88); g.fillPoints(pts, true);
        // Top facet sheen
        g.fillStyle(0xFFFFFF, 0.07); g.fillPoints([pts[0], pts[1], {x:cx, y:cy-h*0.2}] as Phaser.Types.Math.Vector2Like[], true);
        g.lineStyle(1.5, 0x6B8E6B, 0.80); g.strokePoints(pts, true);
        // Acid glow core
        g.fillStyle(0x88BB44, 0.50); g.fillCircle(cx, cy, 4);
        g.fillStyle(0xBBFF88, 0.35); g.fillCircle(cx, cy, 2);
        // Poison drip drops
        g.fillStyle(0x55AA22, 0.60); g.fillCircle(cx-2, cy+h*0.75, 2);
        g.fillStyle(0x55AA22, 0.40); g.fillCircle(cx+3, cy+h*0.85, 1.5);
        break;
      }

      // Watchtower: aura support — flag pole with pulsing detection ring
      case 'watchtower': {
        const auraT   = (Date.now() % 2400) / 2400;
        const pulseA  = 0.055 + 0.045 * Math.sin(auraT * Math.PI * 2);
        const pulse2  = 0.028 + 0.022 * Math.sin(auraT * Math.PI * 2 + 1.6);
        // Dual aura rings
        g.fillStyle(c, pulseA); g.fillCircle(cx, cy, this.data.auraRadius);
        g.lineStyle(1.5, c, 0.25 + 0.18 * Math.sin(auraT * Math.PI * 2)); g.strokeCircle(cx, cy, this.data.auraRadius);
        g.fillStyle(c, pulse2); g.fillCircle(cx, cy, this.data.auraRadius * 0.62);
        g.lineStyle(1, c, 0.15); g.strokeCircle(cx, cy, this.data.auraRadius * 0.62);
        // Stone base column
        g.fillStyle(0x2A2018, 0.92); g.fillRoundedRect(cx-5, cy-h, 10, h*2, 2);
        g.lineStyle(1, COLORS.amberDeep, 0.45); g.strokeRoundedRect(cx-5, cy-h, 10, h*2, 2);
        // Bevel highlight
        g.lineStyle(1, 0x5A4A28, 0.30);
        g.beginPath(); g.moveTo(cx-5, cy+h); g.lineTo(cx-5, cy-h); g.lineTo(cx+5, cy-h); g.strokePath();
        // Silk flag
        g.fillStyle(c, 1); g.fillTriangle(cx+5, cy-h, cx+5+14, cy-h+5, cx+5, cy-h+11);
        g.lineStyle(1, COLORS.amberGlow, 0.65);
        g.beginPath(); g.moveTo(cx+5,cy-h); g.lineTo(cx+19,cy-h+5); g.lineTo(cx+5,cy-h+11); g.strokePath();
        // Cap orb
        g.fillStyle(COLORS.amberGlow, 0.95); g.fillCircle(cx, cy-h, 3.5);
        g.fillStyle(0xFFFFFF, 0.55); g.fillCircle(cx-0.7, cy-h-0.7, 1.4);
        break;
      }
    }
  }


  destroy(): void {
    this._rangeCircle.destroy();
  }

  sellValue(refundRate: number): number { return Math.floor(this.totalInvested * refundRate); }
}