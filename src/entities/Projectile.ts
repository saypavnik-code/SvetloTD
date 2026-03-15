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

  drawTo(g: Phaser.GameObjects.Graphics): void {
    if (!this.isActive) return;
    // Amber dot
    g.fillStyle(this._color, 1); g.fillCircle(this.x, this.y, 3.5);
    g.lineStyle(1.5, COLORS.amberGlow, 0.55); g.strokeCircle(this.x, this.y, 3.5);
    // Trail dots
    for (let i=1;i<this._trail.length;i++) {
      const a=(i/this._trail.length)*0.45;
      const r=1.0+(i/this._trail.length)*2.0;
      g.fillStyle(this._color,a); g.fillCircle(this._trail[i].x,this._trail[i].y,r);
    }
  }

  // Splash ring animation — called from drawEffectsTo each frame, driven by Projectile internal timer
  tickSplash(dt: number): void {
    if (this._splashT<0) return;
    this._splashAcc+=dt;
    if (this._splashAcc>=this._splashDur) this._splashT=-1;
  }

  drawSplashTo(g: Phaser.GameObjects.Graphics): void {
    if (this._splashT<0) return;
    const t=Math.min(this._splashAcc/this._splashDur,1);
    const r=4+t*this._splashR, a=(1-t)*0.55;
    g.lineStyle(2, this._color, a); g.strokeCircle(this._splashX, this._splashY, r);
    g.fillStyle(this._color, a*0.10); g.fillCircle(this._splashX, this._splashY, r);
  }
}
