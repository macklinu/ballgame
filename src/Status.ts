import * as Match from 'effect/Match'
import * as Schema from 'effect/Schema'

export const GameState = Schema.Literals([
  'Scheduled',
  'Warmup',
  'Active',
  'Delayed',
  'UnderReview',
  'Suspended',
  'Final',
  'CompletedEarly',
  'Tied',
  'Forfeit',
  'Postponed',
  'Cancelled',
  'Unknown',
])
export type GameState = typeof GameState.Type

/**
 * The normalized state of a game or a date-specific schedule occurrence.
 *
 * Provider codes intentionally do not appear here. The variants encode the
 * distinctions the application needs for display, score policy, and polling.
 */
export const GameStatus = Schema.Struct({
  state: GameState,
  label: Schema.NonEmptyString,
  reason: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
})
export type GameStatus = typeof GameStatus.Type

export const isActivelyInProgress = (status: GameStatus): boolean =>
  Match.value(status.state).pipe(
    Match.whenOr('Warmup', 'Active', 'Delayed', 'UnderReview', () => true),
    Match.orElse(() => false),
  )

export const isScoreBearing = (status: GameStatus): boolean =>
  Match.value(status.state).pipe(
    Match.whenOr('Final', 'CompletedEarly', 'Tied', 'Forfeit', () => true),
    Match.orElse(() => false),
  )

export const isTerminal = (status: GameStatus): boolean =>
  isScoreBearing(status) ||
  Match.value(status.state).pipe(
    Match.whenOr('Postponed', 'Cancelled', () => true),
    Match.orElse(() => false),
  )
