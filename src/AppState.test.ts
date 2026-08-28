import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'
import { afterEach, describe, expect, test } from 'vitest'

import {
  moveSelection,
  openSelectedGameAtom,
  routeStackAtom,
  selectOccurrenceAtom,
  selectedOccurrenceAtom,
  synchronizeSelectionAtom,
} from './AppState'
import * as Game from './Game'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

const parseUtcDateTime = (value: string) => Schema.decodeSync(Schema.DateTimeUtcFromString)(value)

const team = (ref: string, name: string): Team.Team =>
  Team.Team.make({
    ref: Team.TeamRef.make(ref),
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    shortName: name,
  })

const occurrence = (
  selectedDate: Schedule.ScheduleDate,
  ref: string,
): Schedule.AvailableScheduleOccurrence =>
  Schedule.AvailableScheduleOccurrence.make({
    selectedDate,
    game: Game.Game.make({
      ref: Game.GameRef.make(ref),
      type: 'RegularSeason',
      startsAt: parseUtcDateTime('2025-04-05T20:10:00Z'),
      awayTeam: team(`away-${ref}`, 'Away'),
      homeTeam: team(`home-${ref}`, 'Home'),
      status: Status.GameStatus.make({
        state: 'Scheduled',
        label: 'Scheduled',
        reason: Option.none(),
      }),
      score: Option.none(),
    }),
    rescheduledTo: Option.none(),
    rescheduledFrom: Option.none(),
  })

describe('application route and occurrence state', () => {
  const registries: Array<AtomRegistry.AtomRegistry> = []

  afterEach(() => {
    for (const registry of registries.splice(0)) {
      registry.dispose()
    }
  })

  const registry = () => {
    const value = AtomRegistry.make()
    registries.push(value)
    return value
  }

  test('moves and opens a selected occurrence without storing an array index', () => {
    const date = Schedule.ScheduleDate.make('2025-04-05')
    const slate = Schedule.Schedule.make({
      date,
      occurrences: [occurrence(date, 'game-1'), occurrence(date, 'game-2')],
    })
    const state = registry()

    state.set(synchronizeSelectionAtom, slate)
    expect(Option.getOrThrow(state.get(selectedOccurrenceAtom))).toEqual({
      selectedDate: date,
      gameRef: Game.GameRef.make('game-1'),
    })

    state.set(synchronizeSelectionAtom, slate)
    state.set(selectOccurrenceAtom, occurrence(date, 'game-2'))
    state.set(openSelectedGameAtom, undefined)

    expect(state.get(routeStackAtom)).toEqual([
      { _tag: 'Schedule' },
      {
        _tag: 'GameDetails',
        occurrence: { selectedDate: date, gameRef: Game.GameRef.make('game-2') },
      },
    ])
  })

  test('treats a postponed occurrence and its makeup as distinct selections', () => {
    const originalDate = Schedule.ScheduleDate.make('2025-04-05')
    const makeupDate = Schedule.ScheduleDate.make('2025-04-06')
    const original = occurrence(originalDate, 'game-makeup')
    const makeup = occurrence(makeupDate, 'game-makeup')
    const state = registry()

    state.set(selectOccurrenceAtom, original)
    state.set(
      synchronizeSelectionAtom,
      Schedule.Schedule.make({ date: makeupDate, occurrences: [makeup] }),
    )

    expect(Option.getOrThrow(state.get(selectedOccurrenceAtom))).toEqual({
      selectedDate: makeupDate,
      gameRef: Game.GameRef.make('game-makeup'),
    })
  })

  test('moves between schedule occurrences while preserving their typed identity', () => {
    const date = Schedule.ScheduleDate.make('2025-04-05')
    const first = occurrence(date, 'game-1')
    const second = occurrence(date, 'game-2')
    const slate = Schedule.Schedule.make({ date, occurrences: [first, second] })

    expect(
      moveSelection(slate, Option.some({ selectedDate: date, gameRef: first.game.ref }), 'next'),
    ).toEqual(Option.some({ selectedDate: date, gameRef: second.game.ref }))
    expect(
      moveSelection(
        slate,
        Option.some({ selectedDate: date, gameRef: second.game.ref }),
        'previous',
      ),
    ).toEqual(Option.some({ selectedDate: date, gameRef: first.game.ref }))
  })
})
