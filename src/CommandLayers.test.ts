import invariant from 'tiny-invariant'
import { expect, test, vi } from 'vitest'

import { scheduleCommandLayer } from './CommandLayers'

test('binds lowercase v to opening the selected MLB.TV game', () => {
  const openMlbTv = vi.fn()
  const layer = scheduleCommandLayer({
    previousDate: () => undefined,
    nextDate: () => undefined,
    today: () => undefined,
    openGoToDate: () => undefined,
    previousOccurrence: () => undefined,
    nextOccurrence: () => undefined,
    openSelectedGame: () => undefined,
    openMlbTv,
    openHelp: () => undefined,
  })
  const openMlbTvCommand = layer.commands.find(({ name }) => name === 'schedule.open-mlb-tv')

  invariant(openMlbTvCommand !== undefined, 'Expected an MLB.TV command.')

  expect(layer.bindings).toContainEqual({ key: 'v', cmd: 'schedule.open-mlb-tv' })
  expect(openMlbTvCommand).toMatchObject({ title: 'Open MLB.TV' })

  openMlbTvCommand.run()

  expect(openMlbTv).toHaveBeenCalledOnce()
})
