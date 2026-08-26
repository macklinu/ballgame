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

interface RawStatus {
  readonly codedGameState: string
  readonly statusCode: string
  readonly detailedState: string
  readonly reason?: string
}

interface RawGameOptions {
  readonly gameType?: string
  readonly awayScore?: number
  readonly homeScore?: number
  readonly rescheduleDate?: string
  readonly rescheduleGameDate?: string
  readonly rescheduledFrom?: string
  readonly rescheduledFromDate?: string
}

const rawGame = (status: RawStatus, options: RawGameOptions = {}) => {
  const { gameType = 'R', awayScore = 1, homeScore = 2, ...scheduleFields } = options

  return {
    gamePk: 778443,
    gameType,
    gameDate: '2025-04-05T20:10:00Z',
    status,
    teams: {
      away: {
        score: awayScore,
        team: { id: 1, name: 'Away Club', abbreviation: 'AWY', shortName: 'Away' },
      },
      home: {
        score: homeScore,
        team: { id: 2, name: 'Home Club', abbreviation: 'HME', shortName: 'Home' },
      },
    },
    ...scheduleFields,
  }
}

const mapSingle = (game: unknown) =>
  MlbAdapter.mapScheduleForTest(selectedDate, { dates: [{ games: [game] }] })

const asAvailable = (schedule: Schedule.Schedule): Schedule.AvailableScheduleOccurrence => {
  const occurrence = schedule.occurrences[0]
  if (occurrence === undefined || !Schedule.isAvailableScheduleOccurrence(occurrence)) {
    throw new Error('Expected an available schedule occurrence')
  }
  return occurrence
}

const mapAvailable = (game: unknown) => mapSingle(game).pipe(Effect.map(asAvailable))

const noScore: Option.Option<Game.Score> = Option.none()
const score: Option.Option<Game.Score> = Option.some(Game.Score.make({ away: 1, home: 2 }))

describe('MLB adapter boundary', () => {
  effectIt.effect('maps only normalized public game fields', () => {
    const input = rawGame(
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
      expect(game.type).toBe('AllStar')
      expect({
        name: game.awayTeam.name,
        abbreviation: game.awayTeam.abbreviation,
        shortName: game.awayTeam.shortName,
      }).toEqual({ name: 'Away Club', abbreviation: 'AWY', shortName: 'Away' })
      expect({
        name: game.homeTeam.name,
        abbreviation: game.homeTeam.abbreviation,
        shortName: game.homeTeam.shortName,
      }).toEqual({ name: 'Home Club', abbreviation: 'HME', shortName: 'Home' })
      expect(Option.getOrThrow(game.score)).toEqual({ away: 3, home: 5 })
      expect(game.status.label).toBe('Final after rain delay')
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
        rawGame(
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
      const occurrence = yield* mapAvailable(rawGame(testCase.status))

      expect({ state: occurrence.game.status.state, score: occurrence.game.score }).toEqual({
        state: testCase.state,
        score: testCase.score,
      })
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
              rawGame(
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
              rawGame(
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

  effectIt.effect('retains a malformed game as an unavailable occurrence', () =>
    Effect.gen(function* () {
      const schedule = yield* mapSingle({ gamePk: 'not-a-number' })
      expect(schedule.occurrences).toEqual([
        {
          _tag: 'Unavailable',
          selectedDate: '2025-04-05',
          message: 'Game data unavailable',
        },
      ])
    }),
  )

  effectIt.effect('normalizes a malformed schedule payload into an application error', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        MlbAdapter.mapScheduleForTest(selectedDate, { dates: 'invalid' }),
      )
      expect(failure._tag).toBe('ScheduleUnavailable')
      expect(failure.operation).toBe('MlbSchedule.decode')
    }),
  )
})
