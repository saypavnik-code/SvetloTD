// AdPromptUI.ts — Rewarded ad prompt overlays (Priority 6).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, FONT_FAMILY } from '../config';
import { AdManager } from '../systems/AdManager';
import { EconomyManager } from '../systems/EconomyManager';

const FONT    = FONT_FAMILY;
const TIMEOUT = 8000;

export class AdPromptUI {
  private readonly _scene:   Phaser.Scene;
  private readonly _economy: EconomyManager;
  private _root: Phaser.GameObjects.Container | null = null;
  private _onClose?: () => void;

  constructor(scene: Phaser.Scene, economy: EconomyManager) {
    this._scene   = scene;
    this._economy = economy;
  }

  showDoubleGoldPrompt(bonus: number, onClose: () => void): void {
    if (AdManager.inAd) { onClose(); return; }
    this._build(
      '📺  Удвоить награду?',
      `Посмотрите рекламу и получите\n+${bonus} золота дополнительно`,
      `+${bonus} ◆`,
      () => AdManager.showRewardedForOpportunity('double_wave_reward', () => {
        this._economy.addGold(bonus); this._dismiss();
      }, () => this._dismiss()),
      onClose,
    );
  }

  showRevivePrompt(onRevive: () => void, onClose: () => void): void {
    if (AdManager.inAd) { onClose(); return; }
    this._build(
      '📺  Последний шанс!',
      'Посмотрите рекламу и\nвосстановите 3 жизни',
      '+3 ♥',
      () => AdManager.showRewardedForOpportunity('revive_hero', () => {
        onRevive(); this._dismiss();
      }, () => this._dismiss()),
      onClose,
    );
  }

  private _build(title: string, body: string, reward: string, onWatch: () => void, onClose: () => void): void {
    this._onClose = onClose;
    if (this._root) this._root.destroy();
    const s  = this._scene;
    const cw = 360, ch = 180, cx = GAME_WIDTH/2, cy = GAME_HEIGHT/2 - 40;
    this._root = s.add.container(0, 0).setDepth(DEPTH.OVERLAY + 5);

    const dim = s.add.graphics();
    dim.fillStyle(0x000000, 0.45); dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this._root.add(dim);

    const bg = s.add.graphics();
    bg.fillStyle(0x1A1510, 0.96); bg.fillRoundedRect(cx-cw/2, cy-ch/2, cw, ch, 12);
    bg.lineStyle(2, COLORS.amberWarm, 0.80); bg.strokeRoundedRect(cx-cw/2, cy-ch/2, cw, ch, 12);
    this._root.add(bg);

    this._root.add(s.add.text(cx, cy-ch/2+24, title, {
      fontFamily:FONT, fontSize:'16px', fontStyle:'bold', color:COLORS.amberGlow_css,
    }).setOrigin(0.5));
    this._root.add(s.add.text(cx, cy-14, body, {
      fontFamily:FONT, fontSize:'12px', color:COLORS.textSecondary_css,
      align:'center', lineSpacing:5,
    }).setOrigin(0.5));

    // Watch button
    const bw=180, bh=40, bx=cx-bw/2, by2=cy+ch/2-bh-14;
    const btnG=s.add.graphics();
    btnG.fillStyle(COLORS.amberWarm,1); btnG.fillRoundedRect(bx,by2,bw,bh,8);
    btnG.fillStyle(0xFFFFFF,0.08); btnG.fillRoundedRect(bx+2,by2+2,bw-4,bh/2-2,6);
    btnG.lineStyle(1.5,COLORS.amberGlow,0.80); btnG.strokeRoundedRect(bx,by2,bw,bh,8);
    this._root.add(btnG);
    this._root.add(s.add.text(cx-10, by2+bh/2, `▶  ${reward}`, {
      fontFamily:FONT, fontSize:'15px', fontStyle:'bold', color:COLORS.walnutDark_css,
    }).setOrigin(0.5));
    const wz=s.add.zone(bx,by2,bw,bh).setOrigin(0).setInteractive({useHandCursor:true});
    wz.on('pointerdown', onWatch);
    this._root.add(wz);

    // Skip
    const sx2=bx+bw+16;
    this._root.add(s.add.text(sx2, by2+bh/2, 'Пропустить', {
      fontFamily:FONT, fontSize:'11px', color:COLORS.textMuted_css,
    }).setOrigin(0, 0.5));
    const sz=s.add.zone(sx2,by2,90,bh).setOrigin(0).setInteractive({useHandCursor:true});
    sz.on('pointerdown', () => this._dismiss()); this._root.add(sz);

    // Countdown bar
    const barG=s.add.graphics(); this._root.add(barG);
    const t0=Date.now(), bX=cx-cw/2+16, bY=cy-ch/2+6, bW=cw-32;
    s.time.addEvent({ delay:50, loop:true, callback: () => {
      const frac = Math.max(0, 1-(Date.now()-t0)/TIMEOUT);
      barG.clear();
      barG.fillStyle(COLORS.amberDeep,0.40); barG.fillRoundedRect(bX,bY,bW,3,1);
      barG.fillStyle(COLORS.amberWarm,0.75); barG.fillRoundedRect(bX,bY,bW*frac,3,1);
      if (Date.now()-t0 >= TIMEOUT) this._dismiss();
    }});

    this._root.setAlpha(0);
    s.tweens.add({ targets:this._root, alpha:1, y:{from:30,to:0}, duration:250, ease:'Back.easeOut' });
  }

  private _dismiss(): void {
    if (!this._root) return;
    this._scene.tweens.add({
      targets:this._root, alpha:0, y:20, duration:200, ease:'Cubic.easeIn',
      onComplete: () => { this._root?.destroy(); this._root=null; this._onClose?.(); },
    });
  }

  destroy(): void { this._root?.destroy(); }
}
