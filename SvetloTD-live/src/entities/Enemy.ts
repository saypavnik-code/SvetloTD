// Enemy.ts — Stage 8. Pure TS class (no Phaser Container).
// Batch-rendered via enemyGfx / healthbarGfx in GameScene.

import Phaser from 'phaser';
import { type EnemyDef, type EnemyId, ENEMY_DEFS } from '../data/enemies';
import { type Waypoint } from '../data/pathData';
import { getSmoothedPath } from '../data/BezierPath';
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
      this._waypoints = this.def.isFlying ? waypoints : getSmoothedPath(waypoints);
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
  // ══════════════════════════════════════════════════════════════════════════
  // drawTo — 2027-quality vector models.
  // Each enemy has a distinct silhouette, layered detail, per-type FX tint.
  // Invisible enemies render at 30% alpha. Flying enemies have wing flanges.
  // ══════════════════════════════════════════════════════════════════════════
  drawTo(g: Phaser.GameObjects.Graphics): void {
    // ── Dying — shrink + strobe flash ──────────────────────────────────────
    if (this._isDying) {
      const t = this._dyingTimer / Enemy.DYING_DURATION;
      const r = this.radius * t;
      if (r < 0.5) return;
      const flashOn = Math.floor(this._dyingTimer / 0.06) % 2 === 0;
      g.fillStyle(flashOn ? 0xFFFFFF : this.def.color, t * 0.88);
      g.fillCircle(this.x, this.y, r);
      // Dying ring
      g.lineStyle(1.5, flashOn ? 0xFFFFFF : this.def.colorDark, t * 0.5);
      g.strokeCircle(this.x, this.y, r * 1.3);
      return;
    }

    const r  = this.radius;
    const cx = this.x, cy = this.y;
    const flash = this._flashTimer > 0;
    const c  = flash ? 0xFFFFFF : this.def.color;
    const cd = this.def.colorDark;
    // Invisible: 30% alpha unless detected (logic in Tower._findTarget)
    const alpha = this.def.isInvisible ? 0.30 : 1.0;

    switch (this.def.id) {

      // ── Grunt: armoured goblin — chunky hexagon with helmet spikes ────────
      case 'grunt': {
        // Body
        g.fillStyle(c, alpha); g.fillCircle(cx, cy, r);
        g.lineStyle(2, cd, 0.90 * alpha); g.strokeCircle(cx, cy, r);
        // Inner armour ring
        g.lineStyle(1, cd, 0.40 * alpha); g.strokeCircle(cx, cy, r * 0.65);
        // Helmet spike (top)
        g.fillStyle(c, alpha);
        g.fillTriangle(cx-3, cy-r+2, cx+3, cy-r+2, cx, cy-r-7);
        g.lineStyle(1, cd, 0.70*alpha); g.strokeTriangle(cx-3,cy-r+2,cx+3,cy-r+2,cx,cy-r-7);
        // 4 stud rivets
        g.lineStyle(0, 0, 0);
        for (let i=0;i<4;i++){
          const a = Phaser.Math.DegToRad(45+i*90);
          g.fillStyle(cd, alpha); g.fillCircle(cx+Math.cos(a)*(r*0.55), cy+Math.sin(a)*(r*0.55), 1.5);
        }
        break;
      }

      // ── Runner: fast diamond with motion blur trail ───────────────────────
      case 'runner': {
        // Speed-trail ghost (opposite to movement dir)
        const trailA = alpha * 0.28;
        const nx = Math.cos(this._angle), ny = Math.sin(this._angle);
        for (let i=1;i<=3;i++){
          const ta = trailA * (1 - i/4);
          const ts = r * (1 - i*0.18);
          g.fillStyle(c, ta);
          g.fillCircle(cx - nx*i*4, cy - ny*i*4, ts);
        }
        // Body — elongated diamond aligned to movement
        const px = -ny, py2 = nx;
        const pts: Phaser.Types.Math.Vector2Like[] = [
          {x:cx+nx*r*1.55, y:cy+ny*r*1.55},
          {x:cx+px*r*0.80, y:cy+py2*r*0.80},
          {x:cx-nx*r*1.10, y:cy-ny*r*1.10},
          {x:cx-px*r*0.80, y:cy-py2*r*0.80},
        ];
        g.fillStyle(c, alpha); g.fillPoints(pts, true);
        g.lineStyle(1.5, cd, 0.85*alpha); g.strokePoints(pts, true);
        // Front eye dot
        g.fillStyle(0xFFFFFF, 0.80*alpha); g.fillCircle(cx+nx*r*0.55, cy+ny*r*0.55, 2);
        g.fillStyle(cd, alpha); g.fillCircle(cx+nx*r*0.55, cy+ny*r*0.55, 1);
        break;
      }

      // ── Golem: stone fortress hex — layered plates ────────────────────────
      case 'golem': {
        const outer = this._hex(cx, cy, r, 0);
        const inner = this._hex(cx, cy, r-4, 30);
        // Stone shadow
        g.fillStyle(0x000000, 0.25*alpha); g.fillPoints(this._hex(cx+2, cy+2, r, 0), true);
        // Main body
        g.fillStyle(c, alpha); g.fillPoints(outer, true);
        // Rock-face texture (inner hex, rotated 30°)
        g.fillStyle(cd, 0.25*alpha); g.fillPoints(inner, true);
        g.lineStyle(2.5, cd, 1.0*alpha); g.strokePoints(outer, true);
        g.lineStyle(1, cd, 0.45*alpha); g.strokePoints(inner, true);
        // Crack lines (3 radial)
        g.lineStyle(1, 0x000000, 0.35*alpha);
        for (let i=0;i<3;i++){
          const a = Phaser.Math.DegToRad(i*60+15);
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx+Math.cos(a)*r*0.85, cy+Math.sin(a)*r*0.85); g.strokePath();
        }
        break;
      }

      // ── Wyvern: flying dragon — swept wing kite shape ─────────────────────
      case 'wyvern': {
        const nx = Math.cos(this._angle), ny = Math.sin(this._angle);
        const px = -ny, py2 = nx;
        // Wing spans — wide lateral flanges
        const wingPts: Phaser.Types.Math.Vector2Like[] = [
          {x:cx+nx*r*1.40, y:cy+ny*r*1.40},    // nose
          {x:cx+px*r*1.60, y:cy+py2*r*1.60},   // left wingtip
          {x:cx-nx*r*0.80, y:cy-ny*r*0.80},    // tail
          {x:cx-px*r*1.60, y:cy-py2*r*1.60},   // right wingtip
        ];
        // Wing membrane shadow
        g.fillStyle(0x000000, 0.22*alpha); g.fillPoints(wingPts.map(p=>({x:p.x+3,y:p.y+3})), true);
        // Body
        g.fillStyle(c, alpha); g.fillPoints(wingPts, true);
        // Wing vein lines
        g.lineStyle(1, cd, 0.55*alpha);
        g.beginPath(); g.moveTo(cx,cy); g.lineTo((wingPts[1] as any).x, (wingPts[1] as any).y); g.strokePath();
        g.beginPath(); g.moveTo(cx,cy); g.lineTo((wingPts[3] as any).x, (wingPts[3] as any).y); g.strokePath();
        g.lineStyle(1.5, cd, 0.80*alpha); g.strokePoints(wingPts, true);
        // Eye — direction indicator
        g.fillStyle(0xFF4422, 0.90*alpha); g.fillCircle(cx+nx*r*0.55, cy+ny*r*0.55, 2.5);
        break;
      }

      // ── Boss Goliath: massive hex fortress with pulsing danger aura ────────
      case 'boss_goliath': {
        const glowA = (0.10+0.18*(0.5+Math.sin(this._bossGlowT*Math.PI*2)*0.5)) * alpha;
        // Multi-layer danger glow
        g.fillStyle(COLORS.danger, glowA * 0.5); g.fillCircle(cx, cy, r+14);
        g.fillStyle(COLORS.danger, glowA);       g.fillCircle(cx, cy, r+8);
        // Main body — double hex (outer + rotated inner)
        const outer = this._hex(cx, cy, r, 30);
        const inner = this._hex(cx, cy, r-5, 0);
        // Shadow
        g.fillStyle(0x000000, 0.40*alpha); g.fillPoints(this._hex(cx+3, cy+3, r, 30), true);
        g.fillStyle(c, alpha); g.fillPoints(outer, true);
        g.fillStyle(cd, 0.40*alpha); g.fillPoints(inner, true);
        g.lineStyle(3, COLORS.danger, 0.95*alpha); g.strokePoints(outer, true);
        g.lineStyle(1.5, cd, 0.55*alpha); g.strokePoints(inner, true);
        // Crown spikes (6 outward prongs)
        g.lineStyle(2.5, COLORS.danger, 0.70*alpha);
        for (let i=0;i<6;i++){
          const a = Phaser.Math.DegToRad(30+i*60);
          const sx = cx+Math.cos(a)*r, sy = cy+Math.sin(a)*r;
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx+Math.cos(a)*7, sy+Math.sin(a)*7); g.strokePath();
        }
        // Pulsing red core
        const coreR = 5 + 2*Math.sin(this._bossGlowT*Math.PI*4);
        g.fillStyle(COLORS.danger, 0.90*alpha); g.fillCircle(cx, cy, coreR);
        g.fillStyle(0xFF8888, 0.60*alpha); g.fillCircle(cx, cy, coreR*0.5);
        break;
      }

      // ── Phantom: ghostly invisible enemy — wispy pentagon ─────────────────
      case 'phantom': {
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i=0;i<5;i++){const a=this._angle+Phaser.Math.DegToRad(i*72); pts.push({x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r});}
        // Ghostly body (always semi-transparent)
        g.fillStyle(c, 0.22); g.fillPoints(pts, true);
        // Pulsing wispy border
        const wispAlpha = 0.55 + 0.35*Math.sin(this._bossGlowT * 5);
        g.lineStyle(1.5, c, wispAlpha); g.strokePoints(pts, true);
        // Inner glow
        g.fillStyle(0xFFFFFF, 0.12); g.fillCircle(cx, cy, r*0.38);
        // Floating particles (3 orbiting dots)
        for (let i=0;i<3;i++){
          const a = this._angle*2 + Phaser.Math.DegToRad(i*120);
          g.fillStyle(c, 0.55); g.fillCircle(cx+Math.cos(a)*r*0.65, cy+Math.sin(a)*r*0.65, 1.8);
        }
        break;
      }

      // ── Nether Drake: flying boss — swept dragon kite + crown ─────────────
      case 'nether_drake': {
        const glowA = (0.12+0.12*(0.5+Math.sin(this._bossGlowT*Math.PI*1.5)*0.5)) * alpha;
        // Purple multi-ring glow
        g.fillStyle(0x7B2FBE, glowA*0.5); g.fillCircle(cx, cy, r+14);
        g.fillStyle(0x9B4FDE, glowA);     g.fillCircle(cx, cy, r+8);
        const nx = Math.cos(this._angle), ny = Math.sin(this._angle);
        const px = -ny, py2 = nx;
        // Wide dragon wings
        const wingPts: Phaser.Types.Math.Vector2Like[] = [
          {x:cx+nx*r*1.65, y:cy+ny*r*1.65},
          {x:cx+px*r*1.80, y:cy+py2*r*1.80},
          {x:cx-nx*r*1.00, y:cy-ny*r*1.00},
          {x:cx-px*r*1.80, y:cy-py2*r*1.80},
        ];
        g.fillStyle(0x000000, 0.35*alpha); g.fillPoints(wingPts.map(p=>({x:p.x+4,y:p.y+4})), true);
        g.fillStyle(c, alpha); g.fillPoints(wingPts, true);
        g.lineStyle(2, 0xAA55FF, 0.90*alpha); g.strokePoints(wingPts, true);
        // Wing veins
        g.lineStyle(1, cd, 0.50*alpha);
        g.beginPath(); g.moveTo(cx,cy); g.lineTo((wingPts[1] as any).x,(wingPts[1] as any).y); g.strokePath();
        g.beginPath(); g.moveTo(cx,cy); g.lineTo((wingPts[3] as any).x,(wingPts[3] as any).y); g.strokePath();
        // Crown prongs (5 spikes)
        g.lineStyle(2, 0xAA55FF, 0.80*alpha);
        for (let i=0;i<5;i++){
          const a = this._angle + Phaser.Math.DegToRad(-40+i*20);
          const ex = cx+nx*r+Math.cos(a)*8, ey = cy+ny*r+Math.sin(a)*8;
          g.beginPath(); g.moveTo(cx+nx*(r-2), cy+ny*(r-2)); g.lineTo(ex, ey); g.strokePath();
          g.fillStyle(0xCC88FF, 0.85*alpha); g.fillCircle(ex, ey, 1.5);
        }
        // Eyes
        g.fillStyle(0xFF2222, 0.95*alpha); g.fillCircle(cx+nx*r*0.45+px*3, cy+ny*r*0.45+py2*3, 2.5);
        g.fillStyle(0xFF2222, 0.95*alpha); g.fillCircle(cx+nx*r*0.45-px*3, cy+ny*r*0.45-py2*3, 2.5);
        break;
      }

      // ── Mountain Giant: hulking fortified hex with ground cracks ──────────
      case 'mountain_giant': {
        const glowA = (0.08+0.10*(0.5+Math.sin(this._bossGlowT*Math.PI)*0.5)) * alpha;
        g.fillStyle(0x8B6914, glowA); g.fillCircle(cx, cy, r+12);
        const outer = this._hex(cx, cy, r, 0);
        const inner = this._hex(cx, cy, r-6, 30);
        g.fillStyle(0x000000, 0.45*alpha); g.fillPoints(this._hex(cx+4, cy+4, r, 0), true);
        g.fillStyle(c, alpha); g.fillPoints(outer, true);
        g.fillStyle(cd, 0.30*alpha); g.fillPoints(inner, true);
        g.lineStyle(3.5, cd, 1.0*alpha); g.strokePoints(outer, true);
        // Ground crack lines radiating outward
        g.lineStyle(1.5, 0x2A1800, 0.60*alpha);
        for (let i=0;i<6;i++){
          const a = Phaser.Math.DegToRad(i*60);
          g.beginPath(); g.moveTo(cx+Math.cos(a)*r*0.3, cy+Math.sin(a)*r*0.3);
          g.lineTo(cx+Math.cos(a)*r*1.1, cy+Math.sin(a)*r*1.1); g.strokePath();
        }
        // Secondary crack pass
        g.lineStyle(1, 0x4A3000, 0.35*alpha);
        g.strokePoints(inner, true);
        // Amber highlight rim
        g.lineStyle(1.5, 0xC8A86A, 0.45*alpha); g.strokePoints(this._hex(cx, cy, r-2, 0), true);
        // Core eye
        g.fillStyle(0xFFAA00, 0.80*alpha); g.fillCircle(cx, cy, 5);
        g.fillStyle(0xFF6600, 0.95*alpha); g.fillCircle(cx, cy, 3);
        g.fillStyle(0xFFFFFF, 0.40*alpha); g.fillCircle(cx-1, cy-1, 1.5);
        break;
      }
    }

    // ── Status FX overlays ──────────────────────────────────────────────────
    if (this.fx.hasSlow()) {
      // Ice-blue ring + snowflake ticks
      g.lineStyle(2, 0x7EC8E3, 0.75); g.strokeCircle(cx, cy, r+3);
      g.lineStyle(1, 0xAADDFF, 0.40);
      for (let i=0;i<6;i++){
        const a = Phaser.Math.DegToRad(i*60);
        g.beginPath(); g.moveTo(cx+Math.cos(a)*(r+5), cy+Math.sin(a)*(r+5));
        g.lineTo(cx+Math.cos(a)*(r+8), cy+Math.sin(a)*(r+8)); g.strokePath();
      }
    }
    if (this.fx.hasArmorReduce()) {
      // Orange shatter sparks
      g.lineStyle(1.5, COLORS.amberWarm, 0.85);
      for (let i=0;i<4;i++){
        const a = Phaser.Math.DegToRad(45+i*90);
        g.beginPath(); g.moveTo(cx+Math.cos(a)*(r+1),cy+Math.sin(a)*(r+1));
        g.lineTo(cx+Math.cos(a)*(r+6),cy+Math.sin(a)*(r+6)); g.strokePath();
        g.fillStyle(COLORS.amberWarm, 0.70); g.fillCircle(cx+Math.cos(a)*(r+6),cy+Math.sin(a)*(r+6),1.5);
      }
    }
    if (this.fx.hasPoison?.()) {
      // Green poison bubbles
      g.lineStyle(1, 0x55AA22, 0.55); g.strokeCircle(cx, cy, r+5);
      g.fillStyle(0x88CC44, 0.45); g.fillCircle(cx, cy+r+5, 2.5);
      g.fillStyle(0x66BB33, 0.30); g.fillCircle(cx-r-4, cy, 2);
    }
  }

  drawHealthbarTo(g: Phaser.GameObjects.Graphics): void {
    if (this._isDying || this.hp >= this.maxHp) return;
    const ratio   = Math.max(0, this.hp / this.maxHp);
    const isBoss  = !!this.def.isBoss;
    const BAR_W   = this.radius * (isBoss ? 3.6 : 2.8);
    const BAR_H   = isBoss ? 7 : 4;
    const bx      = this.x - BAR_W / 2;
    const by      = this.y - this.radius - (isBoss ? 15 : 10);
    const fillW   = Math.max(1, Math.round(BAR_W * ratio));

    // Shadow
    g.fillStyle(0x000000, 0.60); g.fillRoundedRect(bx-1, by-1, BAR_W+2, BAR_H+2, 2);
    // Track
    g.fillStyle(0x1A1510, 0.80); g.fillRoundedRect(bx, by, BAR_W, BAR_H, 1);

    // Gradient fill: green → yellow → red
    const col = ratio > 0.60 ? 0x44BB44 : ratio > 0.30 ? 0xCCBB22 : 0xCC3322;
    g.fillStyle(col, 0.92); g.fillRoundedRect(bx, by, fillW, BAR_H, 1);
    // Sheen
    if (fillW > 4) { g.fillStyle(0xFFFFFF, 0.20); g.fillRect(bx+1, by+1, fillW-2, Math.max(1, Math.floor(BAR_H/2))); }

    // Boss: tick marks every 25% + pulsing border
    if (isBoss) {
      g.lineStyle(1, 0x000000, 0.50);
      for (let t=0.25; t<1; t+=0.25) {
        const tx = Math.round(bx + BAR_W * t);
        g.beginPath(); g.moveTo(tx, by); g.lineTo(tx, by + BAR_H); g.strokePath();
      }
      const pulse = 0.45 + 0.35 * Math.sin(this._bossGlowT * Math.PI * 4);
      g.lineStyle(1.5, 0xCC3322, pulse); g.strokeRoundedRect(bx-1, by-1, BAR_W+2, BAR_H+2, 2);
    }

    // Invisible eye icon
    if (this.def.isInvisible) {
      g.fillStyle(0xBB99DD, 0.55); g.fillCircle(this.x, by-7, 3);
      g.lineStyle(1, 0xDDBBFF, 0.40); g.strokeCircle(this.x, by-7, 3);
    }

    // Flying altitude chevron
    if (this.def.isFlying) {
      g.fillStyle(0x8888CC, 0.45);
      g.fillTriangle(this.x-4, by-4, this.x, by-9, this.x+4, by-4);
    }
  }

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
}