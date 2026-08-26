import * as Schema from 'effect/Schema'

/**
 * A Ballgame-owned team reference. The MLB adapter assigns these references;
 * provider identifiers never leave that boundary.
 */
export const TeamRef = Schema.String.pipe(Schema.brand('TeamRef'))
export type TeamRef = typeof TeamRef.Type

export interface Team {
  readonly ref: TeamRef
  readonly name: string
  readonly abbreviation: string
  readonly shortName: string
}

export const Team = Schema.Struct({
  ref: TeamRef,
  name: Schema.NonEmptyString,
  abbreviation: Schema.NonEmptyString,
  shortName: Schema.NonEmptyString,
})
