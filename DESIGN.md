# DESIGN.md — SvetloTD v1.0 "Amber Noir" (Mobile-First Overhaul)

> Burbenog-inspired economy · Modern dark-fantasy Baltic-amber visuals · Phone-first UX
> Document version: 2026-10 · Audience: AI coding/art agents first, humans second
> Supersedes: DESIGN.md of 2026-05-05 (all still-valid rules are preserved below with IDs)

---

## 0. Reading Protocol (for AI agents — read this first)

### 0.1 Conventions
- **MUST / MUST NOT / SHOULD / MAY** follow RFC 2119.
- Every rule has an ID such as `ECO-003`, `UI-021`. Commit messages and PR descriptions MUST cite the IDs they implement or touch.
- Status tags:
  - `[DONE]` is implemented according to the changelog in this file.
  - `[TODO]` is not implemented.
  - `[PROPOSED]` is a design decision awaiting human confirmation. Implement behind a data flag, or ask.
  - `[UNKNOWN-AUDIT]` means the status is unknown. Inspect the code before touching it.
- **Authority order** when sources conflict:
  1. §3 Game Rules and §6 Field Geometry (invariants)
  2. §2 Platform constraints and budgets
  3. Everything else
  4. Existing code
  If code contradicts an invariant, do NOT silently pick a side. Write an entry in §14 (Decision Log), then fix code or doc.
- **Never invent balance numbers.** Anything not specified here (starting gold, starting lives, countdown length, wave composition) lives in data files (`src/data/*.ts|json`). Read it from there. If missing, add it as a named constant in `src/config/balance.ts` with a `// TBD-HUMAN` comment and list it in §14.

### 0.2 Agent Working Rules
1. **Step 0 is always an audit.** Read `src/`, `docs/GAME_DESIGN.md`, `ARCHITECTURE.md`, `ROADMAP.md`. Produce `docs/AUDIT.md` mapping every rule ID to `DONE | PARTIAL | MISSING` with file references.
2. Work in **vertical slices**, one task card (§12) per PR. Each slice MUST be playable and `npm run verify` MUST pass.
3. `npm run verify` = typecheck + lint + unit tests + `assets:validate` + production build. If a script is missing, creating it is task `M0-01`.
4. **Determinism:** all gameplay randomness MUST use the seeded RNG `mulberry32(seed)` from `src/core/rng.ts`. `Math.random()` is allowed only in purely cosmetic VFX.
5. **No runtime network dependencies.** No CDN fonts, no analytics, no ads, no remote assets. The game MUST work offline after first load.
6. **No allocations in hot loops** (`update`, per-frame tweens). Pool sprites, particles, floating texts and projectiles.
7. **Legal:** no Blizzard/WarCraft names, art, maps, music or characters. No copyrighted references in prompts or filenames (`LEG-001`).
8. Do not migrate Phaser major versions in this overhaul. Baseline is the project's current Phaser 3.x (≥ 3.60 features such as postFX and the new particle emitter may be used when WebGL is available).
9. UI strings are never hard-coded. Use `t('key')` from `src/i18n` (§8.9).
10. When unsure between two implementations, choose the one that is **testable without a browser** (pure functions in `src/core`, thin Phaser adapters in `src/scenes|ui`).

### 0.3 Non-Goals (do not build)
Multiplayer, accounts, IAP/ads, 3D meshes, skeletal animation runtimes, pixel-art restyle, WarCraft-like asset imitation, procedurally generated maps (the map is fixed, §6).

---

## 1. Product Vision

**One-liner:** A 12–18 minute, one-thumb-friendly dark-fantasy tower defense where every wave ends in a satisfying economic decision (spend, save for interest, or spend Lumber on an ultimate).

### 1.1 Pillars
| ID | Pillar | Implication |
|---|---|---|
| PIL-1 | **Readable at 6 cm** | Entities are identifiable by silhouette at ≈ 21 dp tile size. Info hierarchy beats decoration. |
| PIL-2 | **Economy is the strategy** | Interest, Lumber, and build-phase 100% refund make timing decisions interesting. |
| PIL-3 | **Amber Noir identity** | Warm amber light against deep walnut and moss darkness. Not generic fantasy, not pixel art. |
| PIL-4 | **Phone first, desktop supported** | Portrait layout is primary. Landscape/desktop reuses the same components. |
| PIL-5 | **Self-contained & fast** | Offline PWA, ≤ 12 MB initial payload, stable 60 fps on a mid-tier 2022 phone. |

### 1.2 Target Session
20 waves (`WAVE_COUNT = 20`), 12–18 min at ×1 speed, 8–12 min with ×2. A run MUST be interruptible: app backgrounding pauses the game and the state persists (§10.3).

---

## 2. Platform, Tech & Performance Constraints

### 2.1 Targets
| Item | Requirement |
|---|---|
| Primary | Mobile browsers (iOS Safari 16+, Chrome Android 110+) as an installable PWA |
| Secondary | Desktop Chrome/Firefox/Safari/Edge, keyboard + mouse |
| Optional packaging | Capacitor wrapper for iOS/Android store builds (no engine changes allowed for it) |
| Renderer | WebGL preferred; Canvas fallback MUST remain playable (no postFX, quality tier `low`) |
| Orientation | Portrait primary; landscape supported (§8.1) |
| Language | `ru` (default), `en` |

### 2.2 Stack (keep)
TypeScript (strict) · Phaser 3.x · Vite · Jest. Additions allowed: `vite-plugin-pwa`, a small sharp-based asset toolchain in `tools/assets/` (dev-only).

### 2.3 Performance Budgets (PERF)
| ID | Budget | Value |
|---|---|---|
| PERF-001 | Frame rate (mid-tier phone, tier `high`/`medium`) | 60 fps; never below 45 fps p95 |
| PERF-002 | Draw calls per frame (WebGL) | ≤ 150 |
| PERF-003 | Active display objects in world | ≤ 400 |
| PERF-004 | GPU texture memory | ≤ 96 MB total, each atlas ≤ 2048×2048 |
| PERF-005 | Initial payload (gzip, excluding audio) | ≤ 8 MB; audio ≤ 4 MB |
| PERF-006 | Cold start to interactive menu | ≤ 3 s on 4G mid-tier phone |
| PERF-007 | JS heap growth over 20 waves | ≤ 40 MB (no leaks; pools reused) |
| PERF-008 | Per-frame allocations in `update` | 0 (objects pooled) |

### 2.4 Quality Tiers
Auto-detected: measure average frame time over 120 frames at the start of wave 1 and again every 3 waves. Downgrade if avg > 20 ms. Upgrade only if avg < 12 ms for 2 consecutive checks. User may force a tier in Settings.

| Feature | `high` | `medium` | `low` |
|---|---|---|---|
| Texture scale | @2x | @2x | @1x |
| Bloom postFX on projectiles/bosses | yes | baked additive glow sprites | no |
| Day/night grading | camera ColorMatrix postFX | multiply overlay rect | overlay rect, static |
| Particle cap (total live) | 300 | 150 | 60 |
| Floating damage numbers | yes | crits/bosses only | off |
| Screen shake | yes (unless reduce-motion) | yes (unless reduce-motion) | no |
| Ambient terrain animation (grass sway, citadel pulse) | yes | citadel pulse only | no |
| Target frame cap | 60 | 60 | 30 |

Resolution scale: render resolution = `min(devicePixelRatio, 2)` for `high/medium`, `1` for `low`. Never render above 2×.

---

## 3. Game Rules — Source of Truth

> Everything in §3 is an invariant (see §0.1). Numbers here are canonical. Formulas MUST use **integer math** (no floating-point accumulation).

