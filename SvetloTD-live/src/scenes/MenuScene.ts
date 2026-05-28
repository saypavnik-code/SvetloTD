// MenuScene.ts — Commercial release. Dark fantasy, animated, VK-ready.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_MAIN } from '../config';
import { AudioManager } from '../systems/AudioManager';
import { PlatformManager } from '../systems/PlatformManager';

const FONT = FONT_MAIN;
interface Ember   { x:number; y:number; vx:number; vy:number; r:number; alpha:number; life:number; }
interface HexCell { cx:number; cy:number; pulse:number; }

export class MenuScene extends Phaser.Scene {
  private _embers:   Ember[]   = [];
  private _hexCells: HexCell[] = [];
  private _t = 0;
  private _hexGfx!:    Phaser.GameObjects.Graphics;
  private _emberGfx!:  Phaser.GameObjects.Graphics;
  private _torchGfx!:  Phaser.GameObjects.Graphics;
  private _playPanel!: Phaser.GameObjects.Graphics;
  private _playLabel!: Phaser.GameObjects.Text;
  private _logoText!:  Phaser.GameObjects.Text;
  private _subtitleT!: Phaser.GameObjects.Text;
  private _btnHover   = false;
  private _towers: Array<{x:number; h:number; phase:number}> = [];

  constructor() { super({ key: 'MenuScene' }); }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#0A0806');
    this._buildBg();
    this._buildHexGrid();
    this._buildHorizon();
    this._buildTowers();
    this._buildFrame();
    this._buildLogo();
    this._buildPlayBtn();
    this._buildFooter();
    this._buildEmbers();
    this.cameras.main.fadeIn(800, 10, 8, 6);
    this._logoText.setY(GAME_HEIGHT / 2 - 110).setAlpha(0);
    this._subtitleT.setAlpha(0);
    this.tweens.add({ targets: this._logoText,  y: GAME_HEIGHT/2 - 68, alpha: 1, duration: 720, ease: 'Back.easeOut', delay: 280 });
    this.tweens.add({ targets: this._subtitleT, alpha: 1, duration: 600, delay: 760 });
    // Init VK Platform (non-blocking)
    await PlatformManager.init();
    if (PlatformManager.user) {
      this.add.text(GAME_WIDTH - 14, 10,
        `▸ ${PlatformManager.user.name}`,
        { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted_css }
      ).setOrigin(1, 0).setDepth(20);
    }
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    this._t += dt;
    this._drawHex(dt);
    this._drawTorches();
    this._updateEmbers(dt);
    this._logoText.setAlpha(0.88 + Math.sin(this._t * 1.8) * 0.12);
  }

  private _buildBg(): void {
    const g = this.add.graphics().setDepth(0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const rv = Math.round(0x0A + t * 0x10), gv = Math.round(0x08 + t * 0x0D), bv = Math.round(0x06 + t * 0x0A);
      g.fillStyle((rv << 16) | (gv << 8) | bv, 1);
      g.fillRect(0, i * (GAME_HEIGHT / 40), GAME_WIDTH, GAME_HEIGHT / 40 + 1);
    }
    for (let r = 340; r > 0; r -= 22)
      g.fillStyle(COLORS.amberDeep, 0.020 * (1 - r / 340)) && g.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, r * 2.4, r);
  }

  private _buildHexGrid(): void {
    this._hexGfx = this.add.graphics().setDepth(1).setAlpha(0.5);
    const R = 30, HW = R * Math.sqrt(3), HH = R * 1.5;
    let row = 0;
    for (let cy = -R; cy < GAME_HEIGHT + R * 2; cy += HH, row++)
      for (let cx = (row % 2 === 0 ? 0 : HW / 2); cx < GAME_WIDTH + HW; cx += HW)
        this._hexCells.push({ cx, cy, pulse: Math.random() * Math.PI * 2 });
  }

  private _drawHex(dt: number): void {
    const g = this._hexGfx; g.clear();
    for (const c of this._hexCells) {
      c.pulse += dt * 0.7;
      const glow = 0.5 + Math.sin(c.pulse) * 0.5;
      g.lineStyle(1, COLORS.amberDeep, 0.03 + glow * 0.05);
      const pts = [];
      for (let i = 0; i < 6; i++) { const a = Math.PI/6 + (Math.PI/3)*i; pts.push({ x: c.cx + 30*Math.cos(a), y: c.cy + 30*Math.sin(a) }); }
      g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true);
      if (glow > 0.94) { g.fillStyle(COLORS.amberWarm, 0.025); g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true); }
    }
  }

  private _buildHorizon(): void {
    const g = this.add.graphics().setDepth(2);
    const hy = GAME_HEIGHT * 0.60;
    for (let i = 0; i < 28; i++) { const t = i/28; g.fillStyle(0x0A0806, t*t*0.58); g.fillRect(0, hy-90+i*(90/28), GAME_WIDTH, 90/28+1); }
    g.lineStyle(1, COLORS.amberDeep, 0.38); g.beginPath(); g.moveTo(0, hy); g.lineTo(GAME_WIDTH, hy); g.strokePath();
    for (let i = 0; i < 18; i++) {
      const t = i/18, v = Math.round(0x0C + t*0x04);
      g.fillStyle((v<<16)|(Math.round(v*0.82)<<8)|Math.round(v*0.55), 1);
      g.fillRect(0, hy + i*((GAME_HEIGHT-hy)/18), GAME_WIDTH, (GAME_HEIGHT-hy)/18+1);
    }
  }

  private _buildTowers(): void {
    this._torchGfx = this.add.graphics().setDepth(4);
    const hy = GAME_HEIGHT * 0.60;
    this._towers = [
      {x:90,h:170,phase:0.0},{x:215,h:115,phase:1.2},{x:340,h:75,phase:0.4},
      {x:880,h:85,phase:1.8},{x:985,h:138,phase:0.7},{x:1125,h:182,phase:2.1},
    ];
    const g = this.add.graphics().setDepth(3);
    for (const t of this._towers) {
      const w = Math.round(t.h*0.30);
      g.fillStyle(0x060402, 1); g.fillRect(t.x-w/2, hy-t.h, w, t.h);
      const mw = Math.max(4, Math.round(w*0.28)), mh = Math.round(t.h*0.10);
      const cnt = Math.max(2, Math.floor(w/(mw*1.8)));
      for (let i=0;i<cnt;i++) g.fillRect(t.x-w/2+i*(w/cnt), hy-t.h-mh, Math.round(mw*0.85), mh);
      g.fillStyle(COLORS.amberDeep, 0.50); g.fillRect(t.x-1, hy-t.h*0.65, 2, Math.round(t.h*0.12));
    }
  }

  private _drawTorches(): void {
    const g = this._torchGfx; g.clear();
    const hy = GAME_HEIGHT*0.60;
    for (const t of this._towers) {
      const ph = t.phase+this._t, fl = 0.55+Math.sin(ph*7.3)*0.25+Math.sin(ph*13.1)*0.2;
      const ty = hy-t.h-8;
      for (let l=5;l>=1;l--) { g.fillStyle(l>3?COLORS.amberGlow:COLORS.amberWarm, 0.04*l*fl); g.fillCircle(t.x,ty,(l+1)*3*fl); }
      g.fillStyle(0xFFEE88, 0.9*fl); g.fillCircle(t.x,ty,2.5);
      g.fillStyle(0xFFFFCC, 0.7*fl); g.fillCircle(t.x,ty-1,1.2);
    }
  }

  private _buildFrame(): void {
    const g = this.add.graphics().setDepth(8);
    const cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2, pw = 545, ph = 330;
    const lx = cx-pw/2, ty = cy-ph/2;
    g.fillStyle(0x120F0C, 0.88); g.fillRoundedRect(lx, ty, pw, ph, 14);
    g.lineStyle(4, COLORS.walnutLight, 0.40); g.strokeRoundedRect(lx-1, ty-1, pw+2, ph+2, 15);
    g.lineStyle(2, COLORS.amberWarm,   0.78); g.strokeRoundedRect(lx, ty, pw, ph, 14);
    g.lineStyle(1, COLORS.amberGlow,   0.28); g.strokeRoundedRect(lx+5, ty+5, pw-10, ph-10, 10);
    for (const [dcx, dcy] of [[lx,ty],[lx+pw,ty],[lx,ty+ph],[lx+pw,ty+ph]] as [number,number][]) {
      const s = 11;
      g.fillStyle(COLORS.amberWarm, 0.95); g.fillPoints([{x:dcx,y:dcy-s},{x:dcx+s,y:dcy},{x:dcx,y:dcy+s},{x:dcx-s,y:dcy}] as Phaser.Types.Math.Vector2Like[], true);
    }
    const divY = ty+175;
    g.lineStyle(1, COLORS.amberDeep, 0.50); g.beginPath(); g.moveTo(lx+30, divY); g.lineTo(lx+pw-30, divY); g.strokePath();
    g.fillStyle(COLORS.amberWarm, 0.90); g.fillPoints([{x:cx,y:divY-7},{x:cx+7,y:divY},{x:cx,y:divY+7},{x:cx-7,y:divY}] as Phaser.Types.Math.Vector2Like[], true);
    for (const sx of [lx+24, lx+pw-24]) {
      g.lineStyle(1.5, COLORS.amberDeep, 0.45);
      for (let i=0;i<5;i++){const ry=ty+26+i*14; g.beginPath(); g.moveTo(sx-7,ry); g.lineTo(sx+7,ry); g.strokePath();}
    }
  }

  private _buildLogo(): void {
    const cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2;
    this.add.text(cx, cy-120, '✦   B A L T I C   C O A S T   T O W E R   D E F E N S E   ✦', {
      fontFamily: FONT, fontSize: '10px', letterSpacing: 4, color: COLORS.amberDeep_css, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
    this._logoText = this.add.text(cx, cy-68, 'СВЕТЛОГОРСК', {
      fontFamily: FONT, fontSize: '66px', fontStyle: 'bold', color: COLORS.amberBright_css,
      shadow: { offsetX: 0, offsetY: 0, color: COLORS.amberWarm_css, blur: 38, fill: true },
    }).setOrigin(0.5).setDepth(10);
    this._subtitleT = this.add.text(cx, cy+8, 'T O W E R   D E F E N S E', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.textSecondary_css, letterSpacing: 11,
    }).setOrigin(0.5).setDepth(10);
    this.add.text(cx, cy+34, '— Постройте линию обороны. Удержите берег. —', {
      fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted_css,
    }).setOrigin(0.5).setDepth(10);
  }

  private _buildPlayBtn(): void {
    const cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2;
    const bw = 272, bh = 56, by = cy+84;
    this._playPanel = this.add.graphics().setDepth(11).setPosition(cx-bw/2, by);
    const draw = (hover: boolean): void => {
      const g = this._playPanel; g.clear();
      if (hover) {
        g.fillStyle(COLORS.amberDeep, 0.58); g.fillRoundedRect(0,0,bw,bh,10);
        g.fillStyle(COLORS.amberWarm, 0.12); g.fillRoundedRect(0,0,bw,bh/2,10);
        g.lineStyle(2.5, COLORS.amberBright, 1.0); g.strokeRoundedRect(0,0,bw,bh,10);
      } else {
        g.fillStyle(0x0C0906, 0.82); g.fillRoundedRect(0,0,bw,bh,10);
        g.lineStyle(2, COLORS.amberWarm, 0.85); g.strokeRoundedRect(0,0,bw,bh,10);
        g.lineStyle(1, COLORS.amberDeep, 0.38); g.strokeRoundedRect(3,3,bw-6,bh-6,8);
      }
    };
    draw(false);
    this._playLabel = this.add.text(cx, by+bh/2, '▶   НАЧАТЬ ОБОРОНУ', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: COLORS.amberGlow_css,
      shadow: { offsetX: 0, offsetY: 0, color: COLORS.amberWarm_css, blur: 14, fill: true },
    }).setOrigin(0.5).setDepth(12);
    const zone = this.add.zone(cx, by+bh/2, bw, bh).setInteractive({ useHandCursor: true }).setDepth(13);
    zone.on('pointerover',  () => { this._btnHover=true;  draw(true);  this._playLabel.setColor(COLORS.amberBright_css); });
    zone.on('pointerout',   () => { this._btnHover=false; draw(false); this._playLabel.setColor(COLORS.amberGlow_css);   });
    zone.on('pointerdown',  () => {
      AudioManager.init();
      this.cameras.main.flash(180, 255, 200, 80, true);
      this.cameras.main.fadeOut(420, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
    });
    this.tweens.addCounter({
      from: 0, to: Math.PI*2, duration: 2800, repeat: -1,
      onUpdate: (tw) => {
        if (this._btnHover) return;
        const a = 0.50 + Math.sin(tw.getValue() ?? 0) * 0.30;
        const g = this._playPanel; g.clear();
        g.fillStyle(0x0C0906, 0.82); g.fillRoundedRect(0,0,bw,bh,10);
        g.lineStyle(2, COLORS.amberWarm, a); g.strokeRoundedRect(0,0,bw,bh,10);
        g.lineStyle(1, COLORS.amberDeep, a*0.45); g.strokeRoundedRect(3,3,bw-6,bh-6,8);
      },
    });
  }

  private _buildFooter(): void {
    const cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2;
    try {
      const s = localStorage.getItem('svetlotd_save');
      if (s) {
        const b = JSON.parse(s) as {isVictory?:boolean;wavesCompleted?:number;livesRemaining?:number;enemiesKilled?:number};
        const line = b.isVictory
          ? `✦  Победа!  ·  Волна ${b.wavesCompleted}  ·  ❤ ${b.livesRemaining}  ·  ☠ ${b.enemiesKilled}`
          : `Лучший рубеж  ·  Волна ${b.wavesCompleted ?? 0}  ·  ❤ ${b.livesRemaining ?? 0}`;
        this.add.text(cx, cy+152, line, {
          fontFamily: FONT, fontSize: '11px', letterSpacing: 1,
          color: b.isVictory ? COLORS.amberWarm_css : COLORS.textSecondary_css,
        }).setOrigin(0.5).setDepth(10);
      }
    } catch { /**/ }
    this.add.text(cx, cy+170, 'ESC пауза  ·  SPACE пропустить  ·  DEL продать  ·  U улучшить', {
      fontFamily: FONT, fontSize: '9px', letterSpacing: 1, color: COLORS.textMuted_css,
    }).setOrigin(0.5).setDepth(10);
    this.add.text(GAME_WIDTH-14, GAME_HEIGHT-10, 'v0.10.0 · Stage 10', {
      fontFamily: FONT, fontSize: '8px', color: COLORS.walnutLight_css,
    }).setOrigin(1,1).setDepth(10);
  }

  private _buildEmbers(): void {
    this._emberGfx = this.add.graphics().setDepth(9);
    for (let i=0;i<60;i++) this._spawnEmber(true);
  }
  private _spawnEmber(scatter=false): void {
    this._embers.push({
      x: Math.random()*GAME_WIDTH, y: scatter ? Math.random()*GAME_HEIGHT : GAME_HEIGHT+4,
      vx: (Math.random()-0.5)*18, vy: -(Math.random()*22+8),
      r: Math.random()*1.8+0.5, alpha: Math.random()*0.6+0.2, life: Math.random()*4+2,
    });
  }
  private _updateEmbers(dt: number): void {
    const g = this._emberGfx; g.clear();
    for (let i=this._embers.length-1;i>=0;i--) {
      const e = this._embers[i];
      e.x+=e.vx*dt; e.y+=e.vy*dt; e.vx+=(Math.random()-0.5)*8*dt; e.life-=dt;
      if (e.life<=0||e.y<-10){this._embers.splice(i,1);this._spawnEmber();continue;}
      g.fillStyle(e.r>1.4?COLORS.amberWarm:COLORS.amberGlow, Math.min(1,e.life*0.4)*e.alpha);
      g.fillCircle(e.x, e.y, e.r);
    }
  }
}
