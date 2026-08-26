import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import { createCliRenderer, TextAttributes } from '@opentui/core'
import { createRoot, useKeyboard } from '@opentui/react'
import * as Cause from 'effect/Cause'
import * as Console from 'effect/Console'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Number from 'effect/Number'
import * as Option from 'effect/Option'
import * as EffectSchedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useEffect, useState } from 'react'

import { dateAtom, goToDateAtom, nextDay, now, previousDay } from './date'
import { GameGridItem } from './game-grid-item'
import { Loading } from './loading'
import * as Mlb from './mlb-adapter'
import * as Schedule from './Schedule'
import { useCurrentView, View } from './View'

const scheduleRuntime = Atom.runtime(Mlb.layerLive.pipe(Layer.provide(FetchHttpClient.layer)))

const getScheduleForDate = Effect.fn('Schedule.getScheduleForDate')(function* (
  date: DateTime.DateTime,
) {
  const scheduleService = yield* Schedule.ScheduleService
  return yield* scheduleService.get(date)
})

const scheduleAtom = Atom.family((date: DateTime.DateTime) =>
  scheduleRuntime.atom(
    Stream.fromEffectSchedule(getScheduleForDate(date), EffectSchedule.spaced('15 seconds')).pipe(
      Stream.takeUntil((schedule) => !Schedule.hasNonTerminalGame(schedule)),
    ),
  ),
)

const selectedGameIndexAtom = Atom.make(0)

const previousGameAtom = Atom.fnSync<DateTime.DateTime>()((date, get) => {
  const schedule = AsyncResult.getOrThrow(get(scheduleAtom(date)))

  const index = get(selectedGameIndexAtom)
  const newIndex = Number.clamp({
    minimum: 0,
    maximum: Math.max(schedule.occurrences.length - 1, 0),
  })(index - 1)

  get.set(selectedGameIndexAtom, newIndex)
})

const nextGameAtom = Atom.fnSync<DateTime.DateTime>()((date, get) => {
  const schedule = AsyncResult.getOrThrow(get(scheduleAtom(date)))

  const index = get(selectedGameIndexAtom)
  const newIndex = Number.clamp({
    minimum: 0,
    maximum: Math.max(schedule.occurrences.length - 1, 0),
  })(index + 1)

  get.set(selectedGameIndexAtom, newIndex)
})

const GoToDate = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <box flexDirection='column' gap={1}>
    <text>Go to date</text>
    <input focused placeholder='YYYY-MM-DD' value={value} onChange={onChange} padding={1} />
  </box>
)

