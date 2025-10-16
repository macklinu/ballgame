import * as DateTime from 'effect/DateTime'
import * as Match from 'effect/Match'
import * as Schema from 'effect/Schema'

import * as Status from './Status'
import * as Team from './Team'

const InningState = Schema.Literal('Top', 'Bottom', 'Middle', 'End')
type InningState = typeof InningState.Type

const abbreviatedInningState = (inningState: InningState) => {
  switch (inningState) {
    case 'Bottom':
      return 'Bot'
    case 'Middle':
      return 'Mid'
    default:
      return inningState
  }
}

class Linescore extends Schema.Class<Linescore>('Linescore')({
  scheduledInnings: Schema.Number,
}) {
  static Live = class Live extends Linescore.extend<Live>('Live')({
    inningState: InningState,
    inningHalf: Schema.Literal('Top', 'Bottom'),
    currentInning: Schema.Number,
    currentInningOrdinal: Schema.String,
    outs: Schema.Number,
    balls: Schema.Number,
    strikes: Schema.Number,
    isTopInning: Schema.Boolean,
  }) {}
}

export class Game extends Schema.Class<Game>('Game')({
  gamePk: Schema.Number,
  gameGuid: Schema.UUID,
  gameType: Schema.String,
  season: Schema.String,
  gameDate: Schema.DateTimeUtc,
  officialDate: Schema.DateTimeUtc,
  teams: Schema.Struct({
    away: Schema.Struct({
      leagueRecord: Schema.Struct({
        wins: Schema.Number,
        losses: Schema.Number,
        pct: Schema.String,
      }),
      score: Schema.Number.pipe(Schema.OptionFromUndefinedOr),
      team: Team.Team,
      splitSquad: Schema.Boolean,
      seriesNumber: Schema.Number,
    }),
    home: Schema.Struct({
      leagueRecord: Schema.Struct({
        wins: Schema.Number,
        losses: Schema.Number,
        pct: Schema.String,
      }),
      score: Schema.Number.pipe(Schema.OptionFromUndefinedOr),
      team: Team.Team,
      splitSquad: Schema.Boolean,
      seriesNumber: Schema.Number,
    }),
  }),
}) {
  get awayTeam() {
    return this.teams.away.team
  }

  get homeTeam() {
    return this.teams.home.team
  }
}

export class PreviewGame extends Game.extend<PreviewGame>('PreviewGame')({
  status: Status.PreviewStatus,
  linescore: Linescore,
}) {}

export class LiveGame extends Game.extend<LiveGame>('LiveGame')({
  status: Status.LiveStatus,
  linescore: Linescore.Live,
}) {}

export class FinalGame extends Game.extend<FinalGame>('FinalGame')({
  status: Status.FinalStatus,
  linescore: Linescore.Live,
}) {}

export const GameSchema = Schema.Union(PreviewGame, LiveGame, FinalGame)

export const currentTime = Match.type<Game>().pipe(
  Match.when(Match.instanceOf(PreviewGame), (game) =>
    DateTime.formatLocal(game.gameDate, { timeStyle: 'short' })
  ),
  Match.when(Match.instanceOf(LiveGame), ({ linescore, status }) =>
    status.statusCode === 'PW'
      ? status.detailedState
      : `${abbreviatedInningState(linescore.inningState)} ${linescore.currentInning}`
  ),
  Match.when(Match.instanceOf(FinalGame), ({ linescore }) => {
    if (linescore.currentInning !== 9) {
      return `F/${linescore.currentInning}`
    }
    return 'F'
  }),
  Match.orElseAbsurd
)

const teamScore = (teamType: 'home' | 'away') => (game: LiveGame | FinalGame) =>
  game.teams[teamType].score

export const homeTeamScore = teamScore('home')
export const awayTeamScore = teamScore('away')

export const hasStarted = (game: Game) =>
  game instanceof LiveGame || game instanceof FinalGame
