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
import { createRoot, useAppContext, useKeyboard } from '@opentui/react'
import { pipe } from 'effect'
import * as Console from 'effect/Console'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Number from 'effect/Number'
import * as Option from 'effect/Option'
import { useEffect, useMemo } from 'react'

import 'opentui-spinner/react'

import * as BunFileSystem from '@effect/platform-bun/BunFileSystem'
import * as PlatformLogger from '@effect/platform/PlatformLogger'
import * as Logger from 'effect/Logger'

import { dateAtom, goToDateAtom, isSameDay, nextDay, now, previousDay } from './date'
import * as Dialog from './Dialog'
import * as Game from './Game'
import { GameGridItem } from './game-grid-item'
import { Loading } from './loading'
import { ScheduleResponse, ScheduleService } from './Schedule'
import { useCurrentView, View } from './View'

const fetchRuntime = Atom.runtime(
  ScheduleService.layerLive.pipe(Layer.provide(FetchHttpClient.layer))
)

const scheduleAtom = Atom.family((date: DateTime.DateTime) =>
  fetchRuntime
    .atom(
      Effect.gen(function* () {
        const scheduleService = yield* ScheduleService
        yield* Console.log(date)
        return yield* scheduleService.getSchedule(DateTime.formatIsoDate(date))
      })
    )
    .pipe(Atom.setIdleTTL(Duration.minutes(5)), Atom.keepAlive)
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

const DailyGameView = ({ schedule }: { schedule: ScheduleResponse }) => {
  const date = useAtomValue(dateAtom)
  const selectedGameIndex = useAtomValue(selectedGameIndexAtom)
  const day = schedule.dates.find((d) => isSameDay(d.date, date))

  if (!day || day.totalGames === 0) {
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
      {day.games.map((game, index) => (
        <GameGridItem
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
  const app = useAppContext()
  const { currentView, isNestedView, pushView, popView } = useCurrentView()
  const { dialog, showDialog, closeDialog } = Dialog.useCurrentDialog()

  const [date, setDate] = useAtom(dateAtom)
  const goToDate = useAtomSet(goToDateAtom)
  const schedule = useAtomValue(scheduleAtom(date))
  const refreshSchedule = useAtomRefresh(scheduleAtom(date))
  const [selectedGameIndex, setSelectedGameIndex] = useAtom(selectedGameIndexAtom)

  useEffect(() => {
    setSelectedGameIndex(0)
  }, [schedule, setSelectedGameIndex])

  const refreshDuration = useMemo(
    () =>
      Option.fromNullable(
        Result.builder(schedule)
          .onSuccess(({ totalGames, dates }) =>
            totalGames === 0
              ? null
              : dates[0]!.games.some((game) => game.status.abstractGameCode === 'L')
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
    if (key.name === '`') {
      app.renderer?.console.toggle()
    }

    if (key.name === 'escape') {
      if (Option.isSome(dialog)) {
        closeDialog()
      } else if (isNestedView) {
        popView()
      }
    }

    if (key.name === 'left') {
      whenSuccess(schedule, ({ totalGames }) => {
        setSelectedGameIndex(
          pipe(
            Number.decrement(1),
            Number.clamp({
              minimum: 0,
              maximum: totalGames - 1,
            })
          )
        )
      })
    }

    if (key.name === 'right') {
      whenSuccess(schedule, ({ totalGames }) => {
        setSelectedGameIndex(
          pipe(
            Number.increment(1),
            Number.clamp({
              minimum: 0,
              maximum: totalGames - 1,
            })
          )
        )
      })
    }

    if (key.name === 'return') {
      if (Option.isSome(dialog)) {
        return
      }
      whenSuccess(schedule, (schedule) => {
        pushView(
          View.GameDetails({
            gamePk: schedule.dates[0]!.games[selectedGameIndex]!.gamePk,
          })
        )
      })
    }

    if (Option.isSome(dialog)) {
      return
    }

    Match.value(key.name).pipe(
      Match.when(Match.is('q'), () => process.exit(0)),
      Match.when(Match.is('p'), () => setDate(previousDay)),
      Match.when(Match.is('n'), () => setDate(nextDay)),
      Match.when(Match.is('t'), () => setDate(now)),
      Match.when(Match.is('g'), () => showDialog(Dialog.Dialog.GoToDate())),
      Match.when(Match.is('j'), () => {}),
      Match.when(Match.is('k'), () => {}),
      Match.when(Match.is('?'), () => {
        // TODO: show help dialog
      })
    )
  })

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
                    return <text>{error.toString()}</text>
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
            {Option.map(
              dialog,
              Dialog.Dialog.$match({
                GoToDate: () => (
                  <Dialog.Component>
                    <text>Go to date</text>
                    <input placeholder='YYYY-MM-DD' onSubmit={goToDate} />
                  </Dialog.Component>
                ),
                Help: () => null,
              })
            ).pipe(Option.getOrNull)}
          </>
        ),
        GameDetails: ({ gamePk }) => <GameDetailsView gamePk={gamePk} />,
      })}
    </box>
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

const FileLoggerLive = Logger.replaceScoped(
  Logger.defaultLogger,
  Logger.jsonLogger.pipe(PlatformLogger.toFile('debug.log', { batchWindow: '500  millis' }))
).pipe(Layer.provide(BunFileSystem.layer))

BunRuntime.runMain(program.pipe(Effect.provide(FileLoggerLive)))
