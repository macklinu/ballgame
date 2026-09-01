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
  value,
  width,
  align = 'right',
}: {
  readonly value: string
  readonly width: number
  readonly align?: 'left' | 'right'
}) => {
  const content = abbreviated(value, width)

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
            <Cell value='Team' width={4} align='left' />{' '}
            {innings.map((inning) => (
              <span key={inning.number}>
                <Cell value={String(inning.number)} width={2} />{' '}
              </span>
            ))}
            | <Cell value='R' width={2} /> <Cell value='H' width={2} /> <Cell value='E' width={2} />
          </text>
          <text>
            <Cell value={game.awayTeam.abbreviation} width={4} align='left' />{' '}
            {innings.map((inning) => (
              <span key={inning.number}>
                <Cell value={optionText(inning.away.runs)} width={2} />{' '}
              </span>
            ))}
            | <Cell value={optionText(availableLinescore.away.runs)} width={2} />{' '}
            <Cell value={optionText(availableLinescore.away.hits)} width={2} />{' '}
            <Cell value={optionText(availableLinescore.away.errors)} width={2} />
          </text>
          <text>
            <Cell value={game.homeTeam.abbreviation} width={4} align='left' />{' '}
            {innings.map((inning) => (
              <span key={inning.number}>
                <Cell value={optionText(inning.home.runs)} width={2} />{' '}
              </span>
            ))}
            | <Cell value={optionText(availableLinescore.home.runs)} width={2} />{' '}
            <Cell value={optionText(availableLinescore.home.hits)} width={2} />{' '}
            <Cell value={optionText(availableLinescore.home.errors)} width={2} />
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
        <Cell value='Player' width={18} align='left' /> <Cell value='Pos' width={3} align='left' />{' '}
        <Cell value='AB' width={2} /> <Cell value='R' width={2} /> <Cell value='H' width={2} />{' '}
        <Cell value='RBI' width={3} /> <Cell value='BB' width={2} /> <Cell value='SO' width={2} />{' '}
        <Cell value='HR' width={2} />
      </text>
      {lines.map(({ player, stats }) => (
        <text key={player.ref}>
          <Cell value={player.name} width={18} align='left' />{' '}
          <Cell value={optionText(player.position)} width={3} align='left' />{' '}
          <Cell value={optionText(stats.atBats)} width={2} />{' '}
          <Cell value={optionText(stats.runs)} width={2} />{' '}
          <Cell value={optionText(stats.hits)} width={2} />{' '}
          <Cell value={optionText(stats.runsBattedIn)} width={3} />{' '}
          <Cell value={optionText(stats.walks)} width={2} />{' '}
          <Cell value={optionText(stats.strikeOuts)} width={2} />{' '}
          <Cell value={optionText(stats.homeRuns)} width={2} />
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
        <Cell value='Player' width={18} align='left' /> <Cell value='IP' width={3} />{' '}
        <Cell value='H' width={2} /> <Cell value='R' width={2} /> <Cell value='ER' width={2} />{' '}
        <Cell value='BB' width={2} /> <Cell value='SO' width={2} /> <Cell value='HR' width={2} />
      </text>
      {lines.map(({ player, stats }) => (
        <text key={player.ref}>
          <Cell value={player.name} width={18} align='left' />{' '}
          <Cell value={optionText(stats.inningsPitched)} width={3} />{' '}
          <Cell value={optionText(stats.hits)} width={2} />{' '}
          <Cell value={optionText(stats.runs)} width={2} />{' '}
          <Cell value={optionText(stats.earnedRuns)} width={2} />{' '}
          <Cell value={optionText(stats.walks)} width={2} />{' '}
          <Cell value={optionText(stats.strikeOuts)} width={2} />{' '}
          <Cell value={optionText(stats.homeRuns)} width={2} />
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
