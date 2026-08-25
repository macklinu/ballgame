# Ballgame product vision

> **Planning status (2026-08-23):**
> [Foundation decisions](foundation-decisions.md) is the current authority for
> first-release scope, architecture boundaries, tooling, fixture publication,
> and release process. This document preserves the product exploration that led
> to those decisions. Where the documents disagree, the foundation decisions
> win.

## Purpose

Ballgame is an independent terminal user interface for following MLB games
through public MLB endpoints. It must make one day of games easy to scan, make
a selected game easy to inspect, and later make high-leverage live games easy
to find.

The primary user is a technically capable baseball fan. This is not a multi-user
service, a betting tool, a replacement for the MLB web site, or an official MLB
product.

## Current application facts

- The application is a Bun, React, OpenTUI, and Effect terminal application.
- The schedule screen shows games for one selected date as selectable grid items.
- Current keys are `p` previous day, `t` today, `n` next day, `g` go to date, left/right arrows change the selected game, Enter opens it, and Escape returns from a nested view.
- `GameDetails` currently fetches the MLB live-game feed but only renders the game identifier. It is a placeholder, not a usable game view.
- `ScheduleService.layerFromFileSystem` is currently selected at startup. It reads date fixtures from `src/fixtures/stats-api/schedule`; it does not use the live schedule HTTP layer.
- The production-shaped schedule request and the live game-feed request target `statsapi.mlb.com`. The schedule request asks for team, game, and linescore data.
- The current schedule refresh logic uses a 15-second interval only while a returned schedule includes a live game.

## Product direction

### Confirmed live-score and box-score contract

The first usable journey is: open Ballgame, scan the local day's MLB slate and
live scores, then open one game for a standard box score. All normal runtime
data for that journey comes from the public MLB Stats API; fixtures remain
deterministic test inputs only.

- **Date and coverage:** The application opens on the user's local calendar
  date and retains the existing previous-day, next-day, today, and go-to-date
  navigation. It includes every official MLB game returned for that official
  schedule date, including Spring Training and postseason games; displayed
  start times use the user's local timezone without changing board membership.
  A valid date with no official games retains normal navigation and says “No
  games today.”
- **Schedule:** A live schedule refreshes every 15 seconds. Delayed,
  postponed, suspended, and cancelled games stay on the slate with MLB's exact
  status and without an invented score or box score.
- **Navigation:** Enter or mouse selection opens the selected game. Escape
  returns to the schedule; left and right arrows remain schedule-selection
  controls rather than switching games from the details screen.
- **Details:** The standard game view contains the matchup and status, an
  inning linescore, compact batting tables (`AB`, `R`, `H`, `RBI`, `BB`, `SO`,
  `HR`), and compact pitching tables (`IP`, `H`, `R`, `ER`, `BB`, `SO`, `HR`).
  Show every truthful section available and give unavailable sections an
  explicit empty state. This is a box score, not a first-release GameDay
  clone: play-by-play, current-batter/pitcher context, count, runners, and
  other live-situation features are deferred.
- **Pregame:** When available, show MLB's pregame lineup or roster data. When
  confirmed lineups are unavailable, show the teams, scheduled start time,
  probable pitchers, and a clear “lineups not announced” state.
- **Freshness and recovery:** A live, open detail view also refreshes every 15
  seconds and stops once the game is final. Schedule and detail views display
  a “last updated” timestamp representing the most recent successful MLB data
  response. A failed refresh preserves the existing data and timestamp; it
  does not replace the view with an error or claim a newer update. If initial
  loading fails and there is no data to retain, show a concise error and retry
  automatically.

### Daily scoreboard board

The first release has one schedule view: the daily bulb board. After v0,
Ballgame may provide a distinct command-center ranking as the new-school view.
It must not be combined with the board or presented as a sort mode within the
same layout.

When command center exists, both views use the selected date as their source of
truth and open the same selected-game detail view. `b` opens the daily bulb
board and `c` opens the command center. The footer must make both commands
discoverable.

The main screen will become an old-school outfield scoreboard. It lists every
official game in scheduled-start order, earliest to latest. Letters and digits
should read as individual bulbs in a fixed terminal grid, rather than as generic
application cards.

