import { it } from '@effect/vitest'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'
import { ChildProcessSpawner } from 'effect/unstable/process'
import invariant from 'tiny-invariant'
import { describe, expect } from 'vitest'

import * as Game from './Game'
import * as MlbAdapter from './mlb-adapter'
import * as MlbDto from './mlb-dto'
import * as Schedule from './Schedule'

const at = (value: string) => Schema.decodeSync(Schema.DateTimeUtcFromString)(value)
const selectedDate = at('2025-04-05T00:00:00Z')

type ProviderGameType = 'S' | 'E' | 'R' | 'A' | 'F' | 'X'

type ProviderGameScenario =
  | 'Scheduled'
  | 'Warmup'
  | 'Active'
  | 'Delayed'
  | 'UnderReview'
  | 'Suspended'
  | 'Resumed'
  | 'Final'
  | 'CompletedEarly'
  | 'Tied'
  | 'Forfeit'
  | 'Postponed'
  | 'Cancelled'
  | 'Unknown'

type ProviderStatusFixture = typeof MlbDto.Status.Encoded
type ProviderGameFixture = typeof MlbDto.Game.Encoded
type ProviderGameFeedFixture = typeof MlbDto.GameFeed.Encoded
type ProviderLinescoreFixture = typeof MlbDto.Linescore.Encoded
type ProviderBoxscoreFixture = typeof MlbDto.Boxscore.Encoded
type ProviderProbablePitchersFixture = typeof MlbDto.ProbablePitchers.Encoded

const providerStatuses = {
  Scheduled: { codedGameState: 'P', statusCode: 'S', detailedState: 'Scheduled', reason: null },
  Warmup: { codedGameState: 'P', statusCode: 'PW', detailedState: 'Warmup', reason: null },
  Active: { codedGameState: 'I', statusCode: 'I', detailedState: 'In Progress', reason: null },
  Delayed: { codedGameState: 'I', statusCode: 'DR', detailedState: 'Delayed', reason: null },
  UnderReview: {
    codedGameState: 'I',
    statusCode: 'M',
    detailedState: 'Manager Challenge',
    reason: null,
  },
  Suspended: { codedGameState: 'U', statusCode: 'U', detailedState: 'Suspended', reason: null },
  Resumed: { codedGameState: 'I', statusCode: 'I', detailedState: 'Resumed', reason: null },
  Final: { codedGameState: 'F', statusCode: 'F', detailedState: 'Final', reason: null },
  CompletedEarly: {
    codedGameState: 'F',
    statusCode: 'CE',
    detailedState: 'Completed Early',
    reason: null,
  },
  Tied: { codedGameState: 'F', statusCode: 'T', detailedState: 'Tie', reason: null },
  Forfeit: { codedGameState: 'F', statusCode: 'Q', detailedState: 'Forfeit', reason: null },
  Postponed: { codedGameState: 'D', statusCode: 'DR', detailedState: 'Postponed', reason: null },
  Cancelled: { codedGameState: 'C', statusCode: 'C', detailedState: 'Cancelled', reason: null },
  Unknown: { codedGameState: 'X', statusCode: 'X1', detailedState: 'Future state', reason: null },
} satisfies Record<ProviderGameScenario, ProviderStatusFixture>

/** Private synthetic provider fixture builder; no captured provider data is used. */
const providerGame = (status: ProviderStatusFixture): ProviderGameFixture => ({
  gamePk: 778443,
  gameType: 'R',
  gameDate: '2025-04-05T20:10:00Z',
  status,
  teams: {
    away: {
      score: 1,
      team: { id: 1, name: 'Away Club', abbreviation: 'AWY', shortName: 'Away' },
    },
    home: {
      score: 2,
      team: { id: 2, name: 'Home Club', abbreviation: 'HME', shortName: 'Home' },
    },
  },
})

const gameWithProviderState = (state: ProviderGameScenario): ProviderGameFixture =>
  providerGame(providerStatuses[state])

