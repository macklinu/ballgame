import type { BoxProps } from '@opentui/react'
import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'

import * as Game from './Game'

export const gameStateText = (game: Game.Game): string => {
  switch (game.status.state) {
    case 'Scheduled':
      return DateTime.formatLocal(game.startsAt, { timeStyle: 'short' })
    case 'Warmup':
      return 'Warmup'
    case 'Active':
      return game.progress.pipe(
        Option.flatMap((progress) =>
          Option.all({ inning: progress.currentInning, half: progress.inningHalf }).pipe(
            Option.map(({ inning, half }) => {
              const outs = progress.outs.pipe(
                Option.map((value) => `  ${value} ${value === 1 ? 'out' : 'outs'}`),
                Option.getOrElse(() => ''),
              )

              return `${half === 'Top' ? 'T' : 'B'}${inning}${outs}`
            }),
          ),
        ),
        Option.getOrElse(() => 'In progress'),
      )
    case 'Delayed':
      return 'Delayed'
    case 'UnderReview':
      return 'Review'
    case 'Suspended':
      return 'Suspended'
    case 'Final':
    case 'CompletedEarly':
      return game.progress.pipe(
        Option.flatMap((progress) =>
          Option.all({
            currentInning: progress.currentInning,
            scheduledInnings: progress.scheduledInnings,
          }),
        ),
        Option.match({
          onNone: () => 'F',
          onSome: ({ currentInning, scheduledInnings }) =>
            currentInning > scheduledInnings ? `F/${currentInning}` : 'F',
        }),
      )
    case 'Tied':
      return 'Tied'
    case 'Forfeit':
      return 'Forfeit'
    case 'Postponed':
      return 'PPD'
    case 'Cancelled':
      return 'Cancelled'
    case 'Unknown':
      return 'Unavailable'
  }
}

export const DailyScheduleRow = ({ game, isSelected, ...props }: Props) => {
  const awayScore = game.score.pipe(
    Option.map((value) => String(value.away).padStart(2)),
    Option.getOrElse(() => '  '),
  )
  const homeScore = game.score.pipe(
    Option.map((value) => String(value.home).padStart(2)),
    Option.getOrElse(() => '  '),
  )
  const matchup = `${game.awayTeam.abbreviation.padEnd(3)}${awayScore}  @ ${game.homeTeam.abbreviation.padEnd(3)}${homeScore}`

  return (
    <box {...props} flexDirection='row' flexShrink={1}>
      <text>{isSelected ? '> ' : '  '}</text>
      <text>{matchup}</text>
      <box flexGrow={1} />
      <text>{gameStateText(game)}</text>
      <text>{isSelected ? ' <' : '  '}</text>
    </box>
  )
}

export interface Props extends BoxProps {
  game: Game.Game
  isSelected: boolean
}
