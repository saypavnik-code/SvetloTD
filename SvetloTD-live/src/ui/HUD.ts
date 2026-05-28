import Phaser from 'phaser';
import {
  GAME_WIDTH, GRID_COLS, TILE_SIZE,
  COLORS, DEPTH, FONT_FAMILY, STARTING_LIVES,
} from '../config';
import { EconomyManager } from '../systems/EconomyManager';
import { WaveManager }    from '../systems/WaveManager';
import { GameSpeed }      from '../systems/GameSpeed';
import { WAVES }          from '../data/waves';

const BAR_H  = 50;
const FONT   = FONT_FAMILY;
const FIELD_W = GRID_COLS * TILE_SIZE; // 720

export class HUD {
  private readonly _scene:   Phaser.Scene;
  private readonly _economy: EconomyManager;
  private readonly _wm:      WaveManager;

  private _livesNum!:   Phaser.GameObjects.Text;
  private _livesIcon!:  Phaser.GameObjects.Text;
  private _goldNum!:    Phaser.GameObjects.Text;
  private _lumberNum!:  Phaser.GameObjects.Text;
  private _waveText!:   Phaser.GameObjects.Text;
  private _phaseTag!:   Phaser.GameObjects.Text;
  private _waveBarFill!:Phaser.GameObjects.Graphics;
  private _speedBtns: Array<{
    bg: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    speed: number;
    bx: number; by: number; bw: number; bh: number;
  }> = [];

  private _goldTween:   Phaser.Tweens.Tween | null = null;
  private _goldDisplay  = 0;
  private _wavePulseT   = 0;
  private _waveIsBoss   = false;
  private _waveProgress = 0;

  constructor(scene: Phaser.Scene, economy: EconomyManager, wm: WaveManager) {
    this._scene   = scene;
    this._economy = economy;
    this._wm      = wm;
    this._build();
  }

