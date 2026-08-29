import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { TextAttributes, type InputRenderable } from '@opentui/core'
import { useActiveKeys, useBindings } from '@opentui/keymap/react'
import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'
import { useCallback, useRef, useState } from 'react'

import {
  closeOverlayAtom,
  goToDateAtom,
  Overlay,
  overlayStackAtom,
  selectedDateAtom,
} from './AppState'
import { focusedDateInputCommandLayer, overlayCommandLayer } from './CommandLayers'
import { parseLocalCalendarDate } from './date'

export const CommandHints = () => {
  const activeKeys = useActiveKeys()

  return (
    <box flexDirection='row' flexWrap='wrap' gap={1}>
      {activeKeys.map((key) => {
        if (key.command === undefined) {
          return null
        }

        const commandName = typeof key.command === 'string' ? key.command : key.command.name
        return (
          <box key={`${key.display}-${commandName}`} flexDirection='row' gap={1}>
            <text attributes={TextAttributes.BOLD}>{key.display}</text>
            <text attributes={TextAttributes.DIM}>{commandName}</text>
          </box>
        )
      })}
    </box>
  )
}

const GoToDateOverlay = () => {
  const date = useAtomValue(selectedDateAtom)
  const closeOverlay = useAtomSet(closeOverlayAtom)
  const goToDate = useAtomSet(goToDateAtom, { mode: 'promise' })
  const inputRef = useRef<InputRenderable>(null)
  const submitRef = useRef<() => void>(() => {})
  const [value, setValue] = useState(() => DateTime.formatIsoDate(date))
  const [error, setError] = useState<string | undefined>()

  const submit = useCallback(() => {
    const input = inputRef.current?.value ?? value
    if (Option.isNone(parseLocalCalendarDate(input))) {
      setError('Enter a valid local calendar date.')
      return
    }

    void goToDate(input)
      .then(() => closeOverlay(undefined))
      .catch(() => setError('Enter a valid local calendar date.'))
  }, [closeOverlay, goToDate, value])
  submitRef.current = submit

  useBindings(
    () => overlayCommandLayer(Overlay.GoToDate(), { close: () => closeOverlay(undefined) }),
    [closeOverlay],
  )
  useBindings(
    () => ({
      ...focusedDateInputCommandLayer({ submit: () => submitRef.current() }),
      targetRef: inputRef,
      targetMode: 'focus' as const,
    }),
    [],
  )

  return (
    <box flexDirection='column' gap={1} padding={2} borderStyle='single' backgroundColor='black'>
      <text>Go to date</text>
      <input
        ref={inputRef}
        focused
        placeholder='YYYY-MM-DD'
        value={value}
        onChange={setValue}
        padding={1}
      />
      {error === undefined ? null : <text fg='red'>{error}</text>}
      <text attributes={TextAttributes.DIM}>Enter to submit · Escape to cancel</text>
    </box>
  )
}

const HelpOverlay = () => {
  const closeOverlay = useAtomSet(closeOverlayAtom)

  useBindings(
    () => overlayCommandLayer(Overlay.Help(), { close: () => closeOverlay(undefined) }),
    [closeOverlay],
  )

  return (
    <box flexDirection='column' gap={1} padding={2} borderStyle='single' backgroundColor='black'>
      <text>Available commands</text>
      <CommandHints />
      <text attributes={TextAttributes.DIM}>Press Escape or ? to close.</text>
    </box>
  )
}

export const OverlayHost = () => {
  const overlays = useAtomValue(overlayStackAtom)
  const overlay = overlays.at(-1)

  if (overlay === undefined) {
    return null
  }

  return (
    <box
      width='100%'
      height='100%'
      position='absolute'
      zIndex={10}
      alignItems='center'
      justifyContent='center'
    >
      {Overlay.$match(overlay, {
        GoToDate: () => <GoToDateOverlay />,
        Help: () => <HelpOverlay />,
      })}
    </box>
  )
}
