# Updating retained upstream sources

Effect and OpenTUI are tracked as native Git subtrees in `vendor/`. They are part of this repository; do not initialise, clone, or add a Git worktree inside either directory.

| Source  | Path             | Upstream URL                               | Pinned upstream commit                                                                             | Package version                              |
| ------- | ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Effect  | `vendor/effect`  | `https://github.com/Effect-TS/effect.git`  | [`1144032c`](https://github.com/Effect-TS/effect/commit/1144032cedda7b5eacc1ebf980d06957c7a59ddf)  | `effect` `4.0.0-rc.111`                      |
| OpenTUI | `vendor/opentui` | `https://github.com/anomalyco/opentui.git` | [`eaf1d41e`](https://github.com/anomalyco/opentui/commit/eaf1d41e9252505232b1cbeae3ab05c15a55243d) | `@opentui/core` and `@opentui/react` `0.5.6` |

## Refresh one source

Start from a clean branch and replace the variables with the source being updated and a full, reviewed upstream commit SHA.

```sh
vendor=vendor/effect
upstream=https://github.com/Effect-TS/effect.git
source_commit=REPLACE_WITH_FULL_UPSTREAM_SHA

test -z "$(git status --porcelain)"
test ! -e "$vendor/.git"
git fetch --quiet "$upstream" "$source_commit"
test "$(git rev-parse FETCH_HEAD)" = "$source_commit"

before=$(git rev-parse HEAD)
git subtree pull --prefix="$vendor" --squash "$upstream" "$source_commit"

# The update may affect only the chosen vendor tree.
test ! -e "$vendor/.git"
git diff --check "$before..HEAD"
git diff --quiet "$before..HEAD" -- . ":(exclude)$vendor/**"
git diff --stat "$before..HEAD" -- "$vendor"
```

For OpenTUI, use `vendor=vendor/opentui` and its URL from the table. Review the vendor diff, update the table's commit and version, and update the root package pin and `nub.lock` when the dependency version changes.
