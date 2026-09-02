import { RegistryProvider } from '@effect/atom-react'
import { it } from '@effect/vitest'
import { KeyCodes } from '@opentui/core/testing'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import * as Cause from 'effect/Cause'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useMemo } from 'react'
import { expect } from 'vitest'

import { App } from './ApplicationView'
import { selectedDateAtom } from './AppState'
import * as Game from './Game'
import { gameOverviewAtom } from './GameOverviewResource'
import * as OpenTuiTest from './OpenTuiTest'
import * as Schedule from './Schedule'
import * as ScheduleResource from './ScheduleResource'
import * as Status from './Status'
import * as Team from './Team'
const fixedDate = DateTime.makeZonedUnsafe({ year: 2025, month: 4, day: 4 }, { timeZone: 'UTC' })
const defectMessage = 'unexpected schedule stream defect'

const ApplicationHarness = () => {
  const renderer = useRenderer()
  const keymap = useMemo(() => createDefaultOpenTuiKeymap(renderer), [renderer])

  return (
    <KeymapProvider keymap={keymap}>
      <App onQuit={() => undefined} />
    </KeymapProvider>
  )
}

const failureResult = AsyncResult.failure<ScheduleResource.ScheduleRefresh>(
  Cause.die(defectMessage),
)

const boardDate = DateTime.makeZonedUnsafe({ year: 2025, month: 4, day: 5 }, { timeZone: 'UTC' })
const scheduleDate = Schedule.ScheduleDate.make('2025-04-05')
const scheduledStart = Schema.decodeSync(Schema.DateTimeUtcFromString)('2025-04-05T20:10:00Z')
const scheduledGame = Game.Game.make({
  ref: Game.GameRef.make('scheduled-game'),
  type: 'RegularSeason',
  startsAt: scheduledStart,
  awayTeam: Team.Team.make({
    ref: Team.TeamRef.make('away-team'),
    name: 'Away Club',
    abbreviation: 'AWY',
    shortName: 'Away',
  }),
  homeTeam: Team.Team.make({
    ref: Team.TeamRef.make('home-team'),
    name: 'Home Club',
    abbreviation: 'HME',
    shortName: 'Home',
  }),
  status: Status.GameStatus.make({
    state: 'Scheduled',
    label: 'Scheduled',
    reason: Option.none(),
  }),
  score: Option.none(),
})
const scheduledOccurrence = Schedule.AvailableScheduleOccurrence.make({
  selectedDate: scheduleDate,
  game: scheduledGame,
  rescheduledTo: Option.none(),
  rescheduledFrom: Option.none(),
})
const scheduledOverview = Game.GameOverview.make({
  game: scheduledGame,
  linescore: Option.none(),
  probablePitchers: Game.ProbablePitchers.make({ away: Option.none(), home: Option.none() }),
  lineups: Option.none(),
  boxscore: Option.none(),
})

it.effect('renders a generic fallback for an unexpected schedule stream defect', () =>
  Effect.gen(function* () {
    const ui = yield* OpenTuiTest.make({
      node: (
        <RegistryProvider
          initialValues={[
            Atom.initialValue(selectedDateAtom, fixedDate),
            Atom.initialValue(ScheduleResource.scheduleForDateAtom(fixedDate), failureResult),
          ]}
        >
          <ApplicationHarness />
        </RegistryProvider>
      ),
      options: { width: 120, height: 34, kittyKeyboard: true },
    })

    yield* ui.renderOnce
    const frame = yield* ui.waitForFrame((value) => value.includes('Unable to load schedule.'))

    expect(frame).toContain('Unable to load schedule.')
    expect(frame).not.toContain(defectMessage)
  }),
)

it.effect('opens the selected date-specific occurrence in game details', () =>
  Effect.gen(function* () {
    const schedule = Schedule.Schedule.make({
      date: scheduleDate,
      occurrences: [scheduledOccurrence],
    })
    const refresh = ScheduleResource.ReadySchedule.make({
      snapshot: ScheduleResource.ScheduleSnapshot.make({ schedule, refreshedAt: scheduledStart }),
    })
    const ui = yield* OpenTuiTest.make({
      node: (
        <RegistryProvider
          initialValues={[
            Atom.initialValue(selectedDateAtom, boardDate),
            Atom.initialValue(
              ScheduleResource.scheduleForDateAtom(boardDate),
              AsyncResult.success(refresh),
            ),
            Atom.initialValue(
              gameOverviewAtom(scheduledGame.ref),
              AsyncResult.success(scheduledOverview),
            ),
          ]}
        >
          <ApplicationHarness />
        </RegistryProvider>
      ),
      options: { width: 120, height: 40, kittyKeyboard: true },
    })

    yield* ui.renderOnce
    yield* ui.waitForFrame((frame) => frame.includes('▶ ○'))
    yield* ui.pressKey({ key: KeyCodes.RETURN })

    const frame = yield* ui.waitForFrame((value) => value.includes('Selected schedule: 2025-04-05'))
    expect(frame).toContain('Away Club at Home Club')
    expect(frame).toContain('Selected schedule: 2025-04-05')
  }),
)
