import { RegistryProvider } from '@effect/atom-react'
import { it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { describe, expect, test } from 'vitest'

import { DailyGameView } from './ApplicationView'
import { selectedOccurrenceAtom } from './AppState'
import { gameStateText } from './DailyScheduleRow'
import * as Game from './Game'
import * as OpenTuiTest from './OpenTuiTest'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

const startsAt = Schema.decodeSync(Schema.DateTimeUtcFromString)('2025-04-05T19:10:00Z')
const selectedDate = Schedule.ScheduleDate.make('2025-04-05')

const fixtureGame = ({
  ref,
  state,
  away,
  home,
  score,
  progress,
}: {
  readonly ref: string
  readonly state: Status.GameState
  readonly away: string
  readonly home: string
  readonly score?: { readonly away: number; readonly home: number }
  readonly progress?: Game.GameProgress
}): Game.Game =>
  Game.Game.make({
    ref: Game.GameRef.make(ref),
    type: 'RegularSeason',
    startsAt,
    awayTeam: Team.Team.make({
      ref: Team.TeamRef.make(`away-${ref}`),
      name: `${away} Club`,
      abbreviation: away,
      shortName: away,
    }),
    homeTeam: Team.Team.make({
      ref: Team.TeamRef.make(`home-${ref}`),
      name: `${home} Club`,
      abbreviation: home,
      shortName: home,
    }),
    status: Status.GameStatus.make({ state, label: state, reason: Option.none() }),
    score: score === undefined ? Option.none() : Option.some(Game.Score.make(score)),
    progress: progress === undefined ? Option.none() : Option.some(progress),
  })

const availableOccurrence = (game: Game.Game): Schedule.AvailableScheduleOccurrence =>
  Schedule.AvailableScheduleOccurrence.make({
    selectedDate,
    game,
    rescheduledTo: Option.none(),
    rescheduledFrom: Option.none(),
  })

const activeProgress = Game.GameProgress.make({
  scheduledInnings: Option.some(9),
  currentInning: Option.some(7),
  inningHalf: Option.some('Bottom'),
  outs: Option.some(1),
})

const extraInningProgress = Game.GameProgress.make({
  scheduledInnings: Option.some(9),
  currentInning: Option.some(10),
  inningHalf: Option.some('Bottom'),
  outs: Option.none(),
})

describe('compact daily schedule', () => {
  test('renders scheduled start time instead of a status label', () => {
    const scheduled = fixtureGame({
      ref: 'scheduled',
      state: 'Scheduled',
      away: 'TOR',
      home: 'CLE',
    })

    expect(gameStateText(scheduled)).toMatch(/^\d{1,2}:\d{2}(?:\s?[AP]M)?$/)
  })

  test.each([
    {
      name: 'active game with a known score and outs',
      game: fixtureGame({
        ref: 'active',
        state: 'Active',
        away: 'KC',
        home: 'DET',
        score: { away: 3, home: 2 },
        progress: activeProgress,
      }),
      state: 'B7  1 out',
    },
    {
      name: 'extra-inning final',
      game: fixtureGame({
        ref: 'final',
        state: 'Final',
        away: 'NYM',
        home: 'TB',
        score: { away: 5, home: 4 },
        progress: extraInningProgress,
      }),
      state: 'F/10',
    },
    {
      name: 'delayed game',
      game: fixtureGame({ ref: 'delayed', state: 'Delayed', away: 'BOS', home: 'NYY' }),
      state: 'Delayed',
    },
    {
      name: 'postponed game',
      game: fixtureGame({ ref: 'postponed', state: 'Postponed', away: 'ATL', home: 'WSH' }),
      state: 'PPD',
    },
    {
      name: 'suspended game',
      game: fixtureGame({ ref: 'suspended', state: 'Suspended', away: 'CHC', home: 'STL' }),
      state: 'Suspended',
    },
    {
      name: 'cancelled game',
      game: fixtureGame({ ref: 'cancelled', state: 'Cancelled', away: 'OAK', home: 'LAA' }),
      state: 'Cancelled',
    },
  ] as const)('renders compact truthful state for $name', ({ game, state }) => {
    expect(gameStateText(game)).toBe(state)
  })

  it.effect('keeps ordered one-line rows with text-only selection and unavailable data', () =>
    Effect.gen(function* () {
      const active = availableOccurrence(
        fixtureGame({
          ref: 'active',
          state: 'Active',
          away: 'KC',
          home: 'DET',
          score: { away: 3, home: 2 },
          progress: activeProgress,
        }),
      )
      const final = availableOccurrence(
        fixtureGame({
          ref: 'final',
          state: 'Final',
          away: 'NYM',
          home: 'TB',
          score: { away: 5, home: 4 },
          progress: extraInningProgress,
        }),
      )
      const scheduled = availableOccurrence(
        fixtureGame({ ref: 'scheduled', state: 'Scheduled', away: 'TOR', home: 'CLE' }),
      )
      const postponed = availableOccurrence(
        fixtureGame({ ref: 'postponed', state: 'Postponed', away: 'ATL', home: 'WSH' }),
      )
      const schedule = Schedule.Schedule.make({
        date: selectedDate,
        occurrences: [
          active,
          final,
          scheduled,
          postponed,
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
      const orderedTeams = ['KC', 'NYM', 'TOR', 'ATL']
      const rows = frame
        .split('\n')
        .filter((line) => orderedTeams.some((team) => line.includes(team)))

      expect(rows).toHaveLength(4)
      expect(rows.map((row) => orderedTeams.find((team) => row.includes(team)))).toEqual(
        orderedTeams,
      )
      expect(frame).toContain('> KC  3  @ DET 2')
      expect(frame).toContain('B7  1 out <')
      expect(frame).not.toContain('LIVE')
      expect(frame).toContain('NYM 5  @ TB  4')
      expect(frame).toContain('F/10')
      expect(frame).toContain('TOR    @ CLE')
      expect(frame).toContain('PPD')
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
