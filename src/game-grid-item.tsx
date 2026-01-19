import { useAtomValue } from '@effect-atom/atom-react'
import type { BoxProps } from '@opentui/react'
import * as Option from 'effect/Option'

import * as Game from './Game'
import { HighlightedText } from './HighlightedText'
import { teamsQuickSearchFilterAtom } from './QuickSearch'
import { buildSubstringSegments } from './SubstringMatch'

export interface Props extends BoxProps {
  game: Game.Game
  isSelected: boolean
}

export const GameGridItem = ({ game, isSelected, ...props }: Props) => {
  const teamsFilter = useAtomValue(teamsQuickSearchFilterAtom)
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
          <HighlightedText
            highlightColor='gray'
            segments={buildSubstringSegments(game.awayTeam.abbreviation, teamsFilter)}
          />
          <HighlightedText
            highlightColor='gray'
            segments={buildSubstringSegments(game.homeTeam.abbreviation, teamsFilter)}
          />
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
