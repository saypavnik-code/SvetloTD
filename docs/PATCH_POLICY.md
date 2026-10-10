# One-time Python patch policy

## Naming and uniqueness

Use the next unused SemVer and **never repeat a file name**:
`patch_svetlogorsk_td_vMAJOR_MINOR_PATCH_scope.py`
For example: `patch_svetlogorsk_td_v0_3_0_coop_foundation.py`.
Register every version, file name, base commit and result in `docs/PATCH_HISTORY.md`.
The previous v0.1.0 patch was `patch_svetlogorsk_td.py`; it must never be run again.

## Transactional contract

1. Check branch, remote, `HEAD`, a clean worktree (other pending `patch_svetlogorsk_td_v*.py` files in the
   repository root are ignored and never staged), the previous version row in `docs/PATCH_HISTORY.md` and exact
   source anchors (each must occur exactly once) before writing. The actual base commit is written into the new
   history row.
2. Snapshot changed files in memory; restore them if any patch or verification step fails.
3. Avoid mass refactors, wildcard deletions, hidden network changes and guessed APIs.
4. Stage only explicitly changed paths (no top-level `git add -A`); use `git diff --cached --check`.
5. Run game/data validation, automated unit tests, TypeScript typecheck and production bundle.
6. Commit and push only on explicit request, after all automated tests pass.
7. Self-delete the unique one-time patch only on success. Keep history in Git, not copied app trees.
8. If remote push fails after commit, do **not** rerun: inspect commit and push manually.
9. Never traverse legacy/vendor `node_modules` with `rglob` or follow dependency symlinks during cleanup.
10. Move trees atomically to private rollback storage; restore before commit if validation fails.

A new patch version is required for any post-release fix, including a fix to a patch script.

## Operating notes (v0.3.0 and later)

- Run `--dry-run` first: it checks the repository, the history and every anchor and writes nothing.
- Apply pending patches in ascending version order, one at a time. Each patch commits (and, with `--push`,
  pushes) before the next one starts; each refuses to run unless the previous version row exists.
- Patch files may sit outside the repository or in its root. With `--commit --push --self-delete` a patch
  deletes only itself, and only after commit and push succeeded.
- Every patch runs unit tests, typecheck, game/data validation, the production build and the bundle budget,
  and states in its history row that the browser smoke was not run.
- A failed run restores every touched file, creates no commit and saves a report to
  `.git/svetlo-patch/<version>_report.txt`. If only the push failed, do not rerun: push the commit manually.
- Existing line endings (LF or CRLF) are preserved per file; new files follow the repository style.
- Each patch also sets the `package.json` version to its own version.
