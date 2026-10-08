# Legacy consolidation, v0.2.1

Source: Git commit `3c2983e`, path `SvetloTD-live/`.
All legacy files remain in Git history; `git show 3c2983e:SvetloTD-live/<path>` restores any individual source. No extra nested app tree or duplicate package exists after this migration.

| Legacy component | Disposition | Reason |
| --- | --- | --- |
| `src/systems/AuraSystem.ts` | Reimplemented in canonical `src/systems/AuraSystem.ts` and connected to `GameScene` | Fixed stale aura when the last source is sold; deterministic non-stacking radius scan |
| `src/systems/MobileAdapter.ts` | Distilled into `src/systems/InputCapabilities.ts`, used by `GameScene` touch Q/W controls | Preserve detection concept, drop viewport-global listeners and fragile safe-area parsing |
| `src/__tests__/` (Jest) | Test scenarios moved into `tests/runtime.test.mjs` | One test runner (Node built-in), no duplicate Jest toolchain |
| `src/data/BezierPath.ts` | Removed | Straight four-lane route; smoothing would introduce off-road movement |
| `src/scenes/MetaScreen.ts` and `src/systems/MetaProgression.ts` | Deferred, not shipped | Persistent power bonuses affect fairness, balancing and save migrations |
| `src/systems/PlatformManager.ts`, `AdManager.ts`, `src/ui/AdPromptUI.ts` | Rejected pending verified platform SDK integration | Legacy mock granted rewards without a real completed ad; unsafe for live releases |
| `src/ui/MobileBottomSheet.ts` | Deferred until responsive UI redesign | Conflicted with fixed side panel, missing UX/accessibility verification |
| `src/systems/ParticleSystem.ts` | Removed | Canonical scene already owns lightweight VFX |
| Legacy `config/`, `data/`, `entities/`, `scenes/`, `ui/` and build config | Removed as redundant | Root code is the sole functional implementation |

This is a **source-tree migration and feature triage**, not an assertion that unreleased SDK, meta-progression or complete touch UI functionality has shipped.
