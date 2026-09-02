import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { type ReactNode, useCallback, useEffect } from 'react'

import {
  activeOverlayAtom,
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
  type ScheduleOccurrenceRef,
} from './AppState'
import { appCommandLayer, detailCommandLayer, scheduleCommandLayer } from './CommandLayers'
import { DailyScheduleRow } from './DailyScheduleRow'
import { GameDetails } from './GameDetails'
import { gameOverviewAtom } from './GameOverviewResource'
import { Loading } from './loading'
import { CommandHints, OverlayHost } from './Overlays'
import * as Schedule from './Schedule'
import * as ScheduleResource from './ScheduleResource'

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

const scheduleFromRefresh = (
  refresh: ScheduleResource.ScheduleRefresh,
): Option.Option<Schedule.Schedule> =>
  ScheduleResource.ScheduleRefresh.match(refresh, {
    Ready: ({ snapshot }) => Option.some(snapshot.schedule),
    Retrying: ({ lastSuccessful }) =>
      lastSuccessful.pipe(Option.map((snapshot) => snapshot.schedule)),
  })

const NoGamesScheduled = () => <text attributes={TextAttributes.DIM}>No games today.</text>

const retryingScheduleMessage = 'Retrying schedule…'

export const DailyGameView = ({
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
      width='100%'
      flexDirection='column'
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      {schedule.occurrences.map((occurrence) =>
        Schedule.isAvailableScheduleOccurrence(occurrence) ? (
          <DailyScheduleRow
            onMouseUp={(event) => {
              onOpenOccurrence(occurrence)
              event.stopPropagation()
            }}
            key={`available-${occurrence.selectedDate}-${occurrence.game.ref}`}
            isSelected={isSelectedOccurrence(selection, occurrence)}
            game={occurrence.game}
          />
        ) : (
          <box
            flexDirection='row'
            key={`unavailable-${occurrence.selectedDate}-${occurrence.message}`}
          >
            <text>{`  ${occurrence.message}`}</text>
            <box flexGrow={1} />
            <text>Unavailable </text>
          </box>
        ),
      )}
    </box>
  )
}

const RetryingSchedule = ({
  refresh,
  onOpenOccurrence,
}: {
  refresh: ScheduleResource.RetryingSchedule
  onOpenOccurrence: (occurrence: Schedule.AvailableScheduleOccurrence) => void
}) =>
  Option.match(refresh.lastSuccessful, {
    onNone: () => (
      <CenteredContainer>
        <text>{retryingScheduleMessage}</text>
      </CenteredContainer>
    ),
    onSome: ({ schedule }) => (
      <>
        <text>{retryingScheduleMessage}</text>
        <DailyGameView schedule={schedule} onOpenOccurrence={onOpenOccurrence} />
      </>
    ),
  })

const ScheduleRefreshView = ({
  refresh,
  onOpenOccurrence,
}: {
  refresh: ScheduleResource.ScheduleRefresh
  onOpenOccurrence: (occurrence: Schedule.AvailableScheduleOccurrence) => void
}) =>
  ScheduleResource.ScheduleRefresh.match(refresh, {
    Ready: ({ snapshot }) => (
      <DailyGameView schedule={snapshot.schedule} onOpenOccurrence={onOpenOccurrence} />
    ),
    Retrying: (retrying) => (
      <RetryingSchedule refresh={retrying} onOpenOccurrence={onOpenOccurrence} />
    ),
  })

