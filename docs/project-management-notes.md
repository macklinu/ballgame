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

### 2026-08-25 — Tooling-migration handoff rule

- After the #4 Nub PR required review corrections, foundation/tooling tickets
  now require a short implementation checklist before an agent opens a PR. It
  must name the authoritative installation method, source-of-truth documents,
  package-manager metadata, lockfile ownership, lifecycle/build policy, and
  reproducible validation command.
- “Adopt” a package manager is interpreted as migrating the project ownership
  contract, including its generated lockfile, unless the issue explicitly
  preserves a compatibility lockfile. This decision was made by the project
  coordinator without a separate user directive, based on the #4 correction.

### 2026-08-25 — Baseline CI runtime contract

- The pre-release CI slice of #16 was implemented as issue #26: one validation
  job runs on pull requests and pushes to `main`, uses the project-pinned Nub,
  then installs, formats, lints, typechecks, and tests.
- No separate Node version was invented because the repository has no existing
  Node runtime source of truth. The workflow pins Nub and follows its official
  setup action; adding Node version policy remains a deliberate future change.
  This decision was made by the implementation agent without a separate user
  directive and is recorded in PR #27.

### 2026-08-25 — Normalized-contract adapter boundary

- Issue #5 keeps MLB DTOs, numeric provider identifiers, endpoint details, and
  HTTP failures inside the MLB adapter. That adapter translates them to
  Ballgame-owned game/team references, normalized schedule occurrences, and
  tagged application errors before UI code receives them.
- The adapter assigns opaque references from an in-memory mapping for the
  lifetime of the application runtime, preserving a game identity across its
  postponed and makeup schedule occurrences without exposing the provider ID.
  This implementation decision was made without a separate user directive and
  is covered by PR #28 tests.

### 2026-08-25 — CI rollout ordering

- PRs opened before #27 cannot run its new workflow until the workflow is on
  `main`. After #27 merges, already-open implementation PRs must rebase or
  otherwise receive a fresh validation run before being cleared for merge.
- This applies first to #28. The rule was chosen by the project coordinator to
  ensure the newly required CI actually validates the code it gates.

### 2026-08-25 — Protect native subtree imports from stack rebases

- GitHub's **Rebase stacks** action rewrote #22 to a branch identical to
  `main`: its merge-only native subtree-import commits were dropped, leaving a
  zero-file PR. A conventional rebase has the same risk because the local
  subtree anchors are already reachable from the repository history.
- Do not use GitHub stack rebases or ordinary rebases on a PR whose delivery
  depends on native `git subtree` merge topology. If its base advances,
  reconstruct each import with the intended first parent, local subtree anchor
  as second parent, and the required `git-subtree-*` trailers; then verify the
  vendor trees, `git subtree split`, refresh behavior, and CI.
- Recovery rebuilt #22 on the CI-enabled `main` tip and replayed #24 with
  `git rebase --onto` so that its documentation-only commit did not replay the
  prior vendor history. This safeguard and repair approach were recorded by
  the project coordinator after the user authorized the recovery.

### 2026-08-25 — Merge native subtree imports without flattening them

- GitHub's stacked-PR merge API initially rejected #22 because this repository
  had merge commits disabled. Squash and rebase merging would flatten the
  recovered native subtree imports and make their topology unusable.
- The user explicitly authorized enabling merge commits. #22 was then merged
  through GitHub's asynchronous stacked-PR API with `merge_method: merge`,
  preserving its native subtree commits on `main`.
- Prefer GitHub rebase merges for ordinary linear PRs. Use a merge commit only
  when a PR intentionally requires two-parent history, such as a native Git
  subtree import; call out that exception during review before merging.

## Reusable Blockers and Watch Items

- The current source trees are under `repos/`; issue #2 must complete before
  documentation work in #3 can name the final `vendor/` paths.
- Issue #4 resolved the missing Nub guidance by adding the current official
  Nub project skill, pinned to its upstream source revision, in its PR.
- #4 exposed an execution/review failure rather than a hard technical blocker:
  the first implementation copied a skill instead of using its official
  installer, duplicated operational guidance, and retained `bun.lock` after
  pinning Nub. The review cycle corrected those items, ending with a generated
  `nub.lock`. Future tool migrations must verify the full ownership contract
  before review rather than treating a legacy lockfile as compatible by
  default.
- A plain `repos/` → `vendor/` move does not retain recognized subtree prefixes:
  `git subtree pull` and `git subtree merge` reject the new paths as never
  added. At the user's direction, #22 was rebuilt with real vendor subtree
  imports. #24 now documents the supported native refresh procedure; the
  temporary archive-based workaround must not merge.
- Vendor provenance has two distinct immutable layers: Ballgame-local subtree
  anchors and the upstream source snapshots named by those anchors' own
  `git-subtree-split` trailers. Documentation must not link a local anchor to
  the upstream repository; #24 records both layers explicitly.
- #28 has completed its local and GitHub Actions validation after #27 merged;
  it is awaiting product review.
- Native subtree root PRs need manual topology-aware recovery after a base
  change. Once the root is stable, documentation-only children may rebase with
  `git rebase --onto <new-root> <old-root>`; verify their diff remains limited
  to their owned files before relinking the stack.
