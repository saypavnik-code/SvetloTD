// Enemy.ts — Stage 8. Pure TS class (no Phaser Container).
// Batch-rendered via enemyGfx / healthbarGfx in GameScene.

import Phaser from 'phaser';
import { type EnemyDef, type EnemyId, ENEMY_DEFS } from '../data/enemies';
import { type Waypoint } from '../data/pathData';
import { BASE_CENTER_X, BASE_CENTER_Y } from '../data/mapData';
import { EventBus, GameEvents } from '../utils/EventBus';
import { type Poolable } from '../utils/ObjectPool';
import { COLORS } from '../config';
import { type DamageType } from '../data/towers';
import { StatusEffectSystem, type StatusEffect } from '../systems/StatusEffectSystem';
import { dmgCalc } from '../systems/DamageCalculator';

export type { DamageType };

export interface EnemySpawnOptions {
  hpMult?:    number;
  speedMult?: number;
  isHealing?: boolean;
}

export class Enemy implements Poolable {
  // Pool / lifecycle
  isActive = false;
  private _isDead = false;
  get isDead(): boolean { return this._isDead; }

  // Dying animation — brief scale-down + flash before pool return
  private _isDying    = false;
  private _dyingTimer = 0;
  private static readonly DYING_DURATION = 0.28;   // seconds

  // World position (read by Tower, Projectile, GameScene)
  x = 0;
  y = 0;

  // Stats
  def!: EnemyDef;
  hp    = 0;
  maxHp = 0;
  get radius(): number { return this.def?.radius ?? 8; }

  readonly fx = new StatusEffectSystem();

  // Movement
  private _baseSpeed  = 0;
  private _speed      = 0;
  private _isFlying   = false;
  private _targetX    = 0;
  private _targetY    = 0;
  private _waypoints: Waypoint[] = [];
  private _wpIndex    = 0;
  private _angle      = 0;  // radians, wyvern facing

  // Visual state
  private _flashTimer = 0;   // ms — white-hit flash
  private _bossGlowT  = 0;
  private _isHealing  = false;
  private _healAcc    = 0;

  // No Phaser scene dependency — pure data class
  constructor() {}

  // ── Init ──────────────────────────────────────────────────────────────────
  init(enemyId: EnemyId, waypoints: Waypoint[], opts: EnemySpawnOptions = {}): void {
    const def       = ENEMY_DEFS[enemyId];
    this.def        = def;
    this.hp         = Math.round(def.hp * (opts.hpMult ?? 1));
    this.maxHp      = this.hp;
    this._baseSpeed = def.speed * (opts.speedMult ?? 1);
    this._speed     = this._baseSpeed;
    this._isFlying  = def.isFlying;
    this._isHealing = opts.isHealing ?? false;
    this._healAcc   = 0;
    this._isDead    = false;
    this._isDying   = false;
    this._dyingTimer = 0;
    this._bossGlowT = 0;
    this._flashTimer = 0;
    this.isActive   = true;
    this.fx.reset();

    if (this._isFlying) {
      const spawn = waypoints[0];
      this.x = spawn.x; this.y = spawn.y;
      this._targetX = BASE_CENTER_X;
      this._targetY = BASE_CENTER_Y;
      this._angle   = Math.atan2(BASE_CENTER_Y - spawn.y, BASE_CENTER_X - spawn.x);
    } else {
      this._waypoints = waypoints;
      this._wpIndex   = 0;
      this.x = waypoints[0].x;
      this.y = waypoints[0].y;
    }
  }