Each game needs an immediately readable state:

- Scheduled: teams and start time.
- Live: teams, scores, inning or other game state, and eventually base/out state.
- Final: teams, final score, and completed status.
- Delayed, postponed, suspended, or cancelled: explicit status that does not look like a live or final game.

The board must remain useful for past dates. Historical mode in the first release means browsing past schedules and final scores. It does not require full historical play-by-play reconstruction.

The first release includes every game returned by the MLB schedule, including Spring Training, All-Star, regular season, postseason, and doubleheader games. Exceptional game types must retain explicit labels so that they do not look like ordinary regular-season games.

### Bulb-board rendering

Bulb rendering is limited to the daily scoreboard. The first-release selected-game title and all other game-detail content use ordinary terminal letters and numbers. This includes the linescore, batting and pitching tables, play-by-play, status explanations, help text, error text, and settings.

Each bulb occupies one terminal cell. A lit bulb is one colored glyph; a dark bulb is dim or absent. The renderer needs a custom fixed glyph map because OpenTUI's bundled ASCII fonts are title fonts, not independently controllable bulb grids.

Use a 3×5 glyph as the default for team abbreviations, scores, inning, outs, and compact state markers. With one column between glyphs, a three-letter team abbreviation is 11 terminal columns. A compact matchup such as `BOS 3 @ NYY 4` consumes about 32 columns before status text. A 5×7 glyph is reserved for a later scoreboard masthead enhancement; it is too wide for every daily-game row.

At an 80-column terminal, show one compact board column. Do not attempt two
detailed matchup columns. Wider terminals may add breathing room, but must not
require wider glyphs or a second layout to preserve readability.

Use ordinary compact text for secondary game information, including scheduled
time, detailed delay reason, the last successful-update timestamp, and long
status labels. Do not turn every word into bulbs.

The bulb grid must preserve these rules:

- Team abbreviations, scores, inning, and final/live state remain readable at a glance.
- Lit and dark bulbs have a contrast difference that survives a low-color terminal.
- Color, brightness, and animation supplement text or shape; they must not be the only state signal.
- Flashing is limited to a meaningful live-state transition and must not continuously redraw the board.
- Unknown or unavailable data uses a defined glyph or normal-text fallback; it must not leave a misleading score or inning.
- The plain-text fallback preserves the same selected game, game order, and status meanings.

#### Base occupancy indicator

For a live game, the board may show a compact diamond-shaped indicator with the second-base position at the top, third base at the left, and first base at the right. Each displayed base uses a lit or dark glyph. Do not render home plate: a batter is not a runner on home, and the batter belongs in ordinary text in the game-detail view.

Start with a small, fixed-size composition of ordinary OpenTUI text and box nodes. A custom renderable is not required unless profiling or a later interaction requirement proves that ordinary composition is insufficient.

Do not define the domain or component input as three Boolean fields now. If a
future release adds base occupancy, inspect the current MLB live-feed shapes
and identify a normalized situation model first. The display then derives which
base positions are lit. Unknown runner state must never appear as an empty
diamond.

Visual checks must cover empty bases, each single occupied base, every two-base combination, bases loaded, and unavailable runner data.

The v0 selected-game title and body use ordinary compact text and tables so
that box-score detail remains dense and readable. A later release may add a
5×7 bulb title.

Before shipping the bulb board, run visual smoke checks with scheduled, live, final, delay, and unavailable-data fixtures. Check at 80×24 and 120×40 terminal sizes, then check the plain-text fallback. The board must not clip team abbreviations, scores, or the selected-game indicator.

### Game details

Opening the selected game must show the standard box score defined in the
confirmed live-score and box-score contract: matchup and status, inning
linescore, batting summary table, and pitching summary table. A live
first-release view does not include current batter/pitcher, count, runners,
or play-by-play; those are GameDay-like features deferred beyond this scope.
For completed games, the view preserves the final result and the same box-score
context. Before first pitch, it follows the pregame contract for lineups,
probable pitchers, and unavailable lineups.

