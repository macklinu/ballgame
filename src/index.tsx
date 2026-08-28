import { RegistryProvider, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import {
  CliRenderEvents,
  createCliRenderer,
  TextAttributes,
  type CliRenderer,
  type InputRenderable,
} from '@opentui/core'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider, useActiveKeys, useBindings } from '@opentui/keymap/react'
import { createRoot } from '@opentui/react'
import * as Cause from 'effect/Cause'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import {
  closeOverlayAtom,
  goToDateAtom,
  isSelectedOccurrence,
  nextDateAtom,
  openOverlayAtom,
  openSelectedGameAtom,
  Overlay,
  popRouteAtom,
  previousDateAtom,
  Route,
  routeStackAtom,
  selectNextOccurrenceAtom,
  selectOccurrenceAtom,
  selectPreviousOccurrenceAtom,
  selectedDateAtom,
  selectedOccurrenceAtom,
  synchronizeSelectionAtom,
  todayAtom,
  overlayStackAtom,
} from './AppState'
import {
  appCommandLayer,
  detailCommandLayer,
  focusedDateInputCommandLayer,
  overlayCommandLayer,
  scheduleCommandLayer,
} from './CommandLayers'
import { GameGridItem } from './game-grid-item'
import { Loading } from './loading'
import * as Schedule from './Schedule'
import { scheduleForDateAtom } from './ScheduleResource'

const CenteredContainer = ({ children }: { children: ReactNode }) => (
  <box
    justifyContent='center'
    flexDirection='column'
    alignItems='center'
    paddingTop={4}
    paddingBottom={4}
  >
    {children}
  </box>
)

const isSubsequentWaiting = <A, E>(result: AsyncResult.AsyncResult<A, E>): boolean =>
  AsyncResult.isNotInitial(result) && AsyncResult.isWaiting(result)

const NoGamesScheduled = () => <text attributes={TextAttributes.DIM}>No games today.</text>

