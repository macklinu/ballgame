import type { BoxProps } from '@opentui/react'
import * as Option from 'effect/Option'

import * as Game from './Game'

export interface Props extends BoxProps {
  game: Game.Game
  isSelected: boolean
}

export const GameGridItem = ({ game, isSelected, ...props }: Props) => {
  return (
    <box
      {...props}
      flexDirection='row'
      justifyContent='space-between'
      padding={1}
      borderStyle='single'
      borderColor={isSelected ? 'white' : 'gray'}
    >
      <box flexDirection='row' gap={4} flexGrow={1}>
        <box flexDirection='column'>
          <text>{game.awayTeam.abbreviation}</text>
          <text>{game.homeTeam.abbreviation}</text>
        </box>
        {Game.hasStarted(game) && (
          <box flexDirection='column'>
            <text>{Game.awayTeamScore(game).pipe(Option.getOrElse(() => 0))}</text>
            <text>{Game.homeTeamScore(game).pipe(Option.getOrElse(() => 0))}</text>
          </box>
        )}
      </box>
      <box>
        <text>{Game.currentTime(game)}</text>
      </box>
    </box>
  )
}
