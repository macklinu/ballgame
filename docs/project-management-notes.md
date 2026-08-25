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
  When productive, it may branch from that PR as an explicit GitHub PR stack;
  it will never rely on uncommitted blocker work.
- Issues #17–#19 explicitly state that they are post-release/post-v0 work, so
  they are excluded from the v0 delivery queue despite being open.
- Release automation (#16) may be implemented and reviewed when its blockers
  clear, but no publishing action, release-tag creation, or merge to `main`
  will be performed by this coordination effort.

### 2026-08-25 — Preserve the #2/#3 documentation boundary

- Issue #2 owns only the physical subtree relocation and the path-reference
  updates it necessitates. It must not absorb upstream provenance or the
  refresh/update procedure, which are the explicit acceptance criteria of #3.

## Reusable Blockers and Watch Items

- The current source trees are under `repos/`; issue #2 must complete before
  documentation work in #3 can name the final `vendor/` paths.
- The official Nub guidance was not present in the initially discovered
  workspace skills. The #4 owner must locate authoritative guidance or report
  the gap before making toolchain-policy choices.
