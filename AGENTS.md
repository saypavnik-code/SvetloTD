# Agent contract (mandatory)

1. Read `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `ROADMAP.md` before edits.
2. Apply **KISS** (simplest correct behavior), **YAGNI** (no speculative systems),
   **DRY** (single authoritative rules/data), and **SOLID** where it improves change safety.
3. Keep edits surgical. Preserve existing working gameplay, names, UX, and save formats.
4. Write code, tests, identifiers, commit messages, and code comments in **English**.
5. One change at a time: plan -> inspect references -> patch -> test -> review diff.
6. Prefer pure, deterministic functions for combat, economy, routing and simulations.
7. Maintain invariant tests for symmetry, route completion, resource conservation,
   scene shutdown, object-pool release and 40-wave progression.
8. Never invent SDK contracts, platform limits, performance measurements, or test results.
9. Do not expose API keys or tokens to `src/` or `dist/`; treat client code as public.
10. Revisit docs and acceptance criteria in the same patch as behavioral changes.
11. Do not delete the `SvetloTD-live/` reference tree until migration is explicitly verified.
12. Ship only when static tests, TypeScript, production build, smoke gameplay and review pass.
13. Keep dist/, node_modules/, Repomix exports, and release archives out of Git.
    Untrack generated content with git rm --cached; never delete local originals blindly.

## Agent handoff

Every task: explain scope; show files changed; identify risks; report actual tests,
including failures and untested browser scenarios; update ROADMAP.md as needed.
No unrequested refactors, unverified fixes, or mass dependency upgrades.
