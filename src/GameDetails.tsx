import { TextAttributes } from '@opentui/core'
import * as DateTime from 'effect/DateTime'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'

import type { ScheduleOccurrenceRef } from './AppState'
import * as Game from './Game'
import { PregameDetails } from './GamePregameDetails'
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

const ScheduledContext = ({ overview, occurrence }: GameDetailsProps) => (
  <box flexDirection='column' gap={1}>
    <text>
      Scheduled for{' '}
      {DateTime.formatLocal(overview.game.startsAt, { dateStyle: 'medium', timeStyle: 'short' })}
    </text>
    <text attributes={TextAttributes.DIM}>Selected schedule: {occurrence.selectedDate}</text>
  </box>
)

const Linescore = ({ overview }: { overview: Game.GameOverview }) =>
  Option.match(overview.linescore, {
    onNone: () => (
      <box flexDirection='column' borderStyle='single' title='Inning linescore' padding={1}>
        <text attributes={TextAttributes.DIM}>Linescore unavailable.</text>
      </box>
    ),
    onSome: (linescore) => {
      const innings = linescore.innings
      const inningHeader = innings.map((inning) => cell(String(inning.number), 2)).join(' ')
      const inningValues = (team: 'away' | 'home') =>
        innings.map((inning) => cell(optionText(inning[team].runs), 2)).join(' ')
      const total = (team: 'away' | 'home') => {
        const values = linescore[team]
        return `${cell(optionText(values.runs), 2)} ${cell(optionText(values.hits), 2)} ${cell(optionText(values.errors), 2)}`
      }

      return (
        <box flexDirection='column' borderStyle='single' title='Inning linescore' padding={1}>
          <text>{`Team ${inningHeader} |  R  H  E`}</text>
          <text>{`${cell(overview.game.awayTeam.abbreviation, 4, 'left')} ${inningValues('away')} | ${total('away')}`}</text>
          <text>{`${cell(overview.game.homeTeam.abbreviation, 4, 'left')} ${inningValues('home')} | ${total('home')}`}</text>
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

const Boxscore = ({ overview }: { overview: Game.GameOverview }) =>
  Option.match(overview.boxscore, {
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
    onSome: (boxscore) => (
      <>
        <box flexDirection='column' gap={1} borderStyle='single' title='Batting' padding={1}>
          <BattingTable lines={boxscore.away.batting} team={overview.game.awayTeam.name} />
          <BattingTable lines={boxscore.home.batting} team={overview.game.homeTeam.name} />
        </box>
        <box flexDirection='column' gap={1} borderStyle='single' title='Pitching' padding={1}>
          <PitchingTable lines={boxscore.away.pitching} team={overview.game.awayTeam.name} />
          <PitchingTable lines={boxscore.home.pitching} team={overview.game.homeTeam.name} />
        </box>
      </>
    ),
  })

export interface GameDetailsProps {
  readonly overview: Game.GameOverview
  readonly occurrence: ScheduleOccurrenceRef
  readonly isRefreshUnavailable?: boolean
  readonly onBack?: () => void
}

/** Renders an adaptive, normalized selected-game snapshot without provider fields. */
export const GameDetails = ({
  overview,
  occurrence,
  isRefreshUnavailable = false,
  onBack,
}: GameDetailsProps) => {
  const { game } = overview
  const boxscoreGame = isBoxscoreGame(game.status)
  const pregame = game.status.state === 'Scheduled' || game.status.state === 'Warmup'

  return (
    <box
      width='100%'
      flexGrow={1}
      flexShrink={1}
      flexDirection='column'
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection='column' gap={1} paddingBottom={1}>
        <text>
          <b>
            {game.awayTeam.name} at {game.homeTeam.name}
          </b>
        </text>
        <text>{game.status.label}</text>
        {isRefreshUnavailable ? (
          <text attributes={TextAttributes.DIM}>Refresh unavailable; showing last update.</text>
        ) : null}
        {Option.match(game.status.reason, {
          onNone: () => null,
          onSome: (reason) => <text>Reason: {reason}</text>,
        })}
        <ScheduledContext overview={overview} occurrence={occurrence} />
        <text attributes={TextAttributes.DIM}>
          Up/Down scroll · Page Up/Page Down page · Escape returns to board
        </text>
      </box>
      <scrollbox
        id='game-details-scroll'
        focused
        flexGrow={1}
        flexShrink={1}
        scrollY
        contentOptions={{ flexDirection: 'column', gap: 1, paddingBottom: 1 }}
        verticalScrollbarOptions={{ showArrows: true }}
        onKeyDown={(event) => {
          if (event.name === 'escape') {
            event.preventDefault()
            onBack?.()
          }
        }}
      >
        {pregame ? (
          <PregameDetails
            awayTeamName={game.awayTeam.name}
            homeTeamName={game.homeTeam.name}
            probablePitchers={overview.probablePitchers}
            lineups={overview.lineups}
          />
        ) : null}
        {boxscoreGame ? (
          <>
            <Linescore overview={overview} />
            <Boxscore overview={overview} />
          </>
        ) : null}
      </scrollbox>
    </box>
  )
}
