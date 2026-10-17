// ─────────────────────────────────────────────────────────────────────────────
// EventBus.ts — Typed global event emitter backed by Phaser's EventEmitter.
//
// WHY: Phaser scenes can't easily call each other's methods directly without
// tight coupling. EventBus lets systems talk to UI (and vice-versa) without
// knowing about each other. Keep event names in GameEvents to avoid typos.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';

// ── Event catalog ─────────────────────────────────────────────────────────────
// Add a new entry here whenever you add a new event. The value IS the string
// key used at runtime, so keep them unique and descriptive.
export const GameEvents = {
  // Economy
  GOLD_CHANGED:        'gold:changed',       // payload: number (new total of that seat), seat id
  LIVES_CHANGED:       'lives:changed',      // payload: number (new total, shared by all seats)
  SEAT_CHANGED:        'seat:changed',       // payload: seat id (the active seat of a shared screen)

  // Waves
  WAVE_STARTED:        'wave:started',       // payload: number (wave index)
  WAVE_COMPLETED:      'wave:completed',     // payload: wave number (1-based), WaveData
  ENEMY_SPAWNED:       'enemy:spawned',      // payload: Enemy instance
  ENEMY_KILLED:        'enemy:killed',       // payload: { enemy, goldReward }
  ENEMY_REACHED_END:   'enemy:reachedEnd',   // payload: Enemy instance

  // Towers
  TOWER_PLACED:        'tower:placed',       // payload: Tower instance
  TOWER_SELECTED:      'tower:selected',     // payload: Tower | null
  TOWER_UPGRADED:      'tower:upgraded',     // payload: Tower instance
  TOWER_SOLD:          'tower:sold',         // payload: { refund }
  TOWER_CEDED:         'tower:ceded',        // payload: { tower, from, to } (seats)
  TOWER_SHOT:          'tower:shot',         // payload: TowerId

  // Hero
  HERO_SKILL_Q:        'hero:skill_q',       // payload: x, y, radius, hitCount
  HERO_SKILL_W:        'hero:skill_w',       // payload: x, y, radius, buffCount

  // Economy — Phase 2
  LUMBER_CHANGED:      'lumber:changed',     // payload: number (new total of that seat), seat id
  INTEREST_AWARDED:    'interest:awarded',   // payload: number (gold amount)
  WAVE_BONUS_AWARDED:  'wavebonus:awarded',  // payload: number (gold amount)
  BUILD_PHASE_START:   'build:phase:start',  // no payload — enables 100% sell
  BUILD_PHASE_END:     'build:phase:end',    // no payload — reverts to 70% sell

  // Game state
  GAME_OVER:           'game:over',          // payload: { victory: boolean }
  GAME_PAUSED:         'game:paused',
  GAME_RESUMED:        'game:resumed',
  SCENE_READY:         'scene:ready',        // payload: scene key string
} as const;

// Derive a union type from the values so callers get autocomplete.
export type GameEventKey = (typeof GameEvents)[keyof typeof GameEvents];

// ─────────────────────────────────────────────────────────────────────────────
class EventBusClass extends Phaser.Events.EventEmitter {
  /**
   * Emit a typed game event.
   * @example EventBus.emit(GameEvents.GOLD_CHANGED, 250);
   */
  override emit(event: GameEventKey, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Raw subscription: it returns the bus, not an unsubscribe function. Components register through
   * `Subscriptions` (utils/Subscriptions.ts) and remove everything with one dispose(); only
   * Subscriptions itself and tests call this directly (guarded by tests/ownership.test.mjs).
   */
  override on(
    event: GameEventKey,
    fn: (...args: unknown[]) => void,
    context?: unknown,
  ): this {
    return super.on(event, fn, context);
  }

  override once(
    event: GameEventKey,
    fn: (...args: unknown[]) => void,
    context?: unknown,
  ): this {
    return super.once(event, fn, context);
  }

  override off(
    event: GameEventKey,
    fn?: (...args: unknown[]) => void,
    context?: unknown,
  ): this {
    return super.off(event, fn, context);
  }
}

// Singleton — import this object everywhere, never instantiate the class.
export const EventBus = new EventBusClass();
