import { TextAttributes } from '@opentui/core'
import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'

import type { ScheduleOccurrenceRef } from './AppState'
import * as Game from './Game'
import { BoxscoreDetails } from './GameBoxscoreDetails'
import { PregameDetails } from './GamePregameDetails'

const ScheduledContext = ({ overview, occurrence }: GameDetailsProps) => (
  <box flexDirection='column' gap={1}>
    <text>
      Scheduled for{' '}
      {DateTime.formatLocal(overview.game.startsAt, { dateStyle: 'medium', timeStyle: 'short' })}
    </text>
    <text attributes={TextAttributes.DIM}>Selected schedule: {occurrence.selectedDate}</text>
  </box>
)

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
        <BoxscoreDetails game={game} linescore={overview.linescore} boxscore={overview.boxscore} />
      </scrollbox>
    </box>
  )
}