  // ── Update — dt = GameSpeed-adjusted seconds ───────────────────────────────
  update(dt: number): void {
    // Dying animation — runs even though isDead is true
    if (this._isDying) {
      this._dyingTimer -= dt;
      if (this._dyingTimer <= 0) {
        this._isDying = false;
        this.reset();
      }
      return;
    }

    if (!this.isActive) return;

    const { slowFraction } = this.fx.update(dt * 1000, (dmg, type) => this.takeDamage(dmg, type));
    this._speed = this._baseSpeed * (1 - slowFraction);

    if (this._isHealing && this.hp < this.maxHp) {
      this._healAcc += dt;
      if (this._healAcc >= 1) { this._healAcc -= 1; this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.maxHp * 0.01)); }
    }

    if (this.def.isBoss) this._bossGlowT += dt;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt * 1000;
    }

    if (this._isFlying) {
      const dx = this._targetX - this.x, dy = this._targetY - this.y;
      if (dx !== 0 || dy !== 0) this._angle = Math.atan2(dy, dx);
      this._moveDirect(dt);
    } else {
      this._moveAlongPath(dt);
    }
  }

  private _moveDirect(dt: number): void {
    const dx=this._targetX-this.x, dy=this._targetY-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy), step=this._speed*dt;
    if (dist<=step) { this.x=this._targetX; this.y=this._targetY; this._leak(); }
    else { this.x+=dx/dist*step; this.y+=dy/dist*step; }
  }

  private _moveAlongPath(dt: number): void {
    if (this._wpIndex>=this._waypoints.length) { this._leak(); return; }
    const tgt=this._waypoints[this._wpIndex];
    const dx=tgt.x-this.x, dy=tgt.y-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy), step=this._speed*dt;
    if (dist<=step) {
      this.x=tgt.x; this.y=tgt.y;
      this._wpIndex++;
      if (this._wpIndex>=this._waypoints.length) this._leak();
    } else { this.x+=dx/dist*step; this.y+=dy/dist*step; }
  }

  // ── Damage — Fix C guard ───────────────────────────────────────────────────
  takeDamage(baseDamage: number, damageType: DamageType): boolean {
    if (!this.isActive || this._isDead) return false;
    const armorRed = this.fx.effects.filter(e=>e.type==='armor_reduce').reduce((s,e)=>s+e.value,0);
    const finalDmg = dmgCalc.calculate(baseDamage, damageType, this.def.armorType, armorRed);
    this.hp = Math.max(0, this.hp - finalDmg);
    this._flashTimer = 80;
    if (this.hp <= 0) { this._die(); return true; }
    return false;
  }

  applyEffect(effect: Omit<StatusEffect, 'remaining'>): void {
    if (this._isDead) return;
    this.fx.apply(effect);
  }

  private _die(): void {
    this._isDead = true;
    // Emit immediately so gold/kills register at death, not after animation
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: this, goldReward: this.def.bounty });
    // Start dying animation — actual pool return happens when timer expires
    this._isDying   = true;
    this._dyingTimer = Enemy.DYING_DURATION;
    // Stop movement and effects during animation
    this.fx.reset();
  }

  private _leak(): void {
    if (this._isDead) return;
    this._isDead = true;
    EventBus.emit(GameEvents.ENEMY_REACHED_END, this);
    this.reset();
  }

  reset(): void {
    this.isActive    = false;
    this._isDead     = false;
    this._isDying    = false;
    this._dyingTimer = 0;
    this._waypoints  = [];
    this._wpIndex    = 0;
    this.hp          = 0;
    this._flashTimer = 0;
    this._bossGlowT  = 0;
    this.fx.reset();
  }

  // ── Batch draw ─────────────────────────────────────────────────────────────
  drawTo(g: Phaser.GameObjects.Graphics): void {
    // Dying animation — shrink + white flash, then hidden
    if (this._isDying) {
      const t     = this._dyingTimer / Enemy.DYING_DURATION;
      const scale = t;
      const r     = this.radius * scale;
      if (r < 0.5) return;
      const flashOn = Math.floor(this._dyingTimer / 0.06) % 2 === 0;
      g.fillStyle(flashOn ? 0xFFFFFF : this.def.color, t * 0.9);
      g.fillCircle(this.x, this.y, r);
      return;
    }

    const r  = this.radius;
    const cx = this.x, cy = this.y;
    const flash = this._flashTimer > 0;
    const c   = flash ? 0xFFFFFF : this.def.color;
    const cd  = this.def.colorDark;

    // Phase 3: invisible enemies render semi-transparent
    const alpha = this.def.isInvisible ? 0.30 : 1.0;

    switch (this.def.id) {
      case 'grunt':
        g.fillStyle(c, alpha); g.fillCircle(cx, cy, r);
        g.lineStyle(1.5, cd, 0.9); g.strokeCircle(cx, cy, r);
        g.lineStyle(1.5, cd, 0.7);
        for (let i=0;i<4;i++){const a=Phaser.Math.DegToRad(45+i*90); g.beginPath(); g.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); g.lineTo(cx+Math.cos(a)*(r+4),cy+Math.sin(a)*(r+4)); g.strokePath();}
        break;
      case 'runner': {
        const pts=[{x:cx,y:cy-r*1.5},{x:cx+r,y:cy},{x:cx,y:cy+r*1.5},{x:cx-r,y:cy}] as Phaser.Types.Math.Vector2Like[];
        g.fillStyle(c, alpha); g.fillPoints(pts,true); g.lineStyle(1,cd,0.8); g.strokePoints(pts,true);
        break;
      }
      case 'golem': {
        const pts=this._hex(cx,cy,r,0); g.fillStyle(c, alpha); g.fillPoints(pts,true); g.lineStyle(2,cd,1); g.strokePoints(pts,true);
        g.lineStyle(1,cd,0.35); g.strokePoints(this._hex(cx,cy,r-3,0),true);
        break;
      }
      case 'wyvern': {
        const nx=Math.cos(this._angle),ny=Math.sin(this._angle),px=-ny,py=nx;
        const pts=[{x:cx+nx*r*1.4,y:cy+ny*r*1.4},{x:cx+px*r*0.8,y:cy+py*r*0.8},{x:cx-nx*r*0.9,y:cy-ny*r*0.9},{x:cx-px*r*0.8,y:cy-py*r*0.8}] as Phaser.Types.Math.Vector2Like[];
        g.fillStyle(c, alpha); g.fillPoints(pts,true); g.lineStyle(1,cd,0.7); g.strokePoints(pts,true);
        break;
      }
      case 'boss_goliath': {
        const glowA = 0.10+0.15*(0.5+Math.sin(this._bossGlowT*Math.PI*2)*0.5);
        g.fillStyle(COLORS.danger,glowA); g.fillCircle(cx,cy,r+8);
        const pts=this._hex(cx,cy,r,30); g.fillStyle(c,1); g.fillPoints(pts,true);
        g.lineStyle(2,COLORS.danger,0.9); g.strokePoints(pts,true);
        g.lineStyle(1,cd,0.5); g.strokePoints(this._hex(cx,cy,r-4,30),true);
        break;
      }

      // ── Phase 3: New enemy shapes ──────────────────────────────────────────

      case 'phantom': {
        // Wispy pentagon with pulsing outer ring
        const pts = this._polygon(cx, cy, r, 5, this._angle);
        g.fillStyle(c, 0.28); g.fillPoints(pts, true);
        g.lineStyle(1.5, c, 0.6 + 0.3 * Math.sin(this._bossGlowT * 6)); g.strokePoints(pts, true);
        // Inner glow dot
        g.fillStyle(0xFFFFFF, 0.18); g.fillCircle(cx, cy, r * 0.35);
        break;
      }

      case 'nether_drake': {
        // Large flying boss — elongated diamond + wing flanges
        const glowA = 0.12 + 0.12 * (0.5 + Math.sin(this._bossGlowT * Math.PI * 1.5) * 0.5);
        g.fillStyle(0x7B2FBE, glowA); g.fillCircle(cx, cy, r + 10);
        const nx = Math.cos(this._angle), ny = Math.sin(this._angle);
        const px = -ny, py = nx;
        const body = [
          {x: cx+nx*r*1.6, y: cy+ny*r*1.6},
          {x: cx+px*r*1.0, y: cy+py*r*1.0},
          {x: cx-nx*r*1.1, y: cy-ny*r*1.1},
          {x: cx-px*r*1.0, y: cy-py*r*1.0},
        ] as Phaser.Types.Math.Vector2Like[];
        g.fillStyle(c, 1); g.fillPoints(body, true);
        g.lineStyle(2, 0xAA55FF, 0.9); g.strokePoints(body, true);
        // Crown spikes
        g.lineStyle(1.5, cd, 0.6);
        for (let i = 0; i < 3; i++) {
          const a = this._angle + Phaser.Math.DegToRad(-30 + i * 30);
          g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          g.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); g.strokePath();
        }
        break;
      }

      case 'mountain_giant': {
        // Huge fortified square with cracks
        const glowA = 0.08 + 0.10 * (0.5 + Math.sin(this._bossGlowT * Math.PI) * 0.5);
        g.fillStyle(0x8B6914, glowA); g.fillCircle(cx, cy, r + 12);
        const pts = this._hex(cx, cy, r, 0);
        g.fillStyle(c, 1); g.fillPoints(pts, true);
        g.lineStyle(3, cd, 1.0); g.strokePoints(pts, true);
        // Inner ring cracks
        g.lineStyle(1, cd, 0.4); g.strokePoints(this._hex(cx, cy, r - 5, 30), true);
        // Highlight
        g.lineStyle(1.5, 0xC8A86A, 0.5); g.strokePoints(this._hex(cx, cy, r - 2, 0), true);
        break;
      }
    }

    // FX overlays
    if (this.fx.hasSlow()) { g.lineStyle(2, COLORS.seaMuted, 0.75); g.strokeCircle(cx, cy, r+3); }
    if (this.fx.hasArmorReduce()) {
      g.lineStyle(1.5, COLORS.amberWarm, 0.85);
      for(let i=0;i<4;i++){const a=Phaser.Math.DegToRad(45+i*90); g.beginPath(); g.moveTo(cx+Math.cos(a)*(r+1),cy+Math.sin(a)*(r+1)); g.lineTo(cx+Math.cos(a)*(r+5),cy+Math.sin(a)*(r+5)); g.strokePath();}
    }
  }

  drawHealthbarTo(g: Phaser.GameObjects.Graphics): void {
    if (this._isDying || this.hp >= this.maxHp) return;
    const ratio  = Math.max(0, this.hp / this.maxHp);
    const isBoss = this.def.isBoss ?? false;
    const BAR_W  = this.radius * (isBoss ? 3.4 : 2.6);
    const BAR_H  = isBoss ? 6 : 4;
    const bx     = this.x - BAR_W / 2;
    const by     = this.y - this.radius - (isBoss ? 14 : 10);
    const fillW  = Math.max(1, Math.round(BAR_W * ratio));

    // Dark track
    g.fillStyle(0x0A0806, 0.85); g.fillRoundedRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2, 2);
    g.fillStyle(0x1A1510, 0.75); g.fillRoundedRect(bx, by, BAR_W, BAR_H, 1);

    // Gradient fill — green → yellow → red
    const col = ratio > 0.60 ? 0x44BB44 : ratio > 0.30 ? 0xCCBB22 : 0xCC3322;
    g.fillStyle(col, 0.92); g.fillRoundedRect(bx, by, fillW, BAR_H, 1);

    // Top sheen on fill
    if (fillW > 4) {
      g.fillStyle(0xFFFFFF, 0.20); g.fillRect(bx + 1, by + 1, fillW - 2, Math.max(1, Math.floor(BAR_H / 2)));
    }

    // Boss: tick marks every 25% + pulse border
    if (isBoss) {
      g.lineStyle(1, 0x000000, 0.45);
      for (let tick = 0.25; tick < 1; tick += 0.25) {
        const tx = Math.round(bx + BAR_W * tick);
        g.beginPath(); g.moveTo(tx, by); g.lineTo(tx, by + BAR_H); g.strokePath();
      }
      const pulse = 0.40 + 0.35 * Math.sin(this._bossGlowT * Math.PI * 4);
      g.lineStyle(1.5, 0xCC3322, pulse); g.strokeRoundedRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2, 2);
    }

    // Invisible indicator (eye dot above bar)
    if (this.def.isInvisible) {
      g.fillStyle(0xBB99DD, 0.55); g.fillCircle(this.x, by - 6, 3);
      g.lineStyle(1, 0xDDBBFF, 0.40); g.strokeCircle(this.x, by - 6, 3);
    }

    // Flying altitude indicator
    if (this.def.isFlying) {
      g.fillStyle(0x8888CC, 0.40);
      g.fillTriangle(this.x - 4, by - 4, this.x, by - 9, this.x + 4, by - 4);
    }
  }

  // Flying shadow (drawn under main enemy layer) — called from GameScene
  drawShadowTo(g: Phaser.GameObjects.Graphics): void {
    if (!this._isFlying || !this.isActive) return;
    const r = this.radius;
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(this.x+4, this.y+6, r*2.4, r*0.85);
  }

  private _hex(cx:number,cy:number,r:number,rot:number): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for(let i=0;i<6;i++){const a=Phaser.Math.DegToRad(rot+60*i); pts.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}
    return pts;
  }

  /** Generic N-sided polygon with optional rotation offset */
  private _polygon(cx:number,cy:number,r:number,sides:number,rot=0): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for(let i=0;i<sides;i++){const a=rot+Math.PI*2*(i/sides); pts.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}
    return pts;
  }
}
