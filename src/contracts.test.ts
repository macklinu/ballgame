import { it as effectIt } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'

import * as Game from './Game'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

const at = (value: string) => Schema.decodeSync(Schema.DateTimeUtcFromString)(value)

const team = (ref: string, name: string): Team.Team =>
  Team.Team.make({
    ref: Team.TeamRef.make(ref),
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    shortName: name,
  })

const game = (ref: string, status: Status.GameStatus): Game.Game =>
  Game.Game.make({
    ref: Game.GameRef.make(ref),
    type: 'RegularSeason',
    startsAt: at('2025-04-05T20:10:00Z'),
    awayTeam: team('team-away', 'Away'),
    homeTeam: team('team-home', 'Home'),
    status,
    score: Option.none(),
  })

const status = (state: Status.GameState): Status.GameStatus =>
  Status.GameStatus.make({ state, label: state, reason: Option.none() })

const availableOccurrence = (
  selectedDate: Schedule.ScheduleDate,
  ref: string,
  gameStatus: Status.GameStatus,
) =>
  Schedule.AvailableScheduleOccurrence.make({
    _tag: 'Available',
    selectedDate,
    game: game(ref, gameStatus),
    rescheduledTo: Option.none(),
    rescheduledFrom: Option.none(),
  })

describe('game contracts', () => {
  it('keeps the postponed original on its selected schedule date', () => {
    const gameRef = 'game-makeup'
    const originalDate = Schedule.ScheduleDate.make('2025-04-05')
    const makeupDate = Schedule.ScheduleDate.make('2025-04-06')
    const original = Schedule.AvailableScheduleOccurrence.make({
      _tag: 'Available',
      selectedDate: originalDate,
      game: game(
        gameRef,
        Status.GameStatus.make({
          state: 'Postponed',
          label: 'Postponed',
          reason: Option.some('Rain'),
        }),
      ),
      rescheduledTo: Option.some(makeupDate),
      rescheduledFrom: Option.none(),
    })

    expect(original.selectedDate).toBe('2025-04-05')
    expect(original.game.status.state).toBe('Postponed')
    expect(Option.getOrThrow(original.rescheduledTo)).toBe('2025-04-06')
  })

  it('relates a later makeup to its original occurrence', () => {
    const gameRef = 'game-makeup'
    const originalDate = Schedule.ScheduleDate.make('2025-04-05')
    const makeupDate = Schedule.ScheduleDate.make('2025-04-06')
    const original = availableOccurrence(originalDate, gameRef, status('Postponed'))
    const makeup = Schedule.AvailableScheduleOccurrence.make({
      _tag: 'Available',
      selectedDate: makeupDate,
      game: game(gameRef, status('Final')),
      rescheduledTo: Option.none(),
      rescheduledFrom: Option.some(originalDate),
    })

    expect(original.game.ref).toBe(makeup.game.ref)
    expect(makeup.game.status.state).toBe('Final')
    expect(Option.getOrThrow(makeup.rescheduledFrom)).toBe(original.selectedDate)
  })

  it.each<[Status.GameState, boolean]>([
    ['Scheduled', false],
    ['Active', true],
    ['Delayed', true],
    ['UnderReview', true],
    ['Suspended', false],
  ])('recognizes %s as actively in progress: %s', (state, expected) => {
    expect(Status.isActivelyInProgress(status(state))).toBe(expected)
  })

  it.each<[Status.GameState, boolean]>([
    ['Final', true],
    ['CompletedEarly', true],
    ['Tied', true],
    ['Forfeit', true],
    ['Postponed', false],
    ['Cancelled', false],
  ])('recognizes %s as score bearing: %s', (state, expected) => {
    expect(Status.isScoreBearing(status(state))).toBe(expected)
  })

  it.each<[Status.GameState, boolean]>([
    ['Suspended', false],
    ['Final', true],
    ['Postponed', true],
    ['Cancelled', true],
    ['Unknown', false],
  ])('recognizes %s as terminal: %s', (state, expected) => {
    expect(Status.isTerminal(status(state))).toBe(expected)
  })

  it('continues polling a schedule with a non-terminal game', () => {
    const date = Schedule.ScheduleDate.make('2025-04-05')
    const schedule = Schedule.Schedule.make({
      date,
      occurrences: [availableOccurrence(date, 'game-scheduled', status('Scheduled'))],
    })

    expect(Schedule.hasNonTerminalGame(schedule)).toBe(true)
  })

  it('stops polling after every available game is terminal', () => {
    const date = Schedule.ScheduleDate.make('2025-04-05')
    const schedule = Schedule.Schedule.make({
      date,
      occurrences: [availableOccurrence(date, 'game-final', status('Final'))],
    })

    expect(Schedule.hasNonTerminalGame(schedule)).toBe(false)
  })

  effectIt.effect('keeps service failures in typed application-error channels', () => {
    const scheduleError = new Schedule.ScheduleUnavailable({
      operation: 'ScheduleService.get',
      cause: new Error('offline'),
    })
    const gameRef = Game.GameRef.make('game-missing')

    return Effect.gen(function* () {
      const scheduleService = yield* Schedule.ScheduleService
      const gameService = yield* Game.GameService

      const scheduleFailure = yield* Effect.flip(scheduleService.get(at('2025-04-05T00:00:00Z')))
      const gameFailure = yield* Effect.flip(gameService.get(gameRef))

      expect(scheduleFailure._tag).toBe('ScheduleUnavailable')
      expect(gameFailure._tag).toBe('GameNotFound')
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(
            Schedule.ScheduleService,
            Schedule.ScheduleService.of({ get: () => Effect.fail(scheduleError) }),
          ),
          Layer.succeed(
            Game.GameService,
            Game.GameService.of({
              get: (ref) => Effect.fail(new Game.GameNotFound({ gameRef: ref })),
            }),
          ),
        ),
      ),
    )
  })
})
