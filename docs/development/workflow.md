# Daily GitHub Workflow

Repository: https://github.com/lmy666888/vibelearning

1. Inspect status and preserve unrelated work. Fetch latest remote refs; never force push.
2. Start from main and update with `git pull --ff-only origin main` only when its worktree is clean. Reconcile divergent history explicitly; never overwrite remote commits.
3. Create the requested feature branch (`feat/day3-ai-tutor` for Day 3); develop there, never directly on main.
4. Implement, run relevant Vitest/Pytest/Chromium/strict TypeScript/build checks, and record actual results.
5. Update README/architecture and the dated daily log BEFORE the final commit. Record existing commit IDs; the enclosing commit can be found with `git log -- docs/development/<date>-dayN.md` to avoid impossible self-referential hashes.
6. Review `git diff`, staged contents and whitespace. Check ignored environments/credentials and scan tracked changes for secrets without printing matched values. Preserve lockfiles.
7. Commit the reviewed work. Fetch once more, inspect remote state, then push the feature branch normally.
8. Create a PR targeting main using `gh pr create --base main --head <feature> --body-file <reviewed-description>`. Verify the returned URL. Do not automatically merge or delete branches.
9. Report commit IDs, actual push results, tests, limitations and confirmed PR URL.

## Authentication

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Complete authorization in your own browser/terminal. Never paste tokens into chats or source files.

## Initial baseline

`79cbb32b960b6ffa291bf4f9986d1bba949b5b63` records the existing Day 1/2 source as a new stable baseline. It is not an invented historical Day 1 or Day 2 commit. The remote was empty when inspected. The first push attempt failed due to missing GitHub authentication; remote success must be verified after login.
