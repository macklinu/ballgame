import type { BoxProps } from '@opentui/react'
import * as Option from 'effect/Option'

import { formatGameState } from './DailyScheduleState'
import * as Game from './Game'

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
      <text>{formatGameState(game)}</text>
      <text>{isSelected ? ' <' : '  '}</text>
    </box>
  )
}

export interface Props extends BoxProps {
  game: Game.Game
  isSelected: boolean
}
