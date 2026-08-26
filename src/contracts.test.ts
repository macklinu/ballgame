import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { describe, expect, test } from 'vitest'

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
    selectedDate,
    game: game(ref, gameStatus),
    rescheduledTo: Option.none(),
    rescheduledFrom: Option.none(),
  })

describe('game contracts', () => {
  test('keeps the postponed original on its selected schedule date', () => {
    const gameRef = 'game-makeup'
    const originalDate = Schedule.ScheduleDate.make('2025-04-05')
    const makeupDate = Schedule.ScheduleDate.make('2025-04-06')
    const original = Schedule.AvailableScheduleOccurrence.make({
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

  test('relates a later makeup to its original occurrence', () => {
    const gameRef = 'game-makeup'
    const originalDate = Schedule.ScheduleDate.make('2025-04-05')
    const makeupDate = Schedule.ScheduleDate.make('2025-04-06')
    const original = availableOccurrence(originalDate, gameRef, status('Postponed'))
    const makeup = Schedule.AvailableScheduleOccurrence.make({
      selectedDate: makeupDate,
      game: game(gameRef, status('Final')),
      rescheduledTo: Option.none(),
      rescheduledFrom: Option.some(originalDate),
    })

    expect(original.game.ref).toBe(makeup.game.ref)
    expect(makeup.game.status.state).toBe('Final')
    expect(Option.getOrThrow(makeup.rescheduledFrom)).toBe(original.selectedDate)
  })

  test.each([
    { state: 'Scheduled', active: false, scoreBearing: false, terminal: false },
    { state: 'Warmup', active: true, scoreBearing: false, terminal: false },
    { state: 'Active', active: true, scoreBearing: false, terminal: false },
    { state: 'Delayed', active: true, scoreBearing: false, terminal: false },
    { state: 'UnderReview', active: true, scoreBearing: false, terminal: false },
    { state: 'Suspended', active: false, scoreBearing: false, terminal: false },
    { state: 'Final', active: false, scoreBearing: true, terminal: true },
    { state: 'CompletedEarly', active: false, scoreBearing: true, terminal: true },
    { state: 'Tied', active: false, scoreBearing: true, terminal: true },
    { state: 'Forfeit', active: false, scoreBearing: true, terminal: true },
    { state: 'Postponed', active: false, scoreBearing: false, terminal: true },
    { state: 'Cancelled', active: false, scoreBearing: false, terminal: true },
    { state: 'Unknown', active: false, scoreBearing: false, terminal: false },
  ] as const)('classifies $state', (testCase) => {
    const gameStatus = status(testCase.state)

    expect({
      active: Status.isActivelyInProgress(gameStatus),
      scoreBearing: Status.isScoreBearing(gameStatus),
      terminal: Status.isTerminal(gameStatus),
    }).toEqual({
      active: testCase.active,
      scoreBearing: testCase.scoreBearing,
      terminal: testCase.terminal,
    })
  })

  test('continues polling a schedule with a non-terminal game', () => {
    const date = Schedule.ScheduleDate.make('2025-04-05')
    const schedule = Schedule.Schedule.make({
      date,
      occurrences: [availableOccurrence(date, 'game-scheduled', status('Scheduled'))],
    })

    expect(Schedule.hasNonTerminalGame(schedule)).toBe(true)
  })

  test('stops polling after terminal games despite unavailable occurrences', () => {
    const date = Schedule.ScheduleDate.make('2025-04-05')
    const schedule = Schedule.Schedule.make({
      date,
      occurrences: [
        availableOccurrence(date, 'game-final', status('Final')),
        Schedule.UnavailableScheduleOccurrence.make({
          selectedDate: date,
          message: 'Game data unavailable',
        }),
      ],
    })

    expect(Schedule.hasNonTerminalGame(schedule)).toBe(false)
  })
})
