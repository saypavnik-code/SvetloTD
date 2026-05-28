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
    GOLD_CHANGED: 'gold:changed', // payload: number (new total)
    LIVES_CHANGED: 'lives:changed', // payload: number (new total)
    // Waves
    WAVE_STARTED: 'wave:started', // payload: number (wave index)
    WAVE_COMPLETED: 'wave:completed', // payload: number (wave index)
    ENEMY_SPAWNED: 'enemy:spawned', // payload: Enemy instance
    ENEMY_KILLED: 'enemy:killed', // payload: { enemy, goldReward }
    ENEMY_REACHED_END: 'enemy:reachedEnd', // payload: Enemy instance
    // Towers
    TOWER_PLACED: 'tower:placed', // payload: Tower instance
    TOWER_SELECTED: 'tower:selected', // payload: Tower | null
    TOWER_UPGRADED: 'tower:upgraded', // payload: Tower instance
    TOWER_SOLD: 'tower:sold', // payload: { tower, refund }
    TOWER_SHOT: 'tower:shot', // payload: TowerId
    // Hero
    HERO_SKILL_Q: 'hero:skill_q', // payload: x, y, radius, hitCount
    HERO_SKILL_W: 'hero:skill_w', // payload: x, y, radius, buffCount
    // Economy — Phase 2
    LUMBER_CHANGED: 'lumber:changed', // payload: number (new total)
    INTEREST_AWARDED: 'interest:awarded', // payload: number (gold amount)
    WAVE_BONUS_AWARDED: 'wavebonus:awarded', // payload: number (gold amount)
    BUILD_PHASE_START: 'build:phase:start', // no payload — enables 100% sell
    BUILD_PHASE_END: 'build:phase:end', // no payload — reverts to 70% sell
    // Game state
    GAME_OVER: 'game:over', // payload: { victory: boolean }
    GAME_PAUSED: 'game:paused',
    GAME_RESUMED: 'game:resumed',
    SCENE_READY: 'scene:ready', // payload: scene key string
};
// ─────────────────────────────────────────────────────────────────────────────
class EventBusClass extends Phaser.Events.EventEmitter {
    /**
     * Emit a typed game event.
     * @example EventBus.emit(GameEvents.GOLD_CHANGED, 250);
     */
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    /**
     * Subscribe with automatic cleanup via the returned unsubscribe fn.
     * @example const off = EventBus.on(GameEvents.GOLD_CHANGED, handler);
     *          // later: off();
     */
    on(event, fn, context) {
        return super.on(event, fn, context);
    }
    once(event, fn, context) {
        return super.once(event, fn, context);
    }
    off(event, fn, context) {
        return super.off(event, fn, context);
    }
}
// Singleton — import this object everywhere, never instantiate the class.
export const EventBus = new EventBusClass();
