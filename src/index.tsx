import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import * as BunServices from '@effect/platform-bun/BunServices'
import { createCliRenderer, TextAttributes } from '@opentui/core'
import { createRoot, useKeyboard } from '@opentui/react'
import * as Cause from 'effect/Cause'
import * as Console from 'effect/Console'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Number from 'effect/Number'
import * as Option from 'effect/Option'
import * as Schedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useEffect, useMemo, useState } from 'react'

import { dateAtom, goToDateAtom, isSameDay, nextDay, now, previousDay } from './date'
import * as Game from './Game'
import { GameGridItem } from './game-grid-item'
import { Loading } from './loading'
import { ScheduleDate, ScheduleService } from './Schedule'
import { useCurrentView, View } from './View'

const scheduleRuntime = Atom.runtime(
  ScheduleService.layerFromFileSystem.pipe(Layer.provide(BunServices.layer)),
)

const getScheduleForDate = Effect.fn('Schedule.getScheduleForDate')(function* (
  date: DateTime.DateTime,
) {
  const scheduleService = yield* ScheduleService
  return yield* scheduleService.getSchedule(date)
})

const scheduleAtom = Atom.family((date: DateTime.DateTime) =>
  scheduleRuntime.atom(
    Stream.fromEffectSchedule(getScheduleForDate(date), Schedule.spaced('15 seconds')).pipe(
      Stream.takeUntil(
        (schedule) =>
          schedule.totalGames === 0 ||
          schedule.games.every((game) => game.status.abstractGameCode === 'F'),
      ),
    ),
  ),
)

const gameApiRuntime = Atom.runtime(
  Game.GameApi.layerLive.pipe(Layer.provide(FetchHttpClient.layer)),
)

const gameFeedAtom = Atom.family((gamePk: number) =>
  gameApiRuntime.atom(
    Effect.gen(function* () {
      const api = yield* Game.GameApi
      return yield* api.feed(gamePk)
    }),
  ),
)

const selectedGameIndexAtom = Atom.make(0)

const previousGameAtom = Atom.fnSync<DateTime.DateTime>()((date, get) => {
  const schedule = AsyncResult.getOrThrow(get(scheduleAtom(date)))

  const index = get(selectedGameIndexAtom)
  const newIndex = Number.clamp({
    minimum: 0,
    maximum: schedule.totalGames - 1,
  })(index - 1)

  get.set(selectedGameIndexAtom, newIndex)
})

const nextGameAtom = Atom.fnSync<DateTime.DateTime>()((date, get) => {
  const schedule = AsyncResult.getOrThrow(get(scheduleAtom(date)))

  const index = get(selectedGameIndexAtom)
  const newIndex = Number.clamp({
    minimum: 0,
    maximum: schedule.totalGames - 1,
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
      {AsyncResult.builder(game)
        .onSuccess(({ gamePk }) => <text>Game details for {gamePk}!</text>)
        .onError((error) => <text>Error loading game: {String(error)}</text>)
        .orNull()}
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
  const refreshSchedule = useAtomRefresh(scheduleAtom(date))
  const [selectedGameIndex, setSelectedGameIndex] = useAtom(selectedGameIndexAtom)

  const goToPreviousGame = useAtomSet(previousGameAtom)
  const goToNextGame = useAtomSet(nextGameAtom)

  useEffect(() => {
    setSelectedGameIndex(0)
  }, [schedule, setSelectedGameIndex])

  const refreshDuration = useMemo(
    () =>
      Option.fromNullishOr(
        AsyncResult.builder(schedule)
          .onSuccess(({ totalGames, games }) =>
            totalGames === 0
              ? null
              : games.some((game) => game.status.abstractGameCode === 'L')
                ? Duration.seconds(15)
                : null,
          )
          .orNull(),
      ),
    [schedule],
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
        pushView(
          View.GameDetails({
            gamePk: schedule.games[selectedGameIndex]!.gamePk,
          }),
        )
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
          GameDetails: ({ gamePk }) => <GameDetailsView gamePk={gamePk} />,
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
