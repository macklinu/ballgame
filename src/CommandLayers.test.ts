import { createTestKeymap } from '@opentui/keymap/testing'
import { afterEach, describe, expect, test } from 'vitest'

import { Overlay } from './AppState'
import {
  appCommandLayer,
  detailCommandLayer,
  focusedDateInputCommandLayer,
  overlayCommandLayer,
  scheduleCommandLayer,
} from './CommandLayers'

describe('contextual command layers', () => {
  const harnesses: Array<ReturnType<typeof createTestKeymap>> = []

  afterEach(() => {
    for (const harness of harnesses.splice(0)) {
      harness.cleanup()
    }
  })

  const harness = () => {
    const value = createTestKeymap({ defaultKeys: true })
    harnesses.push(value)
    return value
  }

  test('makes Help modal while allowing only its explicit close keys', () => {
    const keymap = harness()
    const calls: Array<string> = []

    keymap.keymap.registerLayer(appCommandLayer({ quit: () => calls.push('quit') }))
    keymap.keymap.registerLayer(
      scheduleCommandLayer({
        previousDate: () => calls.push('previous-date'),
        nextDate: () => calls.push('next-date'),
        today: () => calls.push('today'),
        openGoToDate: () => calls.push('go-to-date'),
        previousOccurrence: () => calls.push('previous-occurrence'),
        nextOccurrence: () => calls.push('next-occurrence'),
        openSelectedGame: () => calls.push('open-game'),
        openHelp: () => calls.push('schedule-help'),
      }),
    )
    keymap.keymap.registerLayer(
      detailCommandLayer({
        back: () => calls.push('back'),
        openHelp: () => calls.push('detail-help'),
      }),
    )
    keymap.keymap.registerLayer(
      overlayCommandLayer({
        overlay: Overlay.Help(),
        handlers: { close: () => calls.push('close-overlay') },
      }),
    )

    const capturedEvents = ['q', 'p', 'n', 't', 'g', 'left', 'right', 'return'].map((key) =>
      keymap.host.press(key),
    )

    expect(calls).toEqual([])
    expect(capturedEvents.every((event) => event.defaultPrevented)).toBe(true)

    keymap.host.press('escape')
    keymap.host.press('?')

    expect(calls).toEqual(['close-overlay', 'close-overlay'])
    expect(keymap.diagnostics.takeErrors().errors).toEqual([])
  })

  test('lets the focused date input edit, submit, and close without lower commands', () => {
    const keymap = harness()
    const calls: Array<string> = []
    const input = keymap.host.createTarget('date-input')
    keymap.root.append(input)

    keymap.keymap.registerLayer(appCommandLayer({ quit: () => calls.push('quit') }))
    keymap.keymap.registerLayer(
      scheduleCommandLayer({
        previousDate: () => calls.push('previous-date'),
        nextDate: () => calls.push('next-date'),
        today: () => calls.push('today'),
        openGoToDate: () => calls.push('go-to-date'),
        previousOccurrence: () => calls.push('previous-occurrence'),
        nextOccurrence: () => calls.push('next-occurrence'),
        openSelectedGame: () => calls.push('open-game'),
        openHelp: () => calls.push('help'),
      }),
    )
    keymap.keymap.registerLayer(
      detailCommandLayer({
        back: () => calls.push('back'),
        openHelp: () => calls.push('detail-help'),
      }),
    )
    keymap.keymap.registerLayer(
      overlayCommandLayer({
        overlay: Overlay.GoToDate(),
        handlers: { close: () => calls.push('close-overlay') },
      }),
    )
    keymap.keymap.registerLayer({
      ...focusedDateInputCommandLayer({ submit: () => calls.push('submit-date') }),
      target: input,
      targetMode: 'focus',
    })
    keymap.host.focus(input)

    const editEvents = ['q', 'p', 'n', 't', 'g', '?', 'left', 'right'].map((key) =>
      keymap.host.press(key),
    )
    keymap.host.press('return')
    keymap.host.press('escape')

    expect(calls).toEqual(['submit-date', 'close-overlay'])
    expect(editEvents.every((event) => !event.defaultPrevented)).toBe(true)
    expect(keymap.diagnostics.takeErrors().errors).toEqual([])
  })
})
