import { it as effectIt } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { describe, expect } from 'vitest'

import * as Game from './Game'
import * as MlbAdapter from './mlb-adapter'
import * as Schedule from './Schedule'

const at = (value: string) => Schema.decodeSync(Schema.DateTimeUtcFromString)(value)
const selectedDate = at('2025-04-05T00:00:00Z')

interface ScheduleStatusFixture {
  readonly codedGameState?: string | null
  readonly statusCode?: string | null
  readonly detailedState?: string | null
  readonly reason?: string | null
}

interface LinescoreFixture {
  readonly innings?: ReadonlyArray<{
    readonly away?: { readonly runs?: number }
    readonly home?: { readonly runs?: number }
  }>
}

interface ScheduleGameFixture {
  readonly gamePk: number
  readonly gameType?: string | null
  readonly gameDate: string
  readonly status: ScheduleStatusFixture
  readonly teams: {
    readonly away: ScheduleTeamLineFixture
    readonly home: ScheduleTeamLineFixture
  }
  readonly linescore?: LinescoreFixture | null
  readonly rescheduleDate?: string | null
  readonly rescheduleGameDate?: string | null
  readonly rescheduledFrom?: string | null
  readonly rescheduledFromDate?: string | null
}

interface ScheduleTeamLineFixture {
  readonly team: ScheduleTeamFixture
  readonly score?: number | null
}

interface ScheduleTeamFixture {
  readonly id: number
  readonly name: string
  readonly abbreviation?: string | null
  readonly shortName?: string | null
}

interface InvalidGameFixture {
  readonly gamePk: string
}

interface ScheduleFixture {
  readonly dates: ReadonlyArray<{
    readonly games: ReadonlyArray<ScheduleGameFixture | InvalidGameFixture>
  }>
}

interface ScheduleGameOptions {
  readonly gamePk?: number
  readonly gameType?: string | null
  readonly awayScore?: number | null
  readonly homeScore?: number | null
  readonly awayAbbreviation?: string | null
  readonly homeAbbreviation?: string | null
  readonly awayShortName?: string | null
  readonly homeShortName?: string | null
  readonly linescore?: LinescoreFixture | null
  readonly rescheduleDate?: string | null
  readonly rescheduleGameDate?: string | null
  readonly rescheduledFrom?: string | null
  readonly rescheduledFromDate?: string | null
}

const optional = <T>(value: T | undefined, key: string): { readonly [key: string]: T } =>
  value === undefined ? {} : { [key]: value }

const scheduleGame = (
  status: ScheduleStatusFixture,
  options: ScheduleGameOptions = {},
): ScheduleGameFixture => {
  const {
    gamePk = 778443,
    gameType = 'R',
    awayScore = 1,
    homeScore = 2,
    awayAbbreviation = 'AWY',
    homeAbbreviation = 'HME',
    awayShortName = 'Away',
    homeShortName = 'Home',
    linescore,
    rescheduleDate,
    rescheduleGameDate,
    rescheduledFrom,
    rescheduledFromDate,
  } = options

  return {
    gamePk,
    gameType,
    gameDate: '2025-04-05T20:10:00Z',
    status,
    teams: {
      away: {
        ...optional(awayScore, 'score'),
        team: {
          id: 1,
          name: 'Away Club',
          ...optional(awayAbbreviation, 'abbreviation'),
          ...optional(awayShortName, 'shortName'),
        },
      },
      home: {
        ...optional(homeScore, 'score'),
        team: {
          id: 2,
          name: 'Home Club',
          ...optional(homeAbbreviation, 'abbreviation'),
          ...optional(homeShortName, 'shortName'),
        },
      },
    },
    ...optional(linescore, 'linescore'),
    ...optional(rescheduleDate, 'rescheduleDate'),
    ...optional(rescheduleGameDate, 'rescheduleGameDate'),
    ...optional(rescheduledFrom, 'rescheduledFrom'),
    ...optional(rescheduledFromDate, 'rescheduledFromDate'),
  }
}

const mapSingle = (game: ScheduleGameFixture) =>
  MlbAdapter.mapScheduleForTest(selectedDate, { dates: [{ games: [game] }] })

