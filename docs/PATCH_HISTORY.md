# Immutable patch history

| Version | Unique patch filename | Base | Status | Scope |
| --- | --- | --- | --- | --- |
| v0.1.0 | `patch_svetlogorsk_td.py` (retired) | `3030743` | Applied, pushed `3c2983e` | Four-lane baseline, 40 wave definitions, assets, QA and deployment docs |
| v0.2.0 | `patch_svetlogorsk_td_v0_2_0_migration.py` | `3c2983e` | Failed before commit; retired (nested node_modules symlink) | No committed changes |
| v0.2.1 | `patch_svetlogorsk_td_v0_2_1_safe_migration.py` | `3c2983e` | Applied after successful local gates; verify Git push in log | Symlink-safe canonical migration, watchtower aura, lifecycle/economy P0 fixes and regression tests |
| v0.3.0 | `patch_svetlogorsk_td_v0_3_0_simulation_integrity.py` | `9b9ec78` | Applied after local gates passed (unit tests, typecheck, validate, build, bundle check); browser smoke not run; see git log for the push result | Frame-rate independent poison, Ice Bastion area slow, build-phase sell refund before wave 1, defeat precedence over wave clear, headless wave-lifecycle and data tests, shared test loader |

Never rename or reuse a historic patch file. New requests start at v0.3.0 or later.
