# v0 Project Management Notes

This log records delivery blockers and decisions made while coordinating v0.
It is intentionally separate from product and architecture specifications; GitHub
issues remain the authoritative source for ticket scope and dependency blocking.

## Decisions

### 2026-08-25 — Foundation-first implementation order

- Started issue #2 (**Move sources to vendor**) and issue #4 (**Adopt Nub**),
  the only tickets with no declared blockers.
- Assigned each ticket to an isolated BB worktree with an atomic, PR-only
  delivery requirement. No agent may push or merge to `main`.
- Downstream work will normally wait for a blocker PR to be stable and tested.
  Sequential dependency chains use GitHub's native public-preview stacked-PR
  workflow through the official `gh stack` extension; no dependent work may
  rely on uncommitted blocker changes.
- Issues #17–#19 explicitly state that they are post-release/post-v0 work, so
  they are excluded from the v0 delivery queue despite being open.
- Release automation (#16) may be implemented and reviewed when its blockers
  clear, but no publishing action, release-tag creation, or merge to `main`
  will be performed by this coordination effort.

### 2026-08-25 — Preserve the #2/#3 documentation boundary

- Issue #2 owns only the physical subtree relocation and the path-reference
  updates it necessitates. It must not absorb upstream provenance or the
  refresh/update procedure, which are the explicit acceptance criteria of #3.

### 2026-08-25 — Adopt GitHub native stacked PRs

- Installed GitHub's official `gh-stack` extension (public preview) and its
  agent guidance after reviewing GitHub's stacked-PR quickstart.
- #4 is the planned bottom PR for a stack. #5 has started from #4's feature
  branch, must rebase onto its current parent revision, and must be linked with
  `gh stack link` after opening its PR.
- Use native stacks only for linear dependencies; multi-parent join points
  wait for their parent PRs to merge rather than duplicating parent commits.
- When several tickets independently depend on the same parent, each uses an
  atomic PR targeting that parent branch. They are not appended to one another
  merely to force a linear stack that would create a false dependency.

## Reusable Blockers and Watch Items

- The current source trees are under `repos/`; issue #2 must complete before
  documentation work in #3 can name the final `vendor/` paths.
- Issue #4 resolved the missing Nub guidance by adding the current official
  Nub project skill, pinned to its upstream source revision, in its PR.
- The `repos/` → `vendor/` relocation was a plain Git move, not a Git subtree
  import. `git subtree pull` and `git subtree merge` reject the new prefixes as
  never added; vendor refreshes need the snapshot-based procedure being
  documented in #3.