const asAvailable = (schedule: Schedule.Schedule): Schedule.AvailableScheduleOccurrence => {
  const occurrence = schedule.occurrences[0]
  if (occurrence === undefined || !Schedule.isAvailableScheduleOccurrence(occurrence)) {
    throw new Error('Expected an available schedule occurrence')
  }
  return occurrence
}

const mapAvailable = (game: ScheduleGameFixture) => mapSingle(game).pipe(Effect.map(asAvailable))

const noScore: Option.Option<Game.Score> = Option.none()
const score: Option.Option<Game.Score> = Option.some(Game.Score.make({ away: 1, home: 2 }))

describe('MLB adapter boundary', () => {
  effectIt.effect('maps only normalized public game fields', () => {
    const input = scheduleGame(
      {
        codedGameState: 'F',
        statusCode: 'F',
        detailedState: 'Final after rain delay',
        reason: 'Rain delay',
      },
      { gameType: 'A', awayScore: 3, homeScore: 5 },
    )

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
      expect(String(game.ref)).not.toBe(String(input.gamePk))
      expect(game).not.toHaveProperty('gamePk')
      expect(game.awayTeam).not.toHaveProperty('id')
      expect(game.homeTeam).not.toHaveProperty('id')
    })
  })

  effectIt.effect.each([
    { raw: 'S', expected: 'SpringTraining' },
    { raw: 'E', expected: 'Exhibition' },
    { raw: 'R', expected: 'RegularSeason' },
    { raw: 'A', expected: 'AllStar' },
    { raw: 'F', expected: 'Postseason' },
    { raw: 'X', expected: 'Other' },
  ])('maps game type $raw to $expected', (testCase) =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(
        scheduleGame(
          { codedGameState: 'P', statusCode: 'S', detailedState: 'Scheduled' },
          {
            gameType: testCase.raw,
          },
        ),
      )

      expect(occurrence.game.type).toBe(testCase.expected)
    }),
  )

  effectIt.effect.each([
    {
      name: 'scheduled',
      status: { codedGameState: 'P', statusCode: 'S', detailedState: 'Scheduled' },
      state: 'Scheduled',
      score: noScore,
    },
    {
      name: 'warmup',
      status: { codedGameState: 'P', statusCode: 'PW', detailedState: 'Warmup' },
      state: 'Warmup',
      score: noScore,
    },
    {
      name: 'active',
      status: { codedGameState: 'I', statusCode: 'I', detailedState: 'In Progress' },
      state: 'Active',
      score: noScore,
    },
    {
      name: 'delay',
      status: { codedGameState: 'I', statusCode: 'DR', detailedState: 'Delayed' },
      state: 'Delayed',
      score: noScore,
    },
    {
      name: 'review',
      status: { codedGameState: 'I', statusCode: 'M', detailedState: 'Manager Challenge' },
      state: 'UnderReview',
      score: noScore,
    },
    {
      name: 'suspension',
      status: { codedGameState: 'U', statusCode: 'U', detailedState: 'Suspended' },
      state: 'Suspended',
      score: noScore,
    },
    {
      name: 'resumed',
      status: { codedGameState: 'I', statusCode: 'I', detailedState: 'Resumed' },
      state: 'Active',
      score: noScore,
    },
    {
      name: 'score-bearing terminal',
      status: { codedGameState: 'F', statusCode: 'F', detailedState: 'Final' },
      state: 'Final',
      score,
    },
    {
      name: 'completed early',
      status: { codedGameState: 'F', statusCode: 'CE', detailedState: 'Completed Early' },
      state: 'CompletedEarly',
      score,
    },
    {
      name: 'tie',
      status: { codedGameState: 'F', statusCode: 'T', detailedState: 'Tie' },
      state: 'Tied',
      score,
    },
    {
      name: 'forfeit',
      status: { codedGameState: 'F', statusCode: 'Q', detailedState: 'Forfeit' },
      state: 'Forfeit',
      score,
    },
    {
      name: 'non-score-bearing terminal',
      status: { codedGameState: 'D', statusCode: 'DR', detailedState: 'Postponed' },
      state: 'Postponed',
      score: noScore,
    },
    {
      name: 'cancelled',
      status: { codedGameState: 'C', statusCode: 'C', detailedState: 'Cancelled' },
      state: 'Cancelled',
      score: noScore,
    },
    {
      name: 'unknown',
      status: { codedGameState: 'X', statusCode: 'X1', detailedState: 'Future state' },
      state: 'Unknown',
      score: noScore,
    },
  ])('maps $name to a normalized state and exact score Option', (testCase) =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(scheduleGame(testCase.status))

      expect({ state: occurrence.game.status.state, score: occurrence.game.score }).toEqual({
        state: testCase.state,
        score: testCase.score,
      })
    }),
  )

  effectIt.effect('keeps a future game when optional metadata and linescore data are partial', () =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(
        scheduleGame(
          { codedGameState: 'P', statusCode: null, detailedState: null, reason: null },
          {
            gameType: null,
            awayScore: null,
            homeScore: null,
            awayAbbreviation: null,
            homeAbbreviation: null,
            awayShortName: null,
            homeShortName: null,
            linescore: { innings: [{ home: { runs: 1 } }] },
            rescheduleDate: null,
            rescheduledFromDate: null,
          },
        ),
      )

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

  effectIt.effect.each([
    {
      name: 'string-date fields',
      original: { rescheduleGameDate: '2025-04-06' },
      makeup: { rescheduledFromDate: '2025-04-05' },
    },
    {
      name: 'instant fallback fields',
      original: { rescheduleDate: '2025-04-06T00:00:00Z' },
      makeup: { rescheduledFrom: '2025-04-05T00:00:00Z' },
    },
  ])('normalizes postponed and makeup dates from $name', (testCase) =>
    Effect.gen(function* () {
      const mapper = MlbAdapter.makeScheduleMapperForTest()
      const originalSchedule = yield* mapper.map(at('2025-04-05T00:00:00Z'), {
        dates: [
          {
            games: [
              scheduleGame(
                { codedGameState: 'D', statusCode: 'DR', detailedState: 'Postponed' },
                testCase.original,
              ),
            ],
          },
        ],
      })
      const makeupSchedule = yield* mapper.map(at('2025-04-06T00:00:00Z'), {
        dates: [
          {
            games: [
              scheduleGame(
                { codedGameState: 'F', statusCode: 'F', detailedState: 'Final' },
                testCase.makeup,
              ),
            ],
          },
        ],
      })
      const original = asAvailable(originalSchedule)
      const makeup = asAvailable(makeupSchedule)

      expect(original.selectedDate).toBe('2025-04-05')
      expect(Option.getOrThrow(original.rescheduledTo)).toBe('2025-04-06')
      expect(makeup.selectedDate).toBe('2025-04-06')
      expect(Option.getOrThrow(makeup.rescheduledFrom)).toBe('2025-04-05')
      expect(original.game.ref).toBe(makeup.game.ref)
    }),
  )

  effectIt.effect('retains usable games when one schedule entry is malformed', () =>
    Effect.gen(function* () {
      const fixture: ScheduleFixture = {
        dates: [
          {
            games: [
              scheduleGame({ codedGameState: 'P', statusCode: 'S', detailedState: 'Scheduled' }),
              { gamePk: 'not-a-number' },
              scheduleGame(
                { codedGameState: 'F', statusCode: 'F', detailedState: 'Final' },
                { gamePk: 778444 },
              ),
            ],
          },
        ],
      }
      const schedule = yield* MlbAdapter.mapScheduleForTest(selectedDate, fixture)
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
          code: 'InvalidGameData',
          message: 'The schedule entry could not be mapped.',
        },
      })
    }),
  )

  effectIt.effect('reports a failed schedule refresh as an application error', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        MlbAdapter.mapScheduleForTest(selectedDate, { dates: 'invalid' }),
      )
      expect(failure._tag).toBe('ScheduleUnavailable')
      expect(failure.operation).toBe('MlbSchedule.decode')
    }),
  )
})
