import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'

import * as Game from './Game'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

// Everything below this line is private to the MLB adapter. It is deliberately
// not re-exported from the application-facing game or schedule contracts.
const RawStatus = Schema.Struct({
  codedGameState: Schema.NonEmptyString,
  detailedState: Schema.NonEmptyString,
  statusCode: Schema.NonEmptyString,
  reason: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
})

const RawTeam = Schema.Struct({
  id: Schema.Int,
  name: Schema.NonEmptyString,
  abbreviation: Schema.NonEmptyString,
  shortName: Schema.NonEmptyString,
})

const RawTeamLine = Schema.Struct({
  team: RawTeam,
  score: Schema.OptionFromOptionalKey(Schema.Int),
})

const RawGame = Schema.Struct({
  gamePk: Schema.Int,
  gameType: Schema.NonEmptyString,
  gameDate: Schema.DateTimeUtcFromString,
  status: RawStatus,
  teams: Schema.Struct({
    away: RawTeamLine,
    home: RawTeamLine,
  }),
  rescheduleDate: Schema.OptionFromOptionalKey(Schema.DateTimeUtcFromString),
  rescheduleGameDate: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
  rescheduledFrom: Schema.OptionFromOptionalKey(Schema.DateTimeUtcFromString),
  rescheduledFromDate: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
})

const RawScheduleResponse = Schema.Struct({
  dates: Schema.Array(
    Schema.Struct({
      games: Schema.Array(Schema.Unknown),
    }),
  ),
})

interface References {
  readonly game: (gamePk: number) => Game.GameRef
  readonly team: (teamId: number) => Team.TeamRef
  readonly remember: (game: Game.Game) => void
  readonly findGame: (gameRef: Game.GameRef) => Option.Option<Game.Game>
}

const makeReferences = (): References => {
  const gameRefs = new Map<number, Game.GameRef>()
  const teamRefs = new Map<number, Team.TeamRef>()
  const games = new Map<Game.GameRef, Game.Game>()

  const nextGameRef = (gamePk: number): Game.GameRef => {
    const existing = gameRefs.get(gamePk)
    if (existing !== undefined) {
      return existing
    }

    const ref = Game.GameRef.make(`game-${gameRefs.size + 1}`)
    gameRefs.set(gamePk, ref)
    return ref
  }

  const nextTeamRef = (teamId: number): Team.TeamRef => {
    const existing = teamRefs.get(teamId)
    if (existing !== undefined) {
      return existing
    }

    const ref = Team.TeamRef.make(`team-${teamRefs.size + 1}`)
    teamRefs.set(teamId, ref)
    return ref
  }

  return {
    game: nextGameRef,
    team: nextTeamRef,
    remember: (game) => {
      games.set(game.ref, game)
    },
    findGame: (gameRef) => Option.fromUndefinedOr(games.get(gameRef)),
  }
}

const terminalState = (statusCode: string): Status.GameState => {
  if (statusCode.startsWith('CE')) {
    return 'CompletedEarly'
  }
  if (statusCode.startsWith('T')) {
    return 'Tied'
  }
  if (statusCode.startsWith('Q') || statusCode.startsWith('R')) {
    return 'Forfeit'
  }
  return 'Final'
}

const gameState = (state: Status.GameState): Status.GameState => state

const mapStatusState = (raw: typeof RawStatus.Type): Status.GameState =>
  Match.value(raw.codedGameState).pipe(
    Match.when('P', () => gameState(raw.statusCode === 'PW' ? 'Warmup' : 'Scheduled')),
    Match.when('I', () => {
      if (raw.statusCode.startsWith('D')) {
        return gameState('Delayed')
      }
      if (raw.statusCode.startsWith('M') || raw.statusCode.startsWith('N')) {
        return gameState('UnderReview')
      }
      return gameState('Active')
    }),
    Match.whenOr('U', 'T', () => gameState('Suspended')),
    Match.when('D', () => gameState('Postponed')),
    Match.when('C', () => gameState('Cancelled')),
    Match.whenOr('F', 'O', () => terminalState(raw.statusCode)),
    Match.orElse(() => gameState('Unknown')),
  )

/**
 * Maps documented MLB status codes without treating an English display label as
 * control flow. Unrecognised or contradictory provider values remain visible
 * as the safe Unknown domain state.
 */
const mapStatus = (raw: typeof RawStatus.Type): Status.GameStatus => {
  return Status.GameStatus.make({
    state: mapStatusState(raw),
    label: raw.detailedState,
    reason: raw.reason,
  })
}

const mapGameType = (raw: string): Game.GameType => {
  switch (raw) {
    case 'S':
      return 'SpringTraining'
    case 'E':
      return 'Exhibition'
    case 'R':
      return 'RegularSeason'
    case 'A':
      return 'AllStar'
    case 'F':
    case 'D':
    case 'L':
    case 'W':
      return 'Postseason'
    default:
      return 'Other'
  }
}

const mapTeam = (raw: typeof RawTeam.Type, references: References): Team.Team =>
  Team.Team.make({
    ref: references.team(raw.id),
    name: raw.name,
    abbreviation: raw.abbreviation,
    shortName: raw.shortName,
  })

