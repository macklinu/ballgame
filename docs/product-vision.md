# Ballgame product vision

## Purpose

Ballgame is a personal terminal user interface for following MLB games through the public MLB Stats API. It must make one day of games easy to scan, make a selected game easy to inspect, and later make high-leverage live games easy to find.

The primary user is one technically capable baseball fan. This is not a multi-user service, a betting tool, or a replacement for the MLB web site.

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
  navigation. It includes every official MLB game returned for that date,
  including Spring Training and postseason games.
- **Schedule:** A live schedule refreshes every 15 seconds. Delayed,
  postponed, suspended, and cancelled games stay on the slate with MLB's exact
  status and without an invented score or box score.
- **Navigation:** Enter or mouse selection opens the selected game. Escape
  returns to the schedule; left and right arrows remain schedule-selection
  controls rather than switching games from the details screen.
- **Details:** The standard game view contains the matchup and status, an
  inning linescore, compact batting tables (`AB`, `R`, `H`, `RBI`, `BB`, `SO`,
  `HR`), and compact pitching tables (`IP`, `H`, `R`, `ER`, `BB`, `SO`, `HR`).
  This is a box score, not a first-release GameDay clone: play-by-play,
  current-batter/pitcher context, count, runners, and other live-situation
  features are deferred.
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

Ballgame will provide two distinct, toggleable top-level schedule views. The daily bulb board is the old-school view. The command-center ranking is the new-school view. They must not be combined into one screen or presented as sort modes within the same layout.

Both views use the selected date as their source of truth and open the same
selected-game detail view. `b` opens the daily bulb board and `c` opens the
command center. The footer must make both commands discoverable.

The main screen will become an old-school outfield scoreboard. It will always separate American League and National League games. Letters and digits should read as individual bulbs in a fixed terminal grid, rather than as generic application cards.

Each game needs an immediately readable state:

- Scheduled: teams and start time.
- Live: teams, scores, inning or other game state, and eventually base/out state.
- Final: teams, final score, and completed status.
- Delayed, postponed, suspended, or cancelled: explicit status that does not look like a live or final game.

The board must remain useful for past dates. Historical mode in the first release means browsing past schedules and final scores. It does not require full historical play-by-play reconstruction.

The first release includes every game returned by the MLB schedule, including Spring Training, All-Star, regular season, postseason, and doubleheader games. Exceptional game types must retain explicit labels so that they do not look like ordinary regular-season games.

### Bulb-board rendering

Bulb rendering is limited to the daily scoreboard and, optionally, the title of the selected-game view. All other game-detail content uses ordinary terminal letters and numbers. This includes the linescore, batting and pitching tables, play-by-play, status explanations, help text, error text, and settings.

Each bulb occupies one terminal cell. A lit bulb is one colored glyph; a dark bulb is dim or absent. The renderer needs a custom fixed glyph map because OpenTUI's bundled ASCII fonts are title fonts, not independently controllable bulb grids.

Use a 3×5 glyph as the default for team abbreviations, scores, inning, outs, and compact state markers. With one column between glyphs, a three-letter team abbreviation is 11 terminal columns. A compact matchup such as `BOS 3 @ NYY 4` consumes about 32 columns before status text. A 5×7 glyph is reserved for a scoreboard masthead or the selected-game title; it is too wide for every daily-game row.

At an 80-column terminal, show one compact board column and stack the AL and NL sections vertically. Do not attempt two detailed matchup columns. Wider terminals may add breathing room, but must not require wider glyphs or a second layout to preserve readability.

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

Do not define the domain or component input as three Boolean fields now. First inspect the current MLB live-feed shapes and identify the normalized baseball situation that serves both base occupancy and later play-by-play. The provider adapter must map the MLB response into that future provider-neutral model. The display then derives which base positions are lit. Unknown runner state must never appear as an empty diamond.

Visual checks must cover empty bases, each single occupied base, every two-base combination, bases loaded, and unavailable runner data.

The selected-game view may render its title with a 5×7 bulb glyph, for example a team matchup or game heading. Its body is ordinary text and tables so that box-score detail remains dense and readable.

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

The selected-game title may use the bulb renderer. The detail view body must not.

The bulb-board UI is the delivery priority. The first shippable release includes the board and this detail view. It excludes automatic live-game ranking and stream launching.

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
The ranking model and its independent view implementation may proceed in
parallel with bulb-board work, but they must not delay the bulb-board release.