  private _build(): void {
    const s = this._scene;
    const gw = GAME_WIDTH;
    const FW = FIELD_W;

    // Glass panel
    const bg = s.add.graphics().setDepth(DEPTH.HUD - 2);
    bg.fillStyle(0x0E0B08, 0.96); bg.fillRect(0, 0, gw, BAR_H);
    bg.fillStyle(0x221C14, 0.55); bg.fillRect(0, 0, gw, 7);
    bg.lineStyle(1, 0x342B1E, 0.6); bg.beginPath(); bg.moveTo(0,1); bg.lineTo(gw,1); bg.strokePath();
    bg.lineStyle(2, COLORS.amberWarm, 0.88); bg.beginPath(); bg.moveTo(0, BAR_H-1); bg.lineTo(gw, BAR_H-1); bg.strokePath();
    bg.lineStyle(3, COLORS.amberDeep, 0.20); bg.beginPath(); bg.moveTo(0, BAR_H+1); bg.lineTo(gw, BAR_H+1); bg.strokePath();
    bg.lineStyle(2, COLORS.walnutDark, 0.9); bg.beginPath(); bg.moveTo(FW,0); bg.lineTo(FW, BAR_H); bg.strokePath();
    bg.lineStyle(1, COLORS.amberDeep, 0.7); bg.beginPath(); bg.moveTo(FW+2,0); bg.lineTo(FW+2, BAR_H); bg.strokePath();

    this._waveBarFill = s.add.graphics().setDepth(DEPTH.HUD - 1);

    // Lives
    const S1 = 14;
    this._pill(bg, S1-4, 11, 90, 28, COLORS.danger, 0.14, 0.32);
    this._livesIcon = s.add.text(S1+1, BAR_H/2, '♥', { fontFamily: FONT, fontSize: '16px', color: COLORS.textDanger_css, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this._livesNum  = s.add.text(S1+24, BAR_H/2, `${STARTING_LIVES}`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: COLORS.textDanger_css, shadow:{offsetX:0,offsetY:0,color:'#B34838',blur:9,fill:true} }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this._livesNum.setData('ox', S1+24);
    s.add.text(S1+62, BAR_H/2+2, 'ЖИЗ', { fontFamily: FONT, fontSize: '8px', letterSpacing: 1, color: COLORS.textMuted_css }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this._div(bg, 114);

    // Gold
    const S2 = 122;
    this._pill(bg, S2-4, 11, 98, 28, COLORS.amberDeep, 0.16, 0.30);
    s.add.text(S2+1, BAR_H/2, '◆', { fontFamily: FONT, fontSize: '14px', color: COLORS.amberWarm_css }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this._goldDisplay = this._economy.gold;
    this._goldNum = s.add.text(S2+22, BAR_H/2, `${this._economy.gold}`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: COLORS.amberGlow_css, shadow:{offsetX:0,offsetY:0,color:COLORS.amberWarm_css,blur:11,fill:true} }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    s.add.text(S2+68, BAR_H/2+2, 'ЗОЛОТО', { fontFamily: FONT, fontSize: '8px', letterSpacing: 1, color: COLORS.textMuted_css }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this._div(bg, 232);

    // Lumber
    const S3 = 240;
    this._pill(bg, S3-4, 11, 84, 28, 0x2A6A10, 0.18, 0.30);
    s.add.text(S3+1, BAR_H/2-1, '🪵', { fontFamily: FONT, fontSize: '13px' }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this._lumberNum = s.add.text(S3+26, BAR_H/2, '0', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#7CBA5C', shadow:{offsetX:0,offsetY:0,color:'#2A6A10',blur:8,fill:true} }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    s.add.text(S3+54, BAR_H/2+2, 'ЛЕС', { fontFamily: FONT, fontSize: '8px', letterSpacing: 1, color: COLORS.textMuted_css }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);

    // Centre wave label
    const CX = FW/2;
    this._waveText = s.add.text(CX, BAR_H/2-5, `Волна 1 / ${WAVES.length}`, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: COLORS.textPrimary_css, shadow:{offsetX:0,offsetY:0,color:'#000',blur:7,fill:true} }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this._phaseTag = s.add.text(CX, BAR_H/2+13, 'ПОДГОТОВКА', { fontFamily: FONT, fontSize: '8px', letterSpacing: 4, color: COLORS.textMuted_css }).setOrigin(0.5).setDepth(DEPTH.HUD);

    // Speed pills
    const PW_B = 42, PH_B = 28, GAP = 6;
    const px0 = GAME_WIDTH - 3*(PW_B+GAP) + GAP - 18;
    const py0 = (BAR_H - PH_B) / 2;
    s.add.text(px0-10, BAR_H/2, 'СКОР', { fontFamily: FONT, fontSize: '8px', letterSpacing: 1, color: COLORS.textMuted_css }).setOrigin(1, 0.5).setDepth(DEPTH.HUD);
    [1,2,3].forEach((spd, i) => {
      const bx = px0 + i*(PW_B+GAP);
      const bgG = s.add.graphics().setDepth(DEPTH.HUD);
      const lbl = s.add.text(bx+PW_B/2, py0+PH_B/2, `×${spd}`, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.textSecondary_css }).setOrigin(0.5).setDepth(DEPTH.HUD+1);
      this._speedBtns.push({ bg: bgG, label: lbl, speed: spd, bx, by: py0, bw: PW_B, bh: PH_B });
      this._redrawSpeed(i, spd===1);
      const zone = s.add.zone(bx, py0, PW_B, PH_B).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD+2);
      zone.on('pointerover', () => {
        if (GameSpeed.speed !== spd) { bgG.clear(); bgG.fillStyle(COLORS.amberDeep, 0.30); bgG.fillRoundedRect(bx,py0,PW_B,PH_B,6); bgG.lineStyle(1,COLORS.amberWarm,0.50); bgG.strokeRoundedRect(bx,py0,PW_B,PH_B,6); }
      });
      zone.on('pointerout', () => this._redrawSpeed(i, GameSpeed.speed===spd));
      zone.on('pointerdown', () => { GameSpeed.set(spd); this._speedBtns.forEach((b,j) => this._redrawSpeed(j, b.speed===spd)); });
    });
  }

  private _div(g: Phaser.GameObjects.Graphics, x: number): void {
    g.lineStyle(1, COLORS.walnutLight, 0.22); g.beginPath(); g.moveTo(x,9); g.lineTo(x,BAR_H-9); g.strokePath();
    g.lineStyle(1, 0x080604, 0.55); g.beginPath(); g.moveTo(x+1,9); g.lineTo(x+1,BAR_H-9); g.strokePath();
  }

  private _pill(g: Phaser.GameObjects.Graphics, x:number, y:number, w:number, h:number, col:number, fa:number, sa:number): void {
    g.fillStyle(col, fa); g.fillRoundedRect(x,y,w,h,6);
    g.lineStyle(1, col, sa); g.strokeRoundedRect(x,y,w,h,6);
  }

  private _redrawSpeed(idx: number, active: boolean): void {
    const { bg, label, bx, by, bw, bh } = this._speedBtns[idx];
    bg.clear();
    if (active) {
      bg.fillStyle(COLORS.amberWarm, 1.0); bg.fillRoundedRect(bx,by,bw,bh,6);
      bg.fillStyle(0xFFFFFF, 0.07); bg.fillRoundedRect(bx+2,by+2,bw-4,bh/2-2,4);
      bg.lineStyle(1.5, COLORS.amberGlow, 0.9); bg.strokeRoundedRect(bx,by,bw,bh,6);
      label.setColor(COLORS.walnutDark_css).setFontStyle('bold');
    } else {
      bg.fillStyle(0x1A1510, 0.70); bg.fillRoundedRect(bx,by,bw,bh,6);
      bg.lineStyle(1, COLORS.walnutLight, 0.28); bg.strokeRoundedRect(bx,by,bw,bh,6);
      label.setColor(COLORS.textMuted_css).setFontStyle('normal');
    }
  }

  private _drawWaveBar(): void {
    const g = this._waveBarFill; g.clear();
    if (this._waveProgress <= 0) return;
    const w = Math.round(FIELD_W * this._waveProgress);
    g.fillStyle(0x1A1510, 0.7); g.fillRect(0, BAR_H, FIELD_W, 3);
    g.fillStyle(COLORS.amberWarm, 0.60); g.fillRect(0, BAR_H, w, 3);
    if (w > 6) { g.fillStyle(COLORS.amberGlow, 0.88); g.fillRect(w-6, BAR_H, 6, 3); }
  }

  // Public API
  setLumber(n: number): void { this._lumberNum.setText(`${n}`); }

  setLives(n: number): void {
    this._livesNum.setText(`${n}`);
    const ox = this._livesNum.getData('ox') as number;
    this._scene.tweens.add({ targets: this._livesNum, x:{from:ox-5,to:ox}, duration:180, yoyo:true, repeat:2, onComplete: () => this._livesNum.setX(ox) });
    this._livesIcon.setColor('#FF7777');
    this._scene.time.delayedCall(320, () => this._livesIcon.setColor(COLORS.textDanger_css));
  }

  setGold(n: number): void {
    if (this._goldTween) this._goldTween.stop();
    const obj = { val: this._goldDisplay };
    this._goldTween = this._scene.tweens.add({
      targets: obj, val: n, duration: 340, ease: 'Cubic.easeOut',
      onUpdate: () => { this._goldDisplay = Math.round(obj.val); this._goldNum.setText(`${this._goldDisplay}`); },
      onComplete: () => { this._goldDisplay = n; this._goldNum.setText(`${n}`); },
    });
  }

  setWave(waveNum: number, isBoss: boolean): void {
    this._waveIsBoss = isBoss;
    this._wavePulseT = 0;
    this._waveText.setText(`Волна ${Math.min(waveNum, WAVES.length)} / ${WAVES.length}`);
    this._waveText.setColor(isBoss ? COLORS.textDanger_css : COLORS.textPrimary_css);
    const phase = waveNum<=5?'ТУТОРИАЛ':waveNum<=10?'НАРАСТАНИЕ':waveNum<=15?'ЭСКАЛАЦИЯ':'ХАОС';
    this._phaseTag.setText(isBoss ? '⚠  ВОЛНА БОССА' : phase);
    this._phaseTag.setColor(isBoss ? COLORS.textDanger_css : COLORS.textMuted_css);
  }

  setCountdownProgress(fraction: number): void {
    this._waveProgress = Math.max(0, Math.min(1, fraction));
  }

  update(delta: number): void {
    if (this._waveIsBoss) {
      this._wavePulseT += delta * 0.004;
      this._waveText.setAlpha(0.62 + Math.sin(this._wavePulseT * Math.PI * 2) * 0.38);
    } else {
      this._waveText.setAlpha(1);
    }
    this._drawWaveBar();
  }
}