const scheduledGame = (): ProviderGameFixture => gameWithProviderState('Scheduled')

const finalGame = (gamePk = 778443): ProviderGameFixture => ({
  ...gameWithProviderState('Final'),
  gamePk,
})

const gameWithProviderType = (gameType: ProviderGameType): ProviderGameFixture => ({
  ...scheduledGame(),
  gameType,
})

const allStarFinalWithRainDelay = (): ProviderGameFixture => {
  const game = finalGame()

  return {
    ...game,
    gameType: 'A',
    status: {
      ...game.status,
      detailedState: 'Final after rain delay',
      reason: 'Rain delay',
    },
    teams: {
      away: { ...game.teams.away, score: 3 },
      home: { ...game.teams.home, score: 5 },
    },
  }
}

const futureGameWithPartialScheduleMetadata = (): ProviderGameFixture => {
  const game = scheduledGame()

  return {
    ...game,
    gameType: null,
    status: { ...game.status, statusCode: null, detailedState: null },
    teams: {
      away: {
        ...game.teams.away,
        score: null,
        team: { ...game.teams.away.team, abbreviation: null, shortName: null },
      },
      home: {
        ...game.teams.home,
        score: null,
        team: { ...game.teams.home.team, abbreviation: null, shortName: null },
      },
    },
    rescheduleDate: null,
    rescheduledFromDate: null,
  }
}

const postponedGameWithDateField = (): ProviderGameFixture => ({
  ...gameWithProviderState('Postponed'),
  rescheduleGameDate: '2025-04-06',
})

const makeupGameWithDateField = (): ProviderGameFixture => ({
  ...finalGame(),
  rescheduledFromDate: '2025-04-05',
})

const postponedGameWithInstantField = (): ProviderGameFixture => ({
  ...gameWithProviderState('Postponed'),
  rescheduleDate: '2025-04-06T00:00:00Z',
})

const makeupGameWithInstantField = (): ProviderGameFixture => ({
  ...finalGame(),
  rescheduledFrom: '2025-04-05T00:00:00Z',
})

/** This is the sole crossing from typed synthetic fixtures to the untrusted adapter input. */
const rawSchedulePayload = <T>(games: ReadonlyArray<T>) => ({ dates: [{ games }] })

const mapPayload = (payload: unknown) => MlbAdapter.mapScheduleForTest(selectedDate, payload)

const mapGameAt = (
  mapper: ReturnType<typeof MlbAdapter.makeScheduleMapperForTest>,
  date: typeof selectedDate,
  game: ProviderGameFixture,
) => mapper.map(date, rawSchedulePayload([game]))

const mapSingle = (game: ProviderGameFixture) => mapPayload(rawSchedulePayload([game]))

const malformedGame = (): unknown => ({ gamePk: 'not-a-number' })

const malformedDailySlate = (): unknown => ({ dates: 'invalid' })

