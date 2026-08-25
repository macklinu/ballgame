import { it as effectIt } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import { describe, expect } from 'vitest'

import * as MlbAdapter from './mlb-adapter'

const at = (value: string) => Schema.decodeSync(Schema.DateTimeUtcFromString)(value)
const selectedDate = at('2025-04-05T00:00:00Z')

const rawGame = (status: {
  codedGameState: string
  statusCode: string
  detailedState: string
}) => ({
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

const mapSingle = (game: unknown) =>
  MlbAdapter.mapScheduleForTest(selectedDate, { dates: [{ games: [game] }] })

describe('MLB adapter boundary', () => {
  for (const testCase of [
    {
      name: 'scheduled',
      status: { codedGameState: 'P', statusCode: 'S', detailedState: 'Scheduled' },
      expected: 'Scheduled',
      hasScore: false,
    },
    {
      name: 'warmup',
      status: { codedGameState: 'P', statusCode: 'PW', detailedState: 'Warmup' },
      expected: 'Warmup',
      hasScore: false,
    },
    {
      name: 'active',
      status: { codedGameState: 'I', statusCode: 'I', detailedState: 'In Progress' },
      expected: 'Active',
      hasScore: false,
    },
    {
      name: 'delay',
      status: { codedGameState: 'I', statusCode: 'DR', detailedState: 'Delayed' },
      expected: 'Delayed',
      hasScore: false,
    },
    {
      name: 'review',
      status: { codedGameState: 'I', statusCode: 'M', detailedState: 'Manager Challenge' },
      expected: 'UnderReview',
      hasScore: false,
    },
    {
      name: 'suspension',
      status: { codedGameState: 'U', statusCode: 'U', detailedState: 'Suspended' },
      expected: 'Suspended',
      hasScore: false,
    },
    {
      name: 'score-bearing terminal',
      status: { codedGameState: 'F', statusCode: 'F', detailedState: 'Final' },
      expected: 'Final',
      hasScore: true,
    },
    {
      name: 'completed early',
      status: { codedGameState: 'F', statusCode: 'CE', detailedState: 'Completed Early' },
      expected: 'CompletedEarly',
      hasScore: true,
    },
    {
      name: 'tie',
      status: { codedGameState: 'F', statusCode: 'T', detailedState: 'Tie' },
      expected: 'Tied',
      hasScore: true,
    },
    {
      name: 'forfeit',
      status: { codedGameState: 'F', statusCode: 'Q', detailedState: 'Forfeit' },
      expected: 'Forfeit',
      hasScore: true,
    },
    {
      name: 'non-score-bearing terminal',
      status: { codedGameState: 'D', statusCode: 'DR', detailedState: 'Postponed' },
      expected: 'Postponed',
      hasScore: false,
    },
    {
      name: 'cancelled',
      status: { codedGameState: 'C', statusCode: 'C', detailedState: 'Cancelled' },
      expected: 'Cancelled',
      hasScore: false,
    },
    {
      name: 'unknown',
      status: { codedGameState: 'X', statusCode: 'X1', detailedState: 'Future state' },
      expected: 'Unknown',
      hasScore: false,
    },
  ]) {
    effectIt.effect(`maps ${testCase.name} without leaking provider fields`, () =>
      Effect.gen(function* () {
        const schedule = yield* mapSingle(rawGame(testCase.status))
        const occurrence = schedule.occurrences[0]

        expect(occurrence).toBeDefined()
        if (occurrence === undefined || occurrence._tag !== 'Available') {
          throw new Error('Expected a mapped schedule occurrence')
        }

        expect(occurrence.selectedDate).toBe('2025-04-05')
        expect(occurrence.game.status._tag).toBe(testCase.expected)
        expect(occurrence.game).not.toHaveProperty('gamePk')
        expect(occurrence.game.awayTeam).not.toHaveProperty('id')
        expect(occurrence.game.ref).toMatch(/^game-/)
        expect(occurrence.game.score !== undefined).toBe(testCase.hasScore)
      }),
    )
  }

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

  effectIt.effect('keeps the original postponed occurrence distinct from its later makeup', () =>
    Effect.gen(function* () {
      const mapper = MlbAdapter.makeScheduleMapperForTest()
      const originalSchedule = yield* mapper.map(at('2025-04-05T00:00:00Z'), {
        dates: [
          {
            games: [
              {
                ...rawGame({ codedGameState: 'D', statusCode: 'DR', detailedState: 'Postponed' }),
                rescheduleGameDate: '2025-04-06',
              },
            ],
          },
        ],
      })
      const makeupSchedule = yield* mapper.map(at('2025-04-06T00:00:00Z'), {
        dates: [
          {
            games: [
              {
                ...rawGame({ codedGameState: 'F', statusCode: 'F', detailedState: 'Final' }),
                rescheduledFromDate: '2025-04-05',
              },
            ],
          },
        ],
      })
      const original = originalSchedule.occurrences[0]
      const makeup = makeupSchedule.occurrences[0]

      if (
        original === undefined ||
        makeup === undefined ||
        original._tag !== 'Available' ||
        makeup._tag !== 'Available'
      ) {
        throw new Error('Expected available schedule occurrences')
      }

      expect(original.selectedDate).toBe('2025-04-05')
      expect(original.game.status._tag).toBe('Postponed')
      expect(original.rescheduledTo).toBe('2025-04-06')
      expect(makeup.selectedDate).toBe('2025-04-06')
      expect(makeup.game.status._tag).toBe('Final')
      expect(makeup.rescheduledFrom).toBe('2025-04-05')
      expect(original.game.ref).toBe(makeup.game.ref)
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
