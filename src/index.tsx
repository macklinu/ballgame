import {
  Atom,
  Result,
  useAtom,
  useAtomRefresh,
  useAtomValue,
} from '@effect-atom/atom-react'
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { Spinner, TextInput } from '@inkjs/ui'
import { pipe } from 'effect'
import * as Console from 'effect/Console'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Match from 'effect/Match'
import * as Number from 'effect/Number'
import * as Option from 'effect/Option'
import { Box, render, Spacer, Text, useApp, useInput } from 'ink'
import BigText from 'ink-big-text'
import { useEffect, useMemo } from 'react'

import { dateAtom, isSameDay, nextDay, now, previousDay } from './date'
import * as Dialog from './Dialog'
import { FullScreenBox } from './full-screen-box'
import * as Game from './Game'
import { GameGridItem } from './game-grid-item'
import { Loading } from './loading'
import { getSchedule, ScheduleResponse } from './Schedule'
import { useMeasureElement } from './use-measure-element'
import { useCurrentView, View } from './View'

const fetchRuntime = Atom.runtime(FetchHttpClient.layer)

const scheduleAtom = Atom.family((date: DateTime.DateTime) =>
  fetchRuntime
    .atom(getSchedule(DateTime.formatIsoDate(date)))
    .pipe(Atom.setIdleTTL(Duration.minutes(5)), Atom.keepAlive)
)

const gameFeedAtom = Atom.family((gamePk: number) =>
  Atom.runtime(Game.Api.Default).atom(
    Effect.gen(function* () {
      const api = yield* Game.Api
      return yield* api.getGameFeed(gamePk)
    })
  )
)

const selectedGameIndexAtom = Atom.make(0)

const CenteredContainer = ({ children }: { children: React.ReactNode }) => (
  <Box
    justifyContent='center'
    flexDirection='column'
    alignItems='center'
    paddingY={4}
  >
    {children}
  </Box>
)

const isSubsequentWaiting = <A, E>(result: Result.Result<A, E>): boolean =>
  Result.isNotInitial(result) && Result.isWaiting(result)

const whenSuccess = <A, E>(
  result: Result.Result<A, E>,
  onSuccess: (a: A) => void
) => {
  if (Result.isSuccess(result)) {
    onSuccess(result.value)
  }
}

const NoGamesScheduled = () => <Text dimColor>No games scheduled</Text>

const KeyboardShortcut = ({
  shortcut,
  description,
}: {
  shortcut: string
  description: string
}) => (
  <Box flexDirection='row' flexWrap='wrap' gap={1} alignItems='center'>
    <Box paddingX={1} backgroundColor='white'>
      <Text color='black' bold>
        {shortcut}
      </Text>
    </Box>
    <Text dimColor>{description}</Text>
  </Box>
)

const DailyGameView = ({ schedule }: { schedule: ScheduleResponse }) => {
  const date = useAtomValue(dateAtom)
  const selectedGameIndex = useAtomValue(selectedGameIndexAtom)
  const day = schedule.dates.find((d) => isSameDay(d.date, date))

  const box = useMeasureElement()

  if (!day || day.totalGames === 0) {
    return (
      <CenteredContainer>
        <NoGamesScheduled />
      </CenteredContainer>
    )
  }

  return (
    <>
      <Box
        ref={box.ref}
        flexDirection='row'
        gap={1}
        paddingX={8}
        paddingY={2}
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
      </Box>
    </>
  )
}

const GameDetailsView = ({ gamePk }: { gamePk: number }) => {
  const game = useAtomValue(gameFeedAtom(gamePk))
  return (
    <Box flexDirection='column' padding={2} borderStyle='single'>
      <Text>Game Details for {gamePk}</Text>
      {Result.builder(game)
        .onSuccess(({ gamePk }) => <Text>Game details for {gamePk}!</Text>)
        .onError((error) => <Text>Error loading game: {String(error)}</Text>)
        .orNull()}
    </Box>
  )
}

const App = () => {
  const app = useApp()

  const { currentView, isNestedView, pushView, popView } = useCurrentView()
  const { dialog, showDialog, closeDialog } = Dialog.useCurrentDialog()

  const [date, setDate] = useAtom(dateAtom)
  const schedule = useAtomValue(scheduleAtom(date))
  const refreshSchedule = useAtomRefresh(scheduleAtom(date))
  const [selectedGameIndex, setSelectedGameIndex] = useAtom(
    selectedGameIndexAtom
  )

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
              : dates[0]!.games.some(
                    (game) => game.status.abstractGameCode === 'L'
                  )
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

  useInput((input, key) => {
    Match.value(key).pipe(
      Match.when({ escape: true }, () => {
        if (Option.isSome(dialog)) {
          closeDialog()
        } else if (isNestedView) {
          popView()
        }
      }),
      Match.when({ leftArrow: true }, () => {
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
      }),
      Match.when({ rightArrow: true }, () => {
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
      }),
      Match.when({ upArrow: true }, () => {}),
      Match.when({ downArrow: true }, () => {}),
      Match.when({ return: true }, () => {
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
      })
    )
    Match.value(input).pipe(
      Match.when(Match.is('q'), () => app.exit()),
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
    <FullScreenBox
      display='flex'
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
            <Box alignSelf='center'>
              <BigText
                text='Ballgame'
                font='tiny'
                colors={['blue', 'white', 'red']}
              />
            </Box>
            <Box flexDirection='column' alignItems='center'>
              <Box flexDirection='column' gap={1}>
                <Text bold>
                  {DateTime.formatLocal(date, { dateStyle: 'full' })}
                </Text>
                <Box alignSelf='center' minHeight={4}>
                  {isSubsequentWaiting(schedule) ? <Spinner /> : null}
                </Box>
              </Box>
              {Result.builder(schedule)
                .onInitial(() => (
                  <CenteredContainer>
                    <Loading />
                  </CenteredContainer>
                ))
                .onFailure((error) => {
                  console.error(error)
                  return null
                })
                .onSuccess((schedule) => {
                  return <DailyGameView schedule={schedule} />
                })
                .orNull()}
            </Box>
            <Spacer />
            <Box
              paddingX={1}
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
            </Box>
            {Option.map(
              dialog,
              Dialog.Dialog.$match({
                GoToDate: () => (
                  <Dialog.Component>
                    <Text>Go to date</Text>
                    <TextInput
                      placeholder='YYYY-MM-DD'
                      onSubmit={(value) => {
                        // TODO
                      }}
                    />
                  </Dialog.Component>
                ),
                Help: () => null,
              })
            ).pipe(Option.getOrNull)}
          </>
        ),
        GameDetails: ({ gamePk }) => <GameDetailsView gamePk={gamePk} />,
      })}
    </FullScreenBox>
  )
}

const enterAltScreenCommand = Console.log('\x1b[?1049h')
const leaveAltScreenCommand = Console.log('\x1b[?1049l')

const renderApp = Effect.tryPromise(() => {
  const { waitUntilExit } = render(<App />)
  return waitUntilExit()
})

const program = Effect.gen(function* () {
  yield* enterAltScreenCommand
  yield* renderApp
  yield* leaveAltScreenCommand
})

// TODO: switch between BunRuntime and NodeRuntime based on env?
BunRuntime.runMain(program)
