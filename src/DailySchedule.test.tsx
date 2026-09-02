import { RegistryProvider } from '@effect/atom-react'
import { it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { describe, expect } from 'vitest'

import { DailyGameView } from './ApplicationView'
import { selectedOccurrenceAtom } from './AppState'
import {
  activeProgress,
  availableOccurrence,
  extraInningProgress,
  makeFixtureGame,
  selectedDate,
} from './DailyScheduleTest'
import * as OpenTuiTest from './OpenTuiTest'
import * as Schedule from './Schedule'

describe('compact daily schedule', () => {
  it.effect('keeps game rows in schedule order', () =>
    Effect.gen(function* () {
      const active = availableOccurrence(
        makeFixtureGame({
          ref: 'active',
          state: 'Active',
          away: 'KC',
          home: 'DET',
          score: { away: 3, home: 2 },
          progress: activeProgress,
        }),
      )
      const final = availableOccurrence(
        makeFixtureGame({
          ref: 'final',
          state: 'Final',
          away: 'NYM',
          home: 'TB',
          score: { away: 5, home: 4 },
          progress: extraInningProgress,
        }),
      )
      const scheduled = availableOccurrence(
        makeFixtureGame({ ref: 'scheduled', state: 'Scheduled', away: 'TOR', home: 'CLE' }),
      )
      const postponed = availableOccurrence(
        makeFixtureGame({ ref: 'postponed', state: 'Postponed', away: 'ATL', home: 'WSH' }),
      )
      const schedule = Schedule.Schedule.make({
        date: selectedDate,
        occurrences: [active, final, scheduled, postponed],
      })
      const ui = yield* OpenTuiTest.make({
        node: (
          <RegistryProvider
            initialValues={[
              Atom.initialValue(
                selectedOccurrenceAtom,
                Option.some({ selectedDate, gameRef: active.game.ref }),
              ),
            ]}
          >
            <DailyGameView schedule={schedule} onOpenOccurrence={() => undefined} />
          </RegistryProvider>
        ),
        options: { width: 80, height: 24 },
      })

      yield* ui.renderOnce
      const rows = (yield* ui.captureCharFrame)
        .split('\n')
        .filter((line) => ['KC', 'NYM', 'TOR', 'ATL'].some((team) => line.includes(team)))

      expect(rows).toHaveLength(4)
      expect(
        rows.map((row) => ['KC', 'NYM', 'TOR', 'ATL'].find((team) => row.includes(team))),
      ).toEqual(['KC', 'NYM', 'TOR', 'ATL'])
    }),
  )

  it.effect('renders a selected active game with score, inning, and outs', () =>
    Effect.gen(function* () {
      const active = availableOccurrence(
        makeFixtureGame({
          ref: 'active',
          state: 'Active',
          away: 'KC',
          home: 'DET',
          score: { away: 3, home: 2 },
          progress: activeProgress,
        }),
      )
      const schedule = Schedule.Schedule.make({ date: selectedDate, occurrences: [active] })
      const ui = yield* OpenTuiTest.make({
        node: (
          <RegistryProvider
            initialValues={[
              Atom.initialValue(
                selectedOccurrenceAtom,
                Option.some({ selectedDate, gameRef: active.game.ref }),
              ),
            ]}
          >
            <DailyGameView schedule={schedule} onOpenOccurrence={() => undefined} />
          </RegistryProvider>
        ),
        options: { width: 80, height: 24 },
      })

      yield* ui.renderOnce
      const frame = yield* ui.captureCharFrame

      expect(frame).toContain('> KC  3  @ DET 2')
      expect(frame).toContain('B7  1 out <')
    }),
  )

  it.effect('renders unavailable game data explicitly', () =>
    Effect.gen(function* () {
      const schedule = Schedule.Schedule.make({
        date: selectedDate,
        occurrences: [
          Schedule.UnavailableScheduleOccurrence.make({
            selectedDate,
            message: 'Game data unavailable',
            diagnostic: new Schedule.ScheduleOccurrenceDiagnostic({
              message: 'Malformed game data',
            }),
          }),
        ],
      })
      const ui = yield* OpenTuiTest.make({
        node: (
          <RegistryProvider
            initialValues={[Atom.initialValue(selectedOccurrenceAtom, Option.none())]}
          >
            <DailyGameView schedule={schedule} onOpenOccurrence={() => undefined} />
          </RegistryProvider>
        ),
        options: { width: 80, height: 24 },
      })

      yield* ui.renderOnce
      const frame = yield* ui.captureCharFrame

      expect(frame).toContain('Game data unavailable')
      expect(frame).toContain('Unavailable')
    }),
  )

  it.effect('renders the no-games state', () =>
    Effect.gen(function* () {
      const schedule = Schedule.Schedule.make({ date: selectedDate, occurrences: [] })
      const ui = yield* OpenTuiTest.make({
        node: (
          <RegistryProvider
            initialValues={[Atom.initialValue(selectedOccurrenceAtom, Option.none())]}
          >
            <DailyGameView schedule={schedule} onOpenOccurrence={() => undefined} />
          </RegistryProvider>
        ),
        options: { width: 80, height: 24 },
      })

      yield* ui.renderOnce
      expect(yield* ui.captureCharFrame).toContain('No games today.')
    }),
  )
})
