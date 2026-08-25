import * as Schema from 'effect/Schema'

const StatusFields = {
  label: Schema.NonEmptyString,
  reason: Schema.optionalKey(Schema.NonEmptyString),
}

/**
 * The normalized state of a game or a date-specific schedule occurrence.
 *
 * Provider codes intentionally do not appear here. The variants encode the
 * distinctions the application needs for display, score policy, and polling.
 */
export const GameStatus = Schema.TaggedUnion({
  Scheduled: StatusFields,
  Warmup: StatusFields,
  Active: StatusFields,
  Delayed: StatusFields,
  UnderReview: StatusFields,
  Suspended: StatusFields,
  Final: StatusFields,
  CompletedEarly: StatusFields,
  Tied: StatusFields,
  Forfeit: StatusFields,
  Postponed: StatusFields,
  Cancelled: StatusFields,
  Unknown: StatusFields,
})
export type GameStatus = typeof GameStatus.Type

export const isActivelyInProgress = (status: GameStatus): boolean =>
  status._tag === 'Warmup' ||
  status._tag === 'Active' ||
  status._tag === 'Delayed' ||
  status._tag === 'UnderReview'

export const isScoreBearing = (status: GameStatus): boolean =>
  status._tag === 'Final' ||
  status._tag === 'CompletedEarly' ||
  status._tag === 'Tied' ||
  status._tag === 'Forfeit'

export const isTerminal = (status: GameStatus): boolean =>
  isScoreBearing(status) || status._tag === 'Postponed' || status._tag === 'Cancelled'