### External MLB.TV action

A later key action will open the selected game on MLB.TV in the system browser. The feature must use the official MLB.TV game page or a supported game URL, and must not attempt to bypass authentication, region limits, or blackout rules.

Keep `t` for "today". Use lowercase `v` to open MLB.TV for the selected game.

## Pre-development gates

1. Upgrade the application to a pinned Effect v4 release candidate. This is required before active feature work resumes. The migration plan must identify the selected release candidate, its matching API documentation, and the replacement for each incompatible v3 API.
2. Upgrade OpenTUI to a pinned compatible release as part of the dependency modernization work. Record the selected version, breaking UI or input changes, and the visual smoke-test plan before feature work changes views.
3. Add Git subtrees for the selected upstream Effect and OpenTUI revisions at `vendor/effect` and `vendor/opentui`. Record each upstream repository URL, pinned commit, package version, and subtree update procedure. `@effect/atom-react` remains a separate framework-binding package in Effect v4; identify its upstream source during this task and add a local source tree if `vendor/effect` does not contain it. Agents must use these local source trees for version-specific library inspection.
4. Define and test the normalized domain models plus provider-neutral service contracts before adding new MLB-specific features.
5. Define the notification settings, alert threshold, and deduplication rule before starting an alert worker.
6. Assess the current keyboard listener before adding command-center controls.
   Replace it if necessary with context-aware commands and a testable command
   dispatcher; do not layer new global key conditions onto an unassessed
   listener.

## Release sequence

1. Restore reliable schedule data from the MLB API while retaining deterministic fixtures for tests.
2. Deliver the selectable daily bulb-board and a useful game detail view.
3. Support past-date schedule browsing with final scores.
4. Add the separate `c` command-center view with the documented live-game
   ranking model and display rules.
5. Add the external MLB.TV action after its supported URL rule and keybinding are agreed.

## Data freshness and failure behavior

The runtime application must use the MLB API for normal operation. Schedule fixtures remain deterministic test inputs; they must not be the normal data source.

For a live game, preserve the last successful schedule or game-feed state after
a request failure and retry automatically every 15 seconds. Display the time
of the last successful response. Do not erase the bulb board or command-center
ranking, replace the established data with an error, or present a failed retry
as a newer update. Initial loading, where no successful response exists, shows
a concise retrying error instead.

## Provider-neutral Effect architecture

The application domain must not depend on MLB field names, endpoints, or numeric `gamePk` values. It needs normalized domain models for a baseball schedule, game, team, game state, linescore, box score, and play. Provider-specific payload schemas are private adapter types and must map into these models at the provider boundary.

`GameRef` must identify a game as `{ provider, id }`, where `provider` identifies MLB or a future provider and `id` is that provider's opaque identifier. Do not expose MLB `gamePk` as the general application game identifier. The same rule applies to provider-specific team identifiers.

The application layer will depend on provider-neutral service contracts:

- `ScheduleService`: obtain a normalized schedule for a date.
- `GameService`: obtain normalized game details for a `GameRef`.
- `BaseballDataProvider`: an optional composition boundary that owns both services when an implementation needs one provider-wide client, rate limit, or configuration.

Each method must return domain values and typed domain errors, not raw HTTP, JSON parsing, or provider error types. `GameNotFound`, unavailable provider, malformed provider response, and rate limiting are useful domain-level failure categories. The exact error taxonomy remains a design task.

An MLB adapter layer will implement these contracts from MLB HTTP DTOs. A fixture layer will implement the same contracts from deterministic fixtures. The application runtime selects one complete provider layer; consumers do not branch on provider type. This makes an MLB-to-Women's-Pro-Baseball-League or MLB-to-Korean-baseball replacement an adapter and composition change, not a UI rewrite.

```text
OpenTUI views and application workflows
        │
        ├── ScheduleService ──┐
        └── GameService ──────┤ provider-neutral domain contracts
                               │
              ┌────────────────┴────────────────┐
              │                                 │
         Mlb.layer                         Fixture.layer
              │                                 │
       MLB HTTP DTOs                     fixture DTOs
```

