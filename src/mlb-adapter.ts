import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
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
  reason: Schema.optionalKey(Schema.NonEmptyString),
})

const RawTeam = Schema.Struct({
  id: Schema.Int,
  name: Schema.NonEmptyString,
  abbreviation: Schema.NonEmptyString,
  shortName: Schema.NonEmptyString,
})

const RawTeamLine = Schema.Struct({
  team: RawTeam,
  score: Schema.optionalKey(Schema.Int),
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
  rescheduleDate: Schema.optionalKey(Schema.DateTimeUtcFromString),
  rescheduleGameDate: Schema.optionalKey(Schema.NonEmptyString),
  rescheduledFrom: Schema.optionalKey(Schema.DateTimeUtcFromString),
  rescheduledFromDate: Schema.optionalKey(Schema.NonEmptyString),
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
  readonly findGame: (gameRef: Game.GameRef) => Game.Game | undefined
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
    findGame: (gameRef) => games.get(gameRef),
  }
}

const statusFields = (status: typeof RawStatus.Type) =>
  status.reason === undefined
    ? { label: status.detailedState }
    : { label: status.detailedState, reason: status.reason }

/**
 * Maps documented MLB status codes without treating an English display label as
 * control flow. Unrecognised or contradictory provider values remain visible
 * as the safe Unknown domain state.
 */
const mapStatus = (raw: typeof RawStatus.Type): Status.GameStatus => {
  const fields = statusFields(raw)

  switch (raw.codedGameState) {
    case 'P':
      return raw.statusCode === 'PW'
        ? Status.GameStatus.make({ _tag: 'Warmup', ...fields })
        : Status.GameStatus.make({ _tag: 'Scheduled', ...fields })
    case 'I':
      if (raw.statusCode.startsWith('D')) {
        return Status.GameStatus.make({ _tag: 'Delayed', ...fields })
      }
      if (raw.statusCode.startsWith('M') || raw.statusCode.startsWith('N')) {
        return Status.GameStatus.make({ _tag: 'UnderReview', ...fields })
      }
      return Status.GameStatus.make({ _tag: 'Active', ...fields })
    case 'U':
    case 'T':
      return Status.GameStatus.make({ _tag: 'Suspended', ...fields })
    case 'D':
      return Status.GameStatus.make({ _tag: 'Postponed', ...fields })
    case 'C':
      return Status.GameStatus.make({ _tag: 'Cancelled', ...fields })
    case 'F':
    case 'O':
      if (raw.statusCode.startsWith('CE')) {
        return Status.GameStatus.make({ _tag: 'CompletedEarly', ...fields })
      }
      if (raw.statusCode.startsWith('T')) {
        return Status.GameStatus.make({ _tag: 'Tied', ...fields })
      }
      if (raw.statusCode.startsWith('Q') || raw.statusCode.startsWith('R')) {
        return Status.GameStatus.make({ _tag: 'Forfeit', ...fields })
      }
      return Status.GameStatus.make({ _tag: 'Final', ...fields })
    default:
      return Status.GameStatus.make({ _tag: 'Unknown', ...fields })
  }
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
  date: string | undefined,
  instant: DateTime.DateTime | undefined,
): Schedule.ScheduleDate | undefined =>
  date === undefined
    ? instant === undefined
      ? undefined
      : scheduleDate(DateTime.formatIsoDate(instant))
    : scheduleDate(date)

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
      const score =
        Status.isScoreBearing(status) &&
        raw.teams.away.score !== undefined &&
        raw.teams.home.score !== undefined
          ? Game.Score.make({ away: raw.teams.away.score, home: raw.teams.home.score })
          : undefined
      const game = Game.Game.make({
        ref: references.game(raw.gamePk),
        type: mapGameType(raw.gameType),
        startsAt: raw.gameDate,
        awayTeam: away,
        homeTeam: home,
        status,
        ...(score === undefined ? {} : { score }),
      })
      references.remember(game)
      const rescheduledTo = relatedDate(raw.rescheduleGameDate, raw.rescheduleDate)
      const rescheduledFrom = relatedDate(raw.rescheduledFromDate, raw.rescheduledFrom)

      return Schedule.ScheduleOccurrence.make({
        _tag: 'Available',
        selectedDate,
        game,
        ...(rescheduledTo === undefined ? {} : { rescheduledTo }),
        ...(rescheduledFrom === undefined ? {} : { rescheduledFrom }),
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
      const game = references.findGame(gameRef)
      if (game === undefined) {
        return yield* new Game.GameNotFound({ gameRef })
      }
      return game
    })

    return Context.empty().pipe(
      Context.add(Schedule.ScheduleService, Schedule.ScheduleService.of({ get: getSchedule })),
      Context.add(Game.GameService, Game.GameService.of({ get: getGame })),
    )
  }),
)
