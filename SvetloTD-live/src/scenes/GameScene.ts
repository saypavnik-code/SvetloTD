// GameScene.ts — Stage 10. Phase 2: LumberManager, InterestSystem, dynamic economy.

import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, GRID_COLS, GRID_ROWS,
  COLORS, DEPTH, FONT_MAIN,
} from '../config';
import { MAP_DATA, BASE_TILE_COL, BASE_TILE_ROW } from '../data/mapData';
import { Enemy }          from '../entities/Enemy';
import { Projectile }     from '../entities/Projectile';
import { Tower }          from '../entities/Tower';
import { Hero }           from '../entities/Hero';
import { WaveManager }    from '../systems/WaveManager';
import { BuildSystem }    from '../systems/BuildSystem';
import { EconomyManager } from '../systems/EconomyManager';
import { LumberManager }  from '../systems/LumberManager';
import { InterestSystem } from '../systems/InterestSystem';
import { AuraSystem }     from '../systems/AuraSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { AdManager }      from '../systems/AdManager';
import { ObjectPool }     from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';
import { TowerPanel }     from '../ui/TowerPanel';
import { WaveInfo }       from '../ui/WaveInfo';
import { HUD }            from '../ui/HUD';
import { FloatingTextPool }  from '../ui/FloatingTextPool';
import { TutorialOverlay }  from '../ui/TutorialOverlay';
import { PauseOverlay }     from '../ui/PauseOverlay';
import { SkillBar }         from '../ui/SkillBar';
import { AdPromptUI }        from '../ui/AdPromptUI';
import { MobileBottomSheet } from '../ui/MobileBottomSheet';
import { MobileAdapter }    from '../systems/MobileAdapter';
import { GameSpeed }      from '../systems/GameSpeed';
import { AudioManager }   from '../systems/AudioManager';
import { AmbientMusic }   from '../systems/AmbientMusic';
import { SFX }            from '../systems/SFX';

const ENEMY_POOL_SIZE = 50;
const PROJ_POOL_SIZE  = 80;
const BASE_SIZE       = 2 * TILE_SIZE;
const FONT            = FONT_MAIN;

export class GameScene extends Phaser.Scene {
  private _economy!:      EconomyManager;
  private _lumber!:       LumberManager;
  private _interest!:     InterestSystem;
  private _aura!:         AuraSystem;
  private _particles!:    ParticleSystem;
  private _waveManager!:  WaveManager;
  private _buildSystem!:  BuildSystem;
  private _enemyPool!:    ObjectPool<Enemy>;
  private _projPool!:     ObjectPool<Projectile>;
  private _towerPanel!:   TowerPanel;
  private _waveInfo!:     WaveInfo;
  private _hud!:          HUD;
  private _floatingText!: FloatingTextPool;

  // Batch render graphics
  private _shadowGfx!:    Phaser.GameObjects.Graphics;
  private _enemyGfx!:     Phaser.GameObjects.Graphics;
  private _hpGfx!:        Phaser.GameObjects.Graphics;
  private _projGfx!:      Phaser.GameObjects.Graphics;
  private _towerGfx!:     Phaser.GameObjects.Graphics;
  private _effectGfx!:    Phaser.GameObjects.Graphics;
  private _heroGfx!:      Phaser.GameObjects.Graphics;
  private _vfxGfx!:       Phaser.GameObjects.Graphics;

  // Hero
  private _hero!:         Hero;

  // VFX
  private _vfxList: Array<{
    x: number; y: number;
    maxRadius: number; color: number;
    elapsed: number; duration: number;
    type: 'expand_circle' | 'pulse_ring';
  }> = [];

  // Boss warning
  private _bossWarning!: Phaser.GameObjects.Text;

  // Tutorial
  private _tutorial!:       TutorialOverlay;
  private _pauseOverlay!:   PauseOverlay;
  private _skillBar!:       SkillBar;
  private _mobileSheet!:    MobileBottomSheet;
  private _adPrompt!:       AdPromptUI;

  // Skill UI


  // Base pulse
  private _baseGlow!:    Phaser.GameObjects.Graphics;
  private _basePulseT  = 0;

  // Pause overlay
  private _isPaused      = false;

  // Game-over overlay
  private _gameOverRoot!: Phaser.GameObjects.Container;
  private _gameOver       = false;

  // Stats
  private _totalKills   = 0;
  private _totalGoldEarned = 0;
  private _wavesReached = 1;

