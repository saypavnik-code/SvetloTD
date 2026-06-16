// MetaScreen.ts — Out-of-match upgrade tree scene (Priority 5).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_MAIN, DEPTH } from '../config';
import { META_UPGRADES, MetaProgression, type MetaUpgrade } from '../systems/MetaProgression';

const FONT = FONT_MAIN;

export class MetaScreen extends Phaser.Scene {
  private _starText!: Phaser.GameObjects.Text;
  private _containers: Phaser.GameObjects.Container[] = [];

  constructor() { super({ key: 'MetaScreen' }); }

  async create(): Promise<void> {
    await MetaProgression.load();
    this.cameras.main.setBackgroundColor('#0A0806');
    this.cameras.main.fadeIn(400, 10, 8, 6);
    this._buildBg();
    this._buildHeader();
    this._buildGrid();
    this._buildBackBtn();
  }

  private _buildBg(): void {
    const g = this.add.graphics();
    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      const rv = Math.round(0x0A + t*0x10), gv = Math.round(0x08 + t*0x0D), bv = Math.round(0x06 + t*0x0A);
      g.fillStyle((rv<<16)|(gv<<8)|bv, 1);
      g.fillRect(0, i*(GAME_HEIGHT/30), GAME_WIDTH, GAME_HEIGHT/30+1);
    }
  }

  private _buildHeader(): void {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 36, '★  ДЕРЕВО УЛУЧШЕНИЙ', {
      fontFamily:FONT, fontSize:'20px', fontStyle:'bold',
      color:COLORS.amberWarm_css, letterSpacing:4,
    }).setOrigin(0.5);
    this.add.text(cx, 66, 'Тратьте звёзды на постоянные улучшения для всех игр', {
      fontFamily:FONT, fontSize:'12px', color:COLORS.textSecondary_css,
    }).setOrigin(0.5);
    const sx = cx - 80;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.amberDeep, 0.20); bg.fillRoundedRect(sx, 82, 160, 32, 8);
    bg.lineStyle(1.5, COLORS.amberWarm, 0.60); bg.strokeRoundedRect(sx, 82, 160, 32, 8);
    this._starText = this.add.text(cx, 98, `★ ${MetaProgression.stars} звёзд`, {
      fontFamily:FONT, fontSize:'15px', fontStyle:'bold', color:COLORS.amberGlow_css,
    }).setOrigin(0.5);
  }

  private _buildGrid(): void {
    this._containers.forEach(c => c.destroy());
    this._containers = [];
    const cols = 3, cW = 280, cH = 150, gX = 20, gY = 18;
    const totalW = cols*cW + (cols-1)*gX;
    const x0 = (GAME_WIDTH - totalW) / 2;
    const y0 = 140;
    META_UPGRADES.forEach((upg, i) => {
      const col = i%cols, row = Math.floor(i/cols);
      const cx2 = x0 + col*(cW+gX), cy2 = y0 + row*(cH+gY);
      const cnt = this.add.container(0,0).setDepth(1);
      this._containers.push(cnt);
      this._buildCard(cnt, upg, cx2, cy2, cW, cH);
    });
  }

  private _buildCard(cnt: Phaser.GameObjects.Container, upg: MetaUpgrade, cx2:number, cy2:number, cW:number, cH:number): void {
    cnt.removeAll(true);
    const lv = MetaProgression.getLevel(upg.id);
    const maxed = lv >= upg.maxLevel;
    const afford = MetaProgression.canUpgrade(upg.id);

    const bg = this.add.graphics();
    bg.fillStyle(maxed ? 0x1A2010 : 0x1A1510, 0.92);
    bg.fillRoundedRect(cx2, cy2, cW, cH, 10);
    bg.lineStyle(1.5, maxed ? COLORS.success : afford ? COLORS.amberWarm : COLORS.walnutLight,
      maxed ? 0.70 : afford ? 0.65 : 0.22);
    bg.strokeRoundedRect(cx2, cy2, cW, cH, 10);
    if (maxed) { bg.fillStyle(COLORS.success, 0.06); bg.fillRoundedRect(cx2, cy2, cW, cH, 10); }
    cnt.add(bg);

    cnt.add(this.add.text(cx2+18, cy2+cH/2-8, upg.icon, {
      fontFamily:FONT, fontSize:'28px', color: maxed ? COLORS.success_css : COLORS.amberWarm_css,
    }).setOrigin(0, 0.5));

    cnt.add(this.add.text(cx2+54, cy2+16, upg.name, {
      fontFamily:FONT, fontSize:'15px', fontStyle:'bold', color:COLORS.textPrimary_css,
    }));
    cnt.add(this.add.text(cx2+54, cy2+38, upg.description, {
      fontFamily:FONT, fontSize:'11px', color:COLORS.textSecondary_css,
      wordWrap:{ width: cW-66 },
    }));

    // Pip bar
    for (let p = 0; p < upg.maxLevel; p++) {
      const pipG = this.add.graphics();
      const on = p < lv;
      pipG.fillStyle(on ? COLORS.amberWarm : COLORS.walnutDark, on ? 1 : 0.40);
      pipG.fillRoundedRect(cx2+54+p*22, cy2+cH-38, 16, 6, 3);
      cnt.add(pipG);
    }
    cnt.add(this.add.text(cx2+cW-14, cy2+cH-34, maxed ? 'MAX' : `${lv}/${upg.maxLevel}`, {
      fontFamily:FONT, fontSize:'11px', color: maxed ? COLORS.success_css : COLORS.textMuted_css,
    }).setOrigin(1,0));

    if (!maxed) {
      const bw = cW-68, bh = 28, bx2 = cx2+54, by2 = cy2+cH-34;
      const btnG = this.add.graphics();
      btnG.fillStyle(afford ? COLORS.amberDeep : COLORS.walnutDark, afford ? 0.45 : 0.22);
      btnG.fillRoundedRect(bx2, by2, bw, bh, 6);
      btnG.lineStyle(1, afford ? COLORS.amberWarm : COLORS.walnutLight, afford ? 0.70 : 0.18);
      btnG.strokeRoundedRect(bx2, by2, bw, bh, 6);
      cnt.add(btnG);
      cnt.add(this.add.text(bx2+bw/2, by2+bh/2,
        afford ? `★ ${upg.costPerLevel}  Улучшить` : `★ ${upg.costPerLevel}  Мало звёзд`, {
          fontFamily:FONT, fontSize:'12px', fontStyle: afford?'bold':'normal',
          color: afford ? COLORS.amberGlow_css : COLORS.textMuted_css,
        }).setOrigin(0.5));
      if (afford) {
        const zone = this.add.zone(bx2, by2, bw, bh).setOrigin(0).setInteractive({useHandCursor:true});
        zone.on('pointerdown', () => {
          if (MetaProgression.upgrade(upg.id)) {
            this._starText.setText(`★ ${MetaProgression.stars} звёзд`);
            this._buildGrid();
          }
        });
        cnt.add(zone);
      }
    }
  }

  private _buildBackBtn(): void {
    const cx = GAME_WIDTH/2, y = GAME_HEIGHT - 52;
    const g = this.add.graphics();
    g.fillStyle(COLORS.walnutDark, 0.70); g.fillRoundedRect(cx-100, y, 200, 38, 8);
    g.lineStyle(1.5, COLORS.walnutLight, 0.40); g.strokeRoundedRect(cx-100, y, 200, 38, 8);
    this.add.text(cx, y+19, '← В главное меню', {
      fontFamily:FONT, fontSize:'14px', color:COLORS.textSecondary_css,
    }).setOrigin(0.5).setDepth(2);
    const zone = this.add.zone(cx-100, y, 200, 38).setOrigin(0).setInteractive({useHandCursor:true}).setDepth(3);
    zone.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });
  }
}
