# Immutable patch history

| Version | Unique patch filename | Base | Status | Scope |
| --- | --- | --- | --- | --- |
| v0.1.0 | `patch_svetlogorsk_td.py` (retired) | `3030743` | Applied, pushed `3c2983e` | Four-lane baseline, 40 wave definitions, assets, QA and deployment docs |
| v0.2.0 | `patch_svetlogorsk_td_v0_2_0_migration.py` | `3c2983e` | Failed before commit; retired (nested node_modules symlink) | No committed changes |
| v0.2.1 | `patch_svetlogorsk_td_v0_2_1_safe_migration.py` | `3c2983e` | Applied after successful local gates; verify Git push in log | Symlink-safe canonical migration, watchtower aura, lifecycle/economy P0 fixes and regression tests |
| v0.3.0 | `patch_svetlogorsk_td_v0_3_0_simulation_integrity.py` | `9b9ec78` | Applied after local gates passed (unit tests, typecheck, validate, build, bundle check); browser smoke not run; see git log for the push result | Frame-rate independent poison, Ice Bastion area slow, build-phase sell refund before wave 1, defeat precedence over wave clear, headless wave-lifecycle and data tests, shared test loader |
| v0.4.0 | `patch_svetlogorsk_td_v0_4_0_combat_integrity.py` | `16b6a93` | Applied after local gates passed (unit tests, typecheck, validate, build, bundle check); browser smoke not run; see git log for the push result | Frame-rate independent tower fire rate, stale-target shot loss, target-priority change and upgrade retention, truthful sell-button label, tower/projectile/hero/build/economy regression tests |
| v0.5.0 | `patch_svetlogorsk_td_v0_5_0_documentation_handoff.py` | `363c5d3` | Applied after local gates passed (unit tests, typecheck, validate, build, bundle check); browser smoke not run; see git log for the push result | Documentation only: agent contract (test harness, review checklist, resume procedure), patch policy operating notes, DESIGN/code sell-rule reconciliation, QA smoke log, roadmap state and next sprint, migration closure status, package version |

Never rename or reuse a historic patch file. New requests start at v0.3.0 or later.
