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

const cell = (value: string, width: number, align: 'left' | 'right' = 'right'): string =>
  align === 'left'
    ? abbreviated(value, width).padEnd(width)
    : abbreviated(value, width).padStart(width)

const line = (values: ReadonlyArray<readonly [string, number, 'left' | 'right']>): string =>
  values.map(([value, width, align]) => cell(value, width, align)).join(' ')

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
      const inningHeader = innings.map((inning) => cell(String(inning.number), 2)).join(' ')
      const inningValues = (team: 'away' | 'home') =>
        innings.map((inning) => cell(optionText(inning[team].runs), 2)).join(' ')
      const total = (team: 'away' | 'home') => {
        const values = availableLinescore[team]
        return `${cell(optionText(values.runs), 2)} ${cell(optionText(values.hits), 2)} ${cell(optionText(values.errors), 2)}`
      }

      return (
        <box flexDirection='column' borderStyle='single' title='Inning linescore' padding={1}>
          <text>{`Team ${inningHeader} |  R  H  E`}</text>
          <text>{`${cell(game.awayTeam.abbreviation, 4, 'left')} ${inningValues('away')} | ${total('away')}`}</text>
          <text>{`${cell(game.homeTeam.abbreviation, 4, 'left')} ${inningValues('home')} | ${total('home')}`}</text>
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
        {line([
          ['Player', 18, 'left'],
          ['Pos', 3, 'left'],
          ['AB', 2, 'right'],
          ['R', 2, 'right'],
          ['H', 2, 'right'],
          ['RBI', 3, 'right'],
          ['BB', 2, 'right'],
          ['SO', 2, 'right'],
          ['HR', 2, 'right'],
        ])}
      </text>
      {lines.map(({ player, stats }) => (
        <text key={player.ref}>
          {line([
            [player.name, 18, 'left'],
            [optionText(player.position), 3, 'left'],
            [optionText(stats.atBats), 2, 'right'],
            [optionText(stats.runs), 2, 'right'],
            [optionText(stats.hits), 2, 'right'],
            [optionText(stats.runsBattedIn), 3, 'right'],
            [optionText(stats.walks), 2, 'right'],
            [optionText(stats.strikeOuts), 2, 'right'],
            [optionText(stats.homeRuns), 2, 'right'],
          ])}
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
        {line([
          ['Player', 18, 'left'],
          ['IP', 3, 'right'],
          ['H', 2, 'right'],
          ['R', 2, 'right'],
          ['ER', 2, 'right'],
          ['BB', 2, 'right'],
          ['SO', 2, 'right'],
          ['HR', 2, 'right'],
        ])}
      </text>
      {lines.map(({ player, stats }) => (
        <text key={player.ref}>
          {line([
            [player.name, 18, 'left'],
            [optionText(stats.inningsPitched), 3, 'right'],
            [optionText(stats.hits), 2, 'right'],
            [optionText(stats.runs), 2, 'right'],
            [optionText(stats.earnedRuns), 2, 'right'],
            [optionText(stats.walks), 2, 'right'],
            [optionText(stats.strikeOuts), 2, 'right'],
            [optionText(stats.homeRuns), 2, 'right'],
          ])}
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
