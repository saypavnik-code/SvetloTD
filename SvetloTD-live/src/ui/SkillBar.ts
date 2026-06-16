// SkillBar.ts — extracted from GameScene (Priority 2 refactor)
import Phaser from 'phaser';
import { GAME_HEIGHT, COLORS, DEPTH, FONT_FAMILY } from '../config';
import { Hero } from '../entities/Hero';

const FONT = FONT_FAMILY;
const SLOT = 42, PAD = 8;

export class SkillBar {
  private readonly _scene: Phaser.Scene;
  private readonly _hero:  Hero;
  private _slots: Array<{bg:Phaser.GameObjects.Graphics;cd:Phaser.GameObjects.Text}> = [];
  private _timer = 0;

  constructor(scene: Phaser.Scene, hero: Hero) {
    this._scene = scene; this._hero = hero;
    this._build();
  }

  private _build(): void {
    const s = this._scene;
    const baseY = GAME_HEIGHT - 52 - PAD;
    const baseX = PAD;
    const keys = ['Q', 'W'] as const;
    keys.forEach((key, i) => {
      const sx = baseX + i*(SLOT+PAD), sy = baseY;
      const bg = s.add.graphics().setDepth(DEPTH.HUD);
      bg.lineStyle(1,COLORS.walnutLight,0.6); bg.fillStyle(COLORS.walnutDark,0.20);
      bg.fillRoundedRect(sx,sy,SLOT,SLOT,6); bg.strokeRoundedRect(sx,sy,SLOT,SLOT,6);
      s.add.text(sx+5,sy+4,key,{fontFamily:FONT,fontSize:'12px',color:COLORS.textSecondary_css,fontStyle:'bold'}).setDepth(DEPTH.HUD+1);
      const cd=s.add.text(sx+SLOT/2,sy+SLOT/2+4,'✓',{fontFamily:FONT,fontSize:'15px',color:COLORS.amberWarm_css,fontStyle:'bold'}).setOrigin(0.5).setDepth(DEPTH.HUD+1);
      this._slots.push({bg,cd});
    });
  }

  update(dtSecs: number): void {
    this._timer -= dtSecs;
    if (this._timer > 0) return;
    this._timer = 0.1;
    const cds    = [this._hero.skillQCooldown, this._hero.skillWCooldown];
    const maxCds = [this._hero.SKILL_Q_MAX_CD, this._hero.SKILL_W_MAX_CD];
    const baseX  = PAD, baseY = GAME_HEIGHT - 52 - PAD;
    this._slots.forEach(({bg,cd}, i) => {
      const sx=baseX+i*(SLOT+PAD), sy=baseY, cdv=cds[i], ready=cdv<=0;
      bg.clear();
      if (ready) { bg.lineStyle(2,COLORS.amberWarm,0.90); bg.fillStyle(COLORS.amberDeep,0.25); }
      else        { bg.lineStyle(1,COLORS.walnutLight,0.45); bg.fillStyle(COLORS.walnutDark,0.50); }
      bg.fillRoundedRect(sx,sy,SLOT,SLOT,6); bg.strokeRoundedRect(sx,sy,SLOT,SLOT,6);
      if (!ready) { const frac=cdv/maxCds[i]; bg.fillStyle(COLORS.walnutDark,0.55); bg.fillRoundedRect(sx,sy+SLOT-Math.round(SLOT*frac),SLOT,Math.round(SLOT*frac),6); }
      cd.setText(ready?'✓':String(Math.ceil(cdv)));
      cd.setColor(ready?COLORS.amberWarm_css:COLORS.textMuted_css);
    });
  }
}