const ScheduleScreen = ({ commandsEnabled }: { commandsEnabled: boolean }) => {
  const date = useAtomValue(selectedDateAtom)
  const scheduleResult = useAtomValue(ScheduleResource.scheduleForDateAtom(date))
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
      Option.match(scheduleFromRefresh(scheduleResult.value), {
        onNone: () => undefined,
        onSome: synchronizeSelection,
      })
    }
  }, [scheduleResult, synchronizeSelection])

  const previousOccurrence = useCallback(() => {
    if (AsyncResult.isSuccess(scheduleResult)) {
      Option.match(scheduleFromRefresh(scheduleResult.value), {
        onNone: () => undefined,
        onSome: selectPreviousOccurrence,
      })
    }
  }, [scheduleResult, selectPreviousOccurrence])
  const nextOccurrence = useCallback(() => {
    if (AsyncResult.isSuccess(scheduleResult)) {
      Option.match(scheduleFromRefresh(scheduleResult.value), {
        onNone: () => undefined,
        onSome: selectNextOccurrence,
      })
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
    () => ({
      ...scheduleCommandLayer({
        previousDate: () => previousDate(undefined),
        nextDate: () => nextDate(undefined),
        today: () => today(undefined),
        openGoToDate: () => openOverlay(Overlay.GoToDate()),
        previousOccurrence,
        nextOccurrence,
        openSelectedGame: () => openSelectedGame(undefined),
        openHelp,
      }),
      enabled: commandsEnabled,
    }),
    [
      commandsEnabled,
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
      <box width='100%' flexDirection='column' alignItems='center'>
        <box flexDirection='column' gap={1}>
          <text>
            <b>{DateTime.formatLocal(date, { dateStyle: 'full' })}</b>
          </text>
        </box>
        <box width='100%' flexGrow={0}>
          {AsyncResult.builder(scheduleResult)
            .onInitial(() => (
              <CenteredContainer>
                <Loading />
              </CenteredContainer>
            ))
            .onSuccess((refresh) => (
              <ScheduleRefreshView refresh={refresh} onOpenOccurrence={openOccurrence} />
            ))
            .onFailure(() => (
              <CenteredContainer>
                <text>Unable to load schedule.</text>
              </CenteredContainer>
            ))
            .orNull()}
        </box>
      </box>
    </>
  )
}

const GameDetailsShell = ({
  occurrence,
  commandsEnabled,
}: {
  occurrence: ScheduleOccurrenceRef
  commandsEnabled: boolean
}) => {
  const popRoute = useAtomSet(popRouteAtom)
  const openOverlay = useAtomSet(openOverlayAtom)
  const overviewResult = useAtomValue(gameOverviewAtom(occurrence.gameRef))

  useBindings(
    () => ({
      ...detailCommandLayer({
        back: () => popRoute(undefined),
        openHelp: () => openOverlay(Overlay.Help()),
      }),
      enabled: commandsEnabled,
    }),
    [commandsEnabled, openOverlay, popRoute],
  )

  return Option.match(AsyncResult.value(overviewResult), {
    onNone: () =>
      AsyncResult.builder(overviewResult)
        .onInitial(() => (
          <CenteredContainer>
            <Loading />
          </CenteredContainer>
        ))
        .onFailure(() => (
          <CenteredContainer>
            <box flexDirection='column' padding={2} borderStyle='single' gap={1}>
              <text>Game details are unavailable.</text>
              <text attributes={TextAttributes.DIM}>Press Escape to return to the schedule.</text>
            </box>
          </CenteredContainer>
        ))
        .orNull(),
    onSome: (overview) => (
      <GameDetails
        overview={overview}
        occurrence={occurrence}
        isRefreshUnavailable={AsyncResult.isFailure(overviewResult)}
        onBack={() => popRoute(undefined)}
      />
    ),
  })
}

export const App = ({ onQuit }: { onQuit: () => void }) => {
  const routes = useAtomValue(routeStackAtom)
  const activeOverlay = useAtomValue(activeOverlayAtom)
  const currentRoute = routes.at(-1) ?? Route.Schedule()
  const commandsEnabled = Option.isNone(activeOverlay)

  useBindings(
    () => ({ ...appCommandLayer({ quit: onQuit }), enabled: commandsEnabled }),
    [commandsEnabled, onQuit],
  )

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
        Schedule: () => <ScheduleScreen commandsEnabled={commandsEnabled} />,
        GameDetails: ({ occurrence }) => (
          <GameDetailsShell occurrence={occurrence} commandsEnabled={commandsEnabled} />
        ),
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
      <OverlayHost activeOverlay={activeOverlay} />
    </box>
  )
}