The first-release selected-game title is ordinary compact text. A future release may use a bulb title; the detail body must remain ordinary text.

The bulb-board UI is the delivery priority. The first shippable release includes
the board, this detail view, and the selected-game MLB.TV browser action. It
excludes automatic live-game ranking.

### Command-center live-game ranking

The command-center is a separate new-school view that ranks every in-progress
game from most to least exciting to watch. It is not a bulb-board layout and
uses ordinary, compact text for baseball data rather than bulb typography.

Each row shows rank, matchup, live score, inning, outs, and a compact
first/second/third-base diamond with lit and unlit symbols. Season `W–L`
records appear beside the teams when the terminal width permits; hide records
before clipping live-game state. The rows do not show the ranking total or
per-factor arithmetic. `?` opens a compact help overlay with the fixed model
and point tables instead. If the live feed lacks runner or out data, omit only
that field from the row, retain the game in the ranking, and record diagnostics
internally. Never depict unknown bases as empty.

The command center shows every live game in ranked order. Up/Down and `j`/`k`
move the selected row; Enter opens the selected game detail. If the selected
date has no live games, retain the command-center view and show a clear empty
state rather than redirecting to the board.

Refresh the selected date's live schedule and recompute this ranking every 15
seconds while it includes an in-progress game. Do not add periodic refreshes
for past dates or schedules with no live games. Preserve the last successful
schedule after a refresh failure, retain its last successful-update timestamp,
and continue the 15-second retry cycle.

The v1 model is deterministic, pure, and uses a small fixed set of point
values. It is a fixed late-game-drama profile, not a user setting. Its
independent pure functions must have table-driven unit tests covering point
boundaries, standings snapshots, unavailable situation data, and deterministic
tie-breaks.

```text
rank = on-field drama (maximum 16) + standings stakes (maximum 6)
```

| On-field factor | Points                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Score margin    | Tied: 6; 1 run: 5; 2 runs: 3; 3 runs: 1; 4+ runs: 0                                      |
| Inning          | 1–3: 0; 4–6: 1; 7th: 2; 8th: 3; 9th: 4; 10th+: 5                                         |
| Runners         | Empty: 0; any runner: 1; runner in scoring position: 2; multiple RISP or bases loaded: 3 |
| Outs            | 0: 2; 1: 1; 2: 0                                                                         |

Standings stakes apply only to regular-season games. For each league, classify
the three division leaders, three current wild-card holders, and the next
three teams in the official wild-card order. A team contributes: division
leader 3; wild-card holder 2; first, second, or third chaser 1, 0.5, or 0.25;
all others 0. The two teams' contributions are added, so a matchup can receive
at most six standings points. Spring Training and postseason games rank only
on the on-field model. For equal rank totals, rank the later inning first, then
use `GameRef` as the deterministic final tie-breaker.

The future backlog may add selectable scoring-opportunity and close-score
profiles, in that order. Do not add configuration or those profiles to v1.
The ranking model and its independent view are deliberately deferred until
after the bulb-board-and-details release.

### Initial-release MLB.TV action

A key action opens the selected game on its official MLB.TV page in the system
browser. Ballgame simply delegates to the browser; it neither implements nor
participates in MLB authentication, entitlements, or availability rules. Verify
the official URL mapping from `gamePk` before implementation.

Keep `t` for "today". Use lowercase `v` to open MLB.TV for the selected game.

## Foundation gates

The original pre-development gates were recorded before the current dependency
pins and subtrees existed. The live foundation gates—including the Node/Bun
runtime boundary, retained `vendor/` subtrees, normalized MLB adapter boundary,
Nub contributor contract, derived fixtures, and release checks—now live in
[Foundation decisions](foundation-decisions.md). Do not revive the original
Effect-v3 migration or generic-provider gates from this section.

## Release sequence

1. Restore reliable schedule data from the MLB API while retaining deterministic fixtures for tests.
2. Deliver the selectable daily bulb-board, a useful game detail view, and the
   selected-game MLB.TV browser action.
3. Support past-date schedule browsing with final scores.
4. Add the separate `c` command-center view with the documented live-game
   ranking model and display rules.

