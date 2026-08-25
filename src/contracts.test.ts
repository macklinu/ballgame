import { it as effectIt } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
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
  })

describe('game contracts', () => {
  it('keeps a postponed occurrence tied to its original schedule date', () => {
    const gameRef = 'game-makeup'
    const originalDate = Schedule.ScheduleDate.make('2025-04-05')
    const makeupDate = Schedule.ScheduleDate.make('2025-04-06')
    const original = Schedule.ScheduleOccurrence.make({
      _tag: 'Available',
      selectedDate: originalDate,
      game: game(
        gameRef,
        Status.GameStatus.make({ _tag: 'Postponed', label: 'Postponed', reason: 'Rain' }),
      ),
      rescheduledTo: makeupDate,
    })
    const makeup = Schedule.ScheduleOccurrence.make({
      _tag: 'Available',
      selectedDate: makeupDate,
      game: game(gameRef, Status.GameStatus.make({ _tag: 'Final', label: 'Final' })),
      rescheduledFrom: originalDate,
    })

    expect(original._tag).toBe('Available')
    expect(makeup._tag).toBe('Available')
    if (original._tag !== 'Available' || makeup._tag !== 'Available') {
      throw new Error('Expected available schedule occurrences')
    }

    expect(original.selectedDate).toBe('2025-04-05')
    expect(original.game.ref).toBe(makeup.game.ref)
    expect(original.game.status._tag).toBe('Postponed')
    expect(makeup.game.status._tag).toBe('Final')
    expect(original.rescheduledTo).toBe(makeup.selectedDate)
    expect(makeup.rescheduledFrom).toBe(original.selectedDate)
  })

  it('distinguishes active, suspended, score-bearing, and non-score-bearing states', () => {
    const scheduled = Status.GameStatus.make({ _tag: 'Scheduled', label: 'Scheduled' })
    const active = Status.GameStatus.make({ _tag: 'Active', label: 'In Progress' })
    const delayed = Status.GameStatus.make({ _tag: 'Delayed', label: 'Delayed' })
    const review = Status.GameStatus.make({ _tag: 'UnderReview', label: 'Review' })
    const suspended = Status.GameStatus.make({ _tag: 'Suspended', label: 'Suspended' })
    const final = Status.GameStatus.make({ _tag: 'Final', label: 'Final' })
    const postponed = Status.GameStatus.make({ _tag: 'Postponed', label: 'Postponed' })
    const cancelled = Status.GameStatus.make({ _tag: 'Cancelled', label: 'Cancelled' })
    const unknown = Status.GameStatus.make({ _tag: 'Unknown', label: 'Unrecognised' })

    expect(Status.isActivelyInProgress(scheduled)).toBe(false)
    expect(Status.isActivelyInProgress(active)).toBe(true)
    expect(Status.isActivelyInProgress(delayed)).toBe(true)
    expect(Status.isActivelyInProgress(review)).toBe(true)
    expect(Status.isActivelyInProgress(suspended)).toBe(false)
    expect(Status.isTerminal(suspended)).toBe(false)
    expect(Status.isScoreBearing(final)).toBe(true)
    expect(Status.isTerminal(final)).toBe(true)
    expect(Status.isScoreBearing(postponed)).toBe(false)
    expect(Status.isTerminal(postponed)).toBe(true)
    expect(Status.isScoreBearing(cancelled)).toBe(false)
    expect(Status.isTerminal(cancelled)).toBe(true)
    expect(Status.isTerminal(unknown)).toBe(false)

    expect(
      Schedule.hasNonTerminalGame(
        Schedule.Schedule.make({
          date: Schedule.ScheduleDate.make('2025-04-05'),
          occurrences: [
            Schedule.ScheduleOccurrence.make({
              _tag: 'Available',
              selectedDate: Schedule.ScheduleDate.make('2025-04-05'),
              game: game('game-scheduled', scheduled),
            }),
          ],
        }),
      ),
    ).toBe(true)
    expect(
      Schedule.hasNonTerminalGame(
        Schedule.Schedule.make({
          date: Schedule.ScheduleDate.make('2025-04-05'),
          occurrences: [
            Schedule.ScheduleOccurrence.make({
              _tag: 'Available',
              selectedDate: Schedule.ScheduleDate.make('2025-04-05'),
              game: game('game-final', final),
            }),
          ],
        }),
      ),
    ).toBe(false)
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
