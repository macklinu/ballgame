# v0 Project Management Notes

Concise record of delivery decisions and repeatable blockers. GitHub issues remain the source of ticket scope and dependencies.

## Decisions

- v0 excludes post-release issues #17–#19. Release automation may be implemented, but this effort does not publish, tag, or merge releases.
- Use atomic PRs. Stack only a true linear dependency; independent children share a parent rather than creating a false chain.
- #2 owns vendor relocation; #3 owns provenance and the refresh guide.
- Adopting Nub includes its generated lockfile and direct Nub-based validation; do not retain a previous package-manager lockfile without an explicit compatibility reason.
- Nub runs the app and tests on project-pinned Node 26.4.0 for OpenTUI FFI; `DEV=true` remains off because its React DevTools backend is Node-incompatible.
- The MLB adapter keeps provider DTOs, numeric identifiers, endpoints, and transport errors private; application code receives normalized records and tagged errors.
- Merge preference is squash, then rebase, then merge commit. Native Git subtree imports require a merge commit because their two-parent history is functional metadata.

## Reusable blockers

- Before opening a tooling-migration PR, verify the installer, source-of-truth instructions, lockfile, lifecycle/build policy, and validation command.
- GitHub stack rebases can drop native subtree merge commits. Rebuild the topology if necessary; rebase an ordinary child with `git rebase --onto <new-root> <old-root>` and verify its owned-file diff.
- GitHub Actions may fail before checkout because of runner network errors. Inspect the failed step and rerun an infrastructure-only failure before changing project code.
