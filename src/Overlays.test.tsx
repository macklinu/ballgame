import { RegistryProvider, useAtomSet, useAtomValue } from '@effect/atom-react'
import { it as effectIt } from '@effect/vitest'
import { createTestRenderer, type TestRendererSetup } from '@opentui/core/testing'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider, useBindings } from '@opentui/keymap/react'
import { createRoot, type Root } from '@opentui/react'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect } from 'vitest'

import { openOverlayAtom, Overlay, selectedDateAtom } from './AppState'
import { scheduleCommandLayer } from './CommandLayers'
import { OverlayHost } from './Overlays'

interface RenderedOverlayHarness {
  readonly renderer: TestRendererSetup
  readonly root: Root
  readonly commands: Array<string>
}

const fixedDate = DateTime.makeZonedUnsafe({ year: 2025, month: 4, day: 4 }, { timeZone: 'UTC' })

const ScheduleHarness = ({ commands }: { commands: Array<string> }) => {
  const date = useAtomValue(selectedDateAtom)
  const openOverlay = useAtomSet(openOverlayAtom)

  useBindings(
    () =>
      scheduleCommandLayer({
        previousDate: () => commands.push('previous-date'),
        nextDate: () => commands.push('next-date'),
        today: () => commands.push('today'),
        openGoToDate: () => openOverlay(Overlay.GoToDate()),
        previousOccurrence: () => commands.push('previous-occurrence'),
        nextOccurrence: () => commands.push('next-occurrence'),
        openSelectedGame: () => commands.push('open-game'),
        openHelp: () => openOverlay(Overlay.Help()),
      }),
    [commands, openOverlay],
  )

  return (
    <box width='100%' height='100%' position='relative'>
      <text>{`Selected date: ${DateTime.formatIsoDate(date)}`}</text>
      <OverlayHost />
    </box>
  )
}

const harnesses: Array<RenderedOverlayHarness> = []

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  })
})

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    act(() => harness.root.unmount())
    harness.renderer.renderer.destroy()
  }
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
})

const renderOverlayHarness = () =>
  Effect.tryPromise(() => createTestRenderer({ width: 120, height: 34 })).pipe(
    Effect.map((renderer) => {
      const keymap = createDefaultOpenTuiKeymap(renderer.renderer)
      const root = createRoot(renderer.renderer)
      const commands: Array<string> = []

      act(() => {
        root.render(
          <RegistryProvider initialValues={[Atom.initialValue(selectedDateAtom, fixedDate)]}>
            <KeymapProvider keymap={keymap}>
              <ScheduleHarness commands={commands} />
            </KeymapProvider>
          </RegistryProvider>,
        )
      })

      const harness = { renderer, root, commands }
      harnesses.push(harness)
      return harness
    }),
    Effect.tap((harness) => Effect.tryPromise(() => harness.renderer.renderOnce())),
  )

const actSync = (run: () => void) =>
  Effect.sync(() => {
    act(run)
  })

const actPromise = <A,>(run: () => Promise<A>) => Effect.tryPromise(() => act(run))

const waitForFrame = (harness: RenderedOverlayHarness, predicate: (frame: string) => boolean) =>
  Effect.tryPromise(() => harness.renderer.waitForFrame(predicate))

const clearDateInput = (renderer: TestRendererSetup, length: number) => {
  for (let index = 0; index < length; index += 1) {
    renderer.mockInput.pressBackspace()
  }
}

describe('overlay interactions', () => {
  effectIt.effect('derives Help shortcuts from active layers and lets Help own ?', () =>
    Effect.gen(function* () {
      const harness = yield* renderOverlayHarness()

      yield* actSync(() => harness.renderer.mockInput.pressKey('?'))
      const helpFrame = yield* waitForFrame(harness, (frame) =>
        frame.includes('Available commands'),
      )

      expect(helpFrame).toContain('g schedule.go-to-date')
      expect(helpFrame).toContain('? overlay.close-help')

      yield* actSync(() => harness.renderer.mockInput.pressKey('?'))
      const scheduleFrame = yield* waitForFrame(
        harness,
        (frame) => !frame.includes('Available commands'),
      )

      expect(scheduleFrame).toContain('Selected date: 2025-04-04')
      expect(harness.commands).toEqual([])
    }),
  )

  effectIt.effect(
    'validates Go To Date input while keeping underlying schedule commands inactive',
    () =>
      Effect.gen(function* () {
        const harness = yield* renderOverlayHarness()

        yield* actSync(() => harness.renderer.mockInput.pressKey('g'))
        yield* waitForFrame(harness, (frame) => frame.includes('Go to date'))

        yield* actSync(() => {
          for (const key of ['p', 'n', 't', 'q', '?']) {
            harness.renderer.mockInput.pressKey(key)
          }
        })
        yield* Effect.tryPromise(() => harness.renderer.renderOnce())

        expect(harness.renderer.captureCharFrame()).toContain('Go to date')
        expect(harness.renderer.captureCharFrame()).not.toContain('Available commands')
        expect(harness.commands).toEqual([])

        yield* actPromise(() => {
          clearDateInput(harness.renderer, 15)
          return harness.renderer.mockInput.typeText('2025-02-30')
        })
        yield* waitForFrame(harness, (frame) => frame.includes('2025-02-30'))
        yield* actSync(() => harness.renderer.mockInput.pressEnter())
        const invalidFrame = yield* waitForFrame(harness, (frame) =>
          frame.includes('Enter a valid local calendar date.'),
        )

        expect(invalidFrame).toContain('Go to date')

        yield* actPromise(() => {
          clearDateInput(harness.renderer, 10)
          return harness.renderer.mockInput.typeText('2025-04-05')
        })
        yield* waitForFrame(harness, (frame) => frame.includes('2025-04-05'))
        yield* actSync(() => harness.renderer.mockInput.pressEnter())
        const scheduleFrame = yield* waitForFrame(
          harness,
          (frame) => frame.includes('Selected date: 2025-04-05') && !frame.includes('Go to date'),
        )

        expect(scheduleFrame).toContain('Selected date: 2025-04-05')

        yield* actSync(() => harness.renderer.mockInput.pressKey('p'))
        expect(harness.commands).toEqual(['previous-date'])
      }),
  )
})
