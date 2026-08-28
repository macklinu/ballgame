import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

import * as Status from './Status'
import * as Team from './Team'

/**
 * A Ballgame-owned game reference. Its value is opaque to application code and
 * is never a provider identifier.
 */
export const GameRef = Schema.String.pipe(Schema.brand('GameRef'))
export type GameRef = typeof GameRef.Type

export const GameType = Schema.Literals([
  'SpringTraining',
  'Exhibition',
  'RegularSeason',
  'AllStar',
  'Postseason',
  'Other',
])
export type GameType = typeof GameType.Type

export const Score = Schema.Struct({
  away: Schema.Int,
  home: Schema.Int,
})
export type Score = typeof Score.Type

/** A Ballgame-owned player reference assigned by the provider adapter. */
export const PlayerRef = Schema.String.pipe(Schema.brand('PlayerRef'))
export type PlayerRef = typeof PlayerRef.Type

export const Player = Schema.Struct({
  ref: PlayerRef,
  name: Schema.NonEmptyString,
  position: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
})
export type Player = typeof Player.Type

/** A team total from a linescore. Missing values remain explicitly unavailable. */
export const TeamLinescore = Schema.Struct({
  runs: Schema.OptionFromOptionalKey(Schema.Int),
  hits: Schema.OptionFromOptionalKey(Schema.Int),
  errors: Schema.OptionFromOptionalKey(Schema.Int),
  leftOnBase: Schema.OptionFromOptionalKey(Schema.Int),
})
export type TeamLinescore = typeof TeamLinescore.Type

export const InningLinescore = Schema.Struct({
  number: Schema.Int,
  away: TeamLinescore,
  home: TeamLinescore,
})
export type InningLinescore = typeof InningLinescore.Type

/**
 * The score and inning table supplied by a game feed. Its optional values
 * distinguish unavailable information from a zero in a known score.
 */
export const Linescore = Schema.Struct({
  scheduledInnings: Schema.OptionFromOptionalKey(Schema.Int),
  currentInning: Schema.OptionFromOptionalKey(Schema.Int),
  inningHalf: Schema.OptionFromOptionalKey(Schema.Literals(['Top', 'Bottom'])),
  away: TeamLinescore,
  home: TeamLinescore,
  innings: Schema.Array(InningLinescore),
})
export type Linescore = typeof Linescore.Type

export const LineupPlayer = Schema.Struct({
  player: Player,
  battingOrder: Schema.OptionFromOptionalKey(Schema.Int),
})
export type LineupPlayer = typeof LineupPlayer.Type

export const Lineups = Schema.Struct({
  away: Schema.Array(LineupPlayer),
  home: Schema.Array(LineupPlayer),
})
export type Lineups = typeof Lineups.Type

export const ProbablePitchers = Schema.Struct({
  away: Schema.OptionFromOptionalKey(Player),
  home: Schema.OptionFromOptionalKey(Player),
})
export type ProbablePitchers = typeof ProbablePitchers.Type

/** Standard batting columns, retaining each unavailable statistic as an Option. */
export const BattingLine = Schema.Struct({
  atBats: Schema.OptionFromOptionalKey(Schema.Int),
  runs: Schema.OptionFromOptionalKey(Schema.Int),
  hits: Schema.OptionFromOptionalKey(Schema.Int),
  doubles: Schema.OptionFromOptionalKey(Schema.Int),
  triples: Schema.OptionFromOptionalKey(Schema.Int),
  homeRuns: Schema.OptionFromOptionalKey(Schema.Int),
  runsBattedIn: Schema.OptionFromOptionalKey(Schema.Int),
  walks: Schema.OptionFromOptionalKey(Schema.Int),
  strikeOuts: Schema.OptionFromOptionalKey(Schema.Int),
  average: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
})
export type BattingLine = typeof BattingLine.Type

/** Standard pitching columns, including baseball's display-specific innings value. */
export const PitchingLine = Schema.Struct({
  inningsPitched: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
  hits: Schema.OptionFromOptionalKey(Schema.Int),
  runs: Schema.OptionFromOptionalKey(Schema.Int),
  earnedRuns: Schema.OptionFromOptionalKey(Schema.Int),
  walks: Schema.OptionFromOptionalKey(Schema.Int),
  strikeOuts: Schema.OptionFromOptionalKey(Schema.Int),
  homeRuns: Schema.OptionFromOptionalKey(Schema.Int),
  earnedRunAverage: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
})
export type PitchingLine = typeof PitchingLine.Type

export const BattingBoxscoreLine = Schema.Struct({
  player: Player,
  stats: BattingLine,
})
export type BattingBoxscoreLine = typeof BattingBoxscoreLine.Type

export const PitchingBoxscoreLine = Schema.Struct({
  player: Player,
  stats: PitchingLine,
})
export type PitchingBoxscoreLine = typeof PitchingBoxscoreLine.Type

export const TeamBoxscore = Schema.Struct({
  batting: Schema.Array(BattingBoxscoreLine),
  pitching: Schema.Array(PitchingBoxscoreLine),
})
export type TeamBoxscore = typeof TeamBoxscore.Type

export const Boxscore = Schema.Struct({
  away: TeamBoxscore,
  home: TeamBoxscore,
})
export type Boxscore = typeof Boxscore.Type

export const Game = Schema.Struct({
  ref: GameRef,
  type: GameType,
  startsAt: Schema.DateTimeUtc,
  awayTeam: Team.Team,
  homeTeam: Team.Team,
  status: Status.GameStatus,
  score: Schema.OptionFromOptionalKey(Score),
})
export type Game = typeof Game.Type

/**
 * A single coherent, normalized selected-game snapshot. The game itself owns
 * the truthful matchup, scheduled start, and status; richer tables remain
 * optional because MLB serves meaningful pregame and non-score-bearing feeds.
 */
export const GameOverview = Schema.Struct({
  game: Game,
  linescore: Schema.OptionFromOptionalKey(Linescore),
  probablePitchers: ProbablePitchers,
  lineups: Schema.OptionFromOptionalKey(Lineups),
  boxscore: Schema.OptionFromOptionalKey(Boxscore),
})
export type GameOverview = typeof GameOverview.Type

export class GameNotFound extends Schema.TaggedError<GameNotFound>()('GameNotFound', {
  gameRef: GameRef,
}) {}

export class GameUnavailable extends Schema.TaggedError<GameUnavailable>()('GameUnavailable', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface GameServiceApi {
  readonly get: (gameRef: GameRef) => Effect.Effect<GameOverview, GameNotFound | GameUnavailable>
}

/** Public application service: normalized game overviews and typed application errors only. */
export class GameService extends Context.Service<GameService, GameServiceApi>()(
  '@macklinu/ballgame/GameService',
) {}