const fullGameFeed = (
  options: {
    readonly status?: ProviderStatusFixture
    readonly feedGamePk?: number
    readonly gameDataPk?: number
  } = {},
): ProviderGameFeedFixture => {
  const { status = providerStatuses.Final, feedGamePk = 778443, gameDataPk = 778443 } = options

  return {
    gamePk: feedGamePk,
    gameData: {
      game: { pk: gameDataPk, type: 'R' },
      datetime: { dateTime: '2025-04-05T20:10:00Z' },
      status,
      teams: {
        away: { id: 1, name: 'Away Club', abbreviation: 'AWY', shortName: 'Away' },
        home: { id: 2, name: 'Home Club', abbreviation: 'HME', shortName: 'Home' },
      },
      probablePitchers: {
        away: { id: 41, fullName: 'Away Starter' },
        home: { id: 42, fullName: 'Home Starter' },
      } satisfies ProviderProbablePitchersFixture,
    },
    liveData: {
      linescore: {
        scheduledInnings: 9,
        currentInning: 9,
        inningHalf: 'Bottom',
        teams: {
          away: { runs: 3, hits: 8, errors: 1, leftOnBase: 5 },
          home: { runs: 5, hits: 9, errors: 0, leftOnBase: 7 },
        },
        innings: [
          {
            num: 1,
            away: { runs: 1, hits: 2, errors: 0, leftOnBase: 1 },
            home: { runs: 0, hits: 1, errors: 0, leftOnBase: 2 },
          },
        ],
      } satisfies ProviderLinescoreFixture,
      boxscore: {
        teams: {
          away: {
            players: {
              ID31: {
                person: { id: 31, fullName: 'Away Batter' },
                position: { abbreviation: 'CF' },
                battingOrder: '100',
                stats: {
                  batting: {
                    atBats: 4,
                    runs: 1,
                    hits: 2,
                    doubles: 1,
                    triples: 0,
                    homeRuns: 0,
                    rbi: 1,
                    baseOnBalls: 0,
                    strikeOuts: 1,
                    avg: '.250',
                  },
                },
              },
              ID32: {
                person: { id: 32, fullName: 'Away Pitcher' },
                position: { abbreviation: 'P' },
                stats: {
                  pitching: {
                    inningsPitched: '6.0',
                    hits: 5,
                    runs: 2,
                    earnedRuns: 2,
                    baseOnBalls: 1,
                    strikeOuts: 7,
                    homeRuns: 1,
                    era: '3.00',
                  },
                },
              },
            },
            batters: [31],
            pitchers: [32],
          },
          home: {
            players: {
              ID51: {
                person: { id: 51, fullName: 'Home Batter' },
                position: { abbreviation: '1B' },
                battingOrder: '300',
                stats: {
                  batting: {
                    atBats: 4,
                    runs: 2,
                    hits: 3,
                    doubles: 0,
                    triples: 0,
                    homeRuns: 1,
                    rbi: 3,
                    baseOnBalls: 1,
                    strikeOuts: 0,
                    avg: '.300',
                  },
                },
              },
            },
            batters: [51],
            pitchers: [],
          },
        },
      } satisfies ProviderBoxscoreFixture,
    },
  }
}

const makeLiveAdapter = (schedule: ProviderGameFixture, feedBody: string) => {
  const requestedUrls: Array<string> = []
  const client = HttpClient.make((request) => {
    requestedUrls.push(request.url)
    const body = request.url.endsWith('/schedule')
      ? JSON.stringify({ dates: [{ games: [schedule] }] })
      : feedBody

    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(body, { headers: { 'content-type': 'application/json' } }),
      ),
    )
  })

  const browserArguments: Array<ReadonlyArray<string>> = []
  const browser = Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {
    exitCode: (command) => {
      if (command._tag === 'StandardCommand') {
        browserArguments.push(command.args)
      }
      return Effect.succeed(ChildProcessSpawner.ExitCode(0))
    },
  })

  return {
    layer: MlbAdapter.layerLive.pipe(
      Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
      Layer.provide(browser),
    ),
    requestedUrls,
    browserArguments,
  }
}

const getSelectedOverview = Effect.fn('MlbAdapterTest.getSelectedOverview')(function* () {
  const scheduleService = yield* Schedule.ScheduleService
  const gameService = yield* Game.GameService
  const schedule = yield* scheduleService.get(selectedDate)
  const occurrence = asAvailable(schedule)

  return yield* gameService.get(occurrence.game.ref)
})

const openSelectedMlbTv = Effect.fn('MlbAdapterTest.openSelectedMlbTv')(function* () {
  const scheduleService = yield* Schedule.ScheduleService
  const gameService = yield* Game.GameService
  const schedule = yield* scheduleService.get(selectedDate)
  const occurrence = asAvailable(schedule)

  yield* gameService.openMlbTv(occurrence.game.ref)
})

