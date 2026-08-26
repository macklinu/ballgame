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

interface ProviderStatusFixture {
  readonly codedGameState: string | null
  readonly statusCode: string | null
  readonly detailedState: string | null
  readonly reason: string | null
}

interface LinescoreFixture {
  readonly innings?: ReadonlyArray<{
    readonly away?: { readonly runs?: number }
    readonly home?: { readonly runs?: number }
  }>
}

interface ProviderGameFixture {
  readonly gamePk: number
  readonly gameType?: string | null
  readonly gameDate: string
  readonly status: ProviderStatusFixture
  readonly teams: {
    readonly away: ProviderTeamLineFixture
    readonly home: ProviderTeamLineFixture
  }
  readonly linescore?: LinescoreFixture | null
  readonly rescheduleDate?: string | null
  readonly rescheduleGameDate?: string | null
  readonly rescheduledFrom?: string | null
  readonly rescheduledFromDate?: string | null
}

interface ProviderTeamLineFixture {
  readonly team: ProviderTeamFixture
  readonly score?: number | null
}

interface ProviderTeamFixture {
  readonly id: number
  readonly name: string
  readonly abbreviation?: string | null
  readonly shortName?: string | null
}

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

const futureGameWithPartialMetadata = (): ProviderGameFixture => {
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
    linescore: { innings: [{ home: { runs: 1 } }] },
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
const rawSchedulePayload = (games: ReadonlyArray<unknown>): unknown => ({ dates: [{ games }] })

const mapPayload = (payload: unknown) => MlbAdapter.mapScheduleForTest(selectedDate, payload)

const mapGameAt = (
  mapper: ReturnType<typeof MlbAdapter.makeScheduleMapperForTest>,
  date: typeof selectedDate,
  game: ProviderGameFixture,
) => mapper.map(date, rawSchedulePayload([game]))

const mapSingle = (game: ProviderGameFixture) => mapPayload(rawSchedulePayload([game]))

const malformedGame = (): unknown => ({ gamePk: 'not-a-number' })

const malformedDailySlate = (): unknown => ({ dates: 'invalid' })

const asAvailable = (schedule: Schedule.Schedule): Schedule.AvailableScheduleOccurrence => {
  const occurrence = schedule.occurrences[0]
  if (occurrence === undefined || !Schedule.isAvailableScheduleOccurrence(occurrence)) {
    throw new Error('Expected an available schedule occurrence')
  }
  return occurrence
}

const mapAvailable = (game: ProviderGameFixture) => mapSingle(game).pipe(Effect.map(asAvailable))

const noScore: Option.Option<Game.Score> = Option.none()
const score: Option.Option<Game.Score> = Option.some(Game.Score.make({ away: 1, home: 2 }))

describe('MLB adapter boundary', () => {
  effectIt.effect('maps only normalized public game fields', () => {
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
  ] as const)('maps game type $raw to $expected', (testCase) =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(gameWithProviderType(testCase.raw))

      expect(occurrence.game.type).toBe(testCase.expected)
    }),
  )

  effectIt.effect.each([
    {
      name: 'scheduled',
      scenario: 'Scheduled',
      state: 'Scheduled',
      score: noScore,
    },
    {
      name: 'warmup',
      scenario: 'Warmup',
      state: 'Warmup',
      score: noScore,
    },
    {
      name: 'active',
      scenario: 'Active',
      state: 'Active',
      score: noScore,
    },
    {
      name: 'delay',
      scenario: 'Delayed',
      state: 'Delayed',
      score: noScore,
    },
    {
      name: 'review',
      scenario: 'UnderReview',
      state: 'UnderReview',
      score: noScore,
    },
    {
      name: 'suspension',
      scenario: 'Suspended',
      state: 'Suspended',
      score: noScore,
    },
    {
      name: 'resumed',
      scenario: 'Resumed',
      state: 'Active',
      score: noScore,
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
      score: noScore,
    },
    {
      name: 'cancelled',
      scenario: 'Cancelled',
      state: 'Cancelled',
      score: noScore,
    },
    {
      name: 'unknown',
      scenario: 'Unknown',
      state: 'Unknown',
      score: noScore,
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

  effectIt.effect('keeps a future game when optional metadata and linescore data are partial', () =>
    Effect.gen(function* () {
      const occurrence = yield* mapAvailable(futureGameWithPartialMetadata())

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

  effectIt.effect('keeps the daily slate in the success channel when one game is malformed', () =>
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

  effectIt.effect('uses an application error only when the daily slate cannot be decoded', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(mapPayload(malformedDailySlate()))
      expect(failure._tag).toBe('ScheduleUnavailable')
      expect(failure.operation).toBe('MlbSchedule.decode')
    }),
  )
})
