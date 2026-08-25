import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

import * as Game from './Game'
import * as Status from './Status'

/** A date on the official schedule, independent of the viewer's timezone. */
export const ScheduleDate = Schema.String.pipe(Schema.brand('ScheduleDate'))
export type ScheduleDate = typeof ScheduleDate.Type

/**
 * A date-specific occurrence. The selected schedule date and game reference
 * must travel together so a later makeup cannot overwrite a postponed slate.
 */
export const ScheduleOccurrence = Schema.TaggedUnion({
  Available: {
    selectedDate: ScheduleDate,
    game: Game.Game,
    rescheduledTo: Schema.optionalKey(ScheduleDate),
    rescheduledFrom: Schema.optionalKey(ScheduleDate),
  },
  Unavailable: {
    selectedDate: ScheduleDate,
    message: Schema.NonEmptyString,
  },
})
export type ScheduleOccurrence = typeof ScheduleOccurrence.Type
export type AvailableScheduleOccurrence = Extract<
  ScheduleOccurrence,
  { readonly _tag: 'Available' }
>

export interface Schedule {
  readonly date: ScheduleDate
  readonly occurrences: ReadonlyArray<ScheduleOccurrence>
}

export const Schedule = Schema.Struct({
  date: ScheduleDate,
  occurrences: Schema.Array(ScheduleOccurrence),
})

export const hasNonTerminalGame = (schedule: Schedule): boolean =>
  schedule.occurrences.some(
    (occurrence) => occurrence._tag === 'Available' && !Status.isTerminal(occurrence.game.status),
  )

export class ScheduleUnavailable extends Schema.TaggedError<ScheduleUnavailable>()(
  'ScheduleUnavailable',
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export interface ScheduleServiceApi {
  readonly get: (date: DateTime.DateTime) => Effect.Effect<Schedule, ScheduleUnavailable>
}

/** Public application service: normalized schedules and typed application errors only. */
export class ScheduleService extends Context.Service<ScheduleService, ScheduleServiceApi>()(
  '@macklinu/ballgame/ScheduleService',
) {}
