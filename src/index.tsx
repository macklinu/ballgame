import {
  Atom,
  Result,
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from '@effect-atom/atom-react'
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { createCliRenderer, TextAttributes } from '@opentui/core'
import { createRoot, useKeyboard } from '@opentui/react'
import * as Console from 'effect/Console'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Number from 'effect/Number'
import * as Option from 'effect/Option'
import { useEffect, useMemo, useState } from 'react'

import 'opentui-spinner/react'

import { DialogProvider, useDialog, useDialogState } from '@opentui-ui/dialog/react'
import { themes } from '@opentui-ui/dialog/themes'
import { Toaster } from '@opentui-ui/toast/react'
import * as Cause from 'effect/Cause'
import * as Schedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'

import { dateAtom, goToDateAtom, isSameDay, nextDay, now, previousDay } from './date'
import * as Game from './Game'
import { GameGridItem } from './game-grid-item'
import { Loading } from './loading'
import { defaultAtomRuntime } from './Runtime'
import { ScheduleDate, ScheduleService } from './Schedule'
import { useCurrentView, View } from './View'

const scheduleRuntime = Atom.runtime(
  ScheduleService.layerLive.pipe(Layer.provide(FetchHttpClient.layer))
)

const getScheduleForDate = Effect.fn(function* (date: DateTime.DateTime) {
  const scheduleService = yield* ScheduleService
  return yield* scheduleService.getSchedule(date)
})

const scheduleAtom = Atom.family((date: DateTime.DateTime) =>
  scheduleRuntime.atom(
    Stream.repeatEffectWithSchedule(getScheduleForDate(date), Schedule.spaced('15 seconds')).pipe(
      Stream.takeUntil(
        (schedule) =>
          schedule.totalGames === 0 ||
          schedule.games.every((game) => game.status.abstractGameCode === 'F')
      )
    )
  )
)

const gameApiRuntime = Atom.runtime(
  Game.GameApi.layerLive.pipe(Layer.provide(FetchHttpClient.layer))
)

const gameFeedAtom = Atom.family((gamePk: number) =>
  gameApiRuntime.atom(
    Effect.gen(function* () {
      const api = yield* Game.GameApi
      return yield* api.feed(gamePk)
    })
  )
)

const selectedGameIndexAtom = Atom.make(0)

const previousGameAtom = defaultAtomRuntime.fn(
  Effect.fnUntraced(function* (date: DateTime.DateTime, get: Atom.FnContext) {
    const schedule = Result.getOrThrow(get(scheduleAtom(date)))

    const index = get(selectedGameIndexAtom)
    const newIndex = Number.clamp({
      minimum: 0,
      maximum: schedule.totalGames - 1,
    })(index - 1)

    get.set(selectedGameIndexAtom, newIndex)
  })
)

const nextGameAtom = defaultAtomRuntime.fn(
  Effect.fnUntraced(function* (date: DateTime.DateTime, get: Atom.FnContext) {
    const schedule = Result.getOrThrow(get(scheduleAtom(date)))

    const index = get(selectedGameIndexAtom)
    const newIndex = Number.clamp({
      minimum: 0,
      maximum: schedule.totalGames - 1,
    })(index + 1)

    get.set(selectedGameIndexAtom, newIndex)
  })
)

const GoToDate = ({
  onSubmit,
  date,
}: {
  onSubmit: (value: string) => void
  date: DateTime.DateTime
}) => {
  const [value, setValue] = useState(DateTime.formatIsoDate(date))
  return (
    <box flexDirection='column' gap={1}>
      <text>Go to date</text>
      <input
        focused
        placeholder='YYYY-MM-DD'
        onSubmit={onSubmit}
        value={value}
        onChange={setValue}
        padding={1}
      />
    </box>
  )
}

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

const isSubsequentWaiting = <A, E>(result: Result.Result<A, E>): boolean =>
  Result.isNotInitial(result) && Result.isWaiting(result)

const whenSuccess = <A, E>(result: Result.Result<A, E>, onSuccess: (a: A) => void) => {
  if (Result.isSuccess(result)) {
    onSuccess(result.value)
  }
}

const NoGamesScheduled = () => <text attributes={TextAttributes.DIM}>No games scheduled</text>

const KeyboardShortcut = ({ shortcut, description }: { shortcut: string; description: string }) => (
  <box flexDirection='row' flexWrap='wrap' gap={1} alignItems='center'>
    <box paddingLeft={1} paddingRight={1} backgroundColor='white' justifyContent='center'>
      <text fg='black'>{shortcut}</text>
    </box>
    <text attributes={TextAttributes.DIM}>{description}</text>
  </box>
)

const DailyGameView = ({ schedule }: { schedule: ScheduleDate }) => {
  const date = useAtomValue(dateAtom)
  const selectedGameIndex = useAtomValue(selectedGameIndexAtom)
  const day = schedule.games.some((d) => isSameDay(d.gameDate, date))

  const { pushView } = useCurrentView()

  if (!day) {
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
      {schedule.games.map((game, index) => (
        <GameGridItem
          onMouseUp={(e) => {
            pushView(View.GameDetails({ gamePk: game.gamePk }))
            e.stopPropagation()
          }}
          flexBasis={24}
          key={game.gamePk}
          isSelected={index === selectedGameIndex}
          game={game}
        />
      ))}
    </box>
  )
}

const GameDetailsView = ({ gamePk }: { gamePk: number }) => {
  const game = useAtomValue(gameFeedAtom(gamePk))
  return (
    <box flexDirection='column' padding={2} borderStyle='single'>
      <text>Game Details for {gamePk}</text>
      {Result.builder(game)
        .onSuccess(({ gamePk }) => <text>Game details for {gamePk}!</text>)
        .onError((error) => <text>Error loading game: {String(error)}</text>)
        .orNull()}
    </box>
  )
}

const App = () => {
  const { currentView, isNestedView, pushView, popView } = useCurrentView()
  const dialog = useDialog()
  const isDialogOpen = useDialogState((state) => state.isOpen)

  const [date, setDate] = useAtom(dateAtom)
  const goToDate = useAtomSet(goToDateAtom, { mode: 'promise' })
  const schedule = useAtomValue(scheduleAtom(date))
  const refreshSchedule = useAtomRefresh(scheduleAtom(date))
  const [selectedGameIndex, setSelectedGameIndex] = useAtom(selectedGameIndexAtom)

  const goToPreviousGame = useAtomSet(previousGameAtom)
  const goToNextGame = useAtomSet(nextGameAtom)

  useEffect(() => {
    setSelectedGameIndex(0)
  }, [schedule, setSelectedGameIndex])

  const refreshDuration = useMemo(
    () =>
      Option.fromNullable(
        Result.builder(schedule)
          .onSuccess(({ totalGames, games }) =>
            totalGames === 0
              ? null
              : games.some((game) => game.status.abstractGameCode === 'L')
                ? Duration.seconds(15)
                : null
          )
          .orNull()
      ),
    [schedule]
  )

  useEffect(() => {
    if (Option.isNone(refreshDuration)) {
      return
    }
    const delay = refreshDuration.value.pipe(Duration.toMillis)
    const interval = setInterval(() => refreshSchedule(), delay)
    return () => clearInterval(interval)
  }, [refreshSchedule, refreshDuration])

  useKeyboard((key) => {
    if (isDialogOpen) {
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
        pushView(
          View.GameDetails({
            gamePk: schedule.games[selectedGameIndex]!.gamePk,
          })
        )
      })
    }

    Match.value(key.name).pipe(
      Match.when(Match.is('q'), () => process.exit(0)),
      Match.when(Match.is('p'), () => setDate(previousDay)),
      Match.when(Match.is('n'), () => setDate(nextDay)),
      Match.when(Match.is('t'), () => setDate(now)),
      Match.when(Match.is('g'), () =>
        dialog.show({
          content: () => (
            <GoToDate
              date={date}
              onSubmit={async (value) => {
                await goToDate(value)
                dialog.close()
              }}
            />
          ),
        })
      ),
      Match.when(Match.is('j'), () => {}),
      Match.when(Match.is('k'), () => {}),
      Match.when(Match.is('?'), () => {
        // TODO: show help dialog
      })
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
                    {isSubsequentWaiting(schedule) ? <spinner name='bouncingBall' /> : null}
                  </box>
                </box>
                <box flexGrow={0}>
                  {Result.builder(schedule)
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
          GameDetails: ({ gamePk }) => <GameDetailsView gamePk={gamePk} />,
        })}
      </box>
      <Toaster />
    </>
  )
}

const enterAltScreenCommand = Console.log('\x1b[?1049h')
const leaveAltScreenCommand = Console.log('\x1b[?1049l')

const renderApp = Effect.tryPromise(async () => {
  const renderer = await createCliRenderer()
  return createRoot(renderer).render(
    <DialogProvider {...themes.minimal}>
      <App />
    </DialogProvider>
  )
})

const program = Effect.gen(function* () {
  yield* enterAltScreenCommand
  yield* renderApp
  yield* leaveAltScreenCommand
})

BunRuntime.runMain(program)