After the required upgrade to the pinned Effect v4 release candidate, define service tags with `Context.Service`, implement real adapters with `Layer.effect`, and use `Effect.fn` for public operations. Use `Layer.succeed` or `Layer.sync` for fakes that need no acquisition. The installed repository version is currently Effect `3.19.14`; the available Effect skill targets v4. Do not mix v4 migration work into a feature ticket without the version-specific migration plan.

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

## Decisions made in this session

| Topic                       | Decision                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| First usable release        | Daily board plus game details. Defer live ranking and stream launch.                                                                     |
| Historical mode             | Browse past schedules and final scores.                                                                                                  |
| Ranking approach            | Transparent, deterministic rules explained in help without per-row factor labels.                                                        |
| Stream destination          | MLB.TV page for the selected game, subject to a supported URL rule.                                                                      |
| Board grouping              | Fixed American League and National League sections.                                                                                      |
| Detail contract             | Standard box score: status, linescore, compact batting, and compact pitching tables. Defer GameDay-style situation and play-by-play.     |
| Display baseline            | Unicode and truecolor when available, with a plain-text fallback.                                                                        |
| In-section order            | Live games first; then scheduled start time.                                                                                             |
| Initial ranking model       | 16-point on-field drama plus 6-point regular-season standings stakes; later inning, then `GameRef`, break ties.                          |
| Video key                   | Keep `t` for today; use lowercase `v` for MLB.TV.                                                                                        |
| Live failure behavior       | Preserve existing data after a failed refresh, display its last successful-update timestamp, and retry every 15 seconds.                 |
| Confirmed date scope        | Open on the user's local date while retaining previous, next, today, and explicit date navigation.                                       |
| Confirmed MLB coverage      | Include every official MLB game returned for the selected date, including Spring Training and postseason.                                |
| Confirmed box score         | Standard inning linescore plus compact batting and pitching tables; defer GameDay-style situation and play-by-play features.             |
| Confirmed pregame           | Show lineup or roster data when available; otherwise show teams, time, probable pitchers, and “lineups not announced.”                   |
| Confirmed detail navigation | Escape returns to the schedule; changing games remains a schedule-screen action.                                                         |
| Confirmed refresh display   | Refresh live schedule and open live details every 15 seconds; display the last successful-update timestamp and preserve it on failure.   |
| Initial-load failure        | Show a concise error and retry automatically when no successful data is available yet.                                                   |
| Data architecture           | Provider-neutral domain contracts; complete MLB and fixture adapter layers.                                                              |
| Notifications               | Configurable off, in-app, macOS, or both; sound is user controlled.                                                                      |
| Effect preparation          | Upgrade to a pinned Effect v4 release candidate before feature work uses v4 patterns.                                                    |
| Local library sources       | Add pinned upstream Git subtrees at `vendor/effect` and `vendor/opentui` before development resumes.                                     |
| Bulb typography             | Use custom 3×5 bulbs on the daily board; use 5×7 only for a masthead or selected-game title; keep all detail bodies as ordinary text.    |
| Base occupancy              | Display a compact first/second/third-base diamond without home plate; leave its normalized data model open until MLB live-feed research. |
| Schedule views              | Keep the daily bulb board and command center separate; `b` opens the board and `c` opens the command center.                             |
| Command-center update       | While a selected date has an in-progress game, refresh and recompute its excitement ranking every 15 seconds.                            |
| Command-center rows         | Rank every live game; show baseball data and a base diamond, with responsive records but no inline rank arithmetic.                      |
| Command-center interaction  | Up/Down or `j`/`k` select; Enter opens details; `?` opens model help; no live game shows an empty state.                                 |
| Command-center data gaps    | Omit unavailable situation fields, log diagnostics internally, and never portray unknown bases as empty.                                 |
| Command architecture        | Assess the current listener and use context-aware, testable command dispatch before adding new controls.                                 |

## Open decisions for the next grilling round

1. What exact 3×5 glyph map, bulb colors, dark-bulb appearance, and plain-text fallback make the board readable before visual implementation starts?
2. What official MLB.TV URL or supported identifier mapping should `v` open for each scheduled or live game?
3. Which game-state changes can alert the user, what threshold starts an alert, and how long is the cooldown?
4. Where do user settings persist, and does macOS notification permission belong to application setup or first use?
5. What exact normalized error types and provider-selection configuration does the application need?
6. What normalized current-situation model should provider adapters expose after MLB live-feed research, including runner identity, base occupancy, count, and play context?
