# MLB Stats API ingestion research

- Researched: 2026-08-23
- Status: exploratory evidence and proposed ingestion plan; not a provider contract.
  [Foundation decisions](foundation-decisions.md) is the current product and
  architecture authority.
- Scope: schedule, game overview, and live-game-state ingestion. Play-by-play is
  deliberately a later concern.

## Executive decision

Build the MLB integration as a tolerant, provider-private adapter that maps raw
schedule and GUMBO/live-feed payloads into normalized Ballgame domain models.
Do **not** model MLB game status as the current `Preview | Live | Final` union.

The public status catalogue currently exposes 210 entries. It contains
postponements, cancellations, suspensions, delays, replay/challenge states,
forfeits, ties, completed-early games, and a few internally inconsistent
entries. A future provider status must result in an explicit `Unknown` domain
state, not a decoder failure or a misleading final score.

For the first usable journey, use a hydrated schedule for the daily board and
the full live feed for a selected game's overview. Poll complete snapshots
first. Treat timecode and JSON-patch/diff ingestion as a later optimization.

## Evidence and source quality

| Source                                                                                                        | What it is useful for                                                      | Caveat                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [MLB game-status catalogue](https://statsapi.mlb.com/api/v1/gameStatus)                                       | Current status taxonomy and reasons; snapshot this for tests.              | Dynamic provider configuration, not a versioned schema contract.                                 |
| [MLB schedule endpoint](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-23&hydrate=linescore) | Current schedule and hydrated linescore response shape.                    | The displayed date is only an example and will change over time.                                 |
| [MLB-StatsAPI endpoint wiki](https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints)                        | Broad endpoint and parameter discovery.                                    | Community-maintained.                                                                            |
| [GUMBO documentation PDF](https://github.com/mcbarlowe/mlb/blob/main/GUMBOPDF3-29.pdf)                        | Historical explanation of `metaData`, `gameData`, and `liveData`.          | Internal document created in March 2019; individual schemas and transport assumptions are stale. |
| [Old Swagger mirror](https://controlc.com/fb1e5965)                                                           | Historical parameter names such as `timecode`, `diffPatch`, and `hydrate`. | Non-authoritative and obsolete; never use as sole implementation evidence.                       |

The GUMBO document's high-level model still matches the current full feed:

```text
feed/live
  metaData    provider snapshot timestamp and event markers
  gameData    identity, datetime, status, teams, venue, weather, roster metadata
  liveData    plays, linescore, boxscore, decisions, leaders
```

That structural continuity is useful; the historical document should not be
used to define required fields or enumerate statuses.

## What was probed

All requests below were public unauthenticated requests. Observations are a
snapshot from the research date, not a reliability promise.

### Schedule query shapes

The following variants returned valid data:

```text
/api/v1/schedule?sportId=1&date=YYYY-MM-DD
/api/v1/schedule?sportId=1&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
/api/v1/schedule?gamePk=823745
/api/v1/schedule?gamePks=823745,824799
/api/v1/schedule?sportId=1&teamId=144&date=YYYY-MM-DD
/api/v1/schedule?sportId=1&date=YYYY-MM-DD&hydrate=linescore
```

`gameTypes` and `gameType` both appeared accepted during the probe, but use a
single documented spelling only after a fixture-backed contract test is in
place. `fields` projection also worked, but it easily removes fields required
by a DTO; do not use it for the initial adapter.

The schedule board's current request asks for `team,game,linescore`. Basic
team data is already supplied in an ordinary schedule game. `linescore` is the
important hydration. Add additional hydrations only when a displayed feature
has a concrete need; `game(content(all))` produced a much larger editorial and
media payload than a board needs.

With `hydrate=linescore`, a live schedule game can contain:

- current inning, ordinal, half, state, count, and scheduled innings;
- inning-by-inning scores and aggregate runs/hits/errors/left on base;
- defense and offense participants;
- occupied bases represented by optional `first`, `second`, and `third`
  properties.

An omitted base property means that base is unoccupied only when a valid live
`offense`/situation object is present. A missing or skeletal linescore is
**unavailable situation data**, not proof of empty bases.

### Full-game and targeted endpoint shapes

For sampled in-progress game `823745`, the rough response sizes were:

| Endpoint                        | Approximate payload | Primary use                 |
| ------------------------------- | ------------------: | --------------------------- |
| `/api/v1/game/{id}/linescore`   |              2.8 KB | lightweight live situation  |
| `/api/v1/game/{id}/boxscore`    |              167 KB | batting and pitching tables |
| `/api/v1/game/{id}/playByPlay`  |              441 KB | future event timeline       |
| `/api/v1.1/game/{id}/feed/live` |              580 KB | coherent overview snapshot  |

The full feed is the preferred first detail request because it gives the
status, matchup, linescore, boxscore, and play context in one internally
consistent snapshot. `linescore` can become a lighter polling endpoint later
if request volume or rendering needs justify splitting it.

Two response behaviours require explicit validation:

- A cancelled game can return HTTP 200 for both linescore and boxscore, while
  having empty innings, no plays, and no actual score. HTTP success does not
  mean an official box score exists.
- `/api/v1.1/game/999999999/feed/live` returned HTTP 200 with `gamePk: 0` and
  minimal/empty data during probing. Require the response game ID to equal the
  requested ID and require usable game metadata before returning success.

### Timecode and diff exploration

`/feed/live/timestamps` returned timecodes, and a known `timecode` returned a
historical coherent snapshot. An invalid timecode silently returned current
data rather than an error. Only use provider-supplied timestamp values.

`diffPatch` had two response forms during the probes:

1. a complete snapshot marked with `logicalEvents: ["fullUpdate"]`; or
2. an outer array containing an object whose `diff` is an RFC-6902 operation
   array.

The patch can change plays, runners, linescore, and boxscore simultaneously.
This is a useful future replay/efficiency capability, but it needs an exact raw
snapshot store, RFC-6902 application, validation after every update, and a
full-snapshot fallback. It must not cross the provider-adapter boundary.

## Status taxonomy and mapping policy

The current `/gameStatus` catalogue contained 210 entries during this research.
Its broad groups were Preview (18), Live (102), Final (88), and Other (2).
The apparent `Final` group includes statuses coded as cancelled and postponed.

Examples that must be semantically distinct:

| Provider representation | Domain meaning                             | UI/ingestion rule                                                       |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `P`, scheduled          | Scheduled/Pregame                          | Show start time; no score.                                              |
| `PW`, Warmup            | Warmup                                     | Treat as started only if product needs it; not score-bearing by itself. |
| `I*`, delay             | Delayed/InProgress                         | Preserve reason and last known score/situation.                         |
| `M*` / `N*`             | Manager challenge / umpire review          | In progress, but explain the interruption.                              |
| `T*` / `U*`             | Suspended                                  | Keep on slate, retain reason and scheduling metadata.                   |
| `D*`, Postponed         | Postponed                                  | No invented score or box score; display reschedule metadata.            |
| `C*`, Cancelled         | Cancelled                                  | No invented score or box score.                                         |
| `F*` / `O*`             | Final, completed early, tied, or game over | Result may be score-bearing; classify precise outcome.                  |
| `Q*` / `R*`             | Forfeit                                    | Distinguish from ordinary final.                                        |

Reasons observed include rain, snow, wet grounds, venue, fog, cold, air
quality, wind, inclement weather, power, lightning, COVID-19, emergency, and
tragedy. Preserve the provider's display label and `reason`; do not parse
English `detailedState` strings to determine behavior.

The catalogue has at least one contradictory-looking entry: a status with
`abstractGameCode: "L"` and a detailed scheduled-COVID state. This confirms
that the adapter must not make a single raw flag the entire truth.

Proposed normalized status shape:

```text
GameState =
  Scheduled | Pregame | Warmup
  | InProgress | Delayed | UnderReview | Suspended
  | Final | CompletedEarly | Tied | Forfeit
  | Postponed | Cancelled | Unknown

RawMlbStatus = {
  abstractGameState, abstractGameCode, codedGameState,
  detailedState, statusCode, reason?, startTimeTBD
}
```

Expose separate predicates such as `isActivelyInProgress`, `isTerminal`, and
`isScoreBearing`. `isTerminal` must not imply `isScoreBearing`.

## Current repository evidence

The existing implementation is a productive spike, but it is not yet a safe
ingestion boundary:

- [`src/Status.ts`](../src/Status.ts) declares only P, L, and F game-code
  subtypes and does not retain the provider's reason.
- [`src/Game.ts`](../src/Game.ts) requires `linescore` for both live and final
  games, and requires `seriesNumber` for each team entry.
- [`src/Schedule.ts`](../src/Schedule.ts) decodes an entire response as one
  schema. It catches missing-fixture platform errors but not schema errors.
- [`src/Game.ts`](../src/Game.ts) currently validates the live feed as only a
  numeric `gamePk` and unknown `liveData`.

Audit of the 266 existing schedule fixtures found 2,995 games. Thirty-four
daily fixture documents fail the current decoder. The important causes are 43
games with `linescore: null` and 13 games with an omitted `seriesNumber`.

Fixture coverage is already valuable:

- normal final games, tied finals, completed-early rain outcomes;
- cancelled and postponed games with rain, snow, wet-ground, and inclement
  weather reasons;
- rescheduled and resumed-from metadata;
- 7- and 9-inning games, split-admission and ordinary doubleheaders;
- spring, exhibition, all-star, regular-season, and postseason game types.

It is not sufficient for fresh scheduled, active live, delay/review,
suspended, and rich runner-state coverage.

### Schedule occurrence identity is essential

Game `778443` is listed as postponed on the 2025-04-05 schedule, then final on
2025-04-06 after being rescheduled. It has the same MLB `gamePk` in both
records. The original schedule entry must remain postponed when browsing the
original date; fetching only by `gamePk` can otherwise replace historical
truth with the eventual makeup result.

Represent a selected schedule occurrence with both its schedule date and game
reference, or retain its schedule-entry snapshot while navigating. A provider
game reference alone is insufficient for historical schedule rendering.

## Recommended ingestion boundary

```text
MLB HTTP payload
  -> tolerant private raw DTO decoder
  -> per-game mapper plus diagnostics
  -> normalized ScheduleEntry / GameOverview / LiveSituation
  -> ScheduleService and GameService
  -> UI
```

Use a provider reference such as `{ provider: "mlb", id: opaqueString }` in
the domain, never `gamePk` as a UI-wide type. Keep raw IDs, endpoint URLs,
hydration names, status codes, and JSON patch details in the MLB adapter.

Suggested domain records:

- `ScheduleEntry`: schedule occurrence identity, teams, start instant,
  official-date observation, game type, doubleheader metadata, status, and
  reschedule/resume information.
- `GameOverview`: status, matchup, optional linescore, optional live
  situation, optional box score, and last-successful-provider timestamp.
- `LiveSituation`: optional inning/half/count/participants plus
  `bases: Option<BaseOccupancy>`. The option distinguishes unavailable
  situation from a known empty diamond.
- `ProviderDiagnostics`: raw status and non-fatal anomalies useful in logs and
  tests, rather than values exposed directly to UI components.

For schedule decoding, map games independently. A malformed game should
produce a structured diagnostic and leave the rest of the daily slate usable;
deciding whether to omit or render an explicit unavailable row is a product
decision, not a JSON-parser accident.

## Approaches considered

| Approach                                                   | Advantages                                                              | Risks                                                     | Decision                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Full live feed for every board row                         | One broad schema; contains rich data.                                   | Large multiplied payloads; unnecessary PBP/boxscore data. | Reject.                                               |
| Hydrated schedule for board, full feed for selected detail | Efficient board; coherent detail snapshot; simple first implementation. | Two raw DTO families.                                     | Adopt first.                                          |
| Schedule plus targeted linescore/boxscore endpoints        | Smaller independent refreshes.                                          | Cross-endpoint skew and more state/error composition.     | Later optimization.                                   |
| Timecode plus diff patches                                 | Historical replay and lower update payload possible.                    | Patch variants, snapshot management, hard recovery.       | Defer.                                                |
| Closed status union based on today's literals              | Compact initial code.                                                   | Fails on provider additions and existing exceptions.      | Reject.                                               |
| Raw-status passthrough to UI                               | Preserves provider detail.                                              | Leaks provider coupling and makes UI rules inconsistent.  | Reject; retain raw metadata beneath normalized state. |

## Issue-sized implementation sequence

1. **Define normalized MLB-facing domain records and typed service contracts.**
   Include an application-owned game reference, schedule-occurrence identity,
   status model, and unknown-state semantics.
2. **Add tolerant raw MLB schedule DTOs and independent per-game mapping.**
   Decode optional/null linescores, optional series metadata, status reasons,
   doubleheader values, and reschedule/resume fields.
3. **Build a status-catalog fixture and table-driven mapper tests.**
   Snapshot `/gameStatus`, classify all entries, and add unknown/contradictory
   synthetic cases.
4. **Implement the live schedule adapter behind the normalized service.** Use
   derived test fixtures rather than a runtime fixture provider. Preserve the
   last successful data and use the existing 15-second policy only when a
   normalized state is active/live.
5. **Implement full-feed game overview ingestion.** Validate ID equality and
   meaningful metadata; map linescore and standard box score without exposing
   raw GUMBO types.
6. **Add future live-situation and play-by-play ingestion.** First enrich
   situation coverage, then decide whether full snapshots or diff patches are
   justified.

## Test inventory

The following are minimum fixture cases before the corresponding UI state is
considered reliable:

| Scenario                                             | Required assertion                                          |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| scheduled and start-time TBD                         | No score; display meaningful start state.                   |
| pregame/warmup                                       | Not displayed as a final or score-bearing result.           |
| ordinary in-progress game                            | Inning/count/score map safely.                              |
| empty, each individual base, each pair, bases loaded | Known empty differs from unavailable.                       |
| delay, review, manager challenge                     | Game remains live/in-progress with exact explanatory state. |
| suspended and resumed                                | Preserve state and resumption scheduling facts.             |
| final, tie, completed early, forfeit                 | Outcome is precise and score policy is correct.             |
| postponed/cancelled, each with reason                | No fabricated score or box score.                           |
| original postponed date plus makeup date             | Historical schedule record does not mutate into final.      |
| null/partial linescore and missing optional metadata | Other daily games still decode and render.                  |
| invalid game ID HTTP-200 dummy feed                  | Normalize as `GameNotFound`, not an empty overview.         |
| unknown future status and fields                     | Safe `Unknown` mapping and diagnostic, not failure.         |
| failed refresh after a good response                 | Retain old domain snapshot and its timestamp.               |

Use derived minimal fixtures for observed provider shapes and label every
synthetic case. Raw captures may assist local adapter research, but must remain
untracked and unpublished under the public-data policy.

## Resolved planning decisions

The product questions that previously appeared here are now settled in
[Foundation decisions](foundation-decisions.md):

- Keep the selected local-date occurrence truthful and optionally link a known
  makeup game as related context.
- Render a malformed game as a non-blocking unavailable row.
- Poll warmup, in-progress, delayed, and review states every 15 seconds; do
  not poll scheduled, terminal, postponed, cancelled, or suspended games.
- Use the user's selected local date for board placement.
- Use one adaptive detail shell: render a box score when the result is
  score-bearing and data is usable; otherwise render truthful status and
  scheduling context.
- Keep probable pitchers and lineup availability in game details, not board
  rows.
- Defer timecode and diff-patch ingestion, live situation, and play-by-play.

Endpoint precedence, bounded retry/backoff mechanics, and diagnostic detail are
adapter implementation choices. They must preserve truthful historical
occurrences, retain the last successful response on failure, and meet the
published active-game freshness policy.

## Non-goals for the first ingestion milestone

- Provider-driven play-by-play UI, pitch charting, or replay reconstruction.
- Exposing MLB raw status codes, IDs, or GUMBO objects outside the adapter.
- Depending on `fields` projection, timecodes, or JSON patches for ordinary
  schedule/detail rendering.
- Inferring a score, runners, or completed result from HTTP success alone.