## Data freshness and failure behavior

The runtime application must use the MLB API for normal operation. Schedule fixtures remain deterministic test inputs; they must not be the normal data source.

For a live game, preserve the last successful schedule or game-feed state after
a request failure and retry automatically every 15 seconds. Display the time
of the last successful response. Do not erase the bulb board or command-center
ranking, replace the established data with an error, or present a failed retry
as a newer update. Initial loading, where no successful response exists, shows
a concise retrying error instead.

## Normalized MLB adapter architecture

The application domain must not depend on MLB field names, endpoints, or numeric
`gamePk` values. It needs normalized domain models for a baseball schedule,
game, team, game state, linescore, and box score. Provider-specific payload
schemas are private adapter types and must map into these models at the MLB
adapter boundary.

Use an application-owned opaque game reference; do not expose MLB `gamePk` as
the general application identifier. The same rule applies to provider-specific
team identifiers.

The application layer will depend on normalized MLB-facing service contracts:

- `ScheduleService`: obtain a normalized schedule for a date.
- `GameService`: obtain normalized game details for a `GameRef`.
- `MlbClient`: an optional composition boundary for shared MLB HTTP concerns.

Each method must return domain values and typed application errors, not raw HTTP,
JSON parsing, or provider error types. Test fixtures support these contracts but
are not a selectable runtime provider. A generic multi-provider layer is
deferred until a real product requirement justifies it.

```text
OpenTUI views and application workflows
        │
        ├── ScheduleService ──┐
        └── GameService ──────┤ normalized Ballgame domain contracts
                               │
                          Mlb.layer
                               │
                         MLB HTTP DTOs
```

The repository already pins matching Effect v4 release-candidate packages. Before
foundation implementation, validate the exact pinned APIs in the retained local
sources. Define service tags with `Context.Service`, implement real adapters
with `Layer.effect`, and use `Effect.fn` for public operations. Use
`Layer.succeed` or `Layer.sync` for fakes that need no acquisition.

Effect v4 moves core atom and reactivity primitives into `effect/unstable/reactivity`, but React hooks remain in the separate `@effect/atom-react` package. If the application continues to use atoms for the OpenTUI React binding, pin `effect` and `@effect/atom-react` to the same v4 release-candidate version. The `unstable` import path means that upgrade releases can change this API; inspect the local pinned source before each upgrade.

New domain record schemas should use `Schema.Struct` and a same-name TypeScript interface. Decode unknown provider data at the adapter boundary, then map it explicitly to normalized domain values. Use `Data.TaggedEnum` for internal game-state decisions and `Schema.TaggedErrorClass` for typed boundary errors when the v4 API is available.

## Notification architecture

Notifications are a separate product capability. They must consume normalized game state and the same transparent excitement rules as the future ranking view. A provider adapter must never decide that a game is exciting or call a terminal or operating-system notification API.

The future design has three responsibilities:

- `ExcitementPolicy`: a pure, deterministic domain function that scores and explains a game state.
- `AlertPolicy`: decides whether a score transition merits an alert. It must include deduplication and a cooldown rule so a polling loop does not repeat the same alert.
- `NotificationService`: delivers a normalized notification request to one or more configured targets.

The notification targets are independent layers:

- In-app target: places an alert in an OpenTUI notification area and may play an application sound.
- macOS target: sends an operating-system notification when the user enables it.
- Composite target: deliberately sends to both targets.

The user setting must support `off`, `in-app`, `macOS`, and `both`, plus sound enabled or disabled. Configuration storage, alert threshold, cooldown duration, quiet hours, and the operating-system integration method are not yet decided.

Long-running polling or notification work must be scoped in its owning layer. It must not block layer construction or start duplicate workers when a view re-renders.

## Design and engineering principles

- The selected date is the source of truth for all schedule views.
- Data freshness matters only for in-progress games. Refresh behavior must not make history or final games noisy.
- A game state must have one display meaning. Do not make postponed, final, and live games visually ambiguous.
- Ranking must be stable for unchanged game data and explainable through its
  help overlay without displacing baseball data from the ranked rows.