### 3.1 Difficulty (`src/config/difficulty.ts`)
Names are `normal | hard | insane`. (Burbenog's "Hard/Expert" appear only in the research appendix.)

| Setting | normal | hard | insane |
|---|---|---|---|
| `enemyHpMultPct` | 100 | 160 | 280 |
| `enemySpeedMultPct` | 100 | 115 | 130 |
| `interestRateBp` (basis points) | 500 | 300 | 100 |
| `waveBonusMultPct` | 100 | 80 | 60 |
| `randomEvents` | off | off | on |

Selected on MenuScene, stored in the `GameConfig` singleton, persisted in the save (§10.3). Changing difficulty mid-run is not allowed.

### 3.2 Economy

**ECO-001 Wave completion order** (canonical; executed by `WaveManager` → `InterestSystem`, exactly once per wave, in this order):
1. All per-kill bounties are already credited.
2. `waveBonus` credited. Emits `WAVE_BONUS_AWARDED`.
3. `interest` credited on gold *after* step 2. Emits `INTEREST_AWARDED`.
4. If `wave % 5 === 0`: `+1 Lumber`. Emits `LUMBER_CHANGED`.
5. Emit `BUILD_PHASE_START`, then start the countdown.

**ECO-002 Wave bonus** `[DONE v0.8.0]`
```ts
waveBonus = Math.round(WaveData.bonusGold * waveBonusMultPct / 100);
```
(The legacy `baseBonus + w*scaling` formula is removed. Do not reintroduce it.)

**ECO-003 Gold interest**
```ts
interestGold = Math.floor(currentGold * interestRateBp / 10000);
```
HUD shows an amber floating text `+N` with an interest glyph above the gold counter (`t('hud.interest', {n})`).

**ECO-004 Sell refund** `[DONE v0.3.0–v0.4.0]`
- Build phase (every countdown, including before wave 1): `refund = tower.totalInvested` (100%).
- Combat phase: `refund = Math.floor(tower.totalInvested * 70 / 100)`.
- `EconomyManager.sellRefundRate` follows `BUILD_PHASE_START` / `BUILD_PHASE_END`. `BuildSystem.sellSelected()` and the tower panel read from it.

**ECO-005 Lumber**
- Start 0. Sources: `lumberReward` field on `EnemyDef` (data-driven, see §3.4) and +1 on every 5th completed wave.
- Sinks: Mercenary towers, Aura Flag, Tier-3 ultimates (cost listed per tower).
- HUD: lumber icon + counter next to gold.

**ECO-006 Bounty** is read from `EnemyDef.bounty`, multiplied by the Gold Rush event multiplier (§3.6) when active, after rounding: `Math.round(bounty * bountyMult)`.

**Test vectors (MUST exist as Jest tests):**
| Case | Input | Expected |
|---|---|---|
| interest normal | gold 1000, bp 500 | 50 |
| interest hard | gold 999, bp 300 | 29 |
| interest insane | gold 150, bp 100 | 1 |
| interest zero | gold 0 | 0 |
| wave bonus hard | bonusGold 35, pct 80 | 28 |
| wave bonus insane | bonusGold 45, pct 60 | 27 |
| sell build | invested 105 | 105 |
| sell combat | invested 105 | 73 |
| sell combat | invested 100 | 70 |
| order | gold 100, bonus 50 (normal) | interest on 150 = 7 |

### 3.3 Creep Bounty Table
| Enemy id | Bounty | `lumberReward` |
|---|---|---|
| grunt | 4 | 0 |
| runner | 3 | 0 |
| golem | 14 | 1 |
| wyvern | 7 | 0 |
| phantom | 10 | 0 |
| boss_goliath | 60 | 2 |
| nether_drake | 45 | 1 |
| mountain_giant | 55 | 2 |

### 3.4 Enemy Definitions
```ts
// src/data/enemies.ts
export interface EnemyDef {
  id: string;
  nameKey: string;              // i18n key, never a literal
  hp: number; speed: number;    // base values before difficulty
  armorType: 'unarmored' | 'light' | 'medium' | 'fortified' | 'heroic';
  bounty: number; lumberReward: number; livesCost: number;
  isFlying: boolean; isBoss: boolean; isInvisible?: boolean;
  special?: 'aoe_pulse' | 'spawn_minions';
  visual: EnemyVisual;          // see §7.2
  canDetectInvisible?: never;   // enemies never detect; flag lives on towers
}
```

| id | HP | Speed | Armor | Lives | Flying | Notes |
|---|---|---|---|---|---|---|
| nether_drake (wave 17) | 1800 | 45 | heroic | 4 | yes | Boss. `aoe_pulse` is **cosmetic only**: pulsing 60px ring VFX under the drake, no gameplay effect `[PROPOSED-confirm]`. |
| mountain_giant (wave 19) | 3000 | 15 | fortified | 6 | no | Boss. On death spawns 3 grunts at `hpMult 0.5` (inherit difficulty mults). |
| phantom (wave 13+) | 120 | 90 | unarmored | 2 | no | Invisible. Only towers with `canDetectInvisible` can target it. |

Display names (ru): see §8.9 table. Existing creeps (grunt, runner, golem, wyvern, boss_goliath) keep their current stats from code `[UNKNOWN-AUDIT]`.

**WAVE-001** Remaining-enemy counting MUST be deterministic: `WaveManager` tracks `spawned`, `resolved` (killed + leaked), and `pendingMinions`. A wave completes when `resolved === spawned && pendingMinions === 0 && spawnQueue.length === 0`. No event-count heuristics.

### 3.5 Governors (tower pools)
Player picks one before wave 1 (`GovernorSelect` scene). Each governor defines a tower pool, a support tower, and two hero skills. Governor definitions live in `src/data/governors.ts`. Legacy ids (`arrow_t1`, `cannon_t1`, `magic_t1`, `acid_t1`, `slow_t2`) map via `legacyId` so old saves and tests keep working.

#### A — Iron Forge (Human) · "Cheap, fast, piercing. Beginner-friendly."
| id | Tier | Cost | Type | Notes |
|---|---|---|---|---|
| ballista | T1 | 50 | piercing | legacyId `arrow_t1` |
| mortar | T1 | 75 | siege | legacyId `cannon_t1`, AoE |
| ballista_mk2 | T2 | 120 | piercing | upgrade of ballista |
| howitzer | T2 | 180 | siege | upgrade of mortar |
| steam_cannon | T3 | 250 + Lumber×1 | chaos | AoE + slow |
| watchtower | support | 60 | — | aura +15% attack speed; `canDetectInvisible: true` |

Hero Q **Explosive Charge**: AoE siege damage + 1 s stun (CD 10 s). Hero W **Iron Discipline**: +30% attack speed to all towers for 8 s (CD 20 s).

#### B — Amber Mages (Magic) · "High damage, great vs heavy armor."
| id | Tier | Cost | Type | Notes |
|---|---|---|---|---|
| conjurer | T1 | 60 | magic | legacyId `magic_t1` |
| hexer | T1 | 50 | magic | slow + armor reduction; `canDetectInvisible: true` `[PROPOSED, see D-004]` |
| alchemist | T1 | 70 | piercing | poison DoT, legacyId `acid_t1` |
| crystal_shard | T2 | 200 | chaos | high single target, ignores armor |
| arcane_nexus | T3 | 300 + Lumber×1 | magic | AoE + invisible detection |
| mana_conduit | support | 80 | — | aura +20% dmg to magic towers in radius |

Hero Q **Arcane Burst**: AoE magic damage (CD 12 s). Hero W **Amber Shield**: +25% attack speed and detect invisible (CD 25 s).

#### C — Night Stalkers (Poison/Death) · "DoT specialists, high risk/reward."
| id | Tier | Cost | Type | Notes |
|---|---|---|---|---|
| toxin_spitter | T1 | 55 | piercing | poison DoT per hit |
| shadow_ward | T1 | 65 | magic | detects invisible, slow; `canDetectInvisible: true` |
| plague_cannon | T1 | 80 | siege | poison AoE splash |
| death_coil | T2 | 160 | magic | chain hits 3 enemies |
| void_shrine | T3 | 350 + Lumber×2 | chaos | massive DoT field aura |
| corpse_harvester | support | 70 | — | +1 gold per kill in radius |

Hero Q **Root Trap**: immobilize enemies within 100 px for 2 s (CD 15 s). Hero W **Shadow Meld**: hero invisible, enemies in radius take +30% damage for 8 s (CD 30 s).

**Shared tower mechanics**
- `slow_t2` **Ice Bastion** (legacy pool item, can be granted as a neutral tower or mapped to Hexer T2 `[PROPOSED]`): damage 10, attackSpeed 0.9, range 130, magic, cost 150, specials `slow {value 0.55, duration 2.5}` + `aoe_slow {radius 50}`.
- **Aura system**: `AuraSystem` scans every 1000 ms, finds towers within `auraRadius`, applies `TowerBuff { type, value, duration: 1.5 }`. Rendered as a pulsing ring. No projectile logic.
- **Detection**: only towers with `canDetectInvisible: true` may target invisible enemies. Others skip them. Undetected phantoms render at 30% alpha with a shimmer. Detected phantoms render at 100% with a violet outline.
- **Balance invariant (BAL-001):** each governor MUST have a detector available before wave 13 without Lumber.

### 3.6 Random Events (insane only; 20% chance per wave; rolled with seeded RNG at wave start)
| Event | Effect | Duration |
|---|---|---|
| Goblin Raid | +5 fast grunts from a random path | instant spawn |
| Gold Rush | bounty ×2 | 12 s |
| Fog of War | tower ranges rendered as 0 in the UI | 8 s (visual only) |

Announced with a banner (§8.6) on `RANDOM_EVENT_START`.

### 3.7 Damage
Armor-reduction coefficient is read from `src/config/damage.ts`. `DamageCalculator` has no magic numbers.

---

## 4. Visual Identity — "Amber Noir"

### 4.1 Art Direction
Clean, modern, hand-painted-vector dark fantasy. Warm amber light sources against cool dark-moss ground. **Not pixel art.** Soft anti-aliased shapes, a consistent top-left key light, soft contact shadows, a thin dark outline for readability.

Keywords: *Baltic amber, walnut, moss, sandstone, ember glow, runic engraving, soft rim light.*
Anti-keywords: *neon, cyberpunk, glossy plastic, grim-dark gore, photorealism, WarCraft-lookalike.*

### 4.2 Palette Tokens
Single source: `src/config/theme.ts`. All code and shaders MUST import from it; hex literals elsewhere fail lint (`UI-001`).

```ts
export const COLOR = {
  void:      0x0E0B08,
  walnut:    { 900: 0x1A120C, 800: 0x2A1D13, 700: 0x3B2A1B, 600: 0x4F3925 },
  amber:     { 300: 0xFFD27A, 400: 0xF5B544, 500: 0xE39A1F, 600: 0xB87310 },
  sandstone: { 300: 0xD9C39A, 500: 0xBFA676, 700: 0x8C7650 },
  moss:      { 900: 0x0F1F14, 700: 0x1D3A24, 500: 0x2F5A37, 300: 0x5E8C58 },
  text:      { primary: 0xF6EBD6, secondary: 0xBFAE92, disabled: 0x7A6C57 },
  state:     { danger: 0xE5484D, success: 0x5FBF7A, warning: 0xF5B544, info: 0x5CC8F0 },
  dmg:       { piercing: 0xE8D9B0, siege: 0xFF7A3D, magic: 0x8E6CF0,
               chaos: 0xE04FA0, poison: 0x7FD13B, frost: 0x5CC8F0 },
} as const;
```

### 4.3 Contrast & Readability Rules
- **UI-002** Body text contrast ≥ 4.5:1 against its panel; large text and icons ≥ 3:1. A CI script checks token pairs.
- **UI-003** Enemy silhouette luminance contrast against both `moss.500` and `sandstone.500` ≥ 3:1 (checked by `assets:validate`).
- **UI-004** Information MUST NOT rely on hue alone. Damage types always pair color with an icon shape (§7.4); status effects use glyphs.
- **UI-005** Enemy class by silhouette: ground-light = small and round, fast = narrow and forward-leaning, heavy = wide and low, flying = wings plus a large offset shadow, boss = ≥ 1.6× size plus a golden ring marker.

### 4.4 Lighting & Material Language (faked, mobile-cheap)
- Key light from upper-left; **baked** into all sprites (highlight top-left, shade bottom-right). Rim light in `amber.300` at ≤ 35% opacity on the lit edge.
- Dynamic lighting engines (Light2D, normal maps) are **not used**. Use these instead:
  1. Soft elliptical contact shadow under every entity (`fx_shadow`, alpha 0.35, flying: offset +14 px, alpha 0.25, scale 0.8).
  2. Additive glow sprites (`fx_glow_*`) on projectiles, the citadel, magic towers, and bosses.
  3. Baked ambient occlusion in terrain tiles (darker at road edges and tower plates).
- **Time-of-day progression** gives visual pacing:
  | Waves | Grade | Overlay tint | Intensity |
  |---|---|---|---|
  | 1–7 | Dusk | warm `amber.600` | 8% |
  | 8–14 | Twilight | neutral-cool `0x3A4A6A` | 14% |
  | 15–20 | Night | deep blue `0x0E1630` plus citadel glow ×1.4 | 22% |
  Transitions tween over 3 s at the start of the first wave in each band.

### 4.5 Typography
Self-hosted `woff2`, both families OFL with Cyrillic coverage (CI checks glyph coverage of all i18n strings):
- UI: **Manrope** (500/700/800)
- Display (wave numbers, titles, boss banners): **Playfair Display** (700/800)
- In-canvas numerals (gold, damage, floating text): generated **BitmapFont** (`font_num`) to avoid per-frame text re-rasterization.

Type scale (logical px at portrait layout, see §8.1 for scaling): caption 22 · body 26 · label 28 · title 40 · display 72. Minimum text size on screen ≥ 11 sp equivalent.

### 4.6 Motion Language
- Ease: `Cubic.easeOut` for entrances (180–240 ms), `Sine.easeInOut` for loops, `Back.easeOut` (overshoot 1.2) for confirm/placement.
- UI transitions ≤ 250 ms. Never block input during an animation.
- Respect `prefers-reduced-motion` and the in-app toggle (`UI-006`): no screen shake, no pulsing bloom, wave banner uses fade instead of slide.

---

## 5. Rendering & Asset Pipeline

### 5.1 Strategy (replaces the old "SVG-as-texture only" decision)
Hybrid pipeline, in priority order:
1. **Terrain**: baked once per run into a single `RenderTexture` (720×720 logical) from tile sprites. Static map = 1 draw call.
2. **Entities**: layered sprites from texture atlases with **procedural animation** (no hand-animated frame sheets, no skeletons). Layers: `shadow` · `body` · `turret/head` (rotates) · `fx`.
3. **UI**: 9-slice panels and an SVG-sourced icon atlas.
4. **Fallback**: existing Phaser vector drawing (`Graphics`) remains as a `low`-tier or asset-missing fallback, via `renderMode: 'sprite' | 'vector'` per entity. This preserves the invariant that the game never shows a missing-texture box (`ART-001`).

Existing "prototype art" (three terrain PNGs, twelve 40 px concept PNGs) are *concepts*. They are replaced by production assets from §5.4 through the manifest, never edited in place.

### 5.2 Atlas Spec
| Atlas key | Contents | Max size @2x |
|---|---|---|
| `atlas_terrain` | ground tiles, road autotile, citadel, plates, decor | 2048² |
| `atlas_towers` | all tower bases/turrets/tier pips/muzzle flashes | 2048² |
| `atlas_enemies` | all enemies, bosses, hero sprites | 2048² |
| `atlas_fx` | projectiles, glows, shadows, particles, rings, status glyphs | 1024² |
| `atlas_ui` | icons, 9-slice panels, buttons, cards, badges | 2048² |

- Formats: WebP (lossy q≥90 for painterly sprites; lossless for UI) with PNG fallback. Phaser multiatlas JSON.
- Variants: `@1x` and `@2x` folders; the loader picks per §2.4.
- Padding 2 px, extrusion 1 px (prevents bleeding when scaled), premultiplied alpha consistent across atlases.
- Source masters authored at **4×** (160 px per 40 px logical cell), downsampled by the toolchain with Lanczos. Masters live in `assets-src/` (not shipped).

### 5.3 Authoring Geometry
| Entity | Logical footprint | Canvas incl. overhang | Master (4×) |
|---|---|---|---|
| Terrain tile | 40×40 | 40×40 | 160×160 |
| Tower | 40×40 (1 cell) | 48×48 | 192×192 |
| Small/medium enemy | ≈ 28×28 | 40×40 | 160×160 |
| Boss | ≈ 56×56 | 72×72 | 288×288 |
| Hero | ≈ 32×32 | 48×48 | 192×192 |
| Projectile | 6–16 | 24×24 | 96×96 |
| UI icon | 24 dp | 48 px | SVG |

### 5.4 Asset Manifest (single source of truth)
`assets-src/manifest.yaml` (consumed by both generation and validation tooling):

```yaml
- id: tower_ballista_base
  atlas: atlas_towers
  kind: tower_base
  master: { w: 192, h: 192 }
  footprintFill: [0.55, 0.85]     # min/max fraction of canvas covered by opaque pixels
  palette: [walnut, sandstone, amber]
  promptKey: tower_ballista
  status: TODO                    # TODO | CONCEPT | FINAL
```

**Required terrain assets (`atlas_terrain`)**
| id prefix | Count | Description |
|---|---|---|
| `ground_moss_` | 6 | Dark-green variants (a–f), seamless, subtle tufts and pebbles |
| `road_sand_` | 4 | Sandstone lane variants, subtle cracks, seamless |
| `road_edge_00..15` | 16 | 4-bit neighbor-mask autotile (N=1, E=2, S=4, W=8) for road↔moss border with baked AO |
| `plate_buildable` | 3 | Moss-bordered cobble plate marking buildable cells (visible only in build mode or on hover) |
| `citadel_2x2` | 1 | 80×80 logical, amber citadel, glow baked separately (`fx_glow_citadel`) |
| `spawn_gate` | 4 | One per road end (N/E/S/W): runic gate |
| `decor_*` | ≥ 8 | Rocks, stumps, mushrooms, amber crystals. Only on non-buildable moss cells; seeded placement |

Variant selection MUST be deterministic: `variant = hash(x, y, mapSeed) % N`. No flicker between frames or sessions.

**Required entity assets**
| Group | Ids |
|---|---|
| Towers (per tower: `*_base`, `*_turret` where rotating, tier pips shared) | ballista, ballista_mk2, mortar, howitzer, steam_cannon, watchtower, conjurer, hexer, alchemist, crystal_shard, arcane_nexus, mana_conduit, toxin_spitter, shadow_ward, plague_cannon, death_coil, void_shrine, corpse_harvester, ice_bastion |
| Enemies | grunt, runner, golem, wyvern, phantom, boss_goliath, nether_drake, mountain_giant |
| Heroes | hero_iron_forge, hero_amber_mage, hero_night_stalker |
| FX | proj_bolt, proj_shell, proj_orb, proj_dart, proj_chain, fx_shadow, fx_glow_{amber,violet,green,orange,frost}, fx_ring, fx_pulse, fx_hit, fx_death_dot, fx_muzzle_{1..3}, status_{slow,poison,stun,root,buff,detect} |
| UI | see §8.3 |

### 5.5 AI Image Generation Protocol
AI image models MAY be used to produce concepts and masters. Output is *never* shipped raw. It passes the validation gate (§5.6).

**Style-lock prompt template** (store in `assets-src/prompts/_style.txt`, prepend to every prompt):
```
Top-down 3/4 view (camera pitch about 45 degrees), game asset on a transparent background,
centered, 8% empty margin, soft key light from upper-left, subtle amber rim light,
hand-painted vector look with smooth anti-aliased shapes, crisp thin dark-walnut outline (#1A120C),
palette limited to walnut brown, amber, sandstone beige and dark moss green,
strong readable silhouette, baked soft ambient occlusion, no text, no watermark, no logo.
```
**Negative prompt:** `pixel art, photorealistic, 3D render, glossy plastic, neon, gore, text, signature, Warcraft, Blizzard, Dota, League of Legends, cropped, blurry, multiple objects, background scenery`

**Per-asset prompt** (`assets-src/prompts/<promptKey>.txt`) states only: role, silhouette hint, 2–3 material cues, and what must be recognizable at 40 px. Example:
```
promptKey: tower_ballista
Role: cheap rapid piercing tower. Silhouette: low wooden-and-iron frame with a long horizontal bolt rail,
crossbow arms spread wide. Materials: dark walnut wood, riveted iron, amber-tinted bolt tips.
Must read at 40px as "wide crossbow".
```
**Consistency rules:** fixed seed per asset family; generate the turret and the base as separate images (or mask-split) so the turret can rotate; generate ≥ 4 candidates, pick by validator score, then a human review (§5.6). For terrain, request *seamless tiling* and verify programmatically.

If no image model is available, the toolchain MUST be able to produce an acceptable procedural placeholder (`tools/assets/procedural.ts` using SVG shapes + gradients + noise) that passes the validator. Placeholder status is `CONCEPT`.

### 5.6 Asset Validation Gate (`npm run assets:validate`)
Runs in CI. Fails the build on:
| Check | Rule |
|---|---|
| Dimensions | Master and exports match the manifest geometry exactly |
| Alpha | Fully transparent corners; no matte halo (edge pixels with alpha 0.02–0.98 must not be color-shifted > ΔE 10 from neighbors) |
| Fill ratio | Opaque coverage within `footprintFill` |
| Palette | ≥ 70% of opaque pixels fall within hue families of the declared `palette` tokens |
| Contrast | Silhouette luminance contrast vs `moss.500` and `sandstone.500` ≥ 3:1 (UI-003) |
| Tileability | For tiles: edge pixel diff against its own opposite edge ≤ threshold |
| Budget | Atlas size ≤ budget; total payload ≤ PERF-005 |
| Naming | Names/prompts contain no banned terms (`LEG-001`): warcraft, blizzard, etc. |
| Manifest | Every manifest entry has an exported frame; no orphan frames in atlases |

Plus a **visual regression** pass (§13.3).

### 5.7 Terrain Bake
```ts
// src/render/TerrainBaker.ts
bake(map: MapGrid, seed: number, scale: 1 | 2): Phaser.GameObjects.RenderTexture
```
1. For each cell: pick ground/road variant (deterministic), road edges via the 4-bit mask.
2. Draw decor on eligible moss cells (seeded, never on road, plates, or adjacent to the base).
3. Draw the citadel and spawn gates.
4. Output one RenderTexture. Rebaking occurs only on map/seed/scale change.
Buildable-cell plates and the placement grid are a **separate overlay layer** (toggled).

---

## 6. Game Field Geometry (invariants)

- **GEO-001** Grid 18×18, tile 40 px logical → board 720×720 logical in every layout.
- **GEO-002** Base (citadel) is 2×2 tiles at the exact center: cells (8,8)–(9,9).
- **GEO-003** Four roads (N/S/E/W), each 2 tiles wide, mirror-symmetric on both axes about the center.
- **GEO-004** Buildable cells = moss cells not on roads, not under the base, not under spawn gates. Computed by a pure function `isBuildable(x, y)` with unit tests for symmetry.
- **GEO-005** Color contrast: dark-green terrain, sandstone lanes, amber citadel, readable silhouettes.
- **GEO-006** Towers/enemies/hero keep readable silhouettes even in `vector` fallback mode.

---

## 7. Entity Visual Specs

### 7.1 Towers
Layered: `shadow` → `base` (static) → `turret` (rotates toward target, lerp 0.25/frame) → `muzzleFlash` (additive, 60 ms) → `tierPips` (1–3 small amber gems on the base) → optional `aura ring`.
- Fire feedback: turret recoil (−3 px along facing, 60 ms back-ease), muzzle flash, projectile spawn at `muzzleOffset`.
- Upgrade: 240 ms flash plus scale pop 1.0→1.12→1.0, tier pip lights up.
- Selection: pulsing range ring (`fx_ring`, 2 px stroke `amber.400` at 60%, fill 8%) and a bracket marker.
- Support towers show a faint constant aura ring in the governor color.
- Undetectable/disabled: desaturate 60%.

```ts
export interface TowerVisual {
  spriteBase: string; spriteTurret?: string;
  muzzleOffset: { x: number; y: number }; // from center, at turret angle 0
  projectileKey: string; flashKey: string;
  glow?: 'amber' | 'violet' | 'green' | 'orange' | 'frost';
}
```
Extend `TowerData` with `canDetectInvisible: boolean`, `auraRadius?: number`, `visual: TowerVisual`, `lumberCost?: number`, `legacyId?: string`.

### 7.2 Enemies
Layers: `shadow` + `body` + optional `wings/fx`. All animation is **procedural**:
| Motion | Implementation |
|---|---|
| Walk | body y-bob ±1.5 px and rotation ±4° at `speed`-scaled frequency; runners lean forward 8° |
| Flying | slow vertical hover ±3 px, shadow offset +14 px, wing layer flaps via scaleY 0.8↔1.1 |
| Hit | `setTintFill(white)` 80 ms, tiny knockback 1 px |
| Death | scale 1→0.6, alpha→0 over 300 ms + 6–10 `fx_death_dot` particles tinted to the enemy's `visual.tint`, 0.3 s lifetime |
| Spawn | scale 0.6→1 and alpha 0→1 over 200 ms at the gate |
| Boss | golden ring marker, bloom (tier-dependent), screen top boss bar |
| Phantom | alpha 0.3 + shimmer (tint alternates ±10%, 400 ms) until detected |
| Slowed/poisoned/stunned | status glyph above head, max 2 shown, plus a subtle tint (frost/green/yellow) |

HP bar: shown only after the first damage (bosses always, on the top boss bar). Display width lerps toward the target (`displayW += (targetW - displayW) * 0.2`). Bar width = enemy footprint, 4 px tall, 1 px dark outline.

```ts
export interface EnemyVisual {
  sprite: string; scale: number; tint?: number;
  shadow: { scale: number; offsetY: number; alpha: number };
  walk: 'waddle' | 'lean' | 'stomp' | 'hover' | 'glide';
  deathParticles: { count: [number, number]; tint: number };
}
```

### 7.3 Hero
48 px canvas, same layered approach. Moves to tapped location (tap on empty road cell or via a drag joystick, §8.5), with a path-following ease. Skill casts show a telegraph (ground ring, 120 ms in) → effect (additive burst) → cooldown on the skill button as a radial wipe.

### 7.4 Damage-Type Glyphs
Each damage type has a unique glyph shape **and** a color (UI-004): piercing = arrowhead ▲, siege = shell ●, magic = diamond ◆, chaos = hexagram ✶, poison = drop 💧-shape, frost = snowflake ❄-shape. These appear in the tower card, tower sheet, damage numbers (small), and enemy info.

### 7.5 Projectiles & VFX
- Pooled; cap by quality tier (§2.4).
- Projectile = sprite + additive glow + 3-point trail (faded alpha) on `high`.
- Impact: `fx_hit` (80 ms), siege adds a ring expansion (`fx_ring`, radius=AoE, 200 ms).
- Citadel: breathing glow (scale 1.0↔1.06, 2.4 s loop), flashes red on a leak (120 ms) with camera shake 4 px (unless reduce-motion) and a vignette pulse.
- Build phase: placement plates fade in (alpha 0→0.5, 200 ms). Hidden during combat unless the player is placing.

---

## 8. UI / UX (mobile-first)

### 8.1 Layouts
All layouts keep the **board at exactly 720×720 logical** (GEO-001). A `LayoutManager` (`src/ui/LayoutManager.ts`) chooses the layout and publishes it on resize.

```ts
export type LayoutId = 'portrait' | 'landscape';
// aspect = innerWidth / innerHeight
// aspect < 1.0  → portrait  (logical width 720, height 1216..1600, FIT to width)
// aspect >= 1.0 → landscape (logical height 720, width 1280..1560, panel absorbs extra width)
export const LAYOUT = {
  portrait:  { width: 720,  topBarH: 96,  boardY: 96,  dockMinH: 400 },
  landscape: { height: 720, boardX: 0,    panelMinW: 560 },
} as const;
```
Scale mode: `FIT` with `autoCenter: CENTER_BOTH`; letterbox color `COLOR.void`. Apply `env(safe-area-inset-*)`: top/bottom insets increase `topBarH` and dock padding, they do not shrink the board.

**Portrait wireframe (720 × 1216–1600 logical):**
```
┌──────────────────────────────────────────┐ y=0
│ safe-area-top                            │
│ ❤ 20    Wave 3/20  ⏸   ×2   ⚙            │ TOP BAR  96
│ 🪙 450 (+12 interest)        🪵 3        │
├──────────────────────────────────────────┤ y≈96+inset
│                                          │
│          GAME BOARD 720×720              │
│   (18×18 tiles, pinch-zoom 1×–2×,        │
│    2-finger pan when zoomed)             │
│                                          │
│  [boss banner / event banner overlays]   │
├──────────────────────────────────────────┤ y≈816
│ DOCK (flexible, ≥ 400)                   │
│ ┌ tabs: [Build] [Tower] [Wave] ┐         │
│ │ tower cards ◄ scroll ►       │  (Q)(W) │ ← hero skills, thumb zone
│ │ [Ballista][Mortar][Conj.]…   │  112px  │
│ └──────────────────────────────┘         │
│ ▶ NEXT WAVE  ▓▓▓▓▓░░ 12s   [SKIP]        │
│ safe-area-bottom                         │
└──────────────────────────────────────────┘
```
**Landscape (1280×720, panel 560 wide on the right)** uses the same components stacked vertically in the right panel, matching the previous design: resources header → build list → selected tower → next wave.

### 8.2 Touch & Scaling Rules
- Define `uiScale = layout.logicalWidth / canvasCssWidth`. Helper `dp(n) = n * uiScale`.
- **UI-010** Every interactive element hit-area ≥ `dp(48)` square, with ≥ `dp(8)` spacing between adjacent targets. Visual size may be smaller than the hit-area.
- **UI-011** Primary actions (build, upgrade, next wave, skills) live in the bottom 45% of the screen (thumb zone). Destructive actions (sell) are separated from upgrade by ≥ `dp(16)` and styled as secondary.
- **UI-012** One-handed mode (Settings): mirrors the dock layout (skills on left or right).
- **UI-013** Haptics and audio feedback for every confirmed action (§9).

### 8.3 Component Library (`src/ui/components/`)
Each component is a Phaser `Container` subclass with a pure `ViewModel` for tests.

| Component | Spec |
|---|---|
| `Panel` | 9-slice walnut panel: fill `walnut.800` @ 92%, 1 px inner border `amber.600` @ 40%, radius 16, soft top-left inner highlight, drop shadow 0 6 / 24% black |
| `Button` | Primary: amber gradient (`amber.400→amber.600`), text `walnut.900`. Secondary: walnut with amber outline. Pressed: scale 0.96 + darken 10% (80 ms). Disabled: 40% alpha and no hit |
| `IconButton` | 56 dp visual, 48 dp min hit; used for pause, speed, settings |
| `ResourcePill` | Icon + `font_num` value; tween-count on change (400 ms); flash green/red on gain/loss; floating delta |
| `TowerCard` | 128×152 logical: portrait icon, name, cost badge, damage-type glyph; states: `affordable`, `unaffordable` (cost red, 50% dim), `locked` (lumber cost shown), `selected` |
| `SkillButton` | 112 px circle, radial cooldown wipe, remaining seconds, key hint on desktop (Q/W), disabled while a modal is open |
| `BottomSheet` | Slides up 250 ms; used for Selected Tower; swipe-down dismiss |
| `Toast` | Max 1 visible, 2 s, bottom of board |
| `Banner` | Full-width, top of board (boss, random event, wave) |
| `Modal` | Dim 60% black, blocks world input (§8.7) |
| `RangePreview` | Ring and fill around the cursor/selection |

Icon source: SVG in `assets-src/icons/`, rasterized into `atlas_ui` at 48 px (@1x) / 96 px (@2x). Style: 2 px stroke, rounded joins, duotone amber over walnut.

### 8.4 Information Hierarchy (preserved)
Wave / Lives / Resources / Tower action / Upgrades are always visible. Selectable towers and upgrade/sell pricing stay visible (descriptive hints under counters).

Selected tower sheet shows: sprite and name/tier · DMG / SPD / RNG · DPS · Kills & total damage · **Upgrade** (cost, Lumber if any) · **Sell** (`✕ Продать  <gold>◆`, label format unchanged) · Priority selector (FIRST / LAST / STRONGEST / WEAKEST / CLOSEST).

### 8.5 Input Model
| Gesture | Action |
|---|---|
| Tap tower | Select, open sheet |
| Tap empty board | Deselect; in hero-move mode, move hero |
| **Drag a TowerCard onto the board** | Placement mode |
| Tap TowerCard then tap a tile | Alternate placement (accessibility-friendly) |
| Two-finger pinch/pan | Camera zoom 1×–2× and pan (clamped to board) |
| Double tap board | Toggle zoom 1× ↔ 1.6× around the tap |
| Long-press tower (400 ms) | Quick info tooltip |
| Tap Q/W | Cast skill (`InputCapabilities` tap-to-cast); aimed skills show a telegraph and cast at the next board tap |
| Desktop keys | `1–6` select tower, `U` upgrade, `Del` sell, `Q/W` skills, `Space` start wave, `P`/`Esc` pause, `F` speed |

**Placement flow (solves the "fat finger on 21 dp tiles" problem):**
1. During drag, the ghost tower is drawn at a **reticle offset** of `−dp(56)` on Y above the finger. The finger never occludes it.
2. The reticle snaps ("magnetic") to the nearest buildable tile center within 1.5 tiles. If none, the ghost turns red and shows ✕.
3. Ghost displays the range ring, valid (green tint) / invalid (red tint), and the cost.
4. Release over a valid tile places it (`Back.easeOut` pop, haptic "medium"). Release over the dock, or drag back into the dock, cancels.
5. If gold is insufficient: the card shakes, the cost flashes red, haptic "error", no placement.
6. Optional "Confirm placement" setting for the tap-tap mode: shows ✔/✕ buttons near the tile.

**Safety:** Selling and any action costing > 50% of current gold in one tap offers a 4-second **Undo** toast (valid only if the phase hasn't changed) `[PROPOSED]`.

### 8.6 Wave Flow UI
- **Wave banner**: full-width dark panel slides from top (240 ms), shows `Волна N` in display type (amber) and ≤ 5 enemy preview icons with counts, holds 2 s, slides out. Reduce-motion → fade.
- **Boss warning** (waves with `isBoss`): red-tinted banner, boss portrait, boss HP bar pinned under the top bar during the fight.
- **Next-wave panel**: countdown bar, `SKIP` (starts early; no bonus unless `[PROPOSED]` early-start gold, not part of v1), preview of next wave's types (flying/invisible/boss flags as glyphs).
- **Speed**: ×1 / ×2 toggle, applied via `scene.time.timeScale` and `physics`/tween timescales together. Persisted.

### 8.7 Modal & State Invariants `[DONE v0.2.1]`
- **UI-020** Modal dialogs disable world construction, selection, upgrades, hero actions, and selling.
- **UI-021** Retry/return-to-menu rebuilds the skill HUD exactly once, with no stale sprites (components `destroy()` fully, listeners removed).
- **UI-022** `InputCapabilities` enables tap-to-cast Q/W. The claim "mobile-ready" is permitted in docs/store text only after the M1 acceptance checklist passes.
- **UI-023** Tower panel `[DONE v0.4.0]`: the sell button shows the refund for the current phase and refreshes if the phase changes while a tower is selected. Priority applies immediately (tower re-targets); upgrading keeps the chosen priority. Label format: `✕ Продать  <gold>◆`.

### 8.8 Screens
| Scene | Contents |
|---|---|
| `BootScene` | Loads fonts, atlases (tier-based), shows a thin amber progress bar and a logo |
| `MenuScene` | Title, Play, Difficulty (segmented control with a short numeric hint each), Settings, Credits. Resume button if a save exists |
| `GovernorSelect` | 3 cards (swipeable on phones): portrait, tower lineup preview, 2 hero skills with icons, a difficulty hint ("Beginner-friendly"). Confirm button in the thumb zone. Emits `GOVERNOR_SELECTED` |
| `GameScene` | Board plus HUD plus dock (§8.1). Logic extracted into `WaveTransition`, `SkillBar`, tutorial, so `GameScene` ≤ ~450 lines |
| `ResultScene` | Victory/defeat, stats (kills, gold earned, interest earned, best tower), Retry / Menu |
| `SettingsOverlay` | Quality tier (Auto/High/Med/Low), reduce motion, haptics, SFX/music sliders, text scale (100/115/130%), one-handed mode, language, colorblind-assist (adds extra glyph outlines) |

First-run tutorial (≤ 4 steps, skippable): place a tower (drag) → start wave → upgrade → use a skill. Never shown twice.

### 8.9 Localization
`src/i18n/{ru,en}.json`. All strings keyed. Plurals via ICU-lite helper. Number format: `Intl.NumberFormat`. Required keys incl.:

| Key | ru | en |
|---|---|---|
| `enemy.nether_drake` | Дракон Бездны `[PROPOSED, D-003]` | Nether Drake |
| `enemy.mountain_giant` | Горный Титан | Mountain Giant |
| `enemy.phantom` | Призрак | Phantom |
| `hud.interest` | +{n} процентов | +{n} interest |
| `tower.sell` | ✕ Продать  {gold}◆ | ✕ Sell  {gold}◆ |
| `wave.title` | Волна {n} | Wave {n} |
| `event.goblin_raid` | Набег гоблинов! | Goblin Raid! |
| `event.gold_rush` | Золотая лихорадка! | Gold Rush! |
| `event.fog_of_war` | Туман войны | Fog of War |

CI test: every key exists in all locales; no unused keys; all glyphs exist in the shipped fonts.

---

## 9. Audio & Haptics

- WebAudio; audio unlocked on first user gesture. `visibilitychange` → pause audio and game. Mute switch respected.
- Formats: `.m4a` (AAC) primary for iOS Safari plus `.ogg` for others; single audio-sprite file for SFX.
- Music: procedural ambient drone (existing). Dynamic: low-pass cutoff rises with wave number (waves 1→20: ~600 Hz → ~4 kHz), oscillator +20 Hz per leaked life (capped +120 Hz). Duck music −6 dB during boss banners.
- SFX list (each ≤ 400 ms, normalized −14 LUFS): place, upgrade, sell, error, wave start, wave clear, leak, boss warning, skill ×6, shots per damage type ×5, hit, death, UI tap, UI back.
- Haptics: `navigator.vibrate` where supported, Capacitor Haptics when wrapped. Patterns: tap 8 ms · place 15 ms · error [10,40,10] · leak 40 ms · boss [30,60,30]. Respect the Settings toggle.

---

## 10. Game Flow, State & Persistence

### 10.1 Flow
`Boot → Menu → GovernorSelect → Game(wave loop) → Result → Menu/Retry`

### 10.2 Wave Loop
`BUILD_PHASE_START → countdown (or SKIP) → BUILD_PHASE_END → spawn → combat → WAVE-001 completion → ECO-001`

### 10.3 Save/Resume
- Autosave to IndexedDB (fallback localStorage) at the start of every build phase and on `visibilitychange: hidden`.
- Save schema versioned (`saveVersion`), migration function per version. Contains: difficulty, governor, rng seed and state, wave index, gold, lumber, lives, towers (id, cell, tier, `totalInvested`, priority), hero state, cooldowns, settings.
- Mid-combat resume is **not** required in v1: resume restores to the start of the current wave's build phase `[PROPOSED]`.
- Corrupt/unknown save → discard gracefully, show a toast, never crash.

---

## 11. Code Architecture

### 11.1 Files
```
src/
  config/        theme.ts  difficulty.ts  damage.ts  balance.ts  layout.ts
  core/          rng.ts  economy.ts(pure funcs)  grid.ts  save.ts      ← no Phaser imports
  data/          enemies.ts  towers.ts  governors.ts  raceOverrides.ts  waves.ts
  systems/       WaveManager.ts  EconomyManager.ts  InterestSystem.ts  LumberManager.ts
                 AuraSystem.ts  RandomEvents.ts  BuildSystem.ts  QualityManager.ts
  render/        TerrainBaker.ts  AtlasLoader.ts  EntityRenderer.ts  FxPool.ts  Grading.ts
  scenes/        BootScene.ts  MenuScene.ts  GovernorSelect.ts  GameScene.ts  ResultScene.ts
  ui/            LayoutManager.ts  components/*  LumberHUD.ts  WaveTransition.ts  SkillBar.ts
  i18n/          ru.json  en.json  index.ts
tools/assets/    validate.ts  pack.ts  procedural.ts  generate.md
assets-src/      manifest.yaml  prompts/  icons/  masters/
tests/           unit/  visual/
```
**Rule:** `src/core` and `src/data` MUST NOT import Phaser. Scenes and `ui` MUST NOT contain game-rule math (call `core`).

### 11.2 Refactors
- `GameScene.ts` (931 → ~450): extract `WaveTransition`, `SkillBar`, tutorial.
- `WaveManager.ts`: replace the event-based remaining counter with WAVE-001 tracking.
- `DamageCalculator.ts`: coefficient from `config/damage.ts`.
- `EconomyManager.ts`: `lumber`, `addLumber()`, `spendLumber()` (never negative; returns boolean).
- `enemies.ts` / `towers.ts`: schema from §3.4 / §7.1.

### 11.3 EventBus
```ts
LUMBER_CHANGED        // LumberManager → HUD
INTEREST_AWARDED      // InterestSystem → HUD
WAVE_BONUS_AWARDED    // InterestSystem → HUD
BUILD_PHASE_START     // WaveManager → EconomyManager (100% sell)
BUILD_PHASE_END       // WaveManager → EconomyManager (70% sell)
GOVERNOR_SELECTED     // GovernorSelect → GameScene
RANDOM_EVENT_START    // RandomEvents → HUD banner
QUALITY_CHANGED       // QualityManager → renderers/FX
LAYOUT_CHANGED        // LayoutManager → UI
```
Typed event map (`EventMap` interface), so payloads are checked at compile time.

---

## 12. Implementation Roadmap (task cards)

Statuses are `[UNKNOWN-AUDIT]` until M0-00 is done. Each card is one PR. "AC" means acceptance criteria and all must be verifiable.

### M0 — Audit & Foundation
| Card | Task | AC |
|---|---|---|
| M0-00 | Audit → `docs/AUDIT.md` | Every rule ID mapped with file refs |
| M0-01 | `verify`, `assets:validate`, Jest, lint scripts | `npm run verify` green on a clean clone |
| M0-02 | `config/theme.ts`, lint rule against raw hex | No hex literals outside theme |
| M0-03 | `core/rng.ts`, replace gameplay `Math.random` | grep finds none in gameplay code |
| M0-04 | `QualityManager` and tiers (§2.4) | Forced tier switches features live; unit-tested decision logic |

### M1 — Mobile Shell *(unlocks "mobile-ready" claim, UI-022)*
| Card | Task | AC |
|---|---|---|
| M1-01 | `LayoutManager` portrait/landscape, safe areas, FIT scaling | Board is 720×720 logical in both layouts on 390×844, 360×800, 820×1180, 1280×720, 1920×1080 viewports |
| M1-02 | Component library (§8.3) | Storybook-like debug scene shows all states |
| M1-03 | Dock, TowerCards, BottomSheet, SkillButtons | All hit-areas ≥ dp(48) (automated check via component bounds) |
| M1-04 | Placement flow (§8.5) with reticle offset and magnetic snap | Playwright touch test places a tower on 21 dp tiles with ≥ 95% accuracy |
| M1-05 | Pinch/pan zoom, double-tap zoom | Zoom clamped; the board never leaves the viewport |
| M1-06 | Settings overlay, reduce-motion, text scale, one-handed | Persisted; applies live |
| M1-07 | PWA (manifest, service worker, offline), pause on background | Lighthouse PWA pass; airplane-mode launch works |

### M2 — Visual Baseline
| Card | Task | AC |
|---|---|---|
| M2-01 | Asset toolchain: `pack.ts`, `validate.ts`, manifest | Produces atlases @1x/@2x; validator fails on bad fixtures |
| M2-02 | Terrain set (§5.4) plus `TerrainBaker` | Deterministic bake: same seed → byte-identical PNG snapshot; symmetry test on mirrored quadrants |
| M2-03 | Towers: layered sprites, recoil, tier pips, selection ring | All 19 towers have FINAL or CONCEPT sprites; vector fallback works when the atlas is missing |
| M2-04 | Enemies and bosses: sprites plus procedural motion plus status glyphs | UI-003 contrast pass; boss ring and bar present |
| M2-05 | FX: particles, shadows, glows, death bursts, smooth HP bars | Particle cap respected per tier; PERF-002/003 pass |
| M2-06 | UI atlas (icons, 9-slice) and fonts | No system-font fallback visible; glyph coverage test passes |

### M3 — Economy & Lumber (verify existing, complete the rest)
| Card | Task | AC |
|---|---|---|
| M3-01 | `core/economy.ts` pure functions plus all §3.2 test vectors | All vectors pass |
| M3-02 | `InterestSystem`, ECO-001 order | Integration test: order of events recorded matches |
| M3-03 | `LumberManager`, `lumberReward`, 5th-wave grant, HUD | Lumber never negative; spend rejected if insufficient |
| M3-04 | Floating `+N` texts (interest/bonus) | Pooled; no allocation in update |

### M4 — Mechanics
| Card | Task | AC |
|---|---|---|
| M4-01 | `canDetectInvisible`, phantom (wave 13+) | Non-detectors never target; detected state visible |
| M4-02 | `slow_t2`/Ice Bastion, AoE slow | Slow stacking rule documented and tested (strongest slow wins; durations refresh) |
| M4-03 | Nether Drake and Mountain Giant (minions) | WAVE-001 respects `pendingMinions` |
| M4-04 | `AuraSystem` 1 Hz plus ring visuals | Buff expires 1.5 s after leaving radius |
| M4-05 | `RandomEvents` (insane only) | Seeded: same seed → same events |

### M5 — Governors
| Card | Task | AC |
|---|---|---|
| M5-01 | `governors.ts` (+ `legacyId` mapping) | Old saves load; pool changes per governor |
| M5-02 | `GovernorSelect` scene (swipe cards) | Selection flows into the build menu and hero skills |
| M5-03 | Per-governor hero skills Q/W | Cooldown, telegraph, and VFX per skill; modal blocks casting |
| M5-04 | BAL-001 check | Automated sim: each governor has a detector pre-wave 13 |

### M6 — Polish
| Card | Task | AC |
|---|---|---|
| M6-01 | Day/night grading, bloom (tier-based) | Visible in `high`; matches the §4.4 table |
| M6-02 | Wave and boss banners | Slide in/out per spec; reduce-motion → fade |
| M6-03 | Audio and haptics (§9) | Mute/unlock/background behavior verified on iOS and Android |
| M6-04 | Dynamic soundtrack | Parameters track the wave and leaks per §9 |

### M7 — QA & Release
Jest coverage ≥ 90% for `core/` and `systems/Economy*|Wave*|Interest*|Lumber*|DamageCalculator`; Playwright touch E2E; visual regression; device matrix (§13); perf run against PERF budgets; store/PWA metadata; credits screen.

---

## 13. Quality Assurance

### 13.1 Unit
All §3 formulas, `isBuildable` symmetry, autotile mask, deterministic variant picker, WAVE-001 counter, sell-rate switching, save migrations, i18n coverage.

### 13.2 Simulation (headless)
`tools/sim.ts` runs a full 20-wave game with scripted build orders per governor/difficulty using the seeded RNG. Asserts: no negative gold/lumber, wave completes in finite time, BAL-001, identical outcome for identical seed.

### 13.3 Visual Regression
Playwright + deterministic scene (fixed seed, fixed time) captures at: menu, governor select, build phase, mid-combat, boss, game over, in portrait 390×844 and landscape 1280×720, @2x. Pixel-diff tolerance 0.5%. Updating a snapshot requires a PR note explaining why.

### 13.4 Device/Viewport Matrix
iPhone SE (375×667) · iPhone 14 (390×844) · Pixel 7 (412×915) · small Android (360×800) · iPad (820×1180) · Desktop 1280×720 & 1920×1080. Check: safe areas, hit-areas, text legibility, FPS, memory.

### 13.5 Mobile Acceptance Checklist (gates "mobile-ready")
- [ ] Playable end-to-end (20 waves) one-handed on a 360×800 viewport
- [ ] All tap targets ≥ 48 dp, no accidental placements in 50-placement test
- [ ] No horizontal scroll or browser pull-to-refresh interference (`overscroll-behavior: none`, `touch-action: none` on the canvas)
- [ ] Backgrounding pauses; resume restores the wave
- [ ] PERF-001..008 met on a mid-tier device
- [ ] Offline launch works
- [ ] Reduce-motion and text-scale verified

---

## 14. Decision Log & Open Questions

| ID | Status | Decision / Question |
|---|---|---|
| D-001 | Decided | Difficulty names are `normal/hard/insane`. Burbenog's Hard/Expert is research only. |
| D-002 | Decided | Lumber from kills is data-driven by `EnemyDef.lumberReward` (replaces the ambiguous "+1 per golem/nether_drake, +2 per boss"). Values in §3.3. |
| D-003 | PROPOSED | The `nether_drake` Russian name "Нефритовый Дракон" ("Jade") contradicts its violet color `0x2E1A52`. Proposed rename to "Дракон Бездны". Confirm. |
| D-004 | PROPOSED | Amber Mages have no early detector, so phantoms (wave 13+) would be unbeatable without T3 Lumber. Proposed: Hexer gets `canDetectInvisible` (range ×0.6 for detection). Alternatives: Mana Conduit detects, or Alchemist. Enforced by BAL-001. |
| D-005 | Decided | The old roadmap had two "P4" phases. Replaced by M0–M7 above. |
| D-006 | Decided | Wave completion order is ECO-001 (bonus → interest → lumber → build phase). If existing code differs, open a bug. |
| D-007 | PROPOSED | Nether Drake `aoe_pulse` stays cosmetic (towers have no HP). |
| D-008 | PROPOSED | Undo-sell toast (§8.5). |
| D-009 | PROPOSED | Mid-combat resume not supported in v1 (§10.3). |
| D-010 | Decided | Hybrid rendering (§5.1). The previous "SVG-as-texture only" decision is superseded: SVG is retained for UI icons only. |
| D-011 | Open | Starting gold, starting lives (assumed 20 from the old UI sketch), countdown seconds: confirm values in `balance.ts`. |
| D-012 | Open | Does Ice Bastion (`slow_t2`) belong to a governor (Hexer T2?) or a neutral pool? |
| D-013 | Open | Early wave-start ("SKIP") gold bonus: not in v1 unless confirmed. |

---

## 15. Legal & Credits

- **LEG-001** No WarCraft/Blizzard art, names, maps, music, or characters. CI scans manifest, prompts, filenames, and i18n for banned terms.
- AI-generated art: record the generator, date, seed, and prompt per asset in `assets-src/PROVENANCE.md`. Ship only assets whose license permits commercial use.
- Fonts: Manrope and Playfair Display (SIL OFL). Include license files.
- Credits screen text:
```
SvetloTD — original game design and code
Art: original, generated and procedural (see provenance), Baltic amber palette
Fonts: Manrope, Playfair Display (OFL)
Inspired by the economy of Burbenog TD and Element TD (no assets used)
Kenney (kenney.nl), CC0 — design reference only
```

---

## Appendix A — Research Summary: Burbenog TD (reference only, non-normative)

- **Governors:** 12–15 races, 120 towers total, 4-player co-op, 40 waves. Each governor grants a distinct element set. Builders cost Lumber (earned every 5th wave). Heroes catch leaks and use abilities; training costs Lumber.
- **Economy:** Element-TD-style interest (2% of unspent gold every 15 s in the original; SvetloTD applies it per wave, §3.2). Lumber is the scarcity resource. Fixed per-creep bounty. Escalating wave bonus.
- **Sell rule:** full refund during build phase, partial during combat. It rewards repositioning between waves. SvetloTD keeps 100% / 70%.
- **Modes:** Blitz (more mobs), Shared Income, Endless Spawn. Auto HP increase (+5% per 1:30). SvetloTD only adopts random events (insane).
- **Takeaway for design:** scarcity of a second resource plus a refund window plus an interest-vs-spend tension = the strategic core. Do not dilute it with extra currencies.

## Appendix B — Prior Prototype Notes (superseded, kept for history)
- 18×18 grid, 40 px tiles, 2×2 base, 2-wide mirrored roads: **kept** (§6).
- Three terrain PNGs and twelve 40 px concept sprites: now treated as `CONCEPT`; replaced via the manifest (§5.4).
- Vector 2D models are the `low`-tier/fallback renderer; they are not production sprite sheets or 3D meshes.
- Fixed 1280×720 canvas plus 560 px right panel: **replaced** by responsive layouts (§8.1); the landscape layout preserves the old panel structure.

*End of DESIGN.md*
- `assets-src/manifest.yaml` со всеми 40+ ассетами и готовыми промптами;
- `docs/AUDIT.md` как шаблон для первого прохода агента;
- набор стартовых Jest-тестов из таблицы тест-векторов.
