import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
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
export interface AvailableScheduleOccurrence {
  readonly _tag: 'Available'
  readonly selectedDate: ScheduleDate
  readonly game: Game.Game
  readonly rescheduledTo: Option.Option<ScheduleDate>
  readonly rescheduledFrom: Option.Option<ScheduleDate>
}

export const AvailableScheduleOccurrence = Schema.TaggedStruct('Available', {
  selectedDate: ScheduleDate,
  game: Game.Game,
  rescheduledTo: Schema.OptionFromOptionalKey(ScheduleDate),
  rescheduledFrom: Schema.OptionFromOptionalKey(ScheduleDate),
})

export interface UnavailableScheduleOccurrence {
  readonly _tag: 'Unavailable'
  readonly selectedDate: ScheduleDate
  readonly message: string
}

const UnavailableScheduleOccurrence = Schema.TaggedStruct('Unavailable', {
  selectedDate: ScheduleDate,
  message: Schema.NonEmptyString,
})

export const ScheduleOccurrence = Schema.Union([
  AvailableScheduleOccurrence,
  UnavailableScheduleOccurrence,
])
export type ScheduleOccurrence = typeof ScheduleOccurrence.Type

export const isAvailableScheduleOccurrence = Schema.is(AvailableScheduleOccurrence)

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
    (occurrence) =>
      isAvailableScheduleOccurrence(occurrence) && !Status.isTerminal(occurrence.game.status),
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