const CommandHints = () => {
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

const DailyGameView = ({
  schedule,
  onOpenOccurrence,
}: {
  schedule: Schedule.Schedule
  onOpenOccurrence: (occurrence: Schedule.AvailableScheduleOccurrence) => void
}) => {
  const selection = useAtomValue(selectedOccurrenceAtom)

  if (schedule.occurrences.length === 0) {
    return (
      <CenteredContainer>
        <NoGamesScheduled />
      </CenteredContainer>
    )
  }

  return (
    <box
      flexDirection='row'
      gap={1}
      paddingLeft={8}
      paddingRight={8}
      paddingTop={2}
      paddingBottom={2}
      flexWrap='wrap'
      justifyContent='center'
    >
      {schedule.occurrences.map((occurrence) =>
        Schedule.isAvailableScheduleOccurrence(occurrence) ? (
          <GameGridItem
            onMouseUp={(event) => {
              onOpenOccurrence(occurrence)
              event.stopPropagation()
            }}
            flexBasis={24}
            key={`available-${occurrence.selectedDate}-${occurrence.game.ref}`}
            isSelected={isSelectedOccurrence(selection, occurrence)}
            game={occurrence.game}
          />
        ) : (
          <box
            flexBasis={24}
            key={`unavailable-${occurrence.selectedDate}-${occurrence.message}`}
            padding={1}
            borderStyle='single'
          >
            <text>{occurrence.message}</text>
          </box>
        ),
      )}
    </box>
  )
}

const ScheduleScreen = () => {
  const date = useAtomValue(selectedDateAtom)
  const scheduleResult = useAtomValue(scheduleForDateAtom(date))
  const previousDate = useAtomSet(previousDateAtom)
  const nextDate = useAtomSet(nextDateAtom)
  const today = useAtomSet(todayAtom)
  const openOverlay = useAtomSet(openOverlayAtom)
  const selectPreviousOccurrence = useAtomSet(selectPreviousOccurrenceAtom)
  const selectNextOccurrence = useAtomSet(selectNextOccurrenceAtom)
  const selectOccurrence = useAtomSet(selectOccurrenceAtom)
  const openSelectedGame = useAtomSet(openSelectedGameAtom)
  const synchronizeSelection = useAtomSet(synchronizeSelectionAtom)

  useEffect(() => {
    if (AsyncResult.isSuccess(scheduleResult)) {
      synchronizeSelection(scheduleResult.value)
    }
  }, [scheduleResult, synchronizeSelection])

  const previousOccurrence = useCallback(() => {
    if (AsyncResult.isSuccess(scheduleResult)) {
      selectPreviousOccurrence(scheduleResult.value)
    }
  }, [scheduleResult, selectPreviousOccurrence])
  const nextOccurrence = useCallback(() => {
    if (AsyncResult.isSuccess(scheduleResult)) {
      selectNextOccurrence(scheduleResult.value)
    }
  }, [scheduleResult, selectNextOccurrence])
  const openOccurrence = useCallback(
    (occurrence: Schedule.AvailableScheduleOccurrence) => {
      selectOccurrence(occurrence)
      openSelectedGame(undefined)
    },
    [openSelectedGame, selectOccurrence],
  )
  const openHelp = useCallback(() => openOverlay(Overlay.Help()), [openOverlay])

  useBindings(
    () =>
      scheduleCommandLayer({
        previousDate: () => previousDate(undefined),
        nextDate: () => nextDate(undefined),
        today: () => today(undefined),
        openGoToDate: () => openOverlay(Overlay.GoToDate()),
        previousOccurrence,
        nextOccurrence,
        openSelectedGame: () => openSelectedGame(undefined),
        openHelp,
      }),
    [
      nextDate,
      nextOccurrence,
      openHelp,
      openOverlay,
      openSelectedGame,
      previousDate,
      previousOccurrence,
      today,
    ],
  )

  return (
    <>
      <box alignSelf='center'>
        <ascii-font text='Ballgame' font='tiny' color={['red', 'white', 'blue']} />
      </box>
      <box flexDirection='column' alignItems='center'>
        <box flexDirection='column' gap={1}>
          <text>
            <b>{DateTime.formatLocal(date, { dateStyle: 'full' })}</b>
          </text>
          <box alignSelf='center' minHeight={1}>
            {isSubsequentWaiting(scheduleResult) ? <text>Refreshing…</text> : null}
          </box>
        </box>
        <box flexGrow={0}>
          {AsyncResult.builder(scheduleResult)
            .onInitial(() => (
              <CenteredContainer>
                <Loading />
              </CenteredContainer>
            ))
            .onFailure((error) => <text>{Cause.pretty(error)}</text>)
            .onSuccess((schedule) => (
              <DailyGameView schedule={schedule} onOpenOccurrence={openOccurrence} />
            ))
            .orNull()}
        </box>
      </box>
    </>
  )
}

const GameDetailsShell = () => {
  const popRoute = useAtomSet(popRouteAtom)
  const openOverlay = useAtomSet(openOverlayAtom)

  useBindings(
    () =>
      detailCommandLayer({
        back: () => popRoute(undefined),
        openHelp: () => openOverlay(Overlay.Help()),
      }),
    [openOverlay, popRoute],
  )

  return (
    <CenteredContainer>
      <box flexDirection='column' padding={2} borderStyle='single' gap={1}>
        <text>Game details</text>
        <text attributes={TextAttributes.DIM}>Details are not part of this shell.</text>
        <text attributes={TextAttributes.DIM}>Press Escape to return to the schedule.</text>
      </box>
    </CenteredContainer>
  )
}

const GoToDateOverlay = () => {
  const date = useAtomValue(selectedDateAtom)
  const closeOverlay = useAtomSet(closeOverlayAtom)
  const goToDate = useAtomSet(goToDateAtom, { mode: 'promise' })
  const inputRef = useRef<InputRenderable>(null)
  const [value, setValue] = useState(() => DateTime.formatIsoDate(date))
  const [error, setError] = useState<string | undefined>()

  const submit = useCallback(() => {
    void goToDate(value)
      .then(() => closeOverlay(undefined))
      .catch(() => setError('Enter a valid ISO date.'))
  }, [closeOverlay, goToDate, value])

  useBindings(
    () => overlayCommandLayer(Overlay.GoToDate(), { close: () => closeOverlay(undefined) }),
    [closeOverlay],
  )
  useBindings(
    () => ({
      ...focusedDateInputCommandLayer({ submit }),
      targetRef: inputRef,
      targetMode: 'focus' as const,
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
        onChange={setValue}
        onSubmit={submit}
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

const OverlayHost = () => {
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

export const App = ({ onQuit }: { onQuit: () => void }) => {
  const routes = useAtomValue(routeStackAtom)
  const currentRoute = routes.at(-1) ?? Route.Schedule()

  useBindings(() => appCommandLayer({ quit: onQuit }), [onQuit])

  return (
    <box
      width='100%'
      height='100%'
      flexDirection='column'
      alignItems='center'
      justifyContent='center'
      marginTop={1}
      gap={1}
      position='relative'
    >
      {Route.$match(currentRoute, {
        Schedule: () => <ScheduleScreen />,
        GameDetails: () => <GameDetailsShell />,
      })}
      <box marginTop='auto' />
      <box
        paddingLeft={1}
        paddingRight={1}
        borderStyle='single'
        borderColor='gray'
        flexDirection='row'
        gap={1}
      >
        <CommandHints />
      </box>
      <OverlayHost />
    </box>
  )
}

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

BunRuntime.runMain(program)
