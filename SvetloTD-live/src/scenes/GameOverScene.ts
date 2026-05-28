// GameOverScene.ts — Commercial result screen.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_MAIN } from '../config';
import { PlatformManager } from '../systems/PlatformManager';

interface GameOverData {
  victory: boolean; wave?: number; kills?: number; gold?: number; lives?: number;
}
interface Ember { x:number; y:number; vx:number; vy:number; r:number; alpha:number; life:number; }

export class GameOverScene extends Phaser.Scene {
  private _embers: Ember[] = [];
  private _emberGfx!: Phaser.GameObjects.Graphics;
  private _victory = false;

  constructor() { super({ key: 'GameOverScene' }); }

  create(data: GameOverData): void {
    this._victory = data?.victory ?? false;
    const wave  = data?.wave  ?? 0;
    const kills = data?.kills ?? 0;
    const gold  = data?.gold  ?? 0;
    const lives = data?.lives ?? 0;

    this.cameras.main.setBackgroundColor('#0A0806');
    this.cameras.main.fadeIn(600, 0, 0, 0);

    const cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2;
    const ac  = this._victory ? COLORS.amberWarm   : COLORS.danger;
    const acc = this._victory ? COLORS.amberWarm_css : COLORS.textDanger_css;

    // BG gradient
    const bg = this.add.graphics();
    for (let i=0;i<30;i++){const t=i/30;const rv=Math.round(0x0A+t*0x10),gv=Math.round(0x08+t*0x0D),bv=Math.round(0x06+t*0x0A);bg.fillStyle((rv<<16)|(gv<<8)|bv,1);bg.fillRect(0,i*(GAME_HEIGHT/30),GAME_WIDTH,GAME_HEIGHT/30+1);}
    for (let r=360;r>0;r-=24){bg.fillStyle(ac,0.016*(1-r/360));bg.fillEllipse(cx,cy*0.9,r*2.2,r);}

    // Card
    const CW=460, CH=440;
    const card = this.add.graphics();
    card.fillStyle(0x120F0C, 0.90); card.fillRoundedRect(cx-CW/2,cy-CH/2,CW,CH,16);
    card.lineStyle(4, this._victory?COLORS.walnutLight:0x4A1818, 0.50); card.strokeRoundedRect(cx-CW/2-1,cy-CH/2-1,CW+2,CH+2,17);
    card.lineStyle(2, ac, 0.80); card.strokeRoundedRect(cx-CW/2,cy-CH/2,CW,CH,16);
    for (const [dcx,dcy] of [[cx-CW/2,cy-CH/2],[cx+CW/2,cy-CH/2],[cx-CW/2,cy+CH/2],[cx+CW/2,cy+CH/2]] as [number,number][]) {
      const s=11; card.fillStyle(ac,0.90); card.fillPoints([{x:dcx,y:dcy-s},{x:dcx+s,y:dcy},{x:dcx,y:dcy+s},{x:dcx-s,y:dcy}] as Phaser.Types.Math.Vector2Like[], true);
    }

    // Title
    this.add.text(cx,cy-CH/2+28, this._victory?'✦  РУБЕЖ УДЕРЖАН  ✦':'—  РУБЕЖ ПРОРВАН  —', { fontFamily: FONT_MAIN, fontSize: '10px', letterSpacing:6, color:acc, fontStyle:'bold' }).setOrigin(0.5);
    const title = this.add.text(cx, cy-CH/2+70, this._victory?'ПОБЕДА!':'ПОРАЖЕНИЕ', { fontFamily: FONT_MAIN, fontSize: '58px', fontStyle:'bold', color:acc, shadow:{offsetX:0,offsetY:0,color:acc,blur:32,fill:true} }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets:title, alpha:1, duration:600, ease:'Cubic.easeOut', delay:200 });
    this.add.text(cx, cy-CH/2+136, this._victory?'Берег Балтики выстоял. Враг отступил.':'Линия обороны пала. Берег занят.', { fontFamily: FONT_MAIN, fontSize:'13px', color:COLORS.textSecondary_css, letterSpacing:1 }).setOrigin(0.5);

    // Divider
    const divY = cy-CH/2+162;
    const divG = this.add.graphics();
    divG.lineStyle(1,ac,0.40); divG.beginPath(); divG.moveTo(cx-CW/2+30,divY); divG.lineTo(cx+CW/2-30,divY); divG.strokePath();
    divG.fillStyle(ac,0.85); divG.fillPoints([{x:cx,y:divY-6},{x:cx+6,y:divY},{x:cx,y:divY+6},{x:cx-6,y:divY}] as Phaser.Types.Math.Vector2Like[], true);

