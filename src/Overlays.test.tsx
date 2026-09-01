import { RegistryProvider, useAtomSet, useAtomValue } from '@effect/atom-react'
import { it } from '@effect/vitest'
import { KeyCodes } from '@opentui/core/testing'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider, useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useMemo } from 'react'
import { describe, expect } from 'vitest'

import { activeOverlayAtom, openOverlayAtom, Overlay, selectedDateAtom } from './AppState'
import { appCommandLayer, scheduleCommandLayer } from './CommandLayers'
import * as OpenTuiTest from './OpenTuiTest'
import { OverlayHost } from './Overlays'

const fixedDate = DateTime.makeZonedUnsafe({ year: 2025, month: 4, day: 4 }, { timeZone: 'UTC' })
const isoDateLength = 'YYYY-MM-DD'.length

const ScheduleHarness = ({ commands }: { commands: Array<string> }) => {
  const activeOverlay = useAtomValue(activeOverlayAtom)
  const date = useAtomValue(selectedDateAtom)
  const openOverlay = useAtomSet(openOverlayAtom)
  const commandsEnabled = Option.isNone(activeOverlay)

  useBindings(
    () => ({ ...appCommandLayer({ quit: () => commands.push('quit') }), enabled: commandsEnabled }),
    [commands, commandsEnabled],
  )
  useBindings(
    () => ({
      ...scheduleCommandLayer({
        previousDate: () => commands.push('previous-date'),
        nextDate: () => commands.push('next-date'),
        today: () => commands.push('today'),
        openGoToDate: () => openOverlay(Overlay.GoToDate()),
        previousOccurrence: () => commands.push('previous-occurrence'),
        nextOccurrence: () => commands.push('next-occurrence'),
        openSelectedGame: () => commands.push('open-game'),
        openHelp: () => openOverlay(Overlay.Help()),
      }),
      enabled: commandsEnabled,
    }),
    [commands, commandsEnabled, openOverlay],
  )

  return (
    <box width='100%' height='100%' position='relative'>
      <text>{`Selected date: ${DateTime.formatIsoDate(date)}`}</text>
      <OverlayHost activeOverlay={activeOverlay} />
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

const overlayHarness = Effect.gen(function* () {
  const commands: Array<string> = []
  const ui = yield* OpenTuiTest.make({
    node: (
      <RegistryProvider initialValues={[Atom.initialValue(selectedDateAtom, fixedDate)]}>
        <KeymapHarness commands={commands} />
      </RegistryProvider>
    ),
    options: { width: 120, height: 34, kittyKeyboard: true },
  })

  return { ui, commands }
})

const renderedOverlayHarness = overlayHarness.pipe(Effect.tap(({ ui }) => ui.renderOnce))

describe('overlay interactions', () => {
  it.effect('disables base commands until Help is dismissed', () =>
    Effect.gen(function* () {
      const harness = yield* renderedOverlayHarness

      yield* harness.ui.pressKey({ key: '?' })
      const helpFrame = yield* harness.ui.waitForFrame((frame) =>
        frame.includes('Available commands'),
      )

      expect(helpFrame).not.toContain('g schedule.go-to-date')
      expect(helpFrame).toContain('? overlay.dismiss')

      for (const key of ['q', 'p', KeyCodes.RETURN]) {
        yield* harness.ui.pressKey({ key })
      }
      yield* harness.ui.renderOnce

      const currentFrame = yield* harness.ui.captureCharFrame
      expect(currentFrame).toContain('Available commands')
      expect(harness.commands).toEqual([])

      yield* harness.ui.pressKey({ key: '?' })
      yield* harness.ui.waitForFrame((frame) => !frame.includes('Available commands'))
      yield* harness.ui.pressKey({ key: 'p' })

      expect(harness.commands).toEqual(['previous-date'])

      yield* harness.ui.pressKey({ key: '?' })
      yield* harness.ui.waitForFrame((frame) => frame.includes('Available commands'))
      yield* harness.ui.pressKey({ key: KeyCodes.ESCAPE })
      const escapedFrame = yield* harness.ui.waitForFrame(
        (frame) => !frame.includes('Available commands'),
      )

      expect(escapedFrame).toContain('Selected date: 2025-04-04')
      expect(harness.commands).toEqual(['previous-date'])
    }),
  )

  it.effect('edits and submits Go To Date without dispatching base commands', () =>
    Effect.gen(function* () {
      const harness = yield* renderedOverlayHarness

      yield* harness.ui.pressKey({ key: 'g' })
      yield* harness.ui.waitForFrame((frame) => frame.includes('Go to date'))

      yield* harness.ui.pressKey({ key: 'p' })
      const editedFrame = yield* harness.ui.waitForFrame((frame) => frame.includes('2025-04-04p'))

      expect(editedFrame).toContain('Go to date')
      expect(harness.commands).toEqual([])

      yield* harness.ui.pressKeys({
        keys: Array.from({ length: isoDateLength + 1 }, () => KeyCodes.BACKSPACE),
      })
      yield* harness.ui.typeText('2025-02-30')
      yield* harness.ui.pressKey({ key: KeyCodes.RETURN })
      const invalidFrame = yield* harness.ui.waitForFrame((frame) =>
        frame.includes('Enter a valid local calendar date.'),
      )

      expect(invalidFrame).toContain('Go to date')

      yield* harness.ui.pressKey({ key: KeyCodes.BACKSPACE })
      const correctedFrame = yield* harness.ui.waitForFrame(
        (frame) =>
          frame.includes('2025-02-3') && !frame.includes('Enter a valid local calendar date.'),
      )

      expect(correctedFrame).toContain('Go to date')

      yield* harness.ui.pressKeys({
        keys: Array.from({ length: isoDateLength - 1 }, () => KeyCodes.BACKSPACE),
      })
      yield* harness.ui.typeText('2025-04-05')
      yield* harness.ui.pressKey({ key: KeyCodes.RETURN })
      const scheduleFrame = yield* harness.ui.waitForFrame(
        (frame) => frame.includes('Selected date: 2025-04-05') && !frame.includes('Go to date'),
      )

      expect(scheduleFrame).toContain('Selected date: 2025-04-05')
      expect(harness.commands).toEqual([])

      yield* harness.ui.pressKey({ key: 'g' })
      yield* harness.ui.waitForFrame((frame) => frame.includes('Go to date'))
      yield* harness.ui.pressKey({ key: KeyCodes.ESCAPE })
      const escapedFrame = yield* harness.ui.waitForFrame(
        (frame) => frame.includes('Selected date: 2025-04-05') && !frame.includes('Go to date'),
      )

      expect(escapedFrame).toContain('Selected date: 2025-04-05')
      expect(harness.commands).toEqual([])
    }),
  )
})
