import * as Schema from 'effect/Schema'

/**
 * Private MLB provider wire schemas. This module is an adapter implementation
 * detail and is not re-exported from Ballgame's application contracts.
 */
export const Status = Schema.Struct({
  codedGameState: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  detailedState: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  statusCode: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  reason: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
})
export type Status = typeof Status.Type

export const Team = Schema.Struct({
  id: Schema.Int,
  name: Schema.NonEmptyString,
  abbreviation: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  shortName: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
})
export type Team = typeof Team.Type

export const TeamLine = Schema.Struct({
  team: Team,
  score: Schema.OptionFromOptionalNullOr(Schema.Int),
})
export type TeamLine = typeof TeamLine.Type

export const Person = Schema.Struct({
  id: Schema.Int,
  fullName: Schema.NonEmptyString,
})
export type Person = typeof Person.Type

export const Position = Schema.Struct({
  abbreviation: Schema.NonEmptyString,
})
export type Position = typeof Position.Type

export const LinescoreTeam = Schema.Struct({
  runs: Schema.OptionFromOptionalNullOr(Schema.Int),
  hits: Schema.OptionFromOptionalNullOr(Schema.Int),
  errors: Schema.OptionFromOptionalNullOr(Schema.Int),
  leftOnBase: Schema.OptionFromOptionalNullOr(Schema.Int),
})
export type LinescoreTeam = typeof LinescoreTeam.Type

export const InningLinescore = Schema.Struct({
  num: Schema.Int,
  away: Schema.OptionFromOptionalNullOr(LinescoreTeam),
  home: Schema.OptionFromOptionalNullOr(LinescoreTeam),
})
export type InningLinescore = typeof InningLinescore.Type

export const Linescore = Schema.Struct({
  scheduledInnings: Schema.OptionFromOptionalNullOr(Schema.Int),
  currentInning: Schema.OptionFromOptionalNullOr(Schema.Int),
  inningHalf: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  teams: Schema.OptionFromOptionalNullOr(
    Schema.Struct({
      away: Schema.OptionFromOptionalNullOr(LinescoreTeam),
      home: Schema.OptionFromOptionalNullOr(LinescoreTeam),
    }),
  ),
  innings: Schema.OptionFromOptionalNullOr(Schema.Array(InningLinescore)),
})
export type Linescore = typeof Linescore.Type

export const BattingLine = Schema.Struct({
  atBats: Schema.OptionFromOptionalNullOr(Schema.Int),
  runs: Schema.OptionFromOptionalNullOr(Schema.Int),
  hits: Schema.OptionFromOptionalNullOr(Schema.Int),
  doubles: Schema.OptionFromOptionalNullOr(Schema.Int),
  triples: Schema.OptionFromOptionalNullOr(Schema.Int),
  homeRuns: Schema.OptionFromOptionalNullOr(Schema.Int),
  rbi: Schema.OptionFromOptionalNullOr(Schema.Int),
  baseOnBalls: Schema.OptionFromOptionalNullOr(Schema.Int),
  strikeOuts: Schema.OptionFromOptionalNullOr(Schema.Int),
  avg: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
})
export type BattingLine = typeof BattingLine.Type

export const PitchingLine = Schema.Struct({
  inningsPitched: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  hits: Schema.OptionFromOptionalNullOr(Schema.Int),
  runs: Schema.OptionFromOptionalNullOr(Schema.Int),
  earnedRuns: Schema.OptionFromOptionalNullOr(Schema.Int),
  baseOnBalls: Schema.OptionFromOptionalNullOr(Schema.Int),
  strikeOuts: Schema.OptionFromOptionalNullOr(Schema.Int),
  homeRuns: Schema.OptionFromOptionalNullOr(Schema.Int),
  era: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
})
export type PitchingLine = typeof PitchingLine.Type

export const PlayerStats = Schema.Struct({
  batting: Schema.OptionFromOptionalNullOr(BattingLine),
  pitching: Schema.OptionFromOptionalNullOr(PitchingLine),
})
export type PlayerStats = typeof PlayerStats.Type

export const BoxscorePlayer = Schema.Struct({
  person: Person,
  position: Schema.OptionFromOptionalNullOr(Position),
  battingOrder: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  stats: Schema.OptionFromOptionalNullOr(PlayerStats),
})
export type BoxscorePlayer = typeof BoxscorePlayer.Type

export const BoxscoreTeam = Schema.Struct({
  players: Schema.OptionFromOptionalNullOr(Schema.Record(Schema.String, BoxscorePlayer)),
  batters: Schema.OptionFromOptionalNullOr(Schema.Array(Schema.Int)),
  pitchers: Schema.OptionFromOptionalNullOr(Schema.Array(Schema.Int)),
})
export type BoxscoreTeam = typeof BoxscoreTeam.Type

export const Boxscore = Schema.Struct({
  teams: Schema.Struct({
    away: Schema.OptionFromOptionalNullOr(BoxscoreTeam),
    home: Schema.OptionFromOptionalNullOr(BoxscoreTeam),
  }),
})
export type Boxscore = typeof Boxscore.Type

export const ProbablePitchers = Schema.Struct({
  away: Schema.OptionFromOptionalNullOr(Person),
  home: Schema.OptionFromOptionalNullOr(Person),
})
export type ProbablePitchers = typeof ProbablePitchers.Type

export const GameFeed = Schema.Struct({
  gamePk: Schema.Int,
  gameData: Schema.Struct({
    game: Schema.Struct({
      pk: Schema.Int,
      type: Schema.NonEmptyString,
    }),
    datetime: Schema.Struct({
      dateTime: Schema.DateTimeUtcFromString,
    }),
    status: Status,
    teams: Schema.Struct({
      away: Team,
      home: Team,
    }),
    probablePitchers: Schema.OptionFromOptionalNullOr(Schema.Unknown),
  }),
  liveData: Schema.OptionFromOptionalNullOr(
    Schema.Struct({
      linescore: Schema.OptionFromOptionalNullOr(Schema.Unknown),
      boxscore: Schema.OptionFromOptionalNullOr(Schema.Unknown),
    }),
  ),
})
export type GameFeed = typeof GameFeed.Type

export const Game = Schema.Struct({
  gamePk: Schema.Int,
  gameType: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  gameDate: Schema.DateTimeUtcFromString,
  status: Status,
  teams: Schema.Struct({
    away: TeamLine,
    home: TeamLine,
  }),
  rescheduleDate: Schema.OptionFromOptionalNullOr(Schema.DateTimeUtcFromString),
  rescheduleGameDate: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
  rescheduledFrom: Schema.OptionFromOptionalNullOr(Schema.DateTimeUtcFromString),
  rescheduledFromDate: Schema.OptionFromOptionalNullOr(Schema.NonEmptyString),
})
export type Game = typeof Game.Type

export const ScheduleResponse = Schema.Struct({
  dates: Schema.Array(
    Schema.Struct({
      games: Schema.Array(Schema.Unknown),
    }),
  ),
})
export type ScheduleResponse = typeof ScheduleResponse.Type
