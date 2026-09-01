import { TextAttributes } from '@opentui/core'
import * as Option from 'effect/Option'

import * as Game from './Game'

const displayName = (player: Game.Player): string =>
  Option.match(player.position, {
    onNone: () => player.name,
    onSome: (position) => `${player.name} (${position})`,
  })

const ProbablePitchers = ({ pitchers }: { pitchers: Game.ProbablePitchers }) => (
  <box flexDirection='column' gap={1} borderStyle='single' title='Probable pitchers' padding={1}>
    <text>
      Away: {Option.match(pitchers.away, { onNone: () => 'Not announced', onSome: displayName })}
    </text>
    <text>
      Home: {Option.match(pitchers.home, { onNone: () => 'Not announced', onSome: displayName })}
    </text>
  </box>
)

const Lineup = ({ players, team }: { players: ReadonlyArray<Game.LineupPlayer>; team: string }) => {
  if (players.length === 0) {
    return <text attributes={TextAttributes.DIM}>{team} lineup unavailable.</text>
  }

  return (
    <box flexDirection='column' gap={0}>
      <text>{team}</text>
      {players.map((entry) => (
        <text key={entry.player.ref}>
          {Option.getOrElse(Option.map(entry.battingOrder, String), () => '—')}.{' '}
          {displayName(entry.player)}
        </text>
      ))}
    </box>
  )
}

const Lineups = ({
  awayTeamName,
  homeTeamName,
  lineups,
}: Pick<PregameDetailsProps, 'awayTeamName' | 'homeTeamName' | 'lineups'>) =>
  Option.match(lineups, {
    onNone: () => (
      <box flexDirection='column' borderStyle='single' title='Lineups' padding={1}>
        <text attributes={TextAttributes.DIM}>Lineups not announced.</text>
      </box>
    ),
    onSome: (availableLineups) => (
      <box flexDirection='column' gap={1} borderStyle='single' title='Lineups' padding={1}>
        <Lineup players={availableLineups.away} team={awayTeamName} />
        <Lineup players={availableLineups.home} team={homeTeamName} />
      </box>
    ),
  })

export interface PregameDetailsProps {
  readonly awayTeamName: string
  readonly homeTeamName: string
  readonly probablePitchers: Game.ProbablePitchers
  readonly lineups: Option.Option<Game.Lineups>
}

export const PregameDetails = ({
  awayTeamName,
  homeTeamName,
  probablePitchers,
  lineups,
}: PregameDetailsProps) => (
  <>
    <ProbablePitchers pitchers={probablePitchers} />
    <Lineups awayTeamName={awayTeamName} homeTeamName={homeTeamName} lineups={lineups} />
  </>
)
