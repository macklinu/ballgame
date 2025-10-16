import * as Option from 'effect/Option'
import { Box, Text, type BoxProps } from 'ink'

import * as Game from './Game'

export interface Props extends BoxProps {
  game: Game.Game
  isSelected: boolean
}

export const GameGridItem = ({ game, isSelected, ...props }: Props) => {
  return (
    <Box
      {...props}
      flexDirection='row'
      justifyContent='space-between'
      padding={1}
      borderStyle='single'
      borderColor={isSelected ? 'white' : 'gray'}
    >
      <Box flexDirection='row' gap={4} flexGrow={1}>
        <Box flexDirection='column'>
          <Text>{game.awayTeam.abbreviation}</Text>
          <Text>{game.homeTeam.abbreviation}</Text>
        </Box>
        {Game.hasStarted(game) && (
          <Box flexDirection='column'>
            <Text>
              {Game.awayTeamScore(game).pipe(Option.getOrElse(() => 0))}
            </Text>
            <Text>
              {Game.homeTeamScore(game).pipe(Option.getOrElse(() => 0))}
            </Text>
          </Box>
        )}
      </Box>
      <Box>
        <Text>{Game.currentTime(game)}</Text>
      </Box>
    </Box>
  )
}
