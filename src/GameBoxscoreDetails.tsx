import { TextAttributes } from '@opentui/core'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'

import * as Game from './Game'
import * as Status from './Status'

const unavailable = '—'

const optionText = <A extends string | number>(value: Option.Option<A>): string =>
  Option.getOrElse(Option.map(value, String), () => unavailable)

const abbreviated = (value: string, width: number): string =>
  value.length <= width ? value : `${value.slice(0, Math.max(width - 1, 0))}…`

const Cell = ({
  children,
  width,
  align = 'right',
}: {
  readonly children: string
  readonly width: number
  readonly align?: 'left' | 'right'
}) => {
  const content = abbreviated(children, width)

  return <span>{align === 'left' ? content.padEnd(width) : content.padStart(width)}</span>
}

const isBoxscoreGame = (status: Status.GameStatus): boolean =>
  Status.isScoreBearing(status) ||
  Match.value(status.state).pipe(
    Match.whenOr('Active', 'Delayed', 'UnderReview', () => true),
    Match.orElse(() => false),
  )

const Linescore = ({ game, linescore }: Pick<BoxscoreDetailsProps, 'game' | 'linescore'>) =>
  Option.match(linescore, {
    onNone: () => (
      <box flexDirection='column' borderStyle='single' title='Inning linescore' padding={1}>
        <text attributes={TextAttributes.DIM}>Linescore unavailable.</text>
      </box>
    ),
    onSome: (availableLinescore) => {
      const innings = availableLinescore.innings

      return (
        <box flexDirection='column' borderStyle='single' title='Inning linescore' padding={1}>
          <text>
            <Cell width={4} align='left'>
              Team
            </Cell>{' '}
            {innings.map((inning) => (
              <span key={inning.number}>
                <Cell width={2}>{String(inning.number)}</Cell>{' '}
              </span>
            ))}
            | <Cell width={2}>R</Cell> <Cell width={2}>H</Cell> <Cell width={2}>E</Cell>
          </text>
          <text>
            <Cell width={4} align='left'>
              {game.awayTeam.abbreviation}
            </Cell>{' '}
            {innings.map((inning) => (
              <span key={inning.number}>
                <Cell width={2}>{optionText(inning.away.runs)}</Cell>{' '}
              </span>
            ))}
            | <Cell width={2}>{optionText(availableLinescore.away.runs)}</Cell>{' '}
            <Cell width={2}>{optionText(availableLinescore.away.hits)}</Cell>{' '}
            <Cell width={2}>{optionText(availableLinescore.away.errors)}</Cell>
          </text>
          <text>
            <Cell width={4} align='left'>
              {game.homeTeam.abbreviation}
            </Cell>{' '}
            {innings.map((inning) => (
              <span key={inning.number}>
                <Cell width={2}>{optionText(inning.home.runs)}</Cell>{' '}
              </span>
            ))}
            | <Cell width={2}>{optionText(availableLinescore.home.runs)}</Cell>{' '}
            <Cell width={2}>{optionText(availableLinescore.home.hits)}</Cell>{' '}
            <Cell width={2}>{optionText(availableLinescore.home.errors)}</Cell>
          </text>
        </box>
      )
    },
  })

const BattingTable = ({
  lines,
  team,
}: {
  lines: ReadonlyArray<Game.BattingBoxscoreLine>
  team: string
}) => {
  if (lines.length === 0) {
    return <text attributes={TextAttributes.DIM}>{team} batting unavailable.</text>
  }

  return (
    <box flexDirection='column'>
      <text>{team}</text>
      <text>
        <Cell width={18} align='left'>
          Player
        </Cell>{' '}
        <Cell width={3} align='left'>
          Pos
        </Cell>{' '}
        <Cell width={2}>AB</Cell> <Cell width={2}>R</Cell> <Cell width={2}>H</Cell>{' '}
        <Cell width={3}>RBI</Cell> <Cell width={2}>BB</Cell> <Cell width={2}>SO</Cell>{' '}
        <Cell width={2}>HR</Cell>
      </text>
      {lines.map(({ player, stats }) => (
        <text key={player.ref}>
          <Cell width={18} align='left'>
            {player.name}
          </Cell>{' '}
          <Cell width={3} align='left'>
            {optionText(player.position)}
          </Cell>{' '}
          <Cell width={2}>{optionText(stats.atBats)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.runs)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.hits)}</Cell>{' '}
          <Cell width={3}>{optionText(stats.runsBattedIn)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.walks)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.strikeOuts)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.homeRuns)}</Cell>
        </text>
      ))}
    </box>
  )
}

const PitchingTable = ({
  lines,
  team,
}: {
  lines: ReadonlyArray<Game.PitchingBoxscoreLine>
  team: string
}) => {
  if (lines.length === 0) {
    return <text attributes={TextAttributes.DIM}>{team} pitching unavailable.</text>
  }

  return (
    <box flexDirection='column'>
      <text>{team}</text>
      <text>
        <Cell width={18} align='left'>
          Player
        </Cell>{' '}
        <Cell width={3}>IP</Cell> <Cell width={2}>H</Cell> <Cell width={2}>R</Cell>{' '}
        <Cell width={2}>ER</Cell> <Cell width={2}>BB</Cell> <Cell width={2}>SO</Cell>{' '}
        <Cell width={2}>HR</Cell>
      </text>
      {lines.map(({ player, stats }) => (
        <text key={player.ref}>
          <Cell width={18} align='left'>
            {player.name}
          </Cell>{' '}
          <Cell width={3}>{optionText(stats.inningsPitched)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.hits)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.runs)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.earnedRuns)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.walks)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.strikeOuts)}</Cell>{' '}
          <Cell width={2}>{optionText(stats.homeRuns)}</Cell>
        </text>
      ))}
    </box>
  )
}

const Boxscore = ({ game, boxscore }: Pick<BoxscoreDetailsProps, 'game' | 'boxscore'>) =>
  Option.match(boxscore, {
    onNone: () => (
      <>
        <box flexDirection='column' borderStyle='single' title='Batting' padding={1}>
          <text attributes={TextAttributes.DIM}>Batting unavailable.</text>
        </box>
        <box flexDirection='column' borderStyle='single' title='Pitching' padding={1}>
          <text attributes={TextAttributes.DIM}>Pitching unavailable.</text>
        </box>
      </>
    ),
    onSome: (availableBoxscore) => (
      <>
        <box flexDirection='column' gap={1} borderStyle='single' title='Batting' padding={1}>
          <BattingTable lines={availableBoxscore.away.batting} team={game.awayTeam.name} />
          <BattingTable lines={availableBoxscore.home.batting} team={game.homeTeam.name} />
        </box>
        <box flexDirection='column' gap={1} borderStyle='single' title='Pitching' padding={1}>
          <PitchingTable lines={availableBoxscore.away.pitching} team={game.awayTeam.name} />
          <PitchingTable lines={availableBoxscore.home.pitching} team={game.homeTeam.name} />
        </box>
      </>
    ),
  })

export interface BoxscoreDetailsProps {
  readonly game: Game.Game
  readonly linescore: Option.Option<Game.Linescore>
  readonly boxscore: Option.Option<Game.Boxscore>
}

export const BoxscoreDetails = ({ game, linescore, boxscore }: BoxscoreDetailsProps) => {
  if (!isBoxscoreGame(game.status)) {
    return null
  }

  return (
    <>
      <Linescore game={game} linescore={linescore} />
      <Boxscore game={game} boxscore={boxscore} />
    </>
  )
}