const scheduleDate = (value: string): Schedule.ScheduleDate => Schedule.ScheduleDate.make(value)

const relatedDate = (
  date: Option.Option<string>,
  instant: Option.Option<DateTime.DateTime>,
): Option.Option<Schedule.ScheduleDate> =>
  date.pipe(
    Option.map(scheduleDate),
    Option.orElse(() => instant.pipe(Option.map(DateTime.formatIsoDate), Option.map(scheduleDate))),
  )

const mapRawGame = (
  selectedDate: Schedule.ScheduleDate,
  input: unknown,
  references: References,
): Effect.Effect<Schedule.ScheduleOccurrence, Schema.SchemaError> =>
  Schema.decodeUnknownEffect(RawGame)(input).pipe(
    Effect.map((raw) => {
      const status = mapStatus(raw.status)
      const away = mapTeam(raw.teams.away.team, references)
      const home = mapTeam(raw.teams.home.team, references)
      const score = Status.isScoreBearing(status)
        ? Option.all({ away: raw.teams.away.score, home: raw.teams.home.score }).pipe(
            Option.map((score) => Game.Score.make(score)),
          )
        : Option.none()
      const game = Game.Game.make({
        ref: references.game(raw.gamePk),
        type: mapGameType(raw.gameType),
        startsAt: raw.gameDate,
        awayTeam: away,
        homeTeam: home,
        status,
        score,
      })
      references.remember(game)
      const rescheduledTo = relatedDate(raw.rescheduleGameDate, raw.rescheduleDate)
      const rescheduledFrom = relatedDate(raw.rescheduledFromDate, raw.rescheduledFrom)

      return Schedule.AvailableScheduleOccurrence.make({
        _tag: 'Available',
        selectedDate,
        game,
        rescheduledTo,
        rescheduledFrom,
      })
    }),
  )

const unavailableOccurrence = (selectedDate: Schedule.ScheduleDate): Schedule.ScheduleOccurrence =>
  Schedule.ScheduleOccurrence.make({
    _tag: 'Unavailable',
    selectedDate,
    message: 'Game data unavailable',
  })

const mapPayload = (
  selectedDate: DateTime.DateTime,
  payload: typeof RawScheduleResponse.Type,
  references: References,
): Effect.Effect<Schedule.Schedule> => {
  const date = scheduleDate(DateTime.formatIsoDate(selectedDate))
  const games = payload.dates.flatMap((schedule) => schedule.games)

  return Effect.forEach(games, (game) =>
    mapRawGame(date, game, references).pipe(
      Effect.orElseSucceed(() => unavailableOccurrence(date)),
    ),
  ).pipe(Effect.map((occurrences) => Schedule.Schedule.make({ date, occurrences })))
}

const scheduleUnavailable = (operation: string) => (cause: unknown) =>
  new Schedule.ScheduleUnavailable({ operation, cause })

const mapSchedule = (date: DateTime.DateTime, input: unknown, references: References) =>
  Schema.decodeUnknownEffect(RawScheduleResponse)(input).pipe(
    Effect.flatMap((payload) => mapPayload(date, payload, references)),
    Effect.mapError(scheduleUnavailable('MlbSchedule.decode')),
  )

/** Test-only adapter entry point. Its input stays untyped so raw DTO types stay private. */
export const makeScheduleMapperForTest = () => {
  const references = makeReferences()

  return { map: (date: DateTime.DateTime, input: unknown) => mapSchedule(date, input, references) }
}

export const mapScheduleForTest = (date: DateTime.DateTime, input: unknown) =>
  makeScheduleMapperForTest().map(date, input)

/**
 * The sole live composition boundary. It provides normalized services while
 * retaining all provider URLs, DTOs, numeric IDs, and HTTP errors privately.
 */
export const layerLive = Layer.effectContext(
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const references = makeReferences()

    const getSchedule = Effect.fn('MlbSchedule.get')(function* (date: DateTime.DateTime) {
      const payload = yield* httpClient
        .get('https://statsapi.mlb.com/api/v1/schedule', {
          urlParams: {
            sportId: 1,
            date: DateTime.formatIsoDate(date),
            hydrate: ['team', 'game', 'linescore'].join(','),
          },
        })
        .pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap(HttpClientResponse.schemaBodyJson(RawScheduleResponse)),
          Effect.mapError(scheduleUnavailable('MlbSchedule.get')),
        )

      return yield* mapPayload(date, payload, references)
    })

    const getGame = Effect.fn('MlbGame.get')(function* (gameRef: Game.GameRef) {
      return yield* Option.match(references.findGame(gameRef), {
        onNone: () => Effect.fail(new Game.GameNotFound({ gameRef })),
        onSome: (game) => Effect.succeed(game),
      })
    })

    // One adapter acquisition supplies both public services. They share the
    // private reference cache, so a game returned by a schedule remains
    // addressable by the GameService without exposing provider identifiers.
    return Context.empty().pipe(
      Context.add(Schedule.ScheduleService, Schedule.ScheduleService.of({ get: getSchedule })),
      Context.add(Game.GameService, Game.GameService.of({ get: getGame })),
    )
  }),
)
