import type { Renderable } from '@opentui/core'
import type {
  KeyInput,
  TestRendererOptions,
  TestRendererSetup,
  TestWaitForOptions,
} from '@opentui/core/testing'
import { testRender } from '@opentui/react/test-utils'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import { act, type ReactNode } from 'react'

type KeyModifiers = Parameters<TestRendererSetup['mockInput']['pressKey']>[1]

export interface Harness {
  readonly renderOnce: Effect.Effect<void, Cause.UnknownError>
  readonly captureCharFrame: Effect.Effect<string>
  readonly waitForFrame: (
    predicate: (frame: string) => boolean | Promise<boolean>,
    options?: TestWaitForOptions,
  ) => Effect.Effect<string, Cause.UnknownError>
  readonly findDescendantById: (id: string) => Effect.Effect<Renderable | undefined>
  readonly pressKey: ({
    key,
    modifiers,
  }: {
    readonly key: KeyInput
    readonly modifiers?: KeyModifiers
  }) => Effect.Effect<void>
  readonly pressKeys: ({
    keys,
    delayMs,
  }: {
    readonly keys: Array<KeyInput>
    readonly delayMs?: number
  }) => Effect.Effect<void, Cause.UnknownError>
  readonly typeText: (text: string) => Effect.Effect<void, Cause.UnknownError>
}

const makeHarness = (setup: TestRendererSetup): Harness => ({
  renderOnce: Effect.tryPromise(() => setup.renderOnce()),
  captureCharFrame: Effect.sync(() => setup.captureCharFrame()),
  waitForFrame: (
    predicate: (frame: string) => boolean | Promise<boolean>,
    options?: TestWaitForOptions,
  ) => Effect.tryPromise(() => setup.waitForFrame(predicate, options)),
  findDescendantById: (id: string) => Effect.sync(() => setup.renderer.root.findDescendantById(id)),
  pressKey: ({ key, modifiers }: { readonly key: KeyInput; readonly modifiers?: KeyModifiers }) =>
    Effect.sync(() => {
      act(() => setup.mockInput.pressKey(key, modifiers))
    }),
  pressKeys: ({ keys, delayMs }: { readonly keys: Array<KeyInput>; readonly delayMs?: number }) =>
    Effect.tryPromise(() => act(() => setup.mockInput.pressKeys(keys, delayMs))),
  typeText: (text: string) => Effect.tryPromise(() => act(() => setup.mockInput.typeText(text))),
})

export const make = ({
  node,
  options,
}: {
  readonly node: ReactNode
  readonly options: TestRendererOptions
}) =>
  Effect.acquireRelease(
    Effect.tryPromise(() => testRender(node, options)),
    ({ renderer }) => Effect.sync(() => renderer.destroy()),
  ).pipe(Effect.map(makeHarness))
