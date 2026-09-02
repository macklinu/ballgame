import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { TextAttributes, type InputRenderable } from '@opentui/core'
import { useActiveKeys, useBindings } from '@opentui/keymap/react'
import * as DateTime from 'effect/DateTime'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import { useCallback, useRef, useState } from 'react'
import invariant from 'tiny-invariant'

import { closeOverlayAtom, goToDateAtom, Overlay, selectedDateAtom } from './AppState'
import { parseLocalCalendarDate } from './date'

const formatKeyDisplay = (display: string): string =>
  Match.value(display).pipe(
    Match.when('up', () => '↑'),
    Match.when('down', () => '↓'),
    Match.orElse((value) => value),
  )

export const CommandHints = () => {
  const activeKeys = useActiveKeys({ includeMetadata: true })

  return (
    <box flexDirection='row' flexWrap='wrap' gap={1}>
      {activeKeys.map((key) => {
        if (key.command === undefined) {
          return null
        }

        const commandName = typeof key.command === 'string' ? key.command : key.command.name
        const commandTitle = key.commandAttrs?.title
        invariant(
          typeof commandTitle === 'string' && commandTitle.length > 0,
          `Command ${commandName} must define a title.`,
        )

        return (
          <box key={`${key.display}-${commandName}`} flexDirection='row' gap={1}>
            <text attributes={TextAttributes.BOLD}>{formatKeyDisplay(key.display)}</text>
            <text attributes={TextAttributes.DIM}>{commandTitle}</text>
          </box>
        )
      })}
    </box>
  )
}

const GoToDateOverlay = () => {
  const date = useAtomValue(selectedDateAtom)
  const closeOverlay = useAtomSet(closeOverlayAtom)
  const goToDate = useAtomSet(goToDateAtom)
  const inputRef = useRef<InputRenderable>(null)
  const [value, setValue] = useState(() => DateTime.formatIsoDate(date))
  const [error, setError] = useState<string | undefined>()

  const changeValue = (input: string) => {
    setValue(input)
    setError(undefined)
  }

  const submit = useCallback(() => {
    const input = inputRef.current?.value
    if (input === undefined) {
      return
    }

    const parsedDate = parseLocalCalendarDate(input)
    if (Option.isNone(parsedDate)) {
      setError('Enter a valid local calendar date.')
      return
    }

    setError(undefined)
    goToDate(parsedDate.value)
    closeOverlay(undefined)
  }, [closeOverlay, goToDate])

  useBindings(
    () => ({
      commands: [{ name: 'overlay.dismiss', title: 'Dismiss', run: () => closeOverlay(undefined) }],
      bindings: [{ key: 'escape', cmd: 'overlay.dismiss' }],
    }),
    [closeOverlay],
  )
  useBindings(
    () => ({
      targetRef: inputRef,
      targetMode: 'focus' as const,
      commands: [{ name: 'go-to-date.submit', title: 'Submit date', run: submit }],
      bindings: [{ key: 'return', cmd: 'go-to-date.submit' }],
    }),
    [submit],
  )

  return (
    <box flexDirection='column' gap={1} padding={2} borderStyle='single' backgroundColor='black'>
      <text>Go to date</text>
      <input
        ref={inputRef}
        focused
        placeholder='YYYY-MM-DD'
        value={value}
        onInput={changeValue}
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
    () => ({
      commands: [{ name: 'overlay.dismiss', title: 'Dismiss', run: () => closeOverlay(undefined) }],
      bindings: [
        { key: 'escape', cmd: 'overlay.dismiss' },
        { key: '?', cmd: 'overlay.dismiss' },
      ],
    }),
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

export const OverlayHost = ({ activeOverlay }: { activeOverlay: Option.Option<Overlay> }) =>
  Option.match(activeOverlay, {
    onNone: () => null,
    onSome: (overlay) => (
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
    ),
  })
