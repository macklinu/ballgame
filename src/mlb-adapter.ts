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
import * as MlbDto from './mlb-dto'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

interface References {
  readonly game: (gamePk: number) => Game.GameRef
  readonly team: (teamId: number) => Team.TeamRef
  readonly player: (playerId: number) => Game.PlayerRef
  readonly findGamePk: (gameRef: Game.GameRef) => Option.Option<number>
}

const makeReferences = (): References => {
  const gameRefs = new Map<number, Game.GameRef>()
  const teamRefs = new Map<number, Team.TeamRef>()
  const playerRefs = new Map<number, Game.PlayerRef>()
  const gamePks = new Map<Game.GameRef, number>()

  const nextGameRef = (gamePk: number): Game.GameRef => {
    const existing = gameRefs.get(gamePk)
    if (existing !== undefined) {
      return existing
    }

    const ref = Game.GameRef.make(`game-${gameRefs.size + 1}`)
    gameRefs.set(gamePk, ref)
    gamePks.set(ref, gamePk)
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

  const nextPlayerRef = (playerId: number): Game.PlayerRef => {
    const existing = playerRefs.get(playerId)
    if (existing !== undefined) {
      return existing
    }

    const ref = Game.PlayerRef.make(`player-${playerRefs.size + 1}`)
    playerRefs.set(playerId, ref)
    return ref
  }

  return {
    game: nextGameRef,
    team: nextTeamRef,
    player: nextPlayerRef,
    findGamePk: (gameRef) => Option.fromUndefinedOr(gamePks.get(gameRef)),
  }
}

const optionOrEmpty = (value: Option.Option<string>): string => Option.getOrElse(value, () => '')

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

const mapStatusState = (raw: MlbDto.Status): Status.GameState =>
  Match.value(optionOrEmpty(raw.codedGameState)).pipe(
    Match.whenOr('P', 'S', () =>
      gameState(optionOrEmpty(raw.statusCode) === 'PW' ? 'Warmup' : 'Scheduled'),
    ),
    Match.when('I', () => {
      const statusCode = optionOrEmpty(raw.statusCode)
      if (statusCode.startsWith('D')) {
        return gameState('Delayed')
      }
      if (statusCode.startsWith('M') || statusCode.startsWith('N')) {
        return gameState('UnderReview')
      }
      return gameState('Active')
    }),
    Match.whenOr('U', 'T', () => gameState('Suspended')),
    Match.when('D', () => gameState('Postponed')),
    Match.when('C', () => gameState('Cancelled')),
    Match.whenOr('F', 'O', () => terminalState(optionOrEmpty(raw.statusCode))),
    Match.orElse(() => gameState('Unknown')),
  )

/**
 * Maps documented MLB status codes without treating an English display label as
 * control flow. Unrecognised or contradictory provider values remain visible
 * as the safe Unknown domain state.
 */
const mapStatus = (raw: MlbDto.Status): Status.GameStatus => {
  const state = mapStatusState(raw)

  return Status.GameStatus.make({
    state,
    label: Option.getOrElse(raw.detailedState, () => state),
    reason: raw.reason,
  })
}

const mapGameType = (raw: Option.Option<string>): Game.GameType => {
  const gameType = optionOrEmpty(raw)

  switch (gameType) {
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

const mapTeam = (raw: MlbDto.Team, references: References): Team.Team =>
  Team.Team.make({
    ref: references.team(raw.id),
    name: raw.name,
    abbreviation: Option.getOrElse(raw.abbreviation, () => raw.name),
    shortName: Option.getOrElse(raw.shortName, () => raw.name),
  })

const emptyTeamLinescore = (): Game.TeamLinescore =>
  Game.TeamLinescore.make({
    runs: Option.none(),
    hits: Option.none(),
    errors: Option.none(),
    leftOnBase: Option.none(),
  })

const mapTeamLinescore = (raw: Option.Option<MlbDto.LinescoreTeam>): Game.TeamLinescore =>
  raw.pipe(
    Option.match({
      onNone: emptyTeamLinescore,
      onSome: (value) =>
        Game.TeamLinescore.make({
          runs: value.runs,
          hits: value.hits,
          errors: value.errors,
          leftOnBase: value.leftOnBase,
        }),
    }),
  )

const mapLinescore = (raw: MlbDto.Linescore): Game.Linescore => {
  const teams = raw.teams.pipe(
    Option.match({
      onNone: () => ({ away: emptyTeamLinescore(), home: emptyTeamLinescore() }),
      onSome: (value) => ({
        away: mapTeamLinescore(value.away),
        home: mapTeamLinescore(value.home),
      }),
    }),
  )
  const inningHalf = raw.inningHalf.pipe(
    Option.filter((value): value is 'Top' | 'Bottom' => value === 'Top' || value === 'Bottom'),
  )
  const innings = raw.innings.pipe(
    Option.getOrElse((): ReadonlyArray<MlbDto.InningLinescore> => []),
    (values) =>
      values.map((inning) =>
        Game.InningLinescore.make({
          number: inning.num,
          away: mapTeamLinescore(inning.away),
          home: mapTeamLinescore(inning.home),
        }),
      ),
  )

  return Game.Linescore.make({
    scheduledInnings: raw.scheduledInnings,
    currentInning: raw.currentInning,
    inningHalf,
    away: teams.away,
    home: teams.home,
    innings,
  })
}

const mapPlayer = (
  person: MlbDto.Person,
  position: Option.Option<MlbDto.Position>,
  references: References,
): Game.Player =>
  Game.Player.make({
    ref: references.player(person.id),
    name: person.fullName,
    position: position.pipe(Option.map((value) => value.abbreviation)),
  })

const mapBattingLine = (raw: MlbDto.BattingLine): Game.BattingLine =>
  Game.BattingLine.make({
    atBats: raw.atBats,
    runs: raw.runs,
    hits: raw.hits,
    doubles: raw.doubles,
    triples: raw.triples,
    homeRuns: raw.homeRuns,
    runsBattedIn: raw.rbi,
    walks: raw.baseOnBalls,
    strikeOuts: raw.strikeOuts,
    average: raw.avg,
  })

const mapPitchingLine = (raw: MlbDto.PitchingLine): Game.PitchingLine =>
  Game.PitchingLine.make({
    inningsPitched: raw.inningsPitched,
    hits: raw.hits,
    runs: raw.runs,
    earnedRuns: raw.earnedRuns,
    walks: raw.baseOnBalls,
    strikeOuts: raw.strikeOuts,
    homeRuns: raw.homeRuns,
    earnedRunAverage: raw.era,
  })

const hasBattingData = (stats: MlbDto.BattingLine): boolean =>
  Option.isSome(stats.atBats) ||
  Option.isSome(stats.runs) ||
  Option.isSome(stats.hits) ||
  Option.isSome(stats.doubles) ||
  Option.isSome(stats.triples) ||
  Option.isSome(stats.homeRuns) ||
  Option.isSome(stats.rbi) ||
  Option.isSome(stats.baseOnBalls) ||
  Option.isSome(stats.strikeOuts) ||
  Option.isSome(stats.avg)

const hasPitchingData = (stats: MlbDto.PitchingLine): boolean =>
  Option.isSome(stats.inningsPitched) ||
  Option.isSome(stats.hits) ||
  Option.isSome(stats.runs) ||
  Option.isSome(stats.earnedRuns) ||
  Option.isSome(stats.baseOnBalls) ||
  Option.isSome(stats.strikeOuts) ||
  Option.isSome(stats.homeRuns) ||
  Option.isSome(stats.era)

const battingOrder = (raw: Option.Option<string>): Option.Option<number> =>
  raw.pipe(
    Option.flatMap((value) => {
      const parsed = Number.parseInt(value, 10)
      const order = Math.floor(parsed / 100)
      return Number.isSafeInteger(order) && order > 0 ? Option.some(order) : Option.none()
    }),
  )

const rawTeamPlayers = (raw: MlbDto.BoxscoreTeam): ReadonlyArray<MlbDto.BoxscorePlayer> =>
  raw.players.pipe(
    Option.map((players) => Object.values(players)),
    Option.getOrElse((): ReadonlyArray<MlbDto.BoxscorePlayer> => []),
  )

const mapLineup = (
  raw: MlbDto.BoxscoreTeam,
  references: References,
): ReadonlyArray<Game.LineupPlayer> => {
  const players = rawTeamPlayers(raw)
  const playerById = new Map(players.map((player) => [player.person.id, player]))
  const orderedPlayers = players.filter((player) =>
    Option.isSome(battingOrder(player.battingOrder)),
  )
  const listedPlayers = raw.batters.pipe(
    Option.map((batters) =>
      batters.flatMap((playerId) => {
        const player = playerById.get(playerId)
        return player === undefined ? [] : [player]
      }),
    ),
    Option.getOrElse((): ReadonlyArray<MlbDto.BoxscorePlayer> => []),
  )
  const selectedPlayers = listedPlayers.length > 0 ? listedPlayers : orderedPlayers

  return selectedPlayers.map((player) =>
    Game.LineupPlayer.make({
      player: mapPlayer(player.person, player.position, references),
      battingOrder: battingOrder(player.battingOrder),
    }),
  )
}

const mapTeamBoxscore = (raw: Option.Option<MlbDto.BoxscoreTeam>, references: References) =>
  raw.pipe(
    Option.match({
      onNone: () => ({
        lineup: [],
        boxscore: Game.TeamBoxscore.make({ batting: [], pitching: [] }),
      }),
      onSome: (team) => {
        const players = rawTeamPlayers(team)
        const batting = players.flatMap((player) =>
          player.stats.pipe(
            Option.flatMap((stats) => stats.batting),
            Option.filter(hasBattingData),
            Option.match({
              onNone: () => [],
              onSome: (stats) => [
                Game.BattingBoxscoreLine.make({
                  player: mapPlayer(player.person, player.position, references),
                  stats: mapBattingLine(stats),
                }),
              ],
            }),
          ),
        )
        const pitching = players.flatMap((player) =>
          player.stats.pipe(
            Option.flatMap((stats) => stats.pitching),
            Option.filter(hasPitchingData),
            Option.match({
              onNone: () => [],
              onSome: (stats) => [
                Game.PitchingBoxscoreLine.make({
                  player: mapPlayer(player.person, player.position, references),
                  stats: mapPitchingLine(stats),
                }),
              ],
            }),
          ),
        )

        return {
          lineup: mapLineup(team, references),
          boxscore: Game.TeamBoxscore.make({ batting, pitching }),
        }
      },
    }),
  )

const mapBoxscore = (raw: MlbDto.Boxscore, references: References) => {
  const away = mapTeamBoxscore(raw.teams.away, references)
  const home = mapTeamBoxscore(raw.teams.home, references)
  const lineups =
    away.lineup.length > 0 || home.lineup.length > 0
      ? Option.some(Game.Lineups.make({ away: away.lineup, home: home.lineup }))
      : Option.none()
  const hasBoxscore =
    away.boxscore.batting.length > 0 ||
    away.boxscore.pitching.length > 0 ||
    home.boxscore.batting.length > 0 ||
    home.boxscore.pitching.length > 0

  return {
    lineups,
    boxscore: hasBoxscore
      ? Option.some(Game.Boxscore.make({ away: away.boxscore, home: home.boxscore }))
      : Option.none(),
  }
}

type BoxscoreData = ReturnType<typeof mapBoxscore>

const decodeLinescore = (
  input: Option.Option<unknown>,
): Effect.Effect<Option.Option<Game.Linescore>> =>
  input.pipe(
    Option.match({
      onNone: () => Effect.succeed(Option.none<Game.Linescore>()),
      onSome: (value) =>
        Schema.decodeUnknownEffect(MlbDto.Linescore)(value).pipe(
          Effect.map(mapLinescore),
          Effect.asSome,
          Effect.orElseSucceed(() => Option.none()),
        ),
    }),
  )

const decodeProbablePitchers = (
  input: Option.Option<unknown>,
  references: References,
): Effect.Effect<Option.Option<Game.ProbablePitchers>> =>
  input.pipe(
    Option.match({
      onNone: () => Effect.succeed(Option.none<Game.ProbablePitchers>()),
      onSome: (value) =>
        Schema.decodeUnknownEffect(MlbDto.ProbablePitchers)(value).pipe(
          Effect.map((raw) =>
            Game.ProbablePitchers.make({
              away: raw.away.pipe(
                Option.map((pitcher) => mapPlayer(pitcher, Option.none(), references)),
              ),
              home: raw.home.pipe(
                Option.map((pitcher) => mapPlayer(pitcher, Option.none(), references)),
              ),
            }),
          ),
          Effect.asSome,
          Effect.orElseSucceed(() => Option.none()),
        ),
    }),
  )

const decodeBoxscore = (
  input: Option.Option<unknown>,
  references: References,
): Effect.Effect<Option.Option<BoxscoreData>> =>
  input.pipe(
    Option.match({
      onNone: () => Effect.succeed(Option.none<BoxscoreData>()),
      onSome: (value) =>
        Schema.decodeUnknownEffect(MlbDto.Boxscore)(value).pipe(
          Effect.map((raw) => mapBoxscore(raw, references)),
          Effect.asSome,
          Effect.orElseSucceed(() => Option.none()),
        ),
    }),
  )

const emptyProbablePitchers = (): Game.ProbablePitchers =>
  Game.ProbablePitchers.make({ away: Option.none(), home: Option.none() })

const gameUnavailable = (operation: string, message: string): Game.GameUnavailable =>
  new Game.GameUnavailable({ operation, cause: new Error(message) })

const mapGameOverview = Effect.fn('MlbGame.mapOverview')(function* (
  requestedGamePk: number,
  raw: MlbDto.GameFeed,
  references: References,
) {
  if (raw.gamePk !== requestedGamePk || raw.gameData.game.pk !== requestedGamePk) {
    return yield* gameUnavailable(
      'GameOverview.validate',
      'The returned feed does not belong to the requested game',
    )
  }

  const rawLinescore = raw.liveData.pipe(Option.flatMap((liveData) => liveData.linescore))
  const linescore = yield* decodeLinescore(rawLinescore)
  const probablePitchers = Option.getOrElse(
    yield* decodeProbablePitchers(raw.gameData.probablePitchers, references),
    emptyProbablePitchers,
  )
  const rawBoxscore = raw.liveData.pipe(Option.flatMap((liveData) => liveData.boxscore))
  const boxscoreData = yield* decodeBoxscore(rawBoxscore, references)
  const status = mapStatus(raw.gameData.status)
  const score = Status.isScoreBearing(status)
    ? linescore.pipe(
        Option.flatMap((value) => Option.all({ away: value.away.runs, home: value.home.runs })),
        Option.map((value) => Game.Score.make(value)),
      )
    : Option.none()
  const game = Game.Game.make({
    ref: references.game(requestedGamePk),
    type: mapGameType(Option.some(raw.gameData.game.type)),
    startsAt: raw.gameData.datetime.dateTime,
    awayTeam: mapTeam(raw.gameData.teams.away, references),
    homeTeam: mapTeam(raw.gameData.teams.home, references),
    status,
    score,
  })
  return Game.GameOverview.make({
    game,
    linescore,
    probablePitchers,
    lineups: boxscoreData.pipe(Option.flatMap((value) => value.lineups)),
    boxscore: boxscoreData.pipe(Option.flatMap((value) => value.boxscore)),
  })
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

const unavailableOccurrence = (
  selectedDate: Schedule.ScheduleDate,
): Schedule.UnavailableScheduleOccurrence =>
  Schedule.UnavailableScheduleOccurrence.make({
    selectedDate,
    message: 'Game data unavailable',
    diagnostic: new Schedule.ScheduleOccurrenceDiagnostic({
      message: 'The schedule entry could not be mapped.',
    }),
  })

/** Owns the adapter-private reference cache used by schedule and game lookups. */
const makeScheduleMapper = (references: References) => {
  const mapProviderGame = (
    selectedDate: Schedule.ScheduleDate,
    input: unknown,
  ): Effect.Effect<Schedule.ScheduleOccurrence, Schema.SchemaError> =>
    Schema.decodeUnknownEffect(MlbDto.Game)(input).pipe(
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
        const rescheduledTo = relatedDate(raw.rescheduleGameDate, raw.rescheduleDate)
        const rescheduledFrom = relatedDate(raw.rescheduledFromDate, raw.rescheduledFrom)

        return Schedule.AvailableScheduleOccurrence.make({
          selectedDate,
          game,
          rescheduledTo,
          rescheduledFrom,
        })
      }),
    )

  const mapPayload = (
    selectedDate: DateTime.DateTime,
    payload: MlbDto.ScheduleResponse,
  ): Effect.Effect<Schedule.Schedule> => {
    const date = scheduleDate(DateTime.formatIsoDate(selectedDate))
    const games = payload.dates.flatMap((schedule) => schedule.games)

    return Effect.forEach(games, (game) =>
      mapProviderGame(date, game).pipe(Effect.orElseSucceed(() => unavailableOccurrence(date))),
    ).pipe(Effect.map((occurrences) => Schedule.Schedule.make({ date, occurrences })))
  }

  const map = (date: DateTime.DateTime, input: unknown) =>
    Schema.decodeUnknownEffect(MlbDto.ScheduleResponse)(input).pipe(
      Effect.flatMap((payload) => mapPayload(date, payload)),
      Effect.mapError(() => new Schedule.ScheduleUnavailable()),
    )

  return { map, mapPayload }
}

/** Test-only adapter entry point. Its input stays untyped so raw DTO types stay private. */
export const makeScheduleMapperForTest = () => {
  const mapper = makeScheduleMapper(makeReferences())

  return { map: mapper.map }
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
    const scheduleMapper = makeScheduleMapper(references)

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
          Effect.flatMap(HttpClientResponse.schemaBodyJson(MlbDto.ScheduleResponse)),
          Effect.mapError(() => new Schedule.ScheduleUnavailable()),
        )

      return yield* scheduleMapper.mapPayload(date, payload)
    })

    const getGame = Effect.fn('MlbGame.get')(function* (gameRef: Game.GameRef) {
      const gamePk = yield* Option.match(references.findGamePk(gameRef), {
        onNone: () => Effect.fail(new Game.GameNotFound({ gameRef })),
        onSome: Effect.succeed,
      })

      const payload = yield* httpClient
        .get(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
        .pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap(HttpClientResponse.schemaBodyJson(MlbDto.GameFeed)),
          Effect.mapError(() =>
            gameUnavailable('GameOverview.fetch', 'The game overview could not be retrieved'),
          ),
        )

      return yield* mapGameOverview(gamePk, payload, references)
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
