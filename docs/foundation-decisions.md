# Foundation decisions

- Decision date: 2026-08-23
- Status: current planning authority
- Scope: the focused foundation replacement and the first public `0.x` release

This document records the decisions made before implementation resumes. It is
the source of truth for release scope, operating constraints, and the
foundation roadmap. The product vision, ingestion research, and CLI technical
review remain valuable context and evidence; when they disagree with this
document, this document wins.

## Product and public position

Ballgame is an independent, unofficial terminal baseball scoreboard. It is not
affiliated with, sponsored by, or endorsed by Major League Baseball or any
club. The package and product name remain generic; the project must not use
MLB or club logos, uniform designs, color systems, proprietary editorial or
media content, or language that implies endorsement.

The first public release is a `0.x` npm package for technically capable baseball
fans. It should feel easy to try with `npx @macklinu/ballgame` or
`bunx @macklinu/ballgame`, but it is not a supported commercial service or a
replacement for MLB's own products.

Normal operation fetches current data directly from the user's machine. The
project does not host or proxy MLB data, persist a cross-launch cache, send
telemetry, or write default debug logs. `--debug` may emit redacted diagnostics
locally when the user asks for them.

This is a cautious engineering and product policy, not legal advice. Before a
public release, recheck the current [MLB legal notices](https://www.mlb.com/official-information/legal-notices)
and [terms of use](https://www.mlb.com/official-information/terms-of-use).

## First public release

The first shippable journey is:

1. Launch Ballgame on the user's local calendar date.
2. Scan every official MLB game for that date on a compact old-school bulb
   board.
3. Open any game for a truthful, useful detail view.

The board includes Spring Training, All-Star, regular-season, postseason,
doubleheader, and other official schedule entries. It labels unusual game types
and statuses rather than presenting them as ordinary games.

### Board and interaction

- The bulb board is the default visual identity. It uses a plain-text fallback
  automatically when the terminal is unsuitable and exposes `--plain`.
- The supported baseline is an 80x24 terminal; visual checks also cover
  120x40.
- Board rows show teams, score when legitimate, inning/state, scheduled time,
  and explicit status. Probable pitchers and lineup information belong in game
  details, not the compact board.
- The v0 board does **not** display runners, count, outs, current
  batter/pitcher, play-by-play, or pitch context.
- Keyboard operation is required. The footer and `?` help make available keys
  discoverable. Mouse selection is an optional enhancement, never a required
  path.
- `ballgame` is one interactive command. Its stable v0 flags are `--date`,
  `--plain`, `--help`, and `--version`; non-interactive subcommands are out of
  scope.

### Game details and historical truth

Every board row opens one adaptive detail shell:

- Scheduled games show matchup, time/status, probable pitchers, and a lineup
  or an explicit “lineups not announced” state.
- Score-bearing games show matchup/status, inning linescore, compact batting
  (`AB`, `R`, `H`, `RBI`, `BB`, `SO`, `HR`) and pitching
  (`IP`, `H`, `R`, `ER`, `BB`, `SO`, `HR`) tables when the provider supplies
  usable data.
- Postponed, cancelled, or otherwise non-score-bearing games show the exact
  available status, reason, and scheduling context without empty stat tables
  or invented scores.
- Ties, completed-early games, and forfeits use the same shell and show a box
  score only when the result and data are genuinely score-bearing.

The selected local schedule date is the source of truth. A postponed occurrence
remains postponed when its original date is viewed, even after a later makeup
game finishes. When known, the UI may offer the makeup game as a related link;
it must never replace the original occurrence. A malformed game is a
non-blocking unavailable row with diagnostics, not a reason to drop the whole
day.

### Freshness and failure policy

Poll the selected schedule and an open detail view every 15 seconds only while
a game is in warmup, in progress, delayed, or under review. Do not automatically
poll scheduled, terminal, postponed, cancelled, or suspended games.

After a successful response, retain the last successful data and timestamp
through a failed refresh. Initial load failures show a concise retrying state.
Retry timing and backoff are implementation details, but must preserve the
15-second active-game target without claiming a failed response is fresh.

## Architecture and repository policy

### Application boundary

Keep OpenTUI React and Effect, but replace the spike's seams. The UI and
application workflows receive normalized Ballgame domain records and typed
application errors; raw MLB JSON, endpoint names, HTTP errors, and numeric
`gamePk` values stay inside a private MLB adapter.

This is an **MLB-focused adapter boundary**, not a v0 commitment to arbitrary
provider interchangeability. Test fixtures are test inputs, not a selectable
runtime provider. Future-provider support can be evaluated once it has a real
product need.

Use the first-party OpenTUI keymap for scoped commands. Keep command resolution,
Atom state workflows, Effect services, and the renderer lifecycle distinct.
One application-owned refresh resource owns polling and cleanup; React must not
add a second interval.

### Data and fixtures

Public source and package contents must not include raw captured MLB payloads.
Replace the checked-in raw fixture corpus with synthetic or derived minimal
fixtures that assert the normalized contract. Local captures may help research
an adapter, but remain untracked and unpublished. The test suite still covers
scheduled, live, delayed/review, suspended/resumed, final/tie/completed-early/
forfeit, postponed/cancelled, malformed, unknown-status, and failed-refresh
states.

### Runtime, packaging, and tools

- Publish one npm CLI package; do not create a workspace or separately
  published core/provider packages in v0.
- Support Node.js **26.4.0 exactly** and Bun on macOS and Linux. Node launches
  use ESM and the OpenTUI FFI requirements. Revalidate the exact Node contract
  whenever the pinned OpenTUI version changes.
- The end-user package must run under ordinary `npx` and `bunx`; Nub is a
  contributor tool, not an end-user runtime dependency.
- Nub is the required contributor command convention. Add its official skill
  at project scope, pin it to an upstream revision, and use `nub`, `nub run`,
  `nubx`, and `nub install` for development, scripts, local CLIs, and installs.
  The foundation work must explicitly handle Nub's default denial of dependency
  lifecycle scripts before retaining or replacing the current `prepare` hook.
- Keep reproducible local source access by retaining the Effect and OpenTUI
  Git subtrees. Move the current `repos/effect` and `repos/opentui` subtrees to
  `vendor/effect` and `vendor/opentui` in a dedicated foundation change; do
  not remove them. Record each upstream URL, source commit, package version,
  and subtree update procedure.

### Releases and quality gates

Use Conventional Commits for change intent and Changesets as the sole
version/changelog authority. Releasable pull requests carry a Changeset;
changes that do not affect the package use an empty Changeset or an explicit
documented exception. A Changesets version pull request is merged before a
protected `vX.Y.Z` tag triggers final validation, npm trusted publishing with
provenance, and GitHub release creation.

A first public release requires all of the following:

- repeatable lint, format, typecheck, and fixture-backed test commands;
- Node 26.4.0 and Bun verification on macOS and Linux;
- a clean npm package/install/run check for both `npx` and `bunx`;
- visual smoke checks at 80x24 and 120x40 for scheduled, live, final, delayed,
  and unavailable-data states, plus the plain fallback;
- live-data failure recovery that retains good data and reports an honest
  last-successful timestamp; and
- current README, public-positioning, installation, and contributor guidance.

## Deferred deliberately

The following are not v0 foundation or first-release requirements:

- command-center ranking and its live-situation model;
- notifications, sound, and MLB.TV launching;
- base occupancy, count, current players, play-by-play, pitch charts, replay,
  timecodes, and JSON patch ingestion;
- persistent user settings/cache, remote error reporting, Windows support,
  standalone binaries, and non-interactive CLI commands; and
- a generic multi-provider product architecture.

## Foundation milestone order

1. **Repository and contributor foundation** — move tracked subtrees to
   `vendor/`, record provenance/update steps, adopt the pinned Nub skill and
   command convention, replace Bun-only development/runtime seams, and define
   the Node/Bun packaging path.
2. **Domain and ingestion foundation** — define normalized MLB-facing domain
   records and typed errors; implement tolerant per-game schedule mapping,
   test-only derived fixtures, live scheduling, and retained-success refresh
   behavior.
3. **Usable product slice** — build the scoped keymap/app shell, bulb board,
   plain fallback, adaptive game details, and visual/interaction tests.
4. **Release foundation** — add Changesets, tag-driven trusted publishing,
   the OS/runtime CI matrix, package verification, and public documentation.

Each milestone is independently reviewable. Command-center and other deferred
features begin only after the first slice meets its release gates.
