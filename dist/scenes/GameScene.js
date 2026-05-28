// GameScene.ts — Stage 10. Phase 2: LumberManager, InterestSystem, dynamic economy.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, GRID_COLS, GRID_ROWS, COLORS, DEPTH, FONT_MAIN, } from '../config';
import { MAP_DATA, BASE_TILE_COL, BASE_TILE_ROW } from '../data/mapData';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Hero } from '../entities/Hero';
import { WaveManager } from '../systems/WaveManager';
import { BuildSystem } from '../systems/BuildSystem';
import { EconomyManager } from '../systems/EconomyManager';
import { LumberManager } from '../systems/LumberManager';
import { InterestSystem } from '../systems/InterestSystem';
import { ObjectPool } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';
import { TowerPanel } from '../ui/TowerPanel';
import { WaveInfo } from '../ui/WaveInfo';
import { HUD } from '../ui/HUD';
import { FloatingTextPool } from '../ui/FloatingTextPool';
import { GameSpeed } from '../systems/GameSpeed';
import { AudioManager } from '../systems/AudioManager';
import { AmbientMusic } from '../systems/AmbientMusic';
import { SFX } from '../systems/SFX';
const ENEMY_POOL_SIZE = 50;
const PROJ_POOL_SIZE = 80;
const BASE_SIZE = 2 * TILE_SIZE;
const FONT = FONT_MAIN;
export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        Object.defineProperty(this, "_economy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_lumber", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_interest", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_waveManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_buildSystem", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_enemyPool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_projPool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_towerPanel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_waveInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_hud", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_floatingText", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Batch render graphics
        Object.defineProperty(this, "_shadowGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_enemyGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_hpGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_projGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_towerGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_effectGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_heroGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_vfxGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Hero
        Object.defineProperty(this, "_hero", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // VFX
        Object.defineProperty(this, "_vfxList", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        // Boss warning
        Object.defineProperty(this, "_bossWarning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Tutorial
        Object.defineProperty(this, "_tutorialActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_tutorialRoot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Skill UI
        Object.defineProperty(this, "_skillSlots", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_skillUiTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Base pulse
        Object.defineProperty(this, "_baseGlow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_basePulseT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Pause overlay
        Object.defineProperty(this, "_pauseRoot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_isPaused", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Game-over overlay
        Object.defineProperty(this, "_gameOverRoot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_gameOver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Stats
        Object.defineProperty(this, "_totalKills", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_totalGoldEarned", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_wavesReached", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        // Audio
        Object.defineProperty(this, "_ambientMusic", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_sfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_onTowerPlacedSfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { this._sfx?.build(); }
        });
        Object.defineProperty(this, "_onTowerSoldSfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { this._sfx?.sell(); }
        });
        Object.defineProperty(this, "_onTowerUpgradedSfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { this._sfx?.upgrade(); }
        });
        Object.defineProperty(this, "_onWaveCompletedSfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { this._sfx?.waveComplete(); }
        });
        Object.defineProperty(this, "_onWaveStartedSfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
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
            }
        });
        Object.defineProperty(this, "_onTowerShotSfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (towerId) => {
                const id = towerId;
                if (id.startsWith('arrow')) {
                    this._sfx?.shootArrow();
                    return;
                }
                if (id.startsWith('cannon')) {
                    this._sfx?.shootCannon();
                    return;
                }
                if (id.startsWith('magic')) {
                    this._sfx?.shootMagic();
                    return;
                }
                if (id.startsWith('slow')) {
                    this._sfx?.shootIce();
                    return;
                }
                if (id.startsWith('acid')) {
                    this._sfx?.shootAcid();
                    return;
                }
            }
        });
        Object.defineProperty(this, "_onHeroSkillQ", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (...args) => {
                const [x, y, radius] = args;
                this._vfxList.push({ x, y, maxRadius: radius, color: COLORS.amberGlow,
                    elapsed: 0, duration: 0.35, type: 'expand_circle' });
                this._sfx?.shockwave();
            }
        });
        Object.defineProperty(this, "_onHeroSkillW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (...args) => {
                const [x, y, radius] = args;
                this._vfxList.push({ x, y, maxRadius: radius, color: COLORS.amberGlow,
                    elapsed: 0, duration: 6.0, type: 'pulse_ring' });
                this._sfx?.amberShield();
            }
        });
        Object.defineProperty(this, "_onEnemyKilled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (data) => {
                const { enemy, goldReward } = data;
                this._economy.addGold(goldReward);
                this._totalKills++;
                this._totalGoldEarned += goldReward;
                this._floatingText.show(enemy.x, enemy.y - 10, `+${goldReward}◆`, COLORS.textGold_css);
                this._sfx?.enemyDeath();
                this._sfx?.goldEarned();
                // Phase 2: award lumber from enemy def
                const lumberYield = enemy.def?.lumberYield ?? 0;
                if (lumberYield > 0) {
                    this._lumber.add(lumberYield);
                    this._floatingText.show(enemy.x, enemy.y - 26, `+${lumberYield}🪵`, '#7CBA5C');
                }
            }
        });
        Object.defineProperty(this, "_onLumberChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (total) => {
                this._hud.setLumber(total);
            }
        });
        Object.defineProperty(this, "_onInterestAwarded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (amount) => {
                const n = amount;
                // Show floating text near gold counter (top-right area of field)
                this._floatingText.show(680, 36, `+${n} %◆`, '#F5C842');
                this._sfx?.goldEarned();
            }
        });
        Object.defineProperty(this, "_onWaveBonusAwarded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (amount) => {
                const n = amount;
                this._floatingText.show(680, 52, `+${n} бонус`, COLORS.textGold_css);
            }
        });
        Object.defineProperty(this, "_onEnemyLeaked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (enemy) => {
                const e = enemy;
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
            }
        });
        Object.defineProperty(this, "_onLivesChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (lives) => {
                this._hud.setLives(lives);
            }
        });
        Object.defineProperty(this, "_onGoldChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (gold) => {
                this._hud.setGold(gold);
            }
        });
        Object.defineProperty(this, "_onGameOver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (data) => {
                const { victory } = data;
                this._ambientMusic?.stop(2000);
                this._ambientMusic = null;
                this._saveResult(victory);
                this.time.delayedCall(600, () => this._showGameOver(victory));
            }
        });
    }
    create() {
        this.cameras.main.setBackgroundColor(COLORS.bgGameField);
        this.cameras.main.fadeIn(400, 232, 226, 214);
        this._buildSystems();
        this._buildBatchGraphics();
        this._buildMap();
        this._buildBase();
        // Hero — spawns at base center
        this._hero = new Hero();
        this._heroGfx = this.add.graphics().setDepth(DEPTH.HERO);
        this._vfxGfx = this.add.graphics().setDepth(DEPTH.VFX);
        // Skill UI slots (Q and W) — bottom-left above the wave bar
        this._buildSkillUI();
        // Boss warning text (hidden until a boss wave starts)
        const fw = GRID_COLS * TILE_SIZE;
        const fh = GRID_ROWS * TILE_SIZE;
        this._bossWarning = this.add.text(fw / 2, fh / 2, '⚠ ВОЛНА БОССА', {
            fontFamily: FONT, fontSize: '22px',
            color: COLORS.danger_css, fontStyle: 'bold',
            stroke: COLORS.walnutDark_css, strokeThickness: 4,
        }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_UI).setVisible(false);
        // Tutorial — shown once on first launch
        this._buildTutorial();
        if (!localStorage.getItem('tutorial_done')) {
            this._showTutorialStep(0);
        }
        this._hud = new HUD(this, this._economy, this._waveManager);
        this._towerPanel = new TowerPanel(this, this._buildSystem, this._economy);
        this._towerPanel.bindHotkeys(this);
        this._waveInfo = new WaveInfo(this, this._waveManager, this._economy);
        this._floatingText = new FloatingTextPool(this);
        this._buildPauseOverlay();
        this._buildGameOverOverlay();
        this._bindEvents();
        this._bindInput();
        this._waveManager.startGame();
        GameSpeed.reset();
        // Audio — AudioManager was initialised in MenuScene on play click
        if (AudioManager.isReady) {
            const sfxGain = AudioManager.sfxGain;
            const musicGain = AudioManager.musicGain;
            this._sfx = new SFX(sfxGain);
            this._ambientMusic = new AmbientMusic(musicGain);
            this._ambientMusic.start();
        }
    }
    // Fix A: clamp delta, pass adjusted seconds to waveManager/enemies
    update(_time, delta) {
        if (this._isPaused || this._gameOver)
            return;
        const clampedDelta = Math.min(delta, 100);
        const dt = GameSpeed.adjust(clampedDelta) / 1000;
        // Music uses RAW delta — never game-speed adjusted
        this._ambientMusic?.update(delta);
        this._waveManager.update(dt);
        this._hero.update(dt, this._waveManager.activeEnemies);
        // VFX tick
        for (const v of this._vfxList)
            v.elapsed += dt;
        this._vfxList = this._vfxList.filter(v => v.elapsed < v.duration);
        // Skill UI — throttled to 100 ms
        this._skillUiTimer -= dt;
        if (this._skillUiTimer <= 0) {
            this._skillUiTimer = 0.1;
            this._updateSkillUI();
        }
        this._buildSystem.update(clampedDelta);
        this._updateProjectiles(clampedDelta);
        this._animateBase(clampedDelta);
        this._waveInfo.update(clampedDelta);
        this._hud.update(clampedDelta);
        this._towerPanel.update(clampedDelta);
        this._drawAll();
    }
    // Fix B: cleanup
    shutdown() {
        this._ambientMusic?.stop(1500);
        this._ambientMusic = null;
        this._sfx = null;
        this._waveManager.destroy();
        this._interest.destroy();
        this._economy.destroy();
        EventBus.off(GameEvents.ENEMY_KILLED, this._onEnemyKilled, this);
        EventBus.off(GameEvents.ENEMY_REACHED_END, this._onEnemyLeaked, this);
        EventBus.off(GameEvents.LIVES_CHANGED, this._onLivesChanged, this);
        EventBus.off(GameEvents.GOLD_CHANGED, this._onGoldChanged, this);
        EventBus.off(GameEvents.GAME_OVER, this._onGameOver, this);
        EventBus.off(GameEvents.LUMBER_CHANGED, this._onLumberChanged, this);
        EventBus.off(GameEvents.INTEREST_AWARDED, this._onInterestAwarded, this);
        EventBus.off(GameEvents.WAVE_BONUS_AWARDED, this._onWaveBonusAwarded, this);
        EventBus.off(GameEvents.TOWER_PLACED, this._onTowerPlacedSfx, this);
        EventBus.off(GameEvents.TOWER_SOLD, this._onTowerSoldSfx, this);
        EventBus.off(GameEvents.TOWER_UPGRADED, this._onTowerUpgradedSfx, this);
        EventBus.off(GameEvents.WAVE_STARTED, this._onWaveStartedSfx, this);
        EventBus.off(GameEvents.WAVE_COMPLETED, this._onWaveCompletedSfx, this);
        EventBus.off(GameEvents.TOWER_SHOT, this._onTowerShotSfx, this);
        EventBus.off(GameEvents.HERO_SKILL_Q, this._onHeroSkillQ, this);
        EventBus.off(GameEvents.HERO_SKILL_W, this._onHeroSkillW, this);
        EventBus.removeAllListeners();
    }
    // ── Systems ────────────────────────────────────────────────────────────────
    _buildSystems() {
        this._economy = new EconomyManager();
        this._lumber = new LumberManager();
        this._interest = new InterestSystem(this._economy, this._lumber);
        this._enemyPool = new ObjectPool(() => new Enemy(), ENEMY_POOL_SIZE);
        this._projPool = new ObjectPool(() => new Projectile(), PROJ_POOL_SIZE);
        this._waveManager = new WaveManager(this, this._enemyPool);
        this._buildSystem = new BuildSystem(this, this._economy, this._projPool, () => this._waveManager.activeEnemies);
    }
    _buildBatchGraphics() {
        this._shadowGfx = this.add.graphics().setDepth(DEPTH.ENEMY_SHADOW);
        this._towerGfx = this.add.graphics().setDepth(DEPTH.TOWER);
        this._enemyGfx = this.add.graphics().setDepth(DEPTH.ENEMY);
        this._hpGfx = this.add.graphics().setDepth(DEPTH.ENEMY_HEALTHBAR);
        this._projGfx = this.add.graphics().setDepth(DEPTH.PROJECTILE);
        this._effectGfx = this.add.graphics().setDepth(DEPTH.EFFECT);
    }
    _updateProjectiles(delta) {
        // activeItems from pool = currently checked-out projectiles
        const active = this._projPool.activeItems;
        for (const p of active) {
            p.update(delta);
            p.tickSplash(delta / 1000);
        }
    }
    _drawAll() {
        this._shadowGfx.clear();
        this._towerGfx.clear();
        this._enemyGfx.clear();
        this._hpGfx.clear();
        this._projGfx.clear();
        this._effectGfx.clear();
        // Towers
        for (const t of this._buildSystem.towers)
            t.drawTo(this._towerGfx);
        // Enemies + shadows
        const enemies = this._waveManager.activeEnemies;
        for (const e of enemies) {
            if (!e.isActive)
                continue;
            e.drawShadowTo(this._shadowGfx);
            e.drawTo(this._enemyGfx);
            e.drawHealthbarTo(this._hpGfx);
        }
        // Projectiles + splash
        for (const p of this._projPool.activeItems) {
            if (!p.isActive)
                continue;
            p.drawTo(this._projGfx);
            p.drawSplashTo(this._effectGfx);
        }
        // Hero — drawn above projectiles, below HUD
        this._heroGfx.clear();
        this._hero.drawTo(this._heroGfx);
        // VFX rings (skill Q expand, skill W pulse)
        this._drawVFX();
    }
    _drawVFX() {
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
            }
            else {
                // pulse_ring — steady pulsing for skill W duration
                const pulse = 0.15 + Math.sin(v.elapsed * 4) * 0.06;
                this._vfxGfx.lineStyle(2, v.color, pulse);
                this._vfxGfx.strokeCircle(v.x, v.y, v.maxRadius);
            }
        }
    }
    // ── Tutorial ───────────────────────────────────────────────────────────────
    _buildTutorial() {
        this._tutorialRoot = this.add.container(0, 0)
            .setDepth(DEPTH.OVERLAY + 10)
            .setVisible(false);
    }
    _showTutorialStep(step) {
        this._tutorialActive = true;
        const root = this._tutorialRoot;
        root.removeAll(true);
        root.setVisible(true);
        const messages = [
            'Ставьте башни вдоль путей\n(клавиши 1–5).\nРазные башни эффективны\nпротив разной брони.',
            'Кликните на башню для\nинформации. Улучшайте\nбашни кнопкой U.',
            'Управляйте героем правой\nкнопкой мыши.\nQ — ударная волна,\nW — щит башням.',
        ];
        const btnLabels = ['Понятно →', 'Далее →', 'Начать игру!'];
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = 340, ph = 220;
        // Dim backdrop
        const dim = this.add.graphics();
        dim.fillStyle(COLORS.walnutDark, 0.60);
        dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        root.add(dim);
        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(COLORS.bgPanel, 1);
        panel.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
        panel.lineStyle(2, COLORS.amberDeep, 0.6);
        panel.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
        root.add(panel);
        // Step indicator dots
        for (let i = 0; i < 3; i++) {
            const dot = this.add.graphics();
            dot.fillStyle(i === step ? COLORS.amberWarm : COLORS.walnutLight, i === step ? 1 : 0.4);
            dot.fillCircle(cx - 16 + i * 16, cy - ph / 2 + 20, 5);
            root.add(dot);
        }
        // Message
        const msg = this.add.text(cx, cy - 30, messages[step], {
            fontFamily: FONT, fontSize: '14px', color: COLORS.textPrimary_css,
            align: 'center', lineSpacing: 6,
        }).setOrigin(0.5);
        root.add(msg);
        // Button
        const bw = 160, bh = 40;
        const btnG = this.add.graphics();
        btnG.fillStyle(COLORS.amberWarm, 1);
        btnG.fillRoundedRect(cx - bw / 2, cy + ph / 2 - bh - 16, bw, bh, 8);
        root.add(btnG);
        const btnTxt = this.add.text(cx, cy + ph / 2 - bh / 2 - 16, btnLabels[step], {
            fontFamily: FONT, fontSize: '14px',
            color: COLORS.walnutDark_css, fontStyle: 'bold',
        }).setOrigin(0.5);
        root.add(btnTxt);
        const zone = this.add.zone(cx - bw / 2, cy + ph / 2 - bh - 16, bw, bh)
            .setOrigin(0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            this._sfx?.uiClick();
            if (step < 2)
                this._showTutorialStep(step + 1);
            else
                this._closeTutorial();
        });
        root.add(zone);
        // Animate in
        root.setAlpha(0);
        this.tweens.add({ targets: root, alpha: 1, duration: 200 });
    }
    _closeTutorial() {
        this._tutorialActive = false;
        this.tweens.add({
            targets: this._tutorialRoot, alpha: 0, duration: 200,
            onComplete: () => this._tutorialRoot.setVisible(false),
        });
        try {
            localStorage.setItem('tutorial_done', 'true');
        }
        catch { /* private browse */ }
    }
    // ── Save / load result ─────────────────────────────────────────────────────
    _saveResult(isVictory) {
        // Find best tower by damage dealt
        let bestName = '—';
        let bestDamage = 0;
        for (const t of this._buildSystem.towers) {
            if (t.totalDamageDealt > bestDamage) {
                bestDamage = t.totalDamageDealt;
                bestName = t.data.name;
            }
        }
        const result = {
            wavesCompleted: this._waveManager.waveNumber - 1,
            enemiesKilled: this._totalKills,
            livesRemaining: this._economy.lives,
            goldEarned: this._totalGoldEarned,
            bestTowerName: bestName,
            bestTowerDamage: bestDamage,
            isVictory,
            date: new Date().toISOString(),
        };
        try {
            const stored = localStorage.getItem('best_result');
            const best = stored ? JSON.parse(stored) : null;
            const isBetter = !best
                || result.wavesCompleted > best.wavesCompleted
                || (result.wavesCompleted === best.wavesCompleted
                    && result.livesRemaining > best.livesRemaining);
            if (isBetter)
                localStorage.setItem('best_result', JSON.stringify(result));
        }
        catch { /* storage unavailable */ }
    }
    // ── Skill UI ──────────────────────────────────────────────────────────────
    _buildSkillUI() {
        const SLOT = 42;
        const PAD = 8;
        const baseY = GAME_HEIGHT - 52 - PAD; // above wave bar (52px tall)
        const baseX = PAD;
        const keys = ['Q', 'W'];
        keys.forEach((key, i) => {
            const sx = baseX + i * (SLOT + PAD);
            const sy = baseY;
            const bg = this.add.graphics().setDepth(DEPTH.HUD);
            bg.lineStyle(1, COLORS.walnutLight, 0.6);
            bg.fillStyle(COLORS.walnutDark, 0.20);
            bg.fillRoundedRect(sx, sy, SLOT, SLOT, 6);
            bg.strokeRoundedRect(sx, sy, SLOT, SLOT, 6);
            const keyTxt = this.add.text(sx + 5, sy + 4, key, {
                fontFamily: FONT, fontSize: '12px', color: COLORS.textSecondary_css,
                fontStyle: 'bold',
            }).setDepth(DEPTH.HUD + 1);
            const cdTxt = this.add.text(sx + SLOT / 2, sy + SLOT / 2 + 4, '✓', {
                fontFamily: FONT, fontSize: '15px', color: COLORS.amberWarm_css,
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(DEPTH.HUD + 1);
            this._skillSlots.push({ bg, key: keyTxt, cd: cdTxt });
        });
    }
    _updateSkillUI() {
        const cds = [this._hero.skillQCooldown, this._hero.skillWCooldown];
        const maxCds = [this._hero.SKILL_Q_MAX_CD, this._hero.SKILL_W_MAX_CD];
        const SLOT = 42;
        const PAD = 8;
        const baseX = PAD;
        const baseY = GAME_HEIGHT - 52 - PAD;
        this._skillSlots.forEach((slot, i) => {
            const sx = baseX + i * (SLOT + PAD);
            const sy = baseY;
            const cd = cds[i];
            const ready = cd <= 0;
            // Redraw background — bright when ready, dimmed on cooldown
            slot.bg.clear();
            if (ready) {
                slot.bg.lineStyle(2, COLORS.amberWarm, 0.90);
                slot.bg.fillStyle(COLORS.amberDeep, 0.25);
            }
            else {
                // Fill shows remaining fraction as dark overlay
                slot.bg.lineStyle(1, COLORS.walnutLight, 0.45);
                slot.bg.fillStyle(COLORS.walnutDark, 0.50);
            }
            slot.bg.fillRoundedRect(sx, sy, SLOT, SLOT, 6);
            slot.bg.strokeRoundedRect(sx, sy, SLOT, SLOT, 6);
            // Cooldown fill (draining bar from bottom)
            if (!ready) {
                const frac = cd / maxCds[i];
                const fillH = Math.round(SLOT * frac);
                slot.bg.fillStyle(COLORS.walnutDark, 0.55);
                slot.bg.fillRoundedRect(sx, sy + SLOT - fillH, SLOT, fillH, 6);
            }
            slot.cd.setText(ready ? '✓' : String(Math.ceil(cd)));
            slot.cd.setColor(ready ? COLORS.amberWarm_css : COLORS.textMuted_css);
        });
    }
    // ── Map ─────────────────────────────────────────────────────────────────────
    _buildMap() {
        const bg = this.add.graphics().setDepth(DEPTH.BACKGROUND);
        bg.fillStyle(COLORS.bgGameField, 1);
        bg.fillRect(0, 0, GRID_COLS * TILE_SIZE, GRID_ROWS * TILE_SIZE);
        const grid = this.add.graphics().setDepth(DEPTH.GRID);
        grid.lineStyle(1, COLORS.gridLine, 0.18);
        for (let r = 0; r <= GRID_ROWS; r++) {
            grid.beginPath();
            grid.moveTo(0, r * TILE_SIZE);
            grid.lineTo(GRID_COLS * TILE_SIZE, r * TILE_SIZE);
            grid.strokePath();
        }
        for (let c = 0; c <= GRID_COLS; c++) {
            grid.beginPath();
            grid.moveTo(c * TILE_SIZE, 0);
            grid.lineTo(c * TILE_SIZE, GRID_ROWS * TILE_SIZE);
            grid.strokePath();
        }
        const g = this.add.graphics().setDepth(DEPTH.PATH);
        const deco = this.add.graphics().setDepth(DEPTH.PATH_DECORATION);
        for (let row = 0; row < GRID_ROWS; row++)
            for (let col = 0; col < GRID_COLS; col++) {
                const cell = MAP_DATA[row][col];
                const px = col * TILE_SIZE, py = row * TILE_SIZE;
                if (cell === 'P' || cell === 'B') {
                    g.fillStyle(COLORS.pathMain, 1);
                    g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    g.fillStyle(COLORS.pathBorder, 0.30);
                    g.fillRect(px, py, TILE_SIZE, 2);
                    g.fillRect(px, py, 2, TILE_SIZE);
                    const seed = (row * 31 + col * 17) % 100;
                    if (seed < 28) {
                        deco.fillStyle(COLORS.pathBorder, 0.40);
                        deco.fillCircle(px + (seed % 28) + 5, py + ((seed * 7) % 28) + 5, 1.5);
                    }
                }
            }
        this._drawPathEdges();
    }
    _drawPathEdges() {
        const g = this.add.graphics().setDepth(DEPTH.PATH_DECORATION);
        g.lineStyle(1.5, COLORS.pathBorder, 0.55);
        const isPath = (r, c) => { if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS)
            return false; return MAP_DATA[r][c] === 'P' || MAP_DATA[r][c] === 'B'; };
        for (let row = 0; row < GRID_ROWS; row++)
            for (let col = 0; col < GRID_COLS; col++) {
                if (!isPath(row, col))
                    continue;
                const px = col * TILE_SIZE, py = row * TILE_SIZE;
                if (!isPath(row - 1, col)) {
                    g.beginPath();
                    g.moveTo(px, py);
                    g.lineTo(px + TILE_SIZE, py);
                    g.strokePath();
                }
                if (!isPath(row + 1, col)) {
                    g.beginPath();
                    g.moveTo(px, py + TILE_SIZE);
                    g.lineTo(px + TILE_SIZE, py + TILE_SIZE);
                    g.strokePath();
                }
                if (!isPath(row, col - 1)) {
                    g.beginPath();
                    g.moveTo(px, py);
                    g.lineTo(px, py + TILE_SIZE);
                    g.strokePath();
                }
                if (!isPath(row, col + 1)) {
                    g.beginPath();
                    g.moveTo(px + TILE_SIZE, py);
                    g.lineTo(px + TILE_SIZE, py + TILE_SIZE);
                    g.strokePath();
                }
            }
    }
    _buildBase() {
        const bx = BASE_TILE_COL * TILE_SIZE, by = BASE_TILE_ROW * TILE_SIZE;
        const cx = bx + BASE_SIZE / 2, cy = by + BASE_SIZE / 2;
        this._baseGlow = this.add.graphics().setDepth(DEPTH.BASE - 1);
        const g = this.add.graphics().setDepth(DEPTH.BASE);
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const a = Phaser.Math.DegToRad(30 + 60 * i);
            pts.push({ x: cx + BASE_SIZE * 0.52 * Math.cos(a), y: cy + BASE_SIZE * 0.52 * Math.sin(a) });
        }
        g.fillStyle(COLORS.amberDeep, 0.9);
        g.fillPoints(pts, true);
        g.lineStyle(2, COLORS.amberGlow, 0.8);
        g.strokePoints(pts, true);
        const inner = [];
        for (let i = 0; i < 6; i++) {
            const a = Phaser.Math.DegToRad(30 + 60 * i);
            inner.push({ x: cx + BASE_SIZE * 0.32 * Math.cos(a), y: cy + BASE_SIZE * 0.32 * Math.sin(a) });
        }
        g.lineStyle(1, COLORS.amberPale, 0.4);
        g.strokePoints(inner, true);
        g.fillStyle(COLORS.amberGlow, 1);
        g.fillCircle(cx, cy, 7);
        g.lineStyle(1.5, COLORS.amberBright, 0.9);
        g.strokeCircle(cx, cy, 7);
        this.add.text(cx, cy + BASE_SIZE * 0.52 + 8, 'БАЗА', { fontFamily: FONT, fontSize: '11px', color: COLORS.textGold_css }).setOrigin(0.5, 0).setDepth(DEPTH.HUD);
    }
    _animateBase(delta) {
        this._basePulseT += delta * 0.002;
        const pulse = 0.5 + Math.sin(this._basePulseT) * 0.5;
        const bx = BASE_TILE_COL * TILE_SIZE, by = BASE_TILE_ROW * TILE_SIZE;
        this._baseGlow.clear();
        for (let l = 3; l >= 0; l--) {
            const a = (0.06 + pulse * 0.09) * (l + 1) / 4;
            const pad = (3 + pulse * 5) + l * 3;
            this._baseGlow.fillStyle(COLORS.amberWarm, a);
            this._baseGlow.fillRect(bx - pad, by - pad, BASE_SIZE + pad * 2, BASE_SIZE + pad * 2);
        }
    }
    // ── Pause overlay ─────────────────────────────────────────────────────────
    _buildPauseOverlay() {
        const s = this;
        const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
        this._pauseRoot = this.add.container(0, 0).setDepth(DEPTH.OVERLAY).setVisible(false);
        const dim = s.add.graphics();
        dim.fillStyle(COLORS.walnutDark, 0.55);
        dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this._pauseRoot.add(dim);
        // Panel — taller to fit sliders
        const pw = 300, ph = 280;
        const bg = s.add.graphics();
        bg.fillStyle(COLORS.bgPanel, 1);
        bg.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
        bg.lineStyle(2, COLORS.amberDeep, 0.5);
        bg.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
        this._pauseRoot.add(bg);
        this._pauseRoot.add(s.add.text(cx, cy - ph / 2 + 22, '⏸ ПАУЗА', {
            fontFamily: FONT, fontSize: '18px', color: COLORS.walnutDark_css, fontStyle: 'bold',
        }).setOrigin(0.5));
        // ── Volume sliders ──────────────────────────────────────────────────────
        const sliderX = cx - pw / 2 + 20;
        const BAR_W = pw - 40;
        const BAR_H = 6;
        const makeSlider = (label, sy, initial, onChange) => {
            // Label
            this._pauseRoot.add(s.add.text(sliderX, sy, label, {
                fontFamily: FONT, fontSize: '13px', color: COLORS.textSecondary_css,
            }));
            // Track background
            const trackBg = s.add.graphics();
            trackBg.fillStyle(COLORS.walnutLight, 0.25);
            trackBg.fillRoundedRect(sliderX, sy + 22, BAR_W, BAR_H, 3);
            this._pauseRoot.add(trackBg);
            // Fill bar (redrawn on change)
            const fill = s.add.graphics();
            this._pauseRoot.add(fill);
            // Percentage label
            const pctTxt = s.add.text(sliderX + BAR_W + 10, sy + 16, Math.round(initial * 100) + '%', { fontFamily: FONT, fontSize: '13px', color: COLORS.textPrimary_css });
            this._pauseRoot.add(pctTxt);
            const redraw = (v) => {
                fill.clear();
                fill.fillStyle(COLORS.amberWarm, 1);
                fill.fillRoundedRect(sliderX, sy + 22, BAR_W * v, BAR_H, 3);
                // Knob
                fill.fillStyle(COLORS.amberBright, 1);
                fill.fillCircle(sliderX + BAR_W * v, sy + 22 + BAR_H / 2, 7);
                pctTxt.setText(Math.round(v * 100) + '%');
            };
            redraw(initial);
            // Interactive zone (generous hit area)
            const zone = s.add.zone(sliderX, sy + 10, BAR_W, BAR_H + 24).setOrigin(0)
                .setInteractive({ useHandCursor: true });
            this._pauseRoot.add(zone);
            const handlePtr = (ptr) => {
                const ratio = Math.max(0, Math.min(1, (ptr.x - sliderX) / BAR_W));
                onChange(ratio);
                redraw(ratio);
                this._sfx?.uiClick();
            };
            zone.on('pointerdown', handlePtr);
            zone.on('pointermove', (ptr) => {
                if (ptr.isDown)
                    handlePtr(ptr);
            });
        };
        // Music slider
        makeSlider('Музыка', cy - ph / 2 + 70, AudioManager.musicGain?.gain.value ?? 0.3, (v) => AudioManager.setMusicVolume(v));
        // SFX slider
        makeSlider('Звуки', cy - ph / 2 + 130, AudioManager.sfxGain?.gain.value ?? 0.5, (v) => AudioManager.setSfxVolume(v));
        // ── Buttons ─────────────────────────────────────────────────────────────
        const btnY = cy + ph / 2 - 90;
        const r1 = s.add.graphics();
        r1.fillStyle(COLORS.amberWarm, 1);
        r1.fillRoundedRect(cx - 100, btnY, 200, 38, 8);
        this._pauseRoot.add(r1);
        this._pauseRoot.add(s.add.text(cx, btnY + 19, 'Продолжить', {
            fontFamily: FONT, fontSize: '14px', color: COLORS.walnutDark_css, fontStyle: 'bold',
        }).setOrigin(0.5));
        const z1 = s.add.zone(cx - 100, btnY, 200, 38).setOrigin(0).setInteractive({ useHandCursor: true });
        z1.on('pointerdown', () => { this._sfx?.uiClick(); this._togglePause(); });
        this._pauseRoot.add(z1);
        const btnY2 = cy + ph / 2 - 42;
        const r2 = s.add.graphics();
        r2.lineStyle(1, COLORS.walnut, 0.7);
        r2.strokeRoundedRect(cx - 100, btnY2, 200, 34, 8);
        this._pauseRoot.add(r2);
        this._pauseRoot.add(s.add.text(cx, btnY2 + 17, 'В главное меню', {
            fontFamily: FONT, fontSize: '13px', color: COLORS.walnut_css,
        }).setOrigin(0.5));
        const z2 = s.add.zone(cx - 100, btnY2, 200, 34).setOrigin(0).setInteractive({ useHandCursor: true });
        z2.on('pointerdown', () => {
            this._sfx?.uiClick();
            this.cameras.main.fadeOut(300, 240, 238, 233);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
        });
        this._pauseRoot.add(z2);
    }
    _togglePause() {
        this._isPaused = !this._isPaused;
        this._pauseRoot.setVisible(this._isPaused);
        if (this._isPaused) {
            EventBus.emit(GameEvents.GAME_PAUSED);
            // update() early-returns when _isPaused — no need to stop clock
        }
        else {
            EventBus.emit(GameEvents.GAME_RESUMED);
        }
    }
    // ── Game over overlay ─────────────────────────────────────────────────────
    _buildGameOverOverlay() {
        this._gameOverRoot = this.add.container(0, 0).setDepth(DEPTH.OVERLAY).setVisible(false);
    }
    _showGameOver(victory) {
        this._gameOver = true;
        const s = this, cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
        const root = this._gameOverRoot;
        root.removeAll(true);
        root.setVisible(true);
        const dim = s.add.graphics();
        dim.fillStyle(COLORS.walnutDark, 0.65);
        dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        root.add(dim);
        const pw = 320, ph = 400;
        const bg = s.add.graphics();
        bg.fillStyle(COLORS.bgPanel, 1);
        bg.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
        bg.lineStyle(2, victory ? COLORS.amberDeep : COLORS.dangerSoft, 0.6);
        bg.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
        root.add(bg);
        const titleTxt = victory ? '✦ ПОБЕДА ✦' : 'ПОРАЖЕНИЕ';
        const titleCol = victory ? COLORS.amberGlow_css : COLORS.danger_css;
        root.add(s.add.text(cx, cy - 170, titleTxt, { fontFamily: FONT, fontSize: '24px', color: titleCol, fontStyle: 'bold' }).setOrigin(0.5));
        root.add(s.add.text(cx, cy - 135, victory ? 'Светлогорск спасён!' : 'Шторм поглотил берег...', { fontFamily: FONT, fontSize: '14px', color: COLORS.textSecondary_css }).setOrigin(0.5));
        if (!victory) {
            root.add(s.add.text(cx, cy - 108, `Вы дошли до волны: ${this._wavesReached}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted_css }).setOrigin(0.5));
        }
        // Stats
        const stats = [
            [`Волны пройдено`, `${this._waveManager.waveNumber - 1} / ${this._waveManager.totalWaves}`],
            [`Врагов уничтожено`, `${this._totalKills}`],
            [`Янтарь собран`, `${this._totalGoldEarned}◆`],
            [`Жизни осталось`, `${this._economy.lives}`],
        ];
        stats.forEach(([lbl, val], i) => {
            const y = cy - 70 + i * 28;
            root.add(s.add.text(cx - 130, y, lbl, { fontFamily: FONT, fontSize: '12px', color: COLORS.textSecondary_css }));
            root.add(s.add.text(cx + 130, y, val, { fontFamily: FONT, fontSize: '12px', color: COLORS.textPrimary_css, align: 'right' }).setOrigin(1, 0));
        });
        const mkBtn = (label, bgCol, outlineCol, textCol, bx, by, bw, bh, cb) => {
            const g = s.add.graphics();
            if (bgCol !== null) {
                g.fillStyle(bgCol, 0.9);
                g.fillRoundedRect(bx, by, bw, bh, 8);
            }
            g.lineStyle(1, outlineCol, 0.7);
            g.strokeRoundedRect(bx, by, bw, bh, 8);
            root.add(g);
            root.add(s.add.text(bx + bw / 2, by + bh / 2, label, { fontFamily: FONT, fontSize: '13px', color: textCol, fontStyle: 'bold' }).setOrigin(0.5));
            const z = s.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
            z.on('pointerdown', cb);
            root.add(z);
        };
        const btnY = cy + 140, bw = 130, bh = 38, gap = 16;
        mkBtn('Играть снова', COLORS.amberWarm, COLORS.amberWarm, COLORS.walnutDark_css, cx - bw - gap / 2, btnY, bw, bh, () => { this.cameras.main.fadeOut(300, 240, 238, 233); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene')); });
        mkBtn('В меню', null, COLORS.walnut, COLORS.walnut_css, cx + gap / 2, btnY, bw, bh, () => { this.cameras.main.fadeOut(300, 240, 238, 233); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene')); });
    }
    // ── Events ─────────────────────────────────────────────────────────────────
    _bindEvents() {
        EventBus.on(GameEvents.ENEMY_KILLED, this._onEnemyKilled, this);
        EventBus.on(GameEvents.ENEMY_REACHED_END, this._onEnemyLeaked, this);
        EventBus.on(GameEvents.LIVES_CHANGED, this._onLivesChanged, this);
        EventBus.on(GameEvents.GOLD_CHANGED, this._onGoldChanged, this);
        EventBus.on(GameEvents.GAME_OVER, this._onGameOver, this);
        // Phase 2 — economy extensions
        EventBus.on(GameEvents.LUMBER_CHANGED, this._onLumberChanged, this);
        EventBus.on(GameEvents.INTEREST_AWARDED, this._onInterestAwarded, this);
        EventBus.on(GameEvents.WAVE_BONUS_AWARDED, this._onWaveBonusAwarded, this);
        // SFX — named handlers so they can be removed cleanly in shutdown()
        EventBus.on(GameEvents.TOWER_PLACED, this._onTowerPlacedSfx, this);
        EventBus.on(GameEvents.TOWER_SOLD, this._onTowerSoldSfx, this);
        EventBus.on(GameEvents.TOWER_UPGRADED, this._onTowerUpgradedSfx, this);
        EventBus.on(GameEvents.WAVE_STARTED, this._onWaveStartedSfx, this);
        EventBus.on(GameEvents.WAVE_COMPLETED, this._onWaveCompletedSfx, this);
        EventBus.on(GameEvents.TOWER_SHOT, this._onTowerShotSfx, this);
        // Hero skill VFX
        EventBus.on(GameEvents.HERO_SKILL_Q, this._onHeroSkillQ, this);
        EventBus.on(GameEvents.HERO_SKILL_W, this._onHeroSkillW, this);
    }
    // ── Input ──────────────────────────────────────────────────────────────────
    _bindInput() {
        const kbd = this.input.keyboard;
        // SPACE — skip countdown
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
            if (this._tutorialActive)
                return;
            if (this._waveManager.state === 'countdown')
                this._waveManager.skipCountdown();
        });
        // ESC cascade: cancel build → deselect → pause
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
            if (this._tutorialActive)
                return;
            if (this._buildSystem.isPlacing) {
                this._buildSystem.cancelPlacement();
                return;
            }
            if (this._buildSystem.selectedTower) {
                this._buildSystem.deselect();
                return;
            }
            this._togglePause();
        });
        // M — menu (if not game over)
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
            if (this._gameOver)
                return;
            this.cameras.main.fadeOut(300, 240, 238, 233);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
        });
        // DELETE — sell selected tower
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE).on('down', () => {
            this._buildSystem.sellSelected();
        });
        // U — upgrade (first option)
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.U).on('down', () => {
            const t = this._buildSystem.selectedTower;
            if (t && t.data.upgradeTo.length > 0)
                this._buildSystem.upgradeSelected(t.data.upgradeTo[0]);
        });
        // TAB — toggle all range circles
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.TAB).on('down', () => {
            this._buildSystem.toggleAllRanges();
        });
        // Q — Hero skill: Shockwave
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on('down', () => {
            this._hero.useSkillQ(this._waveManager.activeEnemies);
        });
        // W — Hero skill: Amber Shield
        kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W).on('down', () => {
            this._hero.useSkillW(this._buildSystem.towers);
        });
        // RMB — move hero (field only; cancel build/selection first)
        this.input.on('pointerdown', (ptr) => {
            if (!ptr.rightButtonDown())
                return;
            const wx = ptr.worldX;
            const wy = ptr.worldY;
            if (wx < 0 || wx > 720 || wy < 0 || wy > 720)
                return;
            this._hero.moveTo(wx, wy);
        });
        // Chain onto WaveInfo's existing onWaveStart callback (set in WaveInfo constructor)
        const prevOnWaveStart = this._waveManager.onWaveStart;
        this._waveManager.onWaveStart = (wave) => {
            prevOnWaveStart?.(wave);
            this._wavesReached = wave.wave;
            this._hud.setWave(wave.wave, wave.isBoss);
        };
    }
}
