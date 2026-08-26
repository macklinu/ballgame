import { CliRenderEvents } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { describe, expect, test } from 'vitest'

import { appCommandLayer } from './CommandLayers'

describe('renderer-owned shutdown', () => {
  test('quitting destroys the renderer exactly once', () =>
    createTestRenderer({ width: 20, height: 4 }).then((setup) => {
      const keymap = createDefaultOpenTuiKeymap(setup.renderer)
      let destroyCount = 0
      setup.renderer.on(CliRenderEvents.DESTROY, () => {
        destroyCount += 1
      })
      keymap.registerLayer(appCommandLayer({ quit: () => setup.renderer.destroy() }))

      return setup.mockInput
        .typeText('q')
        .then(() => {
          expect(setup.renderer.isDestroyed).toBe(true)
          expect(destroyCount).toBe(1)
        })
        .finally(() => {
          setup.renderer.destroy()
        })
    }))
})
