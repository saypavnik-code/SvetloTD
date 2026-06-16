// Projectile.ts — Stage 8. Pure TS class, batch-rendered via projectileGfx.

import Phaser from 'phaser';
import { Enemy, type DamageType } from './Enemy';
import { type Poolable } from '../utils/ObjectPool';
import { COLORS } from '../config';
import { GameSpeed } from '../systems/GameSpeed';

const TRAIL_LEN = 7;

interface Pt { x: number; y: number; }

export class Projectile implements Poolable {
  isActive = false;
  x = 0; y = 0;
  onEnemyHit?: (enemy: Enemy) => void;

  private _target:       Enemy | null = null;
  private _lastX = 0; private _lastY = 0;
  private _targetLost    = false;
  private _speed         = 320;
  private _damage        = 0;
  private _damageType:   DamageType = 'normal';
  private _splashRadius  = 0;
  private _color         = 0xF5A623;
  private _activeEnemies: Enemy[] = [];
  private _trail: Pt[]            = [];

  // Splash effect lifetime (pure data, animated in drawTo)
  private _splashT   = -1;   // -1 = no splash
  private _splashX   = 0;
  private _splashY   = 0;
  private _splashR   = 0;
  private _splashDur = 0.3;
  private _splashAcc = 0;

  constructor() {}

  init(
    x: number, y: number, target: Enemy,
    damage: number, damageType: DamageType,
    splashRadius: number, color: number, activeEnemies: Enemy[], speed = 320,
  ): void {
    this.x=x; this.y=y;
    this._target=target; this._lastX=target.x; this._lastY=target.y;
    this._targetLost=false; this._damage=damage; this._damageType=damageType;
    this._splashRadius=splashRadius; this._color=color;
    this._activeEnemies=activeEnemies; this._speed=speed;
    this._trail=[{x,y}];
    this._splashT=-1;
    this.isActive=true;
  }

  reset(): void {
    this.isActive=false; this._target=null; this._activeEnemies=[]; this._trail=[];
    this.onEnemyHit=undefined; this._targetLost=false; this._splashT=-1;
  }

  // dt = pre-clamped raw ms; GameSpeed applied inside
  update(delta: number): void {
    if (!this.isActive) return;
    const dt = GameSpeed.adjust(delta) / 1000;

    if (!this._target||!this._target.isActive||this._target.isDead) this._targetLost=true;
    else { this._lastX=this._target.x; this._lastY=this._target.y; }

    const dx=this._lastX-this.x, dy=this._lastY-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy), step=this._speed*dt;

    this._trail.push({x:this.x,y:this.y});
    if (this._trail.length>TRAIL_LEN) this._trail.shift();