const CenteredContainer = ({ children }: { children: React.ReactNode }) => (
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

const whenSuccess = <A, E>(result: AsyncResult.AsyncResult<A, E>, onSuccess: (a: A) => void) => {
  if (AsyncResult.isSuccess(result)) {
    onSuccess(result.value)
  }
}

const NoGamesScheduled = () => <text attributes={TextAttributes.DIM}>No games today.</text>

const KeyboardShortcut = ({ shortcut, description }: { shortcut: string; description: string }) => (
  <box flexDirection='row' flexWrap='wrap' gap={1} alignItems='center'>
    <box paddingLeft={1} paddingRight={1} backgroundColor='white' justifyContent='center'>
      <text fg='black'>{shortcut}</text>
    </box>
    <text attributes={TextAttributes.DIM}>{description}</text>
  </box>
)

const DailyGameView = ({ schedule }: { schedule: Schedule.Schedule }) => {
  const selectedGameIndex = useAtomValue(selectedGameIndexAtom)

  const { pushView } = useCurrentView()

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
      {schedule.occurrences.map((occurrence, index) =>
        Schedule.isAvailableScheduleOccurrence(occurrence) ? (
          <GameGridItem
            onMouseUp={(e) => {
              pushView(View.GameDetails({ occurrence }))
              e.stopPropagation()
            }}
            flexBasis={24}
            key={`${occurrence.selectedDate}-${occurrence.game.ref}`}
            isSelected={index === selectedGameIndex}
            game={occurrence.game}
          />
        ) : (
          <box
            flexBasis={24}
            key={`${occurrence.selectedDate}-${index}`}
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

const GameDetailsView = ({ occurrence }: { occurrence: Schedule.AvailableScheduleOccurrence }) => {
  const { game } = occurrence
  return (
    <box flexDirection='column' padding={2} borderStyle='single'>
      <text>
        {game.awayTeam.name} at {game.homeTeam.name}
      </text>
      <text>{game.status.label}</text>
      {Option.match(game.status.reason, {
        onNone: () => null,
        onSome: (reason) => <text>{reason}</text>,
      })}
      {Option.match(occurrence.rescheduledTo, {
        onNone: () => null,
        onSome: (date) => <text>Rescheduled to {date}</text>,
      })}
      {Option.match(occurrence.rescheduledFrom, {
        onNone: () => null,
        onSome: (date) => <text>Rescheduled from {date}</text>,
      })}
    </box>
  )
}

const App = () => {
  const { currentView, isNestedView, pushView, popView } = useCurrentView()
  const [isGoToDateOpen, setIsGoToDateOpen] = useState(false)

  const [date, setDate] = useAtom(dateAtom)
  const [goToDateValue, setGoToDateValue] = useState(DateTime.formatIsoDate(date))
  const goToDate = useAtomSet(goToDateAtom, { mode: 'promise' })
  const schedule = useAtomValue(scheduleAtom(date))
  const [selectedGameIndex, setSelectedGameIndex] = useAtom(selectedGameIndexAtom)

  const goToPreviousGame = useAtomSet(previousGameAtom)
  const goToNextGame = useAtomSet(nextGameAtom)

  useEffect(() => {
    setSelectedGameIndex(0)
  }, [schedule, setSelectedGameIndex])

  useKeyboard((key) => {
    if (isGoToDateOpen) {
      if (key.name === 'escape') {
        setIsGoToDateOpen(false)
      } else if (key.name === 'return') {
        void goToDate(goToDateValue).then(() => setIsGoToDateOpen(false))
      }
      return
    }

    if (key.name === 'escape' && isNestedView) {
      popView()
    }

    if (key.name === 'left') {
      goToPreviousGame(date)
    }

    if (key.name === 'right') {
      goToNextGame(date)
    }

    if (key.name === 'return') {
      whenSuccess(schedule, (schedule) => {
        const occurrence = schedule.occurrences[selectedGameIndex]
        if (occurrence !== undefined && Schedule.isAvailableScheduleOccurrence(occurrence)) {
          pushView(View.GameDetails({ occurrence }))
        }
      })
    }

    Match.value(key.name).pipe(
      Match.when(Match.is('q'), () => process.exit(0)),
      Match.when(Match.is('p'), () => setDate(previousDay)),
      Match.when(Match.is('n'), () => setDate(nextDay)),
      Match.when(Match.is('t'), () => setDate(now)),
      Match.when(Match.is('g'), () => {
        setGoToDateValue(DateTime.formatIsoDate(date))
        setIsGoToDateOpen(true)
      }),
      Match.when(Match.is('j'), () => {}),
      Match.when(Match.is('k'), () => {}),
      Match.when(Match.is('?'), () => {
        // TODO: show help dialog
      }),
    )
  })

  return (
    <>
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
        {View.$match(currentView, {
          Schedule: () => (
            <>
              <box alignSelf='center'>
                <ascii-font text='Ballgame' font='tiny' color={['red', 'white', 'blue']} />
              </box>
              <box flexDirection='column' alignItems='center'>
                <box flexDirection='column' gap={1}>
                  <text>
                    <b>{DateTime.formatLocal(date, { dateStyle: 'full' })}</b>
                  </text>
                  <box alignSelf='center' minHeight={4}>
                    {isSubsequentWaiting(schedule) ? <text>Loading...</text> : null}
                  </box>
                </box>
                <box flexGrow={0}>
                  {AsyncResult.builder(schedule)
                    .onInitial(() => (
                      <CenteredContainer>
                        <Loading />
                      </CenteredContainer>
                    ))
                    .onFailure((error) => {
                      console.error(error)
                      return <text>{Cause.pretty(error)}</text>
                    })
                    .onSuccess((schedule) => {
                      return <DailyGameView schedule={schedule} />
                    })
                    .orNull()}
                </box>
              </box>
              <box marginTop='auto' />
              <box
                paddingLeft={1}
                paddingRight={1}
                borderStyle='single'
                borderColor='gray'
                flexDirection='row'
                gap={1}
              >
                <KeyboardShortcut shortcut='p' description='previous day' />
                <KeyboardShortcut shortcut='t' description='today' />
                <KeyboardShortcut shortcut='n' description='next day' />
                <KeyboardShortcut shortcut='g' description='go to day' />
                <KeyboardShortcut shortcut='←/→' description='prev/next game' />
                <KeyboardShortcut shortcut='⏎' description='select game' />
              </box>
            </>
          ),
          GameDetails: ({ occurrence }) => <GameDetailsView occurrence={occurrence} />,
        })}
        {isGoToDateOpen ? (
          <box
            position='absolute'
            flexDirection='column'
            padding={2}
            borderStyle='single'
            backgroundColor='black'
          >
            <GoToDate value={goToDateValue} onChange={setGoToDateValue} />
          </box>
        ) : null}
      </box>
    </>
  )
}

const enterAltScreenCommand = Console.log('\x1b[?1049h')
const leaveAltScreenCommand = Console.log('\x1b[?1049l')

const renderApp = Effect.tryPromise(async () => {
  const renderer = await createCliRenderer()
  return createRoot(renderer).render(<App />)
})

const program = Effect.gen(function* () {
  yield* enterAltScreenCommand
  yield* renderApp
  yield* leaveAltScreenCommand
})

BunRuntime.runMain(program)