    // Stats
    const stats = [ {icon:'⚔',label:'УНИЧТОЖЕНО',value:`${kills}`},{icon:'🌊',label:'ВОЛН',value:`${wave}`},{icon:'◆',label:'ЗОЛОТО',value:`${gold}`},{icon:'♥',label:'ЖИЗНИ',value:`${lives}`} ];
    const CL=(CW-60)/2, CH2=64, CGAP=10;
    const gx0=cx-CW/2+30, gy0=divY+18;
    stats.forEach(({icon,label,value},i) => {
      const col2=i%2,row=Math.floor(i/2);
      const sx=gx0+col2*(CL+CGAP), sy=gy0+row*(CH2+CGAP);
      const cG=this.add.graphics();
      cG.fillStyle(0x1A1510,0.70); cG.fillRoundedRect(sx,sy,CL,CH2,8);
      cG.lineStyle(1,this._victory?COLORS.amberDeep:0x4A1818,0.35); cG.strokeRoundedRect(sx,sy,CL,CH2,8);
      this.add.text(sx+14,sy+CH2/2-1,icon,{fontFamily:FONT_MAIN,fontSize:'18px'}).setOrigin(0,0.5);
      this.add.text(sx+40,sy+12,label,{fontFamily:FONT_MAIN,fontSize:'9px',color:COLORS.textMuted_css,letterSpacing:2});
      this.add.text(sx+40,sy+26,value,{fontFamily:FONT_MAIN,fontSize:'22px',fontStyle:'bold',color:this._victory?COLORS.amberGlow_css:COLORS.textSecondary_css});
    });

    // Buttons
    const btnY = cy+CH/2-70;
    this._btn(cx-110, btnY, 200, 40, '▶  Играть снова', ac, true, () => { this.cameras.main.fadeOut(380,0,0,0); this.cameras.main.once('camerafadeoutcomplete',()=>this.scene.start('GameScene')); });
    this._btn(cx+120, btnY, 180, 40, 'В меню', 0, false, () => { this.cameras.main.fadeOut(380,0,0,0); this.cameras.main.once('camerafadeoutcomplete',()=>this.scene.start('MenuScene')); });

    // Save + leaderboard
    const score = kills * 10 + wave * 100 + (this._victory ? 5000 : 0);
    PlatformManager.submitScore(score);
    PlatformManager.saveData({ isVictory: this._victory, wavesCompleted: wave, livesRemaining: lives, enemiesKilled: kills });

    this._emberGfx = this.add.graphics().setDepth(20);
    if (this._victory) for (let i=0;i<50;i++) this._spawnEmber(true);
  }

  private _btn(x:number, y:number, w:number, h:number, label:string, col:number, filled:boolean, cb:()=>void): void {
    const g = this.add.graphics();
    const dn = (): void => {
      g.clear();
      if (filled) { g.fillStyle(col,0.95);g.fillRoundedRect(x-w/2,y-h/2,w,h,8);g.fillStyle(0xFFFFFF,0.08);g.fillRoundedRect(x-w/2+2,y-h/2+2,w-4,h/2-2,6);g.lineStyle(1.5,COLORS.amberGlow,0.7);g.strokeRoundedRect(x-w/2,y-h/2,w,h,8); }
      else { g.fillStyle(0x1A1510,0.75);g.fillRoundedRect(x-w/2,y-h/2,w,h,8);g.lineStyle(1.5,COLORS.walnutLight,0.40);g.strokeRoundedRect(x-w/2,y-h/2,w,h,8); }
    };
    dn();
    this.add.text(x,y,label,{fontFamily:FONT_MAIN,fontSize:'14px',fontStyle:'bold',color:filled?COLORS.walnutDark_css:COLORS.textSecondary_css}).setOrigin(0.5).setDepth(1);
    const zone = this.add.zone(x-w/2,y-h/2,w,h).setOrigin(0).setInteractive({useHandCursor:true}).setDepth(2);
    zone.on('pointerover',()=>{g.clear();g.fillStyle(col||COLORS.walnutLight,filled?1.0:0.15);g.fillRoundedRect(x-w/2,y-h/2,w,h,8);g.lineStyle(2,col||COLORS.walnutLight,0.90);g.strokeRoundedRect(x-w/2,y-h/2,w,h,8);});
    zone.on('pointerout',dn); zone.on('pointerdown',cb);
  }

  update(_t: number, delta: number): void {
    if (!this._victory) return;
    const g=this._emberGfx; g.clear();
    for (let i=this._embers.length-1;i>=0;i--) {
      const e=this._embers[i];
      e.x+=e.vx*(delta/1000);e.y+=e.vy*(delta/1000);e.vx+=(Math.random()-0.5)*8*(delta/1000);e.life-=delta/1000;
      if (e.life<=0||e.y<-10){this._embers.splice(i,1);this._spawnEmber();continue;}
      g.fillStyle(e.r>1.4?COLORS.amberWarm:COLORS.amberGlow,Math.min(1,e.life*0.4)*e.alpha);g.fillCircle(e.x,e.y,e.r);
    }
  }
  private _spawnEmber(scatter=false): void {
    this._embers.push({x:Math.random()*GAME_WIDTH,y:scatter?Math.random()*GAME_HEIGHT:GAME_HEIGHT+4,vx:(Math.random()-0.5)*18,vy:-(Math.random()*22+8),r:Math.random()*1.8+0.5,alpha:Math.random()*0.6+0.2,life:Math.random()*4+2});
  }
}