    if (dist<=step+2) {
      this.x=this._lastX; this.y=this._lastY;
      if (!this._targetLost) {
        this._dealDamage();
        if (this._splashRadius>0) { this._splashT=0; this._splashX=this.x; this._splashY=this.y; this._splashR=this._splashRadius; this._splashAcc=0; }
      }
      this.reset();
    } else {
      this.x+=dx/dist*step; this.y+=dy/dist*step;
    }
  }

  private _dealDamage(): void {
    if (this._splashRadius>0) {
      const r2=this._splashRadius*this._splashRadius;
      for (const e of this._activeEnemies) {
        if (!e.isActive||e.isDead) continue;
        const dx=e.x-this.x, dy=e.y-this.y;
        if (dx*dx+dy*dy<=r2) { e.takeDamage(this._damage,this._damageType); this.onEnemyHit?.(e); }
      }
    } else {
      if (this._target&&this._target.isActive&&!this._target.isDead) {
        this._target.takeDamage(this._damage,this._damageType);
        this.onEnemyHit?.(this._target);
      }
    }
  }

  tickSplash(dt: number): void {
    if (this._splashT < 0) return;
    this._splashAcc += dt;
    if (this._splashAcc >= this._splashDur) this._splashT = -1;
  }

  drawTo(g: Phaser.GameObjects.Graphics): void {
    if (!this.isActive) return;
    const cx = this.x, cy = this.y;

    // ── Trail ───────────────────────────────────────────────────────────────
    const trailLen = this._trail.length;
    for (let i = 1; i < trailLen; i++) {
      const frac  = i / trailLen;
      const alpha = frac * 0.55;
      const r     = 1.2 + frac * 2.0;
      g.fillStyle(this._color, alpha);
      g.fillCircle(this._trail[i].x, this._trail[i].y, r);
    }

    // ── Head — type-specific shape ──────────────────────────────────────────
    switch (this._damageType) {

      case 'piercing': {
        // Arrow: elongated capsule with bright tip
        const dx = this._lastX - (this._trail[0]?.x ?? cx);
        const dy = this._lastY - (this._trail[0]?.y ?? cy);
        const len = Math.sqrt(dx*dx+dy*dy) || 1;
        const nx = dx/len, ny = dy/len;
        g.fillStyle(this._color, 0.95);
        g.fillTriangle(cx+nx*6, cy+ny*6, cx-ny*2.5, cy+nx*2.5, cx+ny*2.5, cy-nx*2.5);
        g.fillStyle(0xFFFFFF, 0.70); g.fillCircle(cx+nx*5, cy+ny*5, 1.2);
        break;
      }

      case 'siege': {
        // Cannonball: heavy dark sphere with hot-iron glow ring
        g.fillStyle(0x1A1410, 1); g.fillCircle(cx, cy, 5);
        g.lineStyle(1.5, COLORS.danger, 0.80); g.strokeCircle(cx, cy, 5);
        g.fillStyle(COLORS.danger, 0.35); g.fillCircle(cx, cy, 7.5);
        g.fillStyle(0xFFCCAA, 0.55); g.fillCircle(cx-1.5, cy-1.5, 1.8);
        break;
      }

      case 'magic': {
        // Magic orb: pulsing circle with star sparkle
        g.fillStyle(this._color, 0.30); g.fillCircle(cx, cy, 7);
        g.fillStyle(this._color, 0.90); g.fillCircle(cx, cy, 4);
        g.fillStyle(0xFFFFFF, 0.65); g.fillCircle(cx, cy, 2);
        // Cross sparkle
        g.lineStyle(1.5, 0xFFFFFF, 0.55);
        for (let i=0;i<4;i++){const a=Phaser.Math.DegToRad(i*90);g.beginPath();g.moveTo(cx+Math.cos(a)*4,cy+Math.sin(a)*4);g.lineTo(cx+Math.cos(a)*8,cy+Math.sin(a)*8);g.strokePath();}
        break;
      }

      case 'chaos': {
        // Chaos bolt: golden star with rotating outer sparks
        const t = Date.now() / 100;
        g.fillStyle(COLORS.amberBright, 0.25); g.fillCircle(cx, cy, 9);
        g.fillStyle(COLORS.amberBright, 0.90); g.fillCircle(cx, cy, 5);
        g.fillStyle(0xFFFFFF, 0.75); g.fillCircle(cx, cy, 2.5);
        g.lineStyle(1.5, COLORS.amberGlow, 0.60);
        for (let i=0;i<6;i++){const a=t+Phaser.Math.DegToRad(i*60);g.beginPath();g.moveTo(cx+Math.cos(a)*5,cy+Math.sin(a)*5);g.lineTo(cx+Math.cos(a)*9,cy+Math.sin(a)*9);g.strokePath();}
        break;
      }

      default: {
        // Normal: clean amber dot
        g.fillStyle(this._color, 0.95); g.fillCircle(cx, cy, 4);
        g.lineStyle(1.5, COLORS.amberGlow, 0.50); g.strokeCircle(cx, cy, 4);
        g.fillStyle(0xFFFFFF, 0.50); g.fillCircle(cx-1, cy-1, 1.5);
      }
    }
  }

  drawSplashTo(g: Phaser.GameObjects.Graphics): void {
    if (this._splashT < 0) return;
    const t  = Math.min(this._splashAcc / this._splashDur, 1);
    const r  = 4 + t * this._splashR;
    const a  = (1 - t) * 0.60;

    // Outer ring
    g.lineStyle(2.5, this._color, a); g.strokeCircle(this._splashX, this._splashY, r);
    // Inner fill
    g.fillStyle(this._color, a * 0.12); g.fillCircle(this._splashX, this._splashY, r);
    // Secondary ring at half radius
    g.lineStyle(1, this._color, a * 0.45); g.strokeCircle(this._splashX, this._splashY, r * 0.55);
    // Debris sparks (6 outward rays)
    if (t < 0.5) {
      g.lineStyle(1, this._color, a * 0.70);
      for (let i=0;i<6;i++){
        const angle = Phaser.Math.DegToRad(i*60 + t*180);
        const len2  = r * 0.35;
        g.beginPath();
        g.moveTo(this._splashX+Math.cos(angle)*(r-len2), this._splashY+Math.sin(angle)*(r-len2));
        g.lineTo(this._splashX+Math.cos(angle)*(r+2),    this._splashY+Math.sin(angle)*(r+2));
        g.strokePath();
      }
    }
  }
}