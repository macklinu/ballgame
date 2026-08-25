# @macklinu/ballgame

> An independent terminal baseball scoreboard.

Ballgame is an experimental, open-source terminal UI for following MLB games.
It is not affiliated with, sponsored by, or endorsed by Major League Baseball
or any club. The package is not published yet; its first public `0.x` release
is planned for `npx @macklinu/ballgame` and `bunx @macklinu/ballgame`.

## Project direction

- [Foundation decisions](docs/foundation-decisions.md) — current scope,
  architecture, contributor, and release authority.
- [Product vision](docs/product-vision.md) — product context and longer-term
  ideas.
- [MLB Stats API ingestion research](docs/mlb-stats-api-ingestion-research.md)
  — provider evidence and adapter constraints.
- [CLI architecture technical review](docs/cli-architecture-technical-review.md)
  — OpenTUI/React/Effect implementation guidance.

## Contributing

This repository uses [Nub](https://nubjs.com/docs) as its contributor command
convention. Install Nub using the
[official instructions](https://nubjs.com/docs#install), then use the commands
below from the repository root. The project-scoped
[`nub` skill](.agents/skills/nub/SKILL.md) contains the maintained operational
guidance.

| Task                       | Command                                        |
| -------------------------- | ---------------------------------------------- |
| Reproduce a clean checkout | `nub install --frozen-lockfile`                |
| Update an existing install | `nub install`                                  |
| Run the development UI     | `nub run dev`                                  |
| Lint                       | `nub run lint`                                 |
| Type-check                 | `nub run typecheck`                            |
| Test                       | `nub run test`                                 |
| Check formatting           | `nubx oxfmt --disable-nested-config --check .` |
| Run an installed local CLI | `nubx <tool> [args...]`                        |

Nub reads and writes the checked-in text `bun.lock` in place; do not create a
second lockfile or use another package manager for routine contributor work.
For dependency changes, use `nub add`, `nub remove`, or `nub update`, then
commit the resulting `package.json` and `bun.lock` changes.

### Lifecycle scripts

Nub denies dependency lifecycle scripts by default. This project explicitly
allows the build scripts for `esbuild` (development tooling) and
`msgpackr-extract` (transitively required by `effect`) through
`package.json#allowBuilds`. The recorded allowlist makes a normal
`nub install --frozen-lockfile` deterministic rather than relying on Nub's
default-trust list.

If Nub reports another ignored dependency build, inspect why it is needed and,
only when it is justified, run `nub approve-builds <package>`. That command
records the approval in `package.json` and runs the build; commit the manifest
change with the dependency update. Do not use `--ignore-scripts` for ordinary
setup: the intentional root `prepare` hook installs the existing Husky hook
and applies the Effect TypeScript/Oxlint patch after dependencies are linked.

The current development script remains Bun-backed because the application uses
`@effect/platform-bun`; invoke it through `nub run dev` so the contributor
entry point stays consistent while preserving the application's existing
runtime behavior.
