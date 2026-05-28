// ─────────────────────────────────────────────────────────────────────────────
// InterestSystem.ts — Gold interest + wave completion bonus.
//
// Listens for WAVE_COMPLETED. On each event:
//   1. Calculates interest = floor(currentGold * interestRate)
//   2. Calculates waveBonus = waveBonusBase + waveNumber * waveBonusScale
//      (overridden by WaveData.bonusGold if that value is higher — keeps
//       hand-crafted boss wave rewards intact)
//   3. Adds both sums to EconomyManager via addGold()
//   4. Emits INTEREST_AWARDED and WAVE_BONUS_AWARDED for HUD floating text
//
// All rates come from GameConfig.difficulty — zero coupling to scenes.
// ─────────────────────────────────────────────────────────────────────────────
import { EventBus, GameEvents } from '../utils/EventBus';
import { GameConfig } from '../config/difficulty';
export class InterestSystem {
    constructor(economy, lumber) {
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
        Object.defineProperty(this, "_onWaveCompleted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (...args) => {
                const waveNumber = args[0]; // 1-based
                const waveData = args[1];
                const cfg = GameConfig.difficulty;
                // ── 1. Interest on unspent gold ───────────────────────────────────────────
                const interestGold = Math.floor(this._economy.gold * cfg.interestRate);
                if (interestGold > 0) {
                    this._economy.addGold(interestGold);
                    EventBus.emit(GameEvents.INTEREST_AWARDED, interestGold);
                }
                // ── 2. Wave completion bonus ───────────────────────────────────────────────
                const formulaBonus = cfg.waveBonusBase + waveNumber * cfg.waveBonusScale;
                // Use wave-specific bonusGold if it's higher (preserves boss wave rewards)
                const waveBonus = waveData
                    ? Math.max(formulaBonus, waveData.bonusGold)
                    : formulaBonus;
                this._economy.addGold(waveBonus);
                EventBus.emit(GameEvents.WAVE_BONUS_AWARDED, waveBonus);
                // ── 3. Lumber every 5 waves ────────────────────────────────────────────────
                if (waveNumber % 5 === 0) {
                    this._lumber.add(1);
                }
            }
        });
        this._economy = economy;
        this._lumber = lumber;
        EventBus.on(GameEvents.WAVE_COMPLETED, this._onWaveCompleted, this);
    }
    destroy() {
        EventBus.off(GameEvents.WAVE_COMPLETED, this._onWaveCompleted, this);
    }
}
