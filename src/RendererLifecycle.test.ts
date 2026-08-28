import { CliRenderEvents } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { describe, expect, test } from 'vitest'

import { appCommandLayer } from './CommandLayers'

describe('renderer-owned shutdown', () => {
  // oxlint-disable-next-line effecttsgo/async-function
  async function assertRendererShutdown() {
    const setup = await createTestRenderer({ width: 20, height: 4 })
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)
    let destroyCount = 0
    setup.renderer.on(CliRenderEvents.DESTROY, () => {
      destroyCount += 1
    })
    keymap.registerLayer(appCommandLayer({ quit: () => setup.renderer.destroy() }))

    try {
      await setup.mockInput.typeText('q')

      expect(setup.renderer.isDestroyed).toBe(true)
      expect(destroyCount).toBe(1)
    } finally {
      setup.renderer.destroy()
    }
  }

  test('quitting destroys the renderer exactly once', assertRendererShutdown)
})
