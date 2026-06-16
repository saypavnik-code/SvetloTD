// PauseOverlay.ts — extracted from GameScene (Priority 2 refactor)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, FONT_FAMILY } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { AudioManager } from '../systems/AudioManager';

const FONT = FONT_FAMILY;

export class PauseOverlay {
  private readonly _scene: Phaser.Scene;
  private _root!:    Phaser.GameObjects.Container;
  private _visible   = false;
  private _sfxClick?: () => void;

  constructor(scene: Phaser.Scene, onSfxClick?: () => void) {
    this._scene    = scene;
    this._sfxClick = onSfxClick;
    this._build();
  }

  get isVisible(): boolean { return this._visible; }

  toggle(): void {
    this._visible = !this._visible;
    this._root.setVisible(this._visible);
    EventBus.emit(this._visible ? GameEvents.GAME_PAUSED : GameEvents.GAME_RESUMED);
  }

  private _build(): void {
    const s = this._scene;
    const cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2;
    this._root = s.add.container(0,0).setDepth(DEPTH.OVERLAY).setVisible(false);

    const dim = s.add.graphics();
    dim.fillStyle(COLORS.walnutDark, 0.55); dim.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    this._root.add(dim);

    const pw=300, ph=280;
    const bg = s.add.graphics();
    bg.fillStyle(COLORS.bgPanel,1); bg.fillRoundedRect(cx-pw/2,cy-ph/2,pw,ph,12);
    bg.lineStyle(2,COLORS.amberDeep,0.5); bg.strokeRoundedRect(cx-pw/2,cy-ph/2,pw,ph,12);
    this._root.add(bg);

    this._root.add(s.add.text(cx,cy-ph/2+22,'⏸ ПАУЗА',{
      fontFamily:FONT, fontSize:'18px', color:COLORS.walnutDark_css, fontStyle:'bold',
    }).setOrigin(0.5));

    const sliderX = cx-pw/2+20, BAR_W = pw-40, BAR_H = 6;
    const makeSlider = (label:string, sy:number, initial:number, onChange:(v:number)=>void): void => {
      this._root.add(s.add.text(sliderX,sy,label,{fontFamily:FONT,fontSize:'13px',color:COLORS.textSecondary_css}));
      const track=s.add.graphics(); track.fillStyle(COLORS.walnutLight,0.25); track.fillRoundedRect(sliderX,sy+22,BAR_W,BAR_H,3); this._root.add(track);
      const fill=s.add.graphics(); this._root.add(fill);
      const pct=s.add.text(sliderX+BAR_W+10,sy+16,Math.round(initial*100)+'%',{fontFamily:FONT,fontSize:'13px',color:COLORS.textPrimary_css}); this._root.add(pct);
      const redraw=(v:number):void=>{ fill.clear(); fill.fillStyle(COLORS.amberWarm,1); fill.fillRoundedRect(sliderX,sy+22,BAR_W*v,BAR_H,3); fill.fillStyle(COLORS.amberBright,1); fill.fillCircle(sliderX+BAR_W*v,sy+22+BAR_H/2,7); pct.setText(Math.round(v*100)+'%'); };
      redraw(initial);
      const zone=s.add.zone(sliderX,sy+10,BAR_W,BAR_H+24).setOrigin(0).setInteractive({useHandCursor:true}); this._root.add(zone);
      const handle=(ptr:Phaser.Input.Pointer):void=>{ const r=Math.max(0,Math.min(1,(ptr.x-sliderX)/BAR_W)); onChange(r); redraw(r); this._sfxClick?.(); };
      zone.on('pointerdown',handle); zone.on('pointermove',(ptr:Phaser.Input.Pointer)=>{ if(ptr.isDown) handle(ptr); });
    };
    makeSlider('Музыка', cy-ph/2+70,  AudioManager.musicGain?.gain.value??0.3, v=>AudioManager.setMusicVolume(v));
    makeSlider('Звуки',  cy-ph/2+130, AudioManager.sfxGain?.gain.value??0.5,   v=>AudioManager.setSfxVolume(v));

    const btnY=cy+ph/2-90;
    const r1=s.add.graphics(); r1.fillStyle(COLORS.amberWarm,1); r1.fillRoundedRect(cx-100,btnY,200,38,8); this._root.add(r1);
    this._root.add(s.add.text(cx,btnY+19,'Продолжить',{fontFamily:FONT,fontSize:'14px',color:COLORS.walnutDark_css,fontStyle:'bold'}).setOrigin(0.5));
    const z1=s.add.zone(cx-100,btnY,200,38).setOrigin(0).setInteractive({useHandCursor:true});
    z1.on('pointerdown',()=>{ this._sfxClick?.(); this.toggle(); }); this._root.add(z1);

    const btnY2=cy+ph/2-42;
    const r2=s.add.graphics(); r2.lineStyle(1,COLORS.walnut,0.7); r2.strokeRoundedRect(cx-100,btnY2,200,34,8); this._root.add(r2);
    this._root.add(s.add.text(cx,btnY2+17,'В главное меню',{fontFamily:FONT,fontSize:'13px',color:COLORS.walnut_css}).setOrigin(0.5));
    const z2=s.add.zone(cx-100,btnY2,200,34).setOrigin(0).setInteractive({useHandCursor:true});
    z2.on('pointerdown',()=>{ this._sfxClick?.(); s.cameras.main.fadeOut(300,240,238,233); s.cameras.main.once('camerafadeoutcomplete',()=>s.scene.start('MenuScene')); }); this._root.add(z2);
  }
}