- Keyboard actions must be discoverable in the terminal and must not silently replace an existing action.
- Network failures must preserve the last known valid schedule and its last
  successful-update timestamp; diagnostics capture individual failed refreshes.
- The app should prefer documented MLB identifiers and endpoints over inferred URLs or scraped web pages.
- The bulb-board may use Unicode and truecolor. It must define a readable plain-text fallback for terminals without either capability.

## Historical vision snapshot

This table preserves the earlier product exploration. Rows marked deferred or
updated are superseded by [Foundation decisions](foundation-decisions.md).

| Topic                       | Decision                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| First usable release        | Daily board, game details, and selected-game MLB.TV browser action. Defer live ranking.                                                 |
| Historical mode             | Browse past schedules and final scores.                                                                                                 |
| Ranking approach            | Deferred until after the first public release.                                                                                          |
| Stream destination          | Open the selected game's official MLB.TV page in the system browser.                                                                    |
| Board grouping              | One chronological board of all official games, earliest scheduled start first.                                                          |
| Detail contract             | Standard box score: status, linescore, compact batting, and compact pitching tables. Defer GameDay-style situation and play-by-play.    |
| Display baseline            | Unicode and truecolor when available, with a plain-text fallback.                                                                       |
| Board order                 | Official scheduled start time, earliest to latest; status changes do not move a row.                                                    |
| Initial ranking model       | Deferred until command-center work has a post-v0 product mandate.                                                                       |
| Video key                   | Lowercase `v` opens the selected game's official MLB.TV page.                                                                           |
| Live failure behavior       | Preserve existing data after a failed refresh, display its last successful-update timestamp, and follow the active-game polling policy. |
| Confirmed date scope        | Open on the user's local date while retaining previous, next, today, and explicit date navigation.                                      |
| Confirmed MLB coverage      | Include every official MLB game returned for the selected date, including Spring Training and postseason.                               |
| Confirmed box score         | Standard inning linescore plus compact batting and pitching tables; defer GameDay-style situation and play-by-play features.            |
| Confirmed pregame           | Show lineup or roster data when available; otherwise show teams, time, probable pitchers, and “lineups not announced.”                  |
| Confirmed detail navigation | Escape returns to the schedule; changing games remains a schedule-screen action.                                                        |
| Confirmed refresh display   | Refresh warmup, in-progress, delayed, and review states every 15 seconds; preserve the last successful-update timestamp on failure.     |
| Initial-load failure        | Show a concise error and retry automatically when no successful data is available yet.                                                  |
| Data architecture           | Normalized MLB adapter boundary; derived test fixtures, not a selectable runtime provider.                                              |
| Notifications               | Deferred until after the first public release.                                                                                          |
| Effect preparation          | Validate current matching Effect v4 pins against the retained local source before foundation work.                                      |
| Local library sources       | Retain the current Effect/OpenTUI subtrees at the documented `vendor/` paths.                                                           |
| Bulb typography             | Use custom 3×5 bulbs on the daily board; keep the v0 detail title and body as ordinary text; a 5×7 masthead is a later enhancement.     |
| Base occupancy              | Deferred until after the first public release.                                                                                          |
| Schedule views              | The daily bulb board is the only v0 schedule view; command center is deferred.                                                          |
| Command-center update       | Deferred until command-center work begins after v0.                                                                                     |
| Command-center rows         | Deferred until command-center work begins after v0.                                                                                     |
| Command-center interaction  | Deferred until command-center work begins after v0.                                                                                     |
| Command-center data gaps    | Deferred until command-center work begins after v0.                                                                                     |
| Command architecture        | Assess the current listener and use context-aware, testable command dispatch before adding new controls.                                |

## Deferred decisions

The following are deliberately deferred and must not block the foundation or
first public release: exact bulb glyph/color choices beyond the visual fallback
contract, notifications and their settings, persistent user settings,
live-situation modeling, and any provider-selection configuration. MLB.TV URL
mapping is an initial-release implementation verification task, not deferred
scope.
The MLB adapter's typed error taxonomy is an implementation design task within
the normalized boundary, not a reason to reopen the product decisions above.
