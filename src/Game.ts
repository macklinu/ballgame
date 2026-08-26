import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
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

export interface Score {
  readonly away: number
  readonly home: number
}

export const Score = Schema.Struct({
  away: Schema.Int,
  home: Schema.Int,
})

export interface Game {
  readonly ref: GameRef
  readonly type: GameType
  readonly startsAt: DateTime.Utc
  readonly awayTeam: Team.Team
  readonly homeTeam: Team.Team
  readonly status: Status.GameStatus
  readonly score: Option.Option<Score>
}

export const Game = Schema.Struct({
  ref: GameRef,
  type: GameType,
  startsAt: Schema.DateTimeUtc,
  awayTeam: Team.Team,
  homeTeam: Team.Team,
  status: Status.GameStatus,
  score: Schema.OptionFromOptionalKey(Score),
})

export class GameNotFound extends Schema.TaggedError<GameNotFound>()('GameNotFound', {
  gameRef: GameRef,
}) {}

export class GameUnavailable extends Schema.TaggedError<GameUnavailable>()('GameUnavailable', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface GameServiceApi {
  readonly get: (gameRef: GameRef) => Effect.Effect<Game, GameNotFound | GameUnavailable>
}

/** Public application service: normalized games and typed application errors only. */
export class GameService extends Context.Service<GameService, GameServiceApi>()(
  '@macklinu/ballgame/GameService',
) {}
