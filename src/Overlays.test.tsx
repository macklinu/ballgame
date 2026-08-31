import { RegistryProvider, useAtomSet, useAtomValue } from '@effect/atom-react'
import { it } from '@effect/vitest'
import type { TestRendererSetup } from '@opentui/core/testing'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider, useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { testRender } from '@opentui/react/test-utils'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { act, useMemo } from 'react'
import { describe, expect } from 'vitest'

import { openOverlayAtom, Overlay, selectedDateAtom } from './AppState'
import { appCommandLayer, scheduleCommandLayer } from './CommandLayers'
import { OverlayHost } from './Overlays'

const fixedDate = DateTime.makeZonedUnsafe({ year: 2025, month: 4, day: 4 }, { timeZone: 'UTC' })
const isoDateLength = 'YYYY-MM-DD'.length
const helpBlockedShortcutKeys = ['q', 'p', 'n', 't', 'g', 'left', 'right', 'return'] as const
const dateInputEditingKeys = ['q', 'p', 'n', 't', 'g', '?', 'left', 'right'] as const

const ScheduleHarness = ({ commands }: { commands: Array<string> }) => {
  const date = useAtomValue(selectedDateAtom)
  const openOverlay = useAtomSet(openOverlayAtom)

  useBindings(() => appCommandLayer({ quit: () => commands.push('quit') }), [commands])
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

const KeymapHarness = ({ commands }: { commands: Array<string> }) => {
  const renderer = useRenderer()
  const keymap = useMemo(() => createDefaultOpenTuiKeymap(renderer), [renderer])

  return (
    <KeymapProvider keymap={keymap}>
      <ScheduleHarness commands={commands} />
    </KeymapProvider>
  )
}

const overlayHarness = Effect.acquireRelease(
  Effect.gen(function* () {
    const commands: Array<string> = []
    const renderer = yield* Effect.tryPromise(() =>
      testRender(
        <RegistryProvider initialValues={[Atom.initialValue(selectedDateAtom, fixedDate)]}>
          <KeymapHarness commands={commands} />
        </RegistryProvider>,
        { width: 120, height: 34, kittyKeyboard: true },
      ),
    )

    return { renderer, commands }
  }),
  (harness) =>
    Effect.sync(() => {
      harness.renderer.renderer.destroy()
    }),
)

const renderedOverlayHarness = overlayHarness.pipe(
  Effect.tap((harness) => Effect.tryPromise(() => harness.renderer.renderOnce())),
)

const clearDateInput = (renderer: TestRendererSetup, length: number) => {
  for (let index = 0; index < length; index += 1) {
    renderer.mockInput.pressBackspace()
  }
}

const pressShortcut = (renderer: TestRendererSetup, key: string) =>
  act(() => {
    if (key === 'escape') {
      renderer.mockInput.pressEscape()
      return
    }

    if (key === 'return') {
      renderer.mockInput.pressEnter()
      return
    }

    if (key === 'left' || key === 'right') {
      renderer.mockInput.pressArrow(key)
      return
    }

    renderer.mockInput.pressKey(key)
  })

describe('overlay interactions', () => {
  it.effect('makes Help modal and allows only its explicit close keys', () =>
    Effect.gen(function* () {
      const harness = yield* renderedOverlayHarness

      yield* Effect.sync(() => pressShortcut(harness.renderer, '?'))
      const helpFrame = yield* Effect.tryPromise(() =>
        harness.renderer.waitForFrame((frame) => frame.includes('Available commands')),
      )

      expect(helpFrame).not.toContain('g schedule.go-to-date')
      expect(helpFrame).toContain('? overlay.close')

      for (const key of helpBlockedShortcutKeys) {
        yield* Effect.sync(() => pressShortcut(harness.renderer, key))
      }
      yield* Effect.tryPromise(() => harness.renderer.renderOnce())

      expect(harness.renderer.captureCharFrame()).toContain('Available commands')
      expect(harness.commands).toEqual([])

      yield* Effect.sync(() => pressShortcut(harness.renderer, '?'))
      const scheduleFrame = yield* Effect.tryPromise(() =>
        harness.renderer.waitForFrame((frame) => !frame.includes('Available commands')),
      )

      expect(scheduleFrame).toContain('Selected date: 2025-04-04')
      expect(harness.commands).toEqual([])

      yield* Effect.sync(() => pressShortcut(harness.renderer, '?'))
      yield* Effect.tryPromise(() =>
        harness.renderer.waitForFrame((frame) => frame.includes('Available commands')),
      )
      yield* Effect.sync(() => pressShortcut(harness.renderer, 'escape'))
      const escapedFrame = yield* Effect.tryPromise(() =>
        harness.renderer.waitForFrame((frame) => !frame.includes('Available commands')),
      )

      expect(escapedFrame).toContain('Selected date: 2025-04-04')
      expect(harness.commands).toEqual([])
    }),
  )

  it.effect(
    'makes Go To Date modal while preserving local editing, submit, and close behavior',
    () =>
      Effect.gen(function* () {
        const harness = yield* renderedOverlayHarness

        yield* Effect.sync(() => pressShortcut(harness.renderer, 'g'))
        yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame((frame) => frame.includes('Go to date')),
        )

        for (const key of dateInputEditingKeys) {
          yield* Effect.sync(() => pressShortcut(harness.renderer, key))
        }
        yield* Effect.tryPromise(() => harness.renderer.renderOnce())

        expect(harness.renderer.captureCharFrame()).toContain('Go to date')
        expect(harness.renderer.captureCharFrame()).not.toContain('Available commands')
        expect(harness.commands).toEqual([])

        yield* Effect.tryPromise(() => {
          return act(() => {
            clearDateInput(harness.renderer, isoDateLength + dateInputEditingKeys.length)
            return harness.renderer.mockInput.typeText('2025-02-30')
          })
        })
        yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame((frame) => frame.includes('2025-02-30')),
        )
        yield* Effect.sync(() => pressShortcut(harness.renderer, 'return'))
        const invalidFrame = yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame((frame) =>
            frame.includes('Enter a valid local calendar date.'),
          ),
        )

        expect(invalidFrame).toContain('Go to date')

        yield* Effect.tryPromise(() => {
          return act(() => {
            clearDateInput(harness.renderer, isoDateLength)
            return harness.renderer.mockInput.typeText('2025-04-05')
          })
        })
        const correctedFrame = yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame(
            (frame) =>
              frame.includes('2025-04-05') && !frame.includes('Enter a valid local calendar date.'),
          ),
        )

        expect(correctedFrame).toContain('Go to date')

        yield* Effect.sync(() => pressShortcut(harness.renderer, 'return'))
        const scheduleFrame = yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame(
            (frame) => frame.includes('Selected date: 2025-04-05') && !frame.includes('Go to date'),
          ),
        )

        expect(scheduleFrame).toContain('Selected date: 2025-04-05')
        expect(harness.commands).toEqual([])

        yield* Effect.sync(() => pressShortcut(harness.renderer, 'g'))
        yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame((frame) => frame.includes('Go to date')),
        )
        yield* Effect.sync(() => pressShortcut(harness.renderer, 'escape'))
        const escapedFrame = yield* Effect.tryPromise(() =>
          harness.renderer.waitForFrame(
            (frame) => frame.includes('Selected date: 2025-04-05') && !frame.includes('Go to date'),
          ),
        )

        expect(escapedFrame).toContain('Selected date: 2025-04-05')
        expect(harness.commands).toEqual([])

        yield* Effect.sync(() => pressShortcut(harness.renderer, 'p'))
        expect(harness.commands).toEqual(['previous-date'])
      }),
  )
})