const expectGameUnavailable = (
  failure: Game.GameNotFound | Game.GameUnavailable | Schedule.ScheduleUnavailable,
  operation: string,
): void =>
  Match.value(failure).pipe(
    Match.tagsExhaustive({
      GameNotFound: () => invariant(false, 'Expected GameUnavailable, received GameNotFound'),
      GameUnavailable: (error) => {
        expect(error.operation).toBe(operation)
      },
      ScheduleUnavailable: () =>
        invariant(false, 'Expected GameUnavailable, received ScheduleUnavailable'),
    }),
  )

const asAvailable = (schedule: Schedule.Schedule): Schedule.AvailableScheduleOccurrence => {
  const occurrence = schedule.occurrences[0]
  invariant(
    occurrence !== undefined && Schedule.isAvailableScheduleOccurrence(occurrence),
    'Expected an available schedule occurrence',
  )
  return occurrence
}

const mapAvailable = (game: ProviderGameFixture) => mapSingle(game).pipe(Effect.map(asAvailable))

const noScore: Option.Option<Game.Score> = Option.none()
const score: Option.Option<Game.Score> = Option.some(Game.Score.make({ away: 1, home: 2 }))

describe('MLB adapter boundary', () => {
  it.effect('maps only normalized public game fields', () => {
    const input = allStarFinalWithRainDelay()

    return Effect.gen(function* () {
      const occurrence = yield* mapAvailable(input)
      const game = occurrence.game

      expect(occurrence.selectedDate).toBe('2025-04-05')
      expect(game).toMatchObject({
        type: 'AllStar',
        awayTeam: { name: 'Away Club', abbreviation: 'AWY', shortName: 'Away' },
        homeTeam: { name: 'Home Club', abbreviation: 'HME', shortName: 'Home' },
        status: { label: 'Final after rain delay' },
      })
      expect(Option.getOrThrow(game.score)).toEqual({ away: 3, home: 5 })
      expect(Option.getOrThrow(game.status.reason)).toBe('Rain delay')
    })
  })

  it.effect.each([
    { raw: 'S', expected: 'SpringTraining' },
    { raw: 'E', expected: 'Exhibition' },
    { raw: 'R', expected: 'RegularSeason' },
    { raw: 'A', expected: 'AllStar' },
    { raw: 'F', expected: 'Postseason' },
    { raw: 'X', expected: 'Other' },
  ] as const)('maps game type $raw to $expected', (testCase) =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(gameWithProviderType(testCase.raw))

      expect(occurrence.game.type).toBe(testCase.expected)
    }),
  )

  it.effect.each([
    {
      name: 'scheduled',
      scenario: 'Scheduled',
      state: 'Scheduled',
      score,
    },
    {
      name: 'warmup',
      scenario: 'Warmup',
      state: 'Warmup',
      score,
    },
    {
      name: 'active',
      scenario: 'Active',
      state: 'Active',
      score,
    },
    {
      name: 'delay',
      scenario: 'Delayed',
      state: 'Delayed',
      score,
    },
    {
      name: 'review',
      scenario: 'UnderReview',
      state: 'UnderReview',
      score,
    },
    {
      name: 'suspension',
      scenario: 'Suspended',
      state: 'Suspended',
      score,
    },
    {
      name: 'resumed',
      scenario: 'Resumed',
      state: 'Active',
      score,
    },
    {
      name: 'score-bearing terminal',
      scenario: 'Final',
      state: 'Final',
      score,
    },
    {
      name: 'completed early',
      scenario: 'CompletedEarly',
      state: 'CompletedEarly',
      score,
    },
    {
      name: 'tie',
      scenario: 'Tied',
      state: 'Tied',
      score,
    },
    {
      name: 'forfeit',
      scenario: 'Forfeit',
      state: 'Forfeit',
      score,
    },
    {
      name: 'non-score-bearing terminal',
      scenario: 'Postponed',
      state: 'Postponed',
      score,
    },
    {
      name: 'cancelled',
      scenario: 'Cancelled',
      state: 'Cancelled',
      score,
    },
    {
      name: 'unknown',
      scenario: 'Unknown',
      state: 'Unknown',
      score,
    },
  ] as const)('maps $name to a normalized state and exact score Option', (testCase) =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(gameWithProviderState(testCase.scenario))

      expect({ state: occurrence.game.status.state, score: occurrence.game.score }).toEqual({
        state: testCase.state,
        score: testCase.score,
      })
    }),
  )

  it.effect('maps the scheduled provider code used by the live schedule', () =>
    Effect.gen(function* () {
      const scheduled = scheduledGame()
      const occurrence = yield* mapAvailable({
        ...scheduled,
        status: { ...scheduled.status, codedGameState: 'S' },
      })

      expect({ state: occurrence.game.status.state, score: occurrence.game.score }).toEqual({
        state: 'Scheduled',
        score,
      })
    }),
  )
  it.effect('keeps known active scores and hydrated inning progress', () =>
    Effect.gen(function* () {
      const active = {
        ...gameWithProviderState('Active'),
        linescore: {
          scheduledInnings: 9,
          currentInning: 7,
          inningHalf: 'Bottom',
          outs: 1,
          teams: null,
          innings: null,
        },
      } satisfies ProviderGameFixture
      const occurrence = yield* mapAvailable(active)

      expect(occurrence.game.score).toEqual(Option.some(Game.Score.make({ away: 1, home: 2 })))
      expect(Option.getOrThrow(occurrence.game.progress)).toEqual({
        scheduledInnings: Option.some(9),
        currentInning: Option.some(7),
        inningHalf: Option.some('Bottom'),
        outs: Option.some(1),
      })
    }),
  )

  it.effect('orders schedule rows by official scheduled start', () =>
    Effect.gen(function* () {
      const later = {
        ...scheduledGame(),
        gamePk: 2,
        gameDate: '2025-04-05T21:10:00Z',
      } satisfies ProviderGameFixture
      const earlier = {
        ...scheduledGame(),
        gamePk: 1,
        gameDate: '2025-04-05T19:10:00Z',
      } satisfies ProviderGameFixture
      const schedule = yield* mapPayload(rawSchedulePayload([later, earlier]))

      expect(
        schedule.occurrences
          .filter(Schedule.isAvailableScheduleOccurrence)
          .map((occurrence) => DateTime.toEpochMillis(occurrence.game.startsAt)),
      ).toEqual([1743880200000, 1743887400000])
    }),
  )

  it.effect('keeps a future game when optional schedule metadata is partial', () =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(futureGameWithPartialScheduleMetadata())

      expect(occurrence.game).toMatchObject({
        type: 'Other',
        awayTeam: { abbreviation: 'Away Club', shortName: 'Away Club' },
        homeTeam: { abbreviation: 'Home Club', shortName: 'Home Club' },
        status: { state: 'Scheduled', label: 'Scheduled' },
      })
      expect(occurrence.game.score).toEqual(noScore)
      expect(occurrence.game.status.reason).toEqual(Option.none())
    }),
  )

  it.effect.each([
    {
      name: 'string-date fields',
      original: postponedGameWithDateField,
      makeup: makeupGameWithDateField,
    },
    {
      name: 'instant fallback fields',
      original: postponedGameWithInstantField,
      makeup: makeupGameWithInstantField,
    },
  ])('normalizes postponed and makeup dates from $name', (testCase) =>
    Effect.gen(function* () {
      const mapper = MlbAdapter.makeScheduleMapperForTest()
      const originalSchedule = yield* mapGameAt(
        mapper,
        at('2025-04-05T00:00:00Z'),
        testCase.original(),
      )
      const makeupSchedule = yield* mapGameAt(mapper, at('2025-04-06T00:00:00Z'), testCase.makeup())
      const original = asAvailable(originalSchedule)
      const makeup = asAvailable(makeupSchedule)

      expect(original.selectedDate).toBe('2025-04-05')
      expect(Option.getOrThrow(original.rescheduledTo)).toBe('2025-04-06')
      expect(makeup.selectedDate).toBe('2025-04-06')
      expect(Option.getOrThrow(makeup.rescheduledFrom)).toBe('2025-04-05')
      expect(original.game.ref).toBe(makeup.game.ref)
    }),
  )

  it.effect('keeps the daily slate in the success channel when one game is malformed', () =>
    Effect.gen(function* () {
      const schedule = yield* mapPayload(
        rawSchedulePayload([scheduledGame(), malformedGame(), finalGame(778444)]),
      )
      const unavailable = schedule.occurrences[1]

      expect(schedule.occurrences.map((occurrence) => occurrence._tag)).toEqual([
        'Available',
        'Unavailable',
        'Available',
      ])
      expect(unavailable).toMatchObject({
        selectedDate: '2025-04-05',
        message: 'Game data unavailable',
        diagnostic: {
          _tag: 'InvalidGameData',
          message: 'The schedule entry could not be mapped.',
        },
      })
    }),
  )

  it.effect('uses an application error only when the daily slate cannot be decoded', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(mapPayload(malformedDailySlate()))
      expect(failure).toEqual(new Schedule.ScheduleUnavailable())
    }),
  )

  it.effect(
    'fetches a normalized overview with linescore, starters, lineup, and standard boxscore',
    () => {
      const adapter = makeLiveAdapter(finalGame(), JSON.stringify(fullGameFeed()))

      return Effect.gen(function* () {
        const overview = yield* getSelectedOverview().pipe(Effect.provide(adapter.layer))
        const linescore = Option.getOrThrow(overview.linescore)
        const lineups = Option.getOrThrow(overview.lineups)
        const boxscore = Option.getOrThrow(overview.boxscore)

        expect(overview.game).toMatchObject({
          type: 'RegularSeason',
          status: { state: 'Final', label: 'Final' },
          awayTeam: { name: 'Away Club', abbreviation: 'AWY' },
          homeTeam: { name: 'Home Club', abbreviation: 'HME' },
        })
        expect(Option.getOrThrow(overview.game.score)).toEqual({ away: 3, home: 5 })
        expect(linescore).toMatchObject({
          scheduledInnings: Option.some(9),
          currentInning: Option.some(9),
          inningHalf: Option.some('Bottom'),
          away: { runs: Option.some(3), hits: Option.some(8) },
          home: { runs: Option.some(5), hits: Option.some(9) },
        })
        expect(linescore.innings).toEqual([
          {
            number: 1,
            away: {
              runs: Option.some(1),
              hits: Option.some(2),
              errors: Option.some(0),
              leftOnBase: Option.some(1),
            },
            home: {
              runs: Option.some(0),
              hits: Option.some(1),
              errors: Option.some(0),
              leftOnBase: Option.some(2),
            },
          },
        ])
        expect(Option.getOrThrow(overview.probablePitchers.away)).toMatchObject({
          name: 'Away Starter',
        })
        expect(lineups.away).toMatchObject([
          {
            player: { name: 'Away Batter', position: Option.some('CF') },
            battingOrder: Option.some(1),
          },
        ])
        expect(boxscore.away.batting).toMatchObject([
          {
            player: { name: 'Away Batter' },
            stats: { atBats: Option.some(4), hits: Option.some(2), average: Option.some('.250') },
          },
        ])
        expect(boxscore.away.pitching).toMatchObject([
          {
            player: { name: 'Away Pitcher' },
            stats: { inningsPitched: Option.some('6.0'), strikeOuts: Option.some(7) },
          },
        ])
        expect(adapter.requestedUrls).toHaveLength(2)
        expect(adapter.requestedUrls[1]).toContain('/feed/live')
      })
    },
  )

  it.effect('retains partial live linescore data without inventing missing values', () => {
    const partialLinescore: ProviderLinescoreFixture = {
      teams: { away: { runs: 3 } },
    }
    const feed = fullGameFeed()
    const partialFeed: ProviderGameFeedFixture = {
      ...feed,
      liveData: { linescore: partialLinescore, boxscore: null },
    }
    const adapter = makeLiveAdapter(finalGame(), JSON.stringify(partialFeed))

    return Effect.gen(function* () {
      const overview = yield* getSelectedOverview().pipe(Effect.provide(adapter.layer))
      const linescore = Option.getOrThrow(overview.linescore)

      expect(linescore).toEqual({
        scheduledInnings: Option.none(),
        currentInning: Option.none(),
        inningHalf: Option.none(),
        outs: Option.none(),
        away: {
          runs: Option.some(3),
          hits: Option.none(),
          errors: Option.none(),
          leftOnBase: Option.none(),
        },
        home: {
          runs: Option.none(),
          hits: Option.none(),
          errors: Option.none(),
          leftOnBase: Option.none(),
        },
        innings: [],
      })
      expect(overview.game.score).toEqual(Option.none())
    })
  })

  it.effect('keeps a cancelled game useful without inventing a score or boxscore', () => {
    const cancelledStatus: ProviderStatusFixture = {
      ...providerStatuses.Cancelled,
      reason: 'Rain',
    }
    const feed = fullGameFeed({ status: cancelledStatus })
    const cancelledFeed = {
      ...feed,
      gameData: {
        ...feed.gameData,
        probablePitchers: { away: { id: 41, fullName: 'Away Starter' } },
      },
      liveData: { linescore: null, boxscore: null },
    }
    const adapter = makeLiveAdapter(
      gameWithProviderState('Cancelled'),
      JSON.stringify(cancelledFeed),
    )

    return Effect.gen(function* () {
      const overview = yield* getSelectedOverview().pipe(Effect.provide(adapter.layer))

      expect(overview.game).toMatchObject({
        startsAt: at('2025-04-05T20:10:00Z'),
        awayTeam: { name: 'Away Club' },
        homeTeam: { name: 'Home Club' },
        status: { state: 'Cancelled', label: 'Cancelled', reason: Option.some('Rain') },
      })
      expect(overview.game.score).toEqual(Option.none())
      expect(overview.linescore).toEqual(Option.none())
      expect(overview.lineups).toEqual(Option.none())
      expect(overview.boxscore).toEqual(Option.none())
      expect(Option.getOrThrow(overview.probablePitchers.away)).toMatchObject({
        name: 'Away Starter',
      })
      expect(overview.probablePitchers.home).toEqual(Option.none())
    })
  })

  it.effect('rejects a successful response for another game', () => {
    const adapter = makeLiveAdapter(
      scheduledGame(),
      JSON.stringify(fullGameFeed({ feedGamePk: 999999, gameDataPk: 999999 })),
    )

    return Effect.gen(function* () {
      const failure = yield* Effect.flip(getSelectedOverview().pipe(Effect.provide(adapter.layer)))

      expectGameUnavailable(failure, 'GameOverview.validate')
    })
  })

  it.effect('rejects a malformed successful feed that lacks meaningful game metadata', () => {
    const malformedFeed: unknown = { gamePk: 778443, gameData: {}, liveData: {} }
    const adapter = makeLiveAdapter(scheduledGame(), JSON.stringify(malformedFeed))

    return Effect.gen(function* () {
      const failure = yield* Effect.flip(getSelectedOverview().pipe(Effect.provide(adapter.layer)))

      expectGameUnavailable(failure, 'GameOverview.fetch')
    })
  })
  it.effect('opens the selected game official MLB.TV page from its provider game identity', () => {
    const adapter = makeLiveAdapter(scheduledGame(), JSON.stringify(fullGameFeed()))

    return Effect.gen(function* () {
      yield* openSelectedMlbTv().pipe(Effect.provide(adapter.layer))

      expect(adapter.browserArguments).toEqual([['https://www.mlb.com/tv/g778443']])
    })
  })
})
