import { RegistryProvider } from '@effect/atom-react'
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import { CliRenderEvents, createCliRenderer, type CliRenderer } from '@opentui/core'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider } from '@opentui/keymap/react'
import { createRoot } from '@opentui/react'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

import { App } from './ApplicationView'

const waitForRendererDestroy = (renderer: CliRenderer) =>
  Effect.callback<void>((resume) => {
    if (renderer.isDestroyed) {
      resume(Effect.void)
      return
    }

    const onDestroy = () => resume(Effect.void)
    renderer.once(CliRenderEvents.DESTROY, onDestroy)
    return Effect.sync(() => renderer.off(CliRenderEvents.DESTROY, onDestroy))
  })

class ApplicationStartupError extends Schema.TaggedError<ApplicationStartupError>()(
  'ApplicationStartupError',
  { cause: Schema.Defect() },
) {}

const createApplicationRenderer = Effect.tryPromise({
  try: () => createCliRenderer(),
  catch: (cause) => new ApplicationStartupError({ cause }),
}).pipe(
  Effect.flatMap((renderer) =>
    Effect.try({
      try: () => {
        const keymap = createDefaultOpenTuiKeymap(renderer)
        const root = createRoot(renderer)
        root.render(
          <RegistryProvider>
            <KeymapProvider keymap={keymap}>
              <App onQuit={() => renderer.destroy()} />
            </KeymapProvider>
          </RegistryProvider>,
        )
        return renderer
      },
      catch: (error) => {
        renderer.destroy()
        return new ApplicationStartupError({ cause: error })
      },
    }),
  ),
)

const program = Effect.acquireUseRelease(
  createApplicationRenderer,
  waitForRendererDestroy,
  (renderer) => Effect.sync(() => renderer.destroy()),
)

export const runApplication = () => BunRuntime.runMain(program)
