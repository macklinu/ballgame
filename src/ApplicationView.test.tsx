import { RegistryProvider } from '@effect/atom-react'
import { it } from '@effect/vitest'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import * as Cause from 'effect/Cause'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useMemo } from 'react'
import { expect } from 'vitest'

import { App } from './ApplicationView'
import { selectedDateAtom } from './AppState'
import * as OpenTuiTest from './OpenTuiTest'
import * as ScheduleResource from './ScheduleResource'

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

it.effect('renders command hint titles', () =>
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
    const frame = yield* ui.waitForFrame((value) => value.includes('Go to date'))

    expect(frame).toContain('↑ Prev game')
    expect(frame).toContain('↓ Next game')

    expect(frame).toContain('v Open MLB.TV')
    for (const title of [
      'Prev date',
      'Next date',
      'Today',
      'Go to date',
      'Prev game',
      'Next game',
      'Open',
      'Open MLB.TV',
      'Help',
      'Quit',
    ]) {
      expect(frame).toContain(title)
    }
  }),
)
