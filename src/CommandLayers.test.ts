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

  test('gives the top overlay precedence over detail and schedule bindings', () => {
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
      overlayCommandLayer(Overlay.Help(), { close: () => calls.push('close-overlay') }),
    )

    keymap.host.press('escape')
    keymap.host.press('?')
    keymap.host.press('q')

    expect(calls).toEqual(['close-overlay', 'close-overlay', 'quit'])
    expect(keymap.diagnostics.takeErrors().errors).toEqual([])
  })

  test('lets the focused date input own submit and the app quit key', () => {
    const keymap = harness()
    const calls: Array<string> = []
    const input = keymap.host.createTarget('date-input')
    keymap.root.append(input)

    keymap.keymap.registerLayer(appCommandLayer({ quit: () => calls.push('quit') }))
    keymap.keymap.registerLayer({
      ...focusedDateInputCommandLayer({ submit: () => calls.push('submit-date') }),
      target: input,
      targetMode: 'focus',
    })
    keymap.host.focus(input)

    const quitEvent = keymap.host.press('q')
    keymap.host.press('return')

    expect(calls).toEqual(['submit-date'])
    expect(quitEvent.defaultPrevented).toBe(false)
    expect(keymap.diagnostics.takeErrors().errors).toEqual([])
  })
})
