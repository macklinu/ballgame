import { expect, test } from 'vitest'

import { scheduleCommandLayer } from './CommandLayers'

test('binds lowercase v to opening the selected MLB.TV game', () => {
  let opensMlbTv = 0
  const layer = scheduleCommandLayer({
    previousDate: () => undefined,
    nextDate: () => undefined,
    today: () => undefined,
    openGoToDate: () => undefined,
    previousOccurrence: () => undefined,
    nextOccurrence: () => undefined,
    openSelectedGame: () => undefined,
    openMlbTv: () => {
      opensMlbTv += 1
    },
    openHelp: () => undefined,
  })
  const openMlbTvCommand = layer.commands.find(({ name }) => name === 'schedule.open-mlb-tv')

  expect(layer.bindings).toContainEqual({ key: 'v', cmd: 'schedule.open-mlb-tv' })
  expect(openMlbTvCommand).toMatchObject({ title: 'Open MLB.TV' })

  openMlbTvCommand?.run()

  expect(opensMlbTv).toBe(1)
})
