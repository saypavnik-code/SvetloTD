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

  get isBuffed(): boolean { return this._buffs.length > 0; }

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
  drawTo(g: Phaser.GameObjects.Graphics): void {
    const cx=this.x, cy=this.y, c=this.data.color;

    // Spawn bounce — scale coordinates around tower center
    const bounce = this._spawnTimer > 0
      ? 1 + 0.18 * Math.sin((this._spawnTimer / 0.25) * Math.PI)
      : 1;
    const h = (BODY_SIZE / 2) * bounce;

    // Amber base plate
    g.fillStyle(COLORS.amberDeep, 0.20); g.fillRect(cx-h-2, cy-h-2, (BODY_SIZE+4)*bounce, (BODY_SIZE+4)*bounce);

    // Buff glow — amber ring when hero W is active
    if (this.isBuffed) {
      g.lineStyle(2, COLORS.amberGlow, 0.70);
      g.strokeRect(cx - h - 4, cy - h - 4, h*2 + 8, h*2 + 8);
    }

    switch (this.towerId) {
      case 'arrow_t1': case 'arrow_t2':
        g.fillStyle(c,0.9); g.fillRect(cx-h,cy-h,h*2,h*2);
        g.fillStyle(COLORS.walnutDark,0.45); g.fillRect(cx-h+4,cy-h+4,h*2-8,h*2-8);
        [[-h,-h],[h,-h],[-h,h],[h,h]].forEach(([dx,dy])=>{g.fillStyle(c,1);g.fillRect(cx+dx-3,cy+dy-3,6,6);});
        g.fillStyle(COLORS.walnutDark,0.8); g.fillRect(cx-2,cy-h-4,4,8);
        break;
      case 'cannon_t1': case 'cannon_t2':
        g.fillStyle(c,0.85); g.fillRect(cx-h,cy-h,h*2,h*2);
        g.fillStyle(COLORS.walnutDark,0.4); g.fillCircle(cx,cy,h-4);
        g.lineStyle(2,COLORS.walnutDark,0.7); g.strokeRect(cx-h,cy-h,h*2,h*2);
        g.fillStyle(COLORS.walnutDark,1); g.fillRect(cx-3,cy-h-6,6,10);
        break;
      case 'magic_t1': case 'magic_t2': {
        const pts:Phaser.Types.Math.Vector2Like[]=[];
        for(let i=0;i<6;i++){const a=Phaser.Math.DegToRad(i*60);pts.push({x:cx+Math.cos(a)*h,y:cy+Math.sin(a)*h});}
        g.fillStyle(c,0.9); g.fillPoints(pts,true);
        g.lineStyle(1.5,COLORS.amberBright,0.6); g.strokePoints(pts,true);
        g.fillStyle(COLORS.amberGlow,0.9); g.fillCircle(cx,cy,5);
        break;
      }
      case 'slow_t1':
        g.fillStyle(c,0.7); g.fillCircle(cx,cy,h);
        g.lineStyle(1.5,COLORS.seaDark,0.8); g.strokeCircle(cx,cy,h);
        for(let i=0;i<4;i++){
          const a=this._bladesAngle+Phaser.Math.DegToRad(i*90);
          const bx=cx+Math.cos(a)*12, by=cy+Math.sin(a)*12;
          const pa=a+Math.PI/2;
          const pts=[{x:bx+Math.cos(pa)*2,y:by+Math.sin(pa)*2},{x:bx+Math.cos(a)*6,y:by+Math.sin(a)*6},{x:bx-Math.cos(pa)*2,y:by-Math.sin(pa)*2},{x:bx-Math.cos(a)*3,y:by-Math.sin(a)*3}] as Phaser.Types.Math.Vector2Like[];
          g.fillStyle(COLORS.seaLight,0.9); g.fillPoints(pts,true);
        }
        g.fillStyle(COLORS.seaDark,1); g.fillCircle(cx,cy,4);
        break;
      case 'acid_t1': {
        const pts:Phaser.Types.Math.Vector2Like[]=[{x:cx,y:cy-h},{x:cx+h,y:cy},{x:cx,y:cy+h},{x:cx-h,y:cy}];
        g.fillStyle(c,0.85); g.fillPoints(pts,true);
        g.lineStyle(1.5,COLORS.success,0.6); g.strokePoints(pts,true);
        g.fillStyle(COLORS.successSoft,0.8); g.fillCircle(cx,cy-h+5,4);
        break;
      }
      default:
        g.fillStyle(c,0.88); g.fillRect(cx-h,cy-h,h*2,h*2);
    }
  }

  destroy(): void {
    this._rangeCircle.destroy();
  }

  get sellValue(): number { return Math.floor(this.totalInvested * 0.7); }
}
