# DESIGN.md — SvetloTD: Stage 10+ Overhaul
> Burbenog-inspired economy · Visual identity · Strategic depth
> Last updated: 2026-05-05

---

## 1. Research Summary: Burbenog TD Mechanics

### Governor (Race) System
- Players choose one of 12–15 governors, each granting a different set of buildable tower elements (120 total towers across all governors). Goal: prevent 40 waves of monsters from reaching the center. Teamwork across 4 players is essential.
- Each governor commissions 4 types of builders. The primary builder is summoned at game start; every subsequent builder requires one **Lumber**, earned after every 5th completed level. Governors include: Human (cheap/fast), Magic (special abilities), Fire (splash), Ice (slow/freeze), Thunder (longest range), Poison (DoT + slow), Death (black magic).
- Besides towers, players choose a **Hero** who catches leaks and uses special abilities. Training the hero also costs one Lumber.

### Economy
- **Gold interest** (inspired by Element TD, the spiritual cousin): every 15 seconds all players gain interest of 2% on their unspent gold. Players may increase the interest rate once every five levels at the cost of an Element pick.
- **Lumber as secondary resource**: earned every 5 completed waves; spent to unlock additional builders or ultimate towers. This is the core Burbenog scarcity mechanic.
- **Bounty**: each creep type has a fixed bounty defined in the Object Editor. All costs, bounty amounts, damage, cooldown, HP, and movement speed can be modified in the Object Editor. Standard WC3 bounty scales with unit power.
- **Wave completion bonus**: fixed gold reward after each cleared wave, escalating with wave number.
- Starting gold is split among the number of players (fewer players = more gold each). In single-player we treat the full amount as available.
- **Difficulty modes**: Normal / Hard / Expert. Hard lowers enemy HP by 40%, Expert lowers it by 31% (relative to the hardest mode's baseline — i.e., higher difficulty = more HP). Gold income is also adjusted.

### Game Modes
- Blitz: doubles mobs. Shared Income: splits gold bounties. Endless Spawn: fight waves without pause.
- Random events referenced in BurbenOG: Auto HP increase adds 5% HP to mobs every 1.30 minutes. Blitz 1.5× wave spawns in 4-player mode only.

### Sell Mechanic
Burbenog uses **full refund during build phase** (between waves) and partial refund during combat. This is a defining strategic feature — rewarding repositioning after each cleared wave.

---

## 2. Adapted Design for SvetloTD (Single-Player)

### 2.1 Economy Formulas

#### Gold Interest
Applied **once per wave completion**, after bountyGold is added but before next countdown starts.

```
interestGold = floor(currentGold * interestRate)
```

| Difficulty | interestRate | Notes |
|---|---|---|
| Normal | 0.05 | Generous, forgiving |
| Hard | 0.03 | Standard |
| Insane | 0.01 | Punishing |

**Display:** floating text "+N interest" in amber above gold counter.

#### Wave Completion Bonus
```
waveBonus = baseBonus + (waveNumber * scalingBonus)
```

| Difficulty | baseBonus | scalingBonus |
|---|---|---|
| Normal | 15 | 3 |
| Hard | 10 | 2 |
| Insane | 5 | 1 |

This replaces / augments the existing `WaveData.bonusGold` field (keep that for wave-specific overrides; generic formula is the fallback).

#### Creep Bounty Table (revised)

| Enemy | Current | Revised | Notes |
|---|---|---|---|
| grunt | 5 | 4 | Common, low value |
| runner | 3 | 3 | Fast, small |
| golem | 12 | 14 | Yields +1 Lumber |
| wyvern | 8 | 7 | Air, moderate |
| boss_goliath | 50 | 60 | Yields +2 Lumber |
| nether_drake (new) | — | 45 | Flying boss, +1 Lumber |
| mountain_giant (new) | — | 55 | Melee boss, +2 Lumber |

#### Sell Refund Rules
- **Build phase** (no active enemies on map): 100% refund of `tower.totalInvested`
- **Combat phase**: 70% refund (existing behavior)
- `BuildSystem` checks `waveManager.activeEnemies.length === 0 && waveManager.state !== 'spawning'`

#### Lumber (Secondary Resource)
- Starting amount: **0**
- Earned: +1 per golem/nether_drake kill, +2 per boss kill, +1 per 5th wave completion
- Spent on: Mercenary towers (special unlocks), Aura Flag, ultimate tower upgrades
- UI: small lumber icon + counter in HUD, next to gold

---

## 3. Governor (Race) System

Three governors replace the current generic tower pool. Player chooses before wave 1.

### Governor A — Iron Forge (Human)
*Cheap, fast attack, piercing-focused. Recommended for beginners.*

| Tower | Tier | Cost | Type | Notes |
|---|---|---|---|---|
| Ballista | T1 | 50 | piercing | Replaces arrow_t1 |
| Mortar | T1 | 75 | siege | Replaces cannon_t1, AoE |
| Ballista Mk.II | T2 | 120 | piercing | Upgrade of Ballista |
| Howitzer | T2 | 180 | siege | Upgrade of Mortar |
| Steam Cannon | T3 (Lumber×1) | 250 | chaos | Ultimate. AoE + slow |
| Watchtower | support | 60 | — | Aura: +15% attack speed nearby |

Hero skill Q: **Explosive Charge** — AoE siege damage + stun 1s (CD 10s)  
Hero skill W: **Iron Discipline** — +30% attack speed to all towers 8s (CD 20s)

### Governor B — Amber Mages (Magic)
*High damage, magic type, great vs heavy. Moderate cost.*

| Tower | Tier | Cost | Type | Notes |
|---|---|---|---|---|
| Conjurer | T1 | 60 | magic | Replaces magic_t1 |
| Hexer | T1 | 50 | magic | Slow + armor reduce |
| Alchemist | T1 | 70 | piercing | Poison DoT (existing acid_t1) |
| Crystal Shard | T2 | 200 | chaos | High single target, ignores armor |
| Arcane Nexus | T3 (Lumber×1) | 300 | magic | AoE + invisible detection |
| Mana Conduit | support | 80 | — | Aura: +20% dmg to magic towers in radius |

Hero skill Q: **Arcane Burst** — AoE magic damage (CD 12s)  
Hero skill W: **Amber Shield** — +25% attack speed + detect invisible (CD 25s)

### Governor C — Night Stalkers (Poison/Death)
*DoT specialists, invisible detection, high risk/reward.*

| Tower | Tier | Cost | Type | Notes |
|---|---|---|---|---|
| Toxin Spitter | T1 | 55 | piercing | Poison DoT per hit |
| Shadow Ward | T1 | 65 | magic | Detects invisible, slow |
| Plague Cannon | T1 | 80 | siege | Poison AoE splash |
| Death Coil | T2 | 160 | magic | Chain hits 3 enemies |
| Void Shrine | T3 (Lumber×2) | 350 | chaos | Massive DoT field aura |
| Corpse Harvester | support | 70 | — | Earns +1 gold per kill in radius |

Hero skill Q: **Root Trap** — immobilizes enemies in 100px radius 2s (CD 15s)  
Hero skill W: **Shadow Meld** — hero turns invisible, enemies in radius take +30% dmg 8s (CD 30s)

---

## 4. New Enemy Types

### Nether Drake (Flying Boss, Wave 17)
```typescript
id: 'nether_drake', name: 'Нефритовый Дракон',
hp: 1800, speed: 45, armorType: 'heroic', bounty: 45, livesCost: 4,
isFlying: true, isBoss: true, color: 0x2E1A52,
special: 'aoe_pulse' // deals 1 dmg/s to towers in 60px radius (cosmetic/flavor)
```

### Mountain Giant (Ground Boss, Wave 19)
```typescript
id: 'mountain_giant', name: 'Горный Титан',
hp: 3000, speed: 15, armorType: 'fortified', bounty: 55, livesCost: 6,
isFlying: false, isBoss: true, color: 0x4A3A2A,
special: 'spawn_minions' // on death: spawns 3 grunts (hpMult 0.5)
```

### Invisible Creep — Phantom (Wave 13+)
```typescript
id: 'phantom', name: 'Призрак',
hp: 120, speed: 90, armorType: 'unarmored', bounty: 10, livesCost: 2,
isFlying: false, isInvisible: true, color: 0xAA88CC,
```
Detection: only towers with `canDetectInvisible: true` flag (Shadow Ward, Arcane Nexus, Watchtower) can target it. Others skip it. Visual: 30% alpha when not detected.

---

## 5. Missing Mechanics Implementation Plan

### slow_t2 — Ice Bastion
```typescript
id: 'slow_t2', name: 'Ледяной Бастион',
damage: 10, attackSpeed: 0.9, range: 130, damageType: 'magic', cost: 150,
special: [{ type: 'slow', value: 0.55, duration: 2.5 }, { type: 'aoe_slow', radius: 50 }],
upgradeTo: []
```

### Aura Tower (Flag / Watchtower)
- Passive scan every 1000ms: finds all towers within `auraRadius`
- Applies `TowerBuff { type: 'attack_speed', value: 0.15, duration: 1.5 }` to each
- Rendered as pulsing ring; no projectile logic needed

### Random Events (Insane mode only, 20% chance per wave)
| Event | Effect | Duration |
|---|---|---|
| Goblin Raid | +5 fast grunts from random path | instant spawn |
| Gold Rush | bounty ×2 | 12 seconds |
| Fog of War | all tower ranges shown as 0 in UI | 8 seconds (visual only) |

---

## 6. Difficulty Settings

Stored in `GameConfig` singleton, set on MenuScene before game start.

| Setting | Enemy HP mult | Enemy Speed mult | Interest rate | Wave bonus mult |
|---|---|---|---|---|
| Normal | ×1.0 | ×1.0 | 5% | ×1.0 |
| Hard | ×1.6 | ×1.15 | 3% | ×0.8 |
| Insane | ×2.8 | ×1.3 | 1% | ×0.6 |

---

## 7. Asset Strategy

### Primary: Kenney Tower Defense Top-Down (CC0)
- This package includes everything needed for a Tower Defense game: ground tiles, roads, towers, particle effects, enemies, and HUD numbers. 300 separate PNG files + tilesheet. License: CC0.
- URL: `https://kenney.nl/assets/tower-defense-top-down`
- **Decision**: use as reference/fallback only. The game already uses a strong amber/walnut palette identity that Kenney's assets (military/modern theme) would break.

### Chosen Approach: SVG-as-Texture (No HTTP requests)
Given the existing procedural rendering pipeline (batch `Graphics.drawTo`), the most cohesive path is:
1. Keep batch rendering for gameplay entities (enemies, towers, projectiles)
2. Generate SVG icons for UI elements (tower buttons, wave preview, skill icons) and convert to Phaser textures via `scene.textures.addBase64()`
3. Replace rectangular tile grid with a hand-crafted tile texture (SVG → canvas) for stone/amber path and cobblestone buildable cells

**No external file dependencies.** Zero HTTP requests. Game stays self-contained.

### Credits Placeholder
```
Kenney (kenney.nl) — design reference, CC0
Procedural graphics: original code, SvetloTD project
Baltic amber palette: original design
```

---

## 8. UI Layout (Text Sketch)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [GAME FIELD 720×720px]                    [RIGHT PANEL 560px]                │
│                                           ┌──────────────────────────┐       │
│  ┌──── GAME GRID 18×18 ────┐              │ 💰 Gold: 450  🪵 Lumber: 3│       │
│  │  [path tiles amber]     │              │ ❤️ Lives: 20  Wave: 3/20  │       │
│  │  [buildable stone cells]│              ├──────────────────────────┤       │
│  │  [base glow center]     │              │  BUILD TOWERS            │       │
│  │  [enemies walking]      │              │  [1] Ballista      50g   │       │
│  │  [towers shooting]      │              │  [2] Mortar        75g   │       │
│  │  [hero moving]          │              │  [3] Conjurer      60g   │       │
│  └─────────────────────────┘              │  [4] Watchtower    60g   │       │
│                                           │  [5] Alchemist     70g   │       │
│  [Skill bar bottom-left]                  ├──────────────────────────┤       │
│  [Q: Shockwave  12s CD]                   │  SELECTED TOWER          │       │
│  [W: Amb Shield 25s CD]                   │  [sprite] Name / Tier    │       │
│                                           │  DMG / SPD / RNG         │       │
│  [Boss warning banner top]                │  DPS: 24.0               │       │
│  [Wave transition overlay]                │  Kills: 12  Dmg: 1,440   │       │
│                                           │  [U] Upgrade  150g       │       │
│                                           │  [Del] Sell   105g       │       │
│                                           │  [Priority: FIRST ▼]     │       │
│                                           ├──────────────────────────┤       │
│                                           │  NEXT WAVE (in 18s)      │       │
│                                           │  ████████░░░░  [▶ SKIP]  │       │
│                                           │  Enemies: 🔴×12 fast     │       │
│                                           │  [Diff: HARD]  [Speed×2] │       │
│                                           └──────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Code Architecture Changes

### Files to Add
```
src/
  config/
    damage.ts          ← move armor-reduction multiplier here
    difficulty.ts      ← DifficultyConfig type + presets
  systems/
    InterestSystem.ts  ← gold interest + wave bonus (listens EventBus)
    LumberManager.ts   ← lumber resource (add/spend/emit)
    AuraSystem.ts      ← passive tower aura scan (1Hz)
    RandomEvents.ts    ← Insane-mode random events
  data/
    governors.ts       ← GovernorDef type + 3 governor definitions
    raceOverrides.ts   ← per-governor tower pool overrides
  scenes/
    GovernorSelect.ts  ← pre-game race selection screen
  ui/
    LumberHUD.ts       ← lumber counter widget
    WaveTransition.ts  ← "Wave X incoming" overlay (extracted from GameScene)
    SkillBar.ts        ← hero skill UI (extracted from GameScene)
```

### Files to Refactor
- `GameScene.ts` (931 → target ~450 lines): extract WaveTransition, SkillBar, tutorial logic
- `WaveManager.ts`: replace event-based remaining counter with deterministic spawn/despawn tracking
- `DamageCalculator.ts`: read armor coefficient from `config/damage.ts`
- `EconomyManager.ts`: add `lumber` field + `addLumber()` / `spendLumber()` methods
- `enemies.ts`: add `canDetectInvisible: boolean` to `EnemyDef`, add 3 new enemy types
- `towers.ts`: add `canDetectInvisible: boolean` + `auraRadius?: number` to `TowerData`

### EventBus — New Events
```typescript
LUMBER_CHANGED        // LumberManager → HUD
INTEREST_AWARDED      // InterestSystem → HUD floating text
WAVE_BONUS_AWARDED    // InterestSystem → HUD floating text
BUILD_PHASE_START     // WaveManager → BuildSystem (enable 100% sell)
BUILD_PHASE_END       // WaveManager → BuildSystem (revert to 70%)
GOVERNOR_SELECTED     // GovernorSelect → GameScene (set tower pool)
RANDOM_EVENT_START    // RandomEvents → HUD banner
```

---

## 10. Visual Target & Feel

**Style**: Clean dark fantasy, Baltic amber. NOT pixel art. Smooth anti-aliased vector shapes (the current batch-render approach is correct and distinctive).

**Additions**:
- Animated tile textures: stone path tiles with subtle crack lines, buildable tiles with moss border
- Bloom effect: Phaser pipeline with glow pass on projectiles and boss enemies
- Particle bursts on enemy death: 6–10 colored dots, 0.3s lifetime, per enemy color
- Smooth HP bar transitions: `currentDisplayWidth` lerps to `targetWidth` each frame
- Wave transition overlay: full-width dark panel slides in from top, shows wave number in large amber text + enemy preview icons, slides out after 2s
- Dynamic soundtrack: low-pass filter on ambient drone lifts as wave number increases; danger level raises oscillator frequency by 20Hz per leaked life

---

## 11. Implementation Priority (Phases 1→6)

| Phase | Priority tasks | Est. complexity |
|---|---|---|
| **P1 Visual Baseline** | SVG tile textures, particle deaths, smooth HP bars | Medium |
| **P2 Economy** | Interest system, lumber, build-phase sell, wave bonus | Low-Medium |
| **P3 Mechanics** | Invisible enemies, slow_t2, 2 new bosses, aura tower | Medium |
| **P4 Race Select** | Governor screen, 3 tower pools, per-race hero skills | Medium-High |
| **P3b Depth** | Random events, Mountain Giant minions, detection logic | Medium |
| **P4 Refactor** | Split GameScene, fix WaveManager counter, config/damage.ts | Low |
| **P5 Polish** | CRT pipeline, wave transition screen, dynamic music | Medium |
| **P6 QA** | Jest tests for DamageCalc/Economy/WaveManager, play test | Low |

**Start with P2 (Economy)** — zero visual risk, pure additive logic on top of existing EventBus. Then P3 (Mechanics), then P4 (Race Select + visual overhaul together).

---

*End of DESIGN.md — ~200 lines*