  // Audio
  private _ambientMusic: AmbientMusic | null = null;
  private _sfx:          SFX | null = null;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgGameField);
    this.cameras.main.fadeIn(400, 232, 226, 214);

    this._buildSystems();
    this._buildBatchGraphics();
    this._buildMap();
    this._buildBase();

    // Hero — spawns at base center
    this._hero    = new Hero();
    this._heroGfx = this.add.graphics().setDepth(DEPTH.HERO);
    this._vfxGfx  = this.add.graphics().setDepth(DEPTH.VFX);



    // Boss warning text (hidden until a boss wave starts)
    const fw = GRID_COLS * TILE_SIZE;
    const fh = GRID_ROWS * TILE_SIZE;
    this._bossWarning = this.add.text(fw / 2, fh / 2, '⚠ ВОЛНА БОССА', {
      fontFamily: FONT, fontSize: '22px',
      color: COLORS.danger_css, fontStyle: 'bold',
      stroke: COLORS.walnutDark_css, strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_UI).setVisible(false);

    this._tutorial = new TutorialOverlay(this);
    this._tutorial.showIfNeeded();

    this._hud          = new HUD(this, this._economy, this._waveManager);
    this._towerPanel   = new TowerPanel(this, this._buildSystem, this._economy);
    this._towerPanel.bindHotkeys(this);
    this._waveInfo     = new WaveInfo(this, this._waveManager, this._economy);
    this._floatingText = new FloatingTextPool(this);

    // Wire countdown progress → HUD bar
    const BETWEEN_WAVE = 20;
    const prevCountdownTick = this._waveManager.onCountdownTick;
    this._waveManager.onCountdownTick = (secs) => {
      prevCountdownTick?.(secs);
      this._hud.setCountdownProgress(secs / BETWEEN_WAVE);
    };
    const prevWaveStart = this._waveManager.onWaveStart;
    this._waveManager.onWaveStart = (wave) => {
      prevWaveStart?.(wave);
      this._hud.setWave(wave.wave, wave.isBoss ?? false);
      this._hud.setCountdownProgress(0);
    };

    this._pauseOverlay = new PauseOverlay(this, () => this._sfx?.uiClick());
    this._skillBar     = new SkillBar(this, this._hero);
    this._mobileSheet  = new MobileBottomSheet(this, this._buildSystem, this._economy);
    this._adPrompt     = new AdPromptUI(this, this._economy);

    // Mobile: on-screen Q/W skill tap buttons
    if (MobileAdapter.isMobile) this._buildMobileSkillButtons();
    this._buildGameOverOverlay();
    this._bindEvents();
    this._bindInput();

    this._waveManager.startGame();
    GameSpeed.reset();

    // ── Dev-only FPS counter (toggle with F key) ────────────────────────────
    if (import.meta.env.DEV) {
      const fpsTxt = this.add.text(4, 54, '', {
        fontFamily: FONT, fontSize: '11px', color: '#44FF44',
        backgroundColor: '#00000088', padding: { x: 4, y: 2 },
      }).setDepth(DEPTH.OVERLAY_UI);
      this.time.addEvent({
        delay: 200, loop: true,
        callback: () => fpsTxt.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`),
      });
      let fpsVisible = true;
      this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F)
        .on('down', () => { fpsVisible = !fpsVisible; fpsTxt.setVisible(fpsVisible); });
    }

    // Audio — AudioManager was initialised in MenuScene on play click
    if (AudioManager.isReady) {
      const sfxGain   = AudioManager.sfxGain!;
      const musicGain = AudioManager.musicGain!;
      this._sfx          = new SFX(sfxGain);
      this._ambientMusic = new AmbientMusic(musicGain);
      this._ambientMusic.start();
    }
  }

  // Fix A: clamp delta, pass adjusted seconds to waveManager/enemies
  update(_time: number, delta: number): void {
    if (this._isPaused || this._gameOver) return;

    const clampedDelta = Math.min(delta, 100);
    const dt = GameSpeed.adjust(clampedDelta) / 1000;

    // Music uses RAW delta — never game-speed adjusted
    this._ambientMusic?.update(delta);

    this._waveManager.update(dt);
    this._hero.update(dt, this._waveManager.activeEnemies);

    // VFX tick
    for (const v of this._vfxList) v.elapsed += dt;
    this._vfxList = this._vfxList.filter(v => v.elapsed < v.duration);

    // Skill UI — throttled to 100 ms
    this._skillBar.update(dt);

    this._buildSystem.update(clampedDelta);
    this._aura.update(clampedDelta);
    this._particles.update(dt);
    this._mobileSheet.update();
    this._updateProjectiles(clampedDelta);
    this._animateBase(clampedDelta);
    this._waveInfo.update(clampedDelta);
    this._hud.update(clampedDelta);
    this._towerPanel.update(clampedDelta);

    this._drawAll();
  }

  // Fix B: cleanup
  shutdown(): void {
    this._ambientMusic?.stop(1500);
    this._ambientMusic = null;
    this._sfx          = null;
    this._waveManager.destroy();
    this._interest.destroy();
    this._economy.destroy();
    EventBus.off(GameEvents.ENEMY_KILLED,      this._onEnemyKilled,      this);
    EventBus.off(GameEvents.ENEMY_REACHED_END, this._onEnemyLeaked,      this);
    EventBus.off(GameEvents.LIVES_CHANGED,     this._onLivesChanged,     this);
    EventBus.off(GameEvents.GOLD_CHANGED,      this._onGoldChanged,      this);
    EventBus.off(GameEvents.GAME_OVER,         this._onGameOver,         this);
    EventBus.off(GameEvents.LUMBER_CHANGED,    this._onLumberChanged,    this);
    EventBus.off(GameEvents.INTEREST_AWARDED,  this._onInterestAwarded,  this);
    EventBus.off(GameEvents.WAVE_BONUS_AWARDED,this._onWaveBonusAwarded, this);
    EventBus.off(GameEvents.TOWER_PLACED,      this._onTowerPlacedSfx,   this);
    EventBus.off(GameEvents.TOWER_SOLD,        this._onTowerSoldSfx,     this);
    EventBus.off(GameEvents.TOWER_UPGRADED,    this._onTowerUpgradedSfx, this);
    EventBus.off(GameEvents.WAVE_STARTED,      this._onWaveStartedSfx,   this);
    EventBus.off(GameEvents.WAVE_COMPLETED,    this._onWaveCompletedSfx, this);
    EventBus.off(GameEvents.TOWER_SHOT,        this._onTowerShotSfx,     this);
    EventBus.off(GameEvents.HERO_SKILL_Q,      this._onHeroSkillQ,       this);
    EventBus.off(GameEvents.HERO_SKILL_W,      this._onHeroSkillW,       this);
    EventBus.removeAllListeners();
  }

  // ── Systems ────────────────────────────────────────────────────────────────
  private _buildSystems(): void {
    this._economy   = new EconomyManager();
    this._lumber    = new LumberManager();
    this._interest  = new InterestSystem(this._economy, this._lumber);
    this._enemyPool = new ObjectPool<Enemy>(() => new Enemy(), ENEMY_POOL_SIZE);
    this._projPool  = new ObjectPool<Projectile>(() => new Projectile(), PROJ_POOL_SIZE);
    this._waveManager = new WaveManager(this, this._enemyPool);
    this._buildSystem = new BuildSystem(this, this._economy, this._projPool,
      () => this._waveManager.activeEnemies);
    this._aura      = new AuraSystem(() => this._buildSystem.towers);
    this._particles = new ParticleSystem();
  }

  private _buildBatchGraphics(): void {
    this._shadowGfx = this.add.graphics().setDepth(DEPTH.ENEMY_SHADOW);
    this._towerGfx  = this.add.graphics().setDepth(DEPTH.TOWER);
    this._enemyGfx  = this.add.graphics().setDepth(DEPTH.ENEMY);
    this._hpGfx     = this.add.graphics().setDepth(DEPTH.ENEMY_HEALTHBAR);
    this._projGfx   = this.add.graphics().setDepth(DEPTH.PROJECTILE);
    this._effectGfx = this.add.graphics().setDepth(DEPTH.EFFECT);
  }

  private _updateProjectiles(delta: number): void {
    // activeItems from pool = currently checked-out projectiles
    const active = this._projPool.activeItems;
    for (const p of active) {
      p.update(delta);
      p.tickSplash(delta / 1000);
    }
  }

  private _drawAll(): void {
    this._shadowGfx.clear();
    this._towerGfx.clear();
    this._enemyGfx.clear();
    this._hpGfx.clear();
    this._projGfx.clear();
    this._effectGfx.clear();

    // Towers
    for (const t of this._buildSystem.towers) t.drawTo(this._towerGfx);

    // Enemies + shadows
    const enemies = this._waveManager.activeEnemies;
    for (const e of enemies) {
      if (!e.isActive) continue;
      e.drawShadowTo(this._shadowGfx);
      e.drawTo(this._enemyGfx);
      e.drawHealthbarTo(this._hpGfx);
    }

    // Projectiles + splash
    for (const p of this._projPool.activeItems) {
      if (!p.isActive) continue;
      p.drawTo(this._projGfx);
      p.drawSplashTo(this._effectGfx);
    }

    // Hero — drawn above projectiles, below HUD
    this._heroGfx.clear();
    this._hero.drawTo(this._heroGfx);

    // Phase 5: death particles
    this._particles.drawTo(this._effectGfx);

    // VFX rings (skill Q expand, skill W pulse)
    this._drawVFX();
  }

  private _drawVFX(): void {
    this._vfxGfx.clear();
    for (const v of this._vfxList) {
      const p = v.elapsed / v.duration;
      if (v.type === 'expand_circle') {
        const r = v.maxRadius * p;
        const a = 0.45 * (1 - p);
        this._vfxGfx.fillStyle(v.color, a);
        this._vfxGfx.fillCircle(v.x, v.y, r);
        this._vfxGfx.lineStyle(2, v.color, a * 1.5);
        this._vfxGfx.strokeCircle(v.x, v.y, r);
      } else {
        // pulse_ring — steady pulsing for skill W duration
        const pulse = 0.15 + Math.sin(v.elapsed * 4) * 0.06;
        this._vfxGfx.lineStyle(2, v.color, pulse);
        this._vfxGfx.strokeCircle(v.x, v.y, v.maxRadius);
      }
    }
  }



  // ── Save / load result ─────────────────────────────────────────────────────
  private _saveResult(isVictory: boolean): void {
    // Find best tower by damage dealt
    let bestName   = '—';
    let bestDamage = 0;
    for (const t of this._buildSystem.towers) {
      if (t.totalDamageDealt > bestDamage) {
        bestDamage = t.totalDamageDealt;
        bestName   = t.data.name;
      }
    }

    const result = {
      wavesCompleted:  this._waveManager.waveNumber - 1,
      enemiesKilled:   this._totalKills,
      livesRemaining:  this._economy.lives,
      goldEarned:      this._totalGoldEarned,
      bestTowerName:   bestName,
      bestTowerDamage: bestDamage,
      isVictory,
      date: new Date().toISOString(),
    };

    try {
      const stored = localStorage.getItem('best_result');
      const best   = stored ? JSON.parse(stored) : null;
      const isBetter = !best
        || result.wavesCompleted > best.wavesCompleted
        || (result.wavesCompleted === best.wavesCompleted
            && result.livesRemaining > best.livesRemaining);
      if (isBetter) localStorage.setItem('best_result', JSON.stringify(result));
    } catch { /* storage unavailable */ }
  }


  // ── Map ─────────────────────────────────────────────────────────────────────
  private _buildMap(): void {
    const GW = GRID_COLS * TILE_SIZE, GH = GRID_ROWS * TILE_SIZE;
    const T  = TILE_SIZE;

    // ── Layer 0: Vertical gradient background ──────────────────────────────
    const bg = this.add.graphics().setDepth(DEPTH.BACKGROUND);
    for (let row = 0; row < GRID_ROWS; row++) {
      const t  = row / GRID_ROWS;
      const rv = Math.round(0x13 + t * (0x1E - 0x13));
      const gv = Math.round(0x10 + t * (0x1A - 0x10));
      const bv = Math.round(0x0C + t * (0x12 - 0x0C));
      bg.fillStyle((rv << 16) | (gv << 8) | bv, 1);
      bg.fillRect(0, row * T, GW, T);
    }

    // ── Layer 1: Stone buildable cells ─────────────────────────────────────
    const stone = this.add.graphics().setDepth(DEPTH.GRID);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (MAP_DATA[row][col] === 'P' || MAP_DATA[row][col] === 'B') continue;
        const px = col * T, py = row * T;
        stone.fillStyle(0x1C1812, 1); stone.fillRect(px, py, T, T);
        stone.lineStyle(1, 0x2E2820, 0.5);
        stone.beginPath(); stone.moveTo(px, py + T); stone.lineTo(px, py); stone.lineTo(px + T, py); stone.strokePath();
        stone.lineStyle(1, 0x0D0A06, 0.7);
        stone.beginPath(); stone.moveTo(px + T, py); stone.lineTo(px + T, py + T); stone.lineTo(px, py + T); stone.strokePath();
        const seed = (row * 37 + col * 19) % 100;
        if (seed < 28) {
          stone.lineStyle(1, 0x110E08, 0.45);
          stone.beginPath(); stone.moveTo(px + 4 + (seed % 8), py + 6); stone.lineTo(px + 10 + (seed % 6), py + 14); stone.strokePath();
        }
      }
    }

    // ── Layer 2: Amber cobblestone path tiles ──────────────────────────────
    const path = this.add.graphics().setDepth(DEPTH.PATH);
    const deco = this.add.graphics().setDepth(DEPTH.PATH_DECORATION);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = MAP_DATA[row][col];
        if (cell !== 'P' && cell !== 'B') continue;
        const px = col * T, py = row * T;
        path.fillStyle(0x4A3820, 1); path.fillRect(px, py, T, T);
        path.fillStyle(0x3E2E14, 1); path.fillRect(px + 2, py + 2, T - 4, T - 4);
        path.lineStyle(1, 0x6A5028, 0.6);
        path.beginPath(); path.moveTo(px + 2, py + T - 2); path.lineTo(px + 2, py + 2); path.lineTo(px + T - 2, py + 2); path.strokePath();
        path.lineStyle(1, 0x1E1408, 0.7);
        path.beginPath(); path.moveTo(px + T - 2, py + 2); path.lineTo(px + T - 2, py + T - 2); path.lineTo(px + 2, py + T - 2); path.strokePath();
        const seed = (row * 31 + col * 17) % 100;
        if (seed < 35) { deco.fillStyle(0x5A4422, 0.50); deco.fillCircle(px + 5 + (seed % 12), py + 5 + ((seed * 7) % 12), 1.8); }
        if (seed > 70) { deco.fillStyle(0x6A5430, 0.35); deco.fillCircle(px + T - 6 - (seed % 6), py + T - 7, 1.4); }
      }
    }
    this._drawPathEdges();

    // ── Layer 3: Corner vignette ────────────────────────────────────────────
    const vig = this.add.graphics().setDepth(DEPTH.BACKGROUND + 1);
    for (let i = 0; i < 16; i++) {
      const t = i / 16, a = 0.24 * t * t;
      const pad = Math.round(Math.min(GW, GH) * 0.40 * (1 - t));
      vig.fillStyle(0x000000, a);
      vig.fillRect(0, 0, pad, GH); vig.fillRect(GW - pad, 0, pad, GH);
      vig.fillRect(pad, 0, GW - 2 * pad, pad); vig.fillRect(pad, GH - pad, GW - 2 * pad, pad);
    }
  }

  private _drawPathEdges(): void {
    const g = this.add.graphics().setDepth(DEPTH.PATH_DECORATION);
    g.lineStyle(1.5, COLORS.pathBorder, 0.55);
    const isPath=(r:number,c:number)=>{ if(r<0||r>=GRID_ROWS||c<0||c>=GRID_COLS)return false; return MAP_DATA[r][c]==='P'||MAP_DATA[r][c]==='B'; };
    for (let row=0;row<GRID_ROWS;row++) for (let col=0;col<GRID_COLS;col++) {
      if (!isPath(row,col)) continue;
      const px=col*TILE_SIZE, py=row*TILE_SIZE;
      if (!isPath(row-1,col)){g.beginPath();g.moveTo(px,py);g.lineTo(px+TILE_SIZE,py);g.strokePath();}
      if (!isPath(row+1,col)){g.beginPath();g.moveTo(px,py+TILE_SIZE);g.lineTo(px+TILE_SIZE,py+TILE_SIZE);g.strokePath();}
      if (!isPath(row,col-1)){g.beginPath();g.moveTo(px,py);g.lineTo(px,py+TILE_SIZE);g.strokePath();}
      if (!isPath(row,col+1)){g.beginPath();g.moveTo(px+TILE_SIZE,py);g.lineTo(px+TILE_SIZE,py+TILE_SIZE);g.strokePath();}
    }
  }

  private _buildBase(): void {
    const bx=BASE_TILE_COL*TILE_SIZE, by=BASE_TILE_ROW*TILE_SIZE;
    const cx=bx+BASE_SIZE/2, cy=by+BASE_SIZE/2;
    this._baseGlow=this.add.graphics().setDepth(DEPTH.BASE-1);
    const g=this.add.graphics().setDepth(DEPTH.BASE);
    const pts:Phaser.Types.Math.Vector2Like[]=[];
    for(let i=0;i<6;i++){const a=Phaser.Math.DegToRad(30+60*i);pts.push({x:cx+BASE_SIZE*0.52*Math.cos(a),y:cy+BASE_SIZE*0.52*Math.sin(a)});}
    g.fillStyle(COLORS.amberDeep,0.9);g.fillPoints(pts,true);
    g.lineStyle(2,COLORS.amberGlow,0.8);g.strokePoints(pts,true);
    const inner:Phaser.Types.Math.Vector2Like[]=[];
    for(let i=0;i<6;i++){const a=Phaser.Math.DegToRad(30+60*i);inner.push({x:cx+BASE_SIZE*0.32*Math.cos(a),y:cy+BASE_SIZE*0.32*Math.sin(a)});}
    g.lineStyle(1,COLORS.amberPale,0.4);g.strokePoints(inner,true);
    g.fillStyle(COLORS.amberGlow,1);g.fillCircle(cx,cy,7);
    g.lineStyle(1.5,COLORS.amberBright,0.9);g.strokeCircle(cx,cy,7);
    this.add.text(cx,cy+BASE_SIZE*0.52+8,'БАЗА',{fontFamily:FONT,fontSize:'11px',color:COLORS.textGold_css}).setOrigin(0.5,0).setDepth(DEPTH.HUD);
  }

  private _animateBase(delta: number): void {
    this._basePulseT+=delta*0.002;
    const pulse=0.5+Math.sin(this._basePulseT)*0.5;
    const bx=BASE_TILE_COL*TILE_SIZE, by=BASE_TILE_ROW*TILE_SIZE;
    this._baseGlow.clear();
    for(let l=3;l>=0;l--){const a=(0.06+pulse*0.09)*(l+1)/4;const pad=(3+pulse*5)+l*3;this._baseGlow.fillStyle(COLORS.amberWarm,a);this._baseGlow.fillRect(bx-pad,by-pad,BASE_SIZE+pad*2,BASE_SIZE+pad*2);}
  }

  private _togglePause(): void {
    this._isPaused = !this._isPaused;
    this._pauseOverlay.toggle();
  }

  // ── Game over overlay ─────────────────────────────────────────────────────
  private _buildGameOverOverlay(): void {
    this._gameOverRoot=this.add.container(0,0).setDepth(DEPTH.OVERLAY).setVisible(false);
  }

  private _showGameOver(victory: boolean): void {
    this._gameOver=true;
    const s=this, cx=GAME_WIDTH/2, cy=GAME_HEIGHT/2;
    const root=this._gameOverRoot; root.removeAll(true); root.setVisible(true);

    const dim=s.add.graphics(); dim.fillStyle(COLORS.walnutDark,0.65); dim.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    root.add(dim);

    const pw=320,ph=400;
    const bg=s.add.graphics();
    bg.fillStyle(COLORS.bgPanel,1); bg.fillRoundedRect(cx-pw/2,cy-ph/2,pw,ph,12);
    bg.lineStyle(2,victory?COLORS.amberDeep:COLORS.dangerSoft,0.6); bg.strokeRoundedRect(cx-pw/2,cy-ph/2,pw,ph,12);
    root.add(bg);

    const titleTxt=victory?'✦ ПОБЕДА ✦':'ПОРАЖЕНИЕ';
    const titleCol=victory?COLORS.amberGlow_css:COLORS.danger_css;
    root.add(s.add.text(cx,cy-170,titleTxt,{fontFamily:FONT,fontSize:'24px',color:titleCol,fontStyle:'bold'}).setOrigin(0.5));
    root.add(s.add.text(cx,cy-135,victory?'Светлогорск спасён!':'Шторм поглотил берег...',{fontFamily:FONT,fontSize:'14px',color:COLORS.textSecondary_css}).setOrigin(0.5));

    if (!victory) {
      root.add(s.add.text(cx,cy-108,`Вы дошли до волны: ${this._wavesReached}`,{fontFamily:FONT,fontSize:'13px',color:COLORS.textMuted_css}).setOrigin(0.5));
    }

    // Stats
    const stats=[
      [`Волны пройдено`,`${this._waveManager.waveNumber - 1} / ${this._waveManager.totalWaves}`],
      [`Врагов уничтожено`,`${this._totalKills}`],
      [`Янтарь собран`,`${this._totalGoldEarned}◆`],
      [`Жизни осталось`,`${this._economy.lives}`],
    ];
    stats.forEach(([lbl,val],i)=>{
      const y=cy-70+i*28;
      root.add(s.add.text(cx-130,y,lbl,{fontFamily:FONT,fontSize:'12px',color:COLORS.textSecondary_css}));
      root.add(s.add.text(cx+130,y,val,{fontFamily:FONT,fontSize:'12px',color:COLORS.textPrimary_css,align:'right'}).setOrigin(1,0));
    });

    const mkBtn=(label:string,bgCol:number|null,outlineCol:number,textCol:string,bx:number,by:number,bw:number,bh:number,cb:()=>void)=>{
      const g=s.add.graphics();
      if (bgCol!==null){g.fillStyle(bgCol,0.9);g.fillRoundedRect(bx,by,bw,bh,8);}
      g.lineStyle(1,outlineCol,0.7);g.strokeRoundedRect(bx,by,bw,bh,8);
      root.add(g);
      root.add(s.add.text(bx+bw/2,by+bh/2,label,{fontFamily:FONT,fontSize:'13px',color:textCol,fontStyle:'bold'}).setOrigin(0.5));
      const z=s.add.zone(bx,by,bw,bh).setOrigin(0).setInteractive({useHandCursor:true}); z.on('pointerdown',cb); root.add(z);
    };

    const btnY=cy+140, bw=130, bh=38, gap=16;
    mkBtn('Играть снова', COLORS.amberWarm, COLORS.amberWarm, COLORS.walnutDark_css,  cx-bw-gap/2, btnY, bw, bh,
      ()=>{this.cameras.main.fadeOut(300,240,238,233);this.cameras.main.once('camerafadeoutcomplete',()=>this.scene.start('GameScene'));});
    mkBtn('В меню', null, COLORS.walnut, COLORS.walnut_css, cx+gap/2, btnY, bw, bh,
      ()=>{this.cameras.main.fadeOut(300,240,238,233);this.cameras.main.once('camerafadeoutcomplete',()=>this.scene.start('MenuScene'));});
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  private _bindEvents(): void {
    EventBus.on(GameEvents.ENEMY_KILLED,      this._onEnemyKilled,     this);
    EventBus.on(GameEvents.ENEMY_REACHED_END, this._onEnemyLeaked,     this);
    EventBus.on(GameEvents.LIVES_CHANGED,     this._onLivesChanged,    this);
    EventBus.on(GameEvents.GOLD_CHANGED,      this._onGoldChanged,     this);
    EventBus.on(GameEvents.GAME_OVER,         this._onGameOver,        this);

    // Phase 2 — economy extensions
    EventBus.on(GameEvents.LUMBER_CHANGED,     this._onLumberChanged,    this);
    EventBus.on(GameEvents.INTEREST_AWARDED,   this._onInterestAwarded,  this);
    EventBus.on(GameEvents.WAVE_BONUS_AWARDED, this._onWaveBonusAwarded, this);

    // SFX — named handlers so they can be removed cleanly in shutdown()
    EventBus.on(GameEvents.TOWER_PLACED,   this._onTowerPlacedSfx,  this);
    EventBus.on(GameEvents.TOWER_SOLD,     this._onTowerSoldSfx,    this);
    EventBus.on(GameEvents.TOWER_UPGRADED, this._onTowerUpgradedSfx,this);
    EventBus.on(GameEvents.WAVE_STARTED,   this._onWaveStartedSfx,  this);
    EventBus.on(GameEvents.WAVE_COMPLETED, this._onWaveCompletedSfx,this);
    EventBus.on(GameEvents.TOWER_SHOT,     this._onTowerShotSfx,    this);

    // Hero skill VFX
    EventBus.on(GameEvents.HERO_SKILL_Q,   this._onHeroSkillQ, this);
    EventBus.on(GameEvents.HERO_SKILL_W,   this._onHeroSkillW, this);
  }

  private _onTowerPlacedSfx   = (): void => { this._sfx?.build(); };
  private _onTowerSoldSfx     = (): void => { this._sfx?.sell(); };
  private _onTowerUpgradedSfx = (): void => { this._sfx?.upgrade(); };
  private _onWaveCompletedSfx = (...args: unknown[]): void => {
    this._sfx?.waveComplete();
    const waveNum = args[0] as number;
    if (waveNum > 0 && waveNum % 5 === 0 && !this._gameOver) {
      const bonus = 15 + waveNum * 3;
      this.time.delayedCall(800, () => {
        if (!this._gameOver && this._waveManager.state !== 'spawning') {
          this._adPrompt.showDoubleGoldPrompt(bonus, () => {});
        }
      });
      void AdManager.showInterstitial();
    }
  };

  private _onWaveStartedSfx = (): void => {
    const wave = this._waveManager.currentWaveData;
    if (wave?.isBoss) {
      this._sfx?.bossAlert();
      // Boss warning banner
      this._bossWarning.setVisible(true).setAlpha(0).setScale(0.5);
      this.tweens.add({
        targets: this._bossWarning, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 400, ease: 'Back.easeOut',
        onComplete: () => {
          this.time.delayedCall(2000, () => {
            this.tweens.add({
              targets: this._bossWarning, alpha: 0, duration: 300,
              onComplete: () => this._bossWarning.setVisible(false),
            });
          });
        },
      });
    }
  };

  private _onTowerShotSfx = (towerId: unknown): void => {
    const id = towerId as string;
    if (id.startsWith('arrow'))  { this._sfx?.shootArrow();  return; }
    if (id.startsWith('cannon')) { this._sfx?.shootCannon(); return; }
    if (id.startsWith('magic'))  { this._sfx?.shootMagic();  return; }
    if (id.startsWith('slow'))   { this._sfx?.shootIce();    return; }
    if (id.startsWith('acid'))   { this._sfx?.shootAcid();   return; }
  };

  private _onHeroSkillQ = (...args: unknown[]): void => {
    const [x, y, radius] = args as [number, number, number];
    this._vfxList.push({ x, y, maxRadius: radius, color: COLORS.amberGlow,
      elapsed: 0, duration: 0.35, type: 'expand_circle' });
    this._sfx?.shockwave();
  };

  private _onHeroSkillW = (...args: unknown[]): void => {
    const [x, y, radius] = args as [number, number, number];
    this._vfxList.push({ x, y, maxRadius: radius, color: COLORS.amberGlow,
      elapsed: 0, duration: 6.0, type: 'pulse_ring' });
    this._sfx?.amberShield();
  };

  private _onEnemyKilled = (data: unknown): void => {
    const {enemy, goldReward} = data as {enemy: Enemy; goldReward: number};
    this._economy.addGold(goldReward);
    this._totalKills++;
    this._totalGoldEarned += goldReward;
    this._sfx?.enemyDeath();
    this._sfx?.goldEarned();

    // Death particles
    const burstCount = enemy.def.isBoss ? 20 : 8;
    this._particles.burst(enemy.x, enemy.y, enemy.def.color, burstCount);
    if (enemy.def.isBoss) this._particles.burst(enemy.x, enemy.y, 0xFFCC44, 12);

    // Floating gold — larger for bosses
    const sz = enemy.def.isBoss ? 'lg' : 'md';
    this._floatingText.show(enemy.x, enemy.y - 10, `+${goldReward}◆`, COLORS.textGold_css, sz as 'lg'|'md');

    // Phase 2: award lumber from enemy def
    const lumberYield = (enemy.def as any)?.lumberYield ?? 0;
    if (lumberYield > 0) {
      this._lumber.add(lumberYield);
      this._floatingText.show(enemy.x, enemy.y - 26, `+${lumberYield}🪵`, '#7CBA5C');
    }
  };

  private _onLumberChanged = (total: unknown): void => {
    this._hud.setLumber(total as number);
  };

  private _onInterestAwarded = (amount: unknown): void => {
    const n = amount as number;
    this._floatingText.show(680, 36, `+${n} %◆`, '#F5C842', 'sm');
    this._sfx?.goldEarned();
  };

  private _onWaveBonusAwarded = (amount: unknown): void => {
    const n = amount as number;
    this._floatingText.show(680, 52, `+${n} бонус`, COLORS.textGold_css, 'sm');
  };

  private _onEnemyLeaked = (enemy: unknown): void => {
    const e = enemy as Enemy;
    this._economy.loseLife(e.def?.livesCost ?? 1);
    this._sfx?.enemyLeak();
    // Screen shake + red flash
    this.cameras.main.shake(200, 0.0022);
    const fw = GRID_COLS * TILE_SIZE;
    const fh = GRID_ROWS * TILE_SIZE;
    this._vfxList.push({
      x: fw / 2, y: fh / 2,
      maxRadius: Math.max(fw, fh),
      color: COLORS.danger,
      elapsed: 0, duration: 0.40,
      type: 'expand_circle',
    });
  };

  private _onLivesChanged = (lives: unknown): void => {
    const n = lives as number;
    this._hud.setLives(n);
    if (n === 1 && !this._gameOver) {
      this.time.delayedCall(400, () => {
        if (this._economy.lives <= 1 && !this._gameOver) {
          this._adPrompt.showRevivePrompt(
            () => this._economy.addLives(3),
            () => {},
          );
        }
      });
    }
  };

  private _onGoldChanged = (gold: unknown): void => {
    this._hud.setGold(gold as number);
  };

  private _onGameOver = (data: unknown): void => {
    const {victory}=data as {victory:boolean};
    this._ambientMusic?.stop(2000);
    this._ambientMusic = null;
    this._saveResult(victory);
    this.time.delayedCall(600, () => this._showGameOver(victory));
  };

  // ── Input ──────────────────────────────────────────────────────────────────
  /** Mobile: large Q/W skill tap buttons in bottom-left corner */
  private _buildMobileSkillButtons(): void {
    const s    = this;   // GameScene extends Phaser.Scene
    const BTN  = 60;
    const PAD  = 10;
    const y0   = GAME_HEIGHT - BTN - PAD - 90; // above wave bar

    const skills: Array<{key:'Q'|'W'; label:string; action:()=>void}> = [
      { key:'Q', label:'⚡',  action: () => this._hero.useSkillQ(this._waveManager.activeEnemies) },
      { key:'W', label:'🛡', action: () => this._hero.useSkillW(this._buildSystem.towers) },
    ];

    skills.forEach(({ key, label, action }, i) => {
      const bx = PAD + i * (BTN + PAD);
      const g  = s.add.graphics().setDepth(DEPTH.HUD + 3);

      const draw = (active: boolean): void => {
        g.clear();
        g.fillStyle(active ? COLORS.amberDeep : 0x1A1510, active ? 0.70 : 0.85);
        g.fillRoundedRect(bx, y0, BTN, BTN, 10);
        g.fillStyle(0xFFFFFF, 0.07);
        g.fillRoundedRect(bx + 2, y0 + 2, BTN - 4, BTN / 2 - 2, 8);
        g.lineStyle(2, active ? COLORS.amberBright : COLORS.amberWarm, active ? 1 : 0.65);
        g.strokeRoundedRect(bx, y0, BTN, BTN, 10);
      };
      draw(false);

      s.add.text(bx + BTN / 2, y0 + 14, label, {
        fontFamily: FONT, fontSize: '20px',
      }).setOrigin(0.5).setDepth(DEPTH.HUD + 4);
      s.add.text(bx + BTN / 2, y0 + BTN - 14, key, {
        fontFamily: FONT, fontSize: '11px', fontStyle: 'bold',
        color: COLORS.textSecondary_css,
      }).setOrigin(0.5).setDepth(DEPTH.HUD + 4);

      const zone = s.add.zone(bx, y0, BTN, BTN).setOrigin(0)
        .setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD + 5);
      zone.on('pointerover',  () => draw(true));
      zone.on('pointerout',   () => draw(false));
      zone.on('pointerdown',  () => { draw(true);  action(); });
      zone.on('pointerup',    () => draw(false));
    });

    // Build button — opens MobileBottomSheet
    const buildBx = PAD + skills.length * (BTN + PAD);
    const buildG  = s.add.graphics().setDepth(DEPTH.HUD + 3);
    const drawBuild = (hover: boolean): void => {
      buildG.clear();
      buildG.fillStyle(hover ? COLORS.amberDeep : 0x1A1510, hover ? 0.70 : 0.85);
      buildG.fillRoundedRect(buildBx, y0, BTN, BTN, 10);
      buildG.fillStyle(0xFFFFFF, 0.07);
      buildG.fillRoundedRect(buildBx + 2, y0 + 2, BTN - 4, BTN / 2 - 2, 8);
      buildG.lineStyle(2, hover ? COLORS.amberBright : COLORS.amberWarm, hover ? 1 : 0.65);
      buildG.strokeRoundedRect(buildBx, y0, BTN, BTN, 10);
    };
    drawBuild(false);
    s.add.text(buildBx + BTN / 2, y0 + 14, '🏗', {
      fontFamily: FONT, fontSize: '20px',
    }).setOrigin(0.5).setDepth(DEPTH.HUD + 4);
    s.add.text(buildBx + BTN / 2, y0 + BTN - 14, 'BUILD', {
      fontFamily: FONT, fontSize: '9px', letterSpacing: 1,
      color: COLORS.textSecondary_css,
    }).setOrigin(0.5).setDepth(DEPTH.HUD + 4);
    const buildZone = s.add.zone(buildBx, y0, BTN, BTN).setOrigin(0)
      .setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD + 5);
    buildZone.on('pointerover',  () => drawBuild(true));
    buildZone.on('pointerout',   () => drawBuild(false));
    buildZone.on('pointerdown',  () => {
      drawBuild(true);
      this._mobileSheet.isOpen ? this._mobileSheet.hide() : this._mobileSheet.show();
    });
    buildZone.on('pointerup', () => drawBuild(false));
  }

  private _bindInput(): void {
    const kbd = this.input.keyboard!;
    const FIELD_W = GRID_COLS * TILE_SIZE;
    const FIELD_H = GRID_ROWS * TILE_SIZE;

    // ── Keyboard shortcuts (desktop) ─────────────────────────────────────────
    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
      if (this._tutorial.isActive) return;
      if (this._waveManager.state === 'countdown') this._waveManager.skipCountdown();
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this._tutorial.isActive) return;
      if (this._buildSystem.isPlacing)      { this._buildSystem.cancelPlacement(); return; }
      if (this._buildSystem.selectedTower)  { this._buildSystem.deselect();        return; }
      this._togglePause();
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      if (this._gameOver) return;
      this.cameras.main.fadeOut(300, 240, 238, 233);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE).on('down', () => {
      this._buildSystem.sellSelected();
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.U).on('down', () => {
      const t = this._buildSystem.selectedTower;
      if (t && t.data.upgradeTo.length > 0) this._buildSystem.upgradeSelected(t.data.upgradeTo[0]);
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.TAB).on('down', () => {
      this._buildSystem.toggleAllRanges();
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on('down', () => {
      this._hero.useSkillQ(this._waveManager.activeEnemies);
    });

    kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W).on('down', () => {
      this._hero.useSkillW(this._buildSystem.towers);
    });

    // ── RMB — move hero (desktop) ────────────────────────────────────────────
    this.input.on('pointerdown', (rawPtr: unknown) => {
      const ptr = rawPtr as Phaser.Input.Pointer;
      if (!ptr.rightButtonDown()) return;
      const wx = ptr.worldX, wy = ptr.worldY;
      if (wx < 0 || wx > FIELD_W || wy < 0 || wy > FIELD_H) return;
      this._hero.moveTo(wx, wy);
    });

    // ── Touch input (mobile) ─────────────────────────────────────────────────
    this._bindTouchInput(FIELD_W, FIELD_H);

    // ── Wave callback ────────────────────────────────────────────────────────
    const prevOnWaveStart = this._waveManager.onWaveStart;
    this._waveManager.onWaveStart = (wave) => {
      prevOnWaveStart?.(wave);
      this._wavesReached = wave.wave;
      this._hud.setWave(wave.wave, wave.isBoss);
    };
  }

  /** Touch-specific input: joystick-style hero movement + tap-to-build */
  private _bindTouchInput(fieldW: number, fieldH: number): void {
    // State
    let touchStartX = 0, touchStartY = 0;
    let touchStartTime = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isDraggingHero = false;
    const LONG_PRESS_MS = 400;
    const TAP_MOVE_PX   = 12;  // max pixel movement to count as tap not drag

    // Visual long-press ring
    const lpGfx = this.add.graphics().setDepth(DEPTH.OVERLAY_UI);

    const clearLP = (): void => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      lpGfx.clear();
      isDraggingHero = false;
    };

    this.input.on('pointerdown', (rawPtr: unknown) => {
      const ptr = rawPtr as Phaser.Input.Pointer;
      if (ptr.button !== 0) return;         // left / touch only
      if (ptr.worldX > fieldW) return;      // ignore panel side

      touchStartX    = ptr.worldX;
      touchStartY    = ptr.worldY;
      touchStartTime = Date.now();

      // Long-press ring animation
      let t = 0;
      const interval = setInterval(() => {
        t += 50;
        const frac = Math.min(1, t / LONG_PRESS_MS);
        lpGfx.clear();
        lpGfx.lineStyle(3, COLORS.amberWarm, 0.70);
        lpGfx.beginPath();
        lpGfx.arc(touchStartX, touchStartY, 20, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
        lpGfx.strokePath();
      }, 50);

      longPressTimer = setTimeout(() => {
        clearInterval(interval);
        lpGfx.clear();
        // Long press = move hero
        isDraggingHero = true;
        this._hero.moveTo(touchStartX, touchStartY);
        this._sfx?.uiClick?.();
      }, LONG_PRESS_MS);

      // Store interval ref for cleanup
      (longPressTimer as any).__interval = interval;
    });

    this.input.on('pointermove', (rawPtr: unknown) => {
      const ptr = rawPtr as Phaser.Input.Pointer;
      if (!ptr.isDown || ptr.worldX > fieldW) return;
      const dx = ptr.worldX - touchStartX;
      const dy = ptr.worldY - touchStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);

      // Cancel long press if finger moved too much
      if (moved > TAP_MOVE_PX && longPressTimer) {
        clearInterval((longPressTimer as any).__interval);
        clearLP();
      }

      // Drag hero if already in drag mode
      if (isDraggingHero && ptr.worldX > 0 && ptr.worldY > 0
          && ptr.worldX < fieldW && ptr.worldY < fieldH) {
        this._hero.moveTo(ptr.worldX, ptr.worldY);
      }
    });

    this.input.on('pointerup', (rawPtr: unknown) => {
      const ptr = rawPtr as Phaser.Input.Pointer;
      if ((longPressTimer as any)?.__interval) {
        clearInterval((longPressTimer as any).__interval);
      }
      const wasLongPress = isDraggingHero;
      clearLP();

      if (wasLongPress) return;  // long press handled above
      if (ptr.worldX > fieldW)  return;  // tap on panel side — handled by TowerPanel

      const elapsed = Date.now() - touchStartTime;
      const dx = ptr.worldX - touchStartX;
      const dy = ptr.worldY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Short tap on field = confirm tower placement OR select tower
      if (elapsed < 400 && dist < TAP_MOVE_PX) {
        if (this._buildSystem.isPlacing) {
          // Placement handled by BuildSystem's existing pointerdown listener
        } else {
          // Tap on empty field = move hero (single tap)
          this._hero.moveTo(ptr.worldX, ptr.worldY);
        }
      }
    });

    // Two-finger tap = pause (mobile gesture)
    this.input.on('pointerdown', (rawPtr: unknown) => {
      const ptr = rawPtr as Phaser.Input.Pointer;
      if (this.input.pointer2?.isDown && ptr.id === this.input.pointer2.id) {
        this._togglePause();
      }
    });
  }
}
