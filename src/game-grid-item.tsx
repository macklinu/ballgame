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
        {Option.match(game.score, {
          onNone: () => null,
          onSome: (score) => (
            <box flexDirection='column'>
              <text>{score.away}</text>
              <text>{score.home}</text>
            </box>
          ),
        })}
      </box>
      <box>
        <text>{game.status.label}</text>
      </box>
    </box>
  )
}
