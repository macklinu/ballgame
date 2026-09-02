import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
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
export const AvailableScheduleOccurrence = Schema.TaggedStruct('Available', {
  selectedDate: ScheduleDate,
  game: Game.Game,
  rescheduledTo: Schema.OptionFromOptionalKey(ScheduleDate),
  rescheduledFrom: Schema.OptionFromOptionalKey(ScheduleDate),
})
export type AvailableScheduleOccurrence = typeof AvailableScheduleOccurrence.Type

/** A stable, application-owned diagnostic for an unavailable schedule row. */
export class ScheduleOccurrenceDiagnostic extends Schema.TaggedError<ScheduleOccurrenceDiagnostic>()(
  'InvalidGameData',
  {
    message: Schema.NonEmptyString,
  },
) {}

export const UnavailableScheduleOccurrence = Schema.TaggedStruct('Unavailable', {
  selectedDate: ScheduleDate,
  message: Schema.NonEmptyString,
  diagnostic: ScheduleOccurrenceDiagnostic,
})
export type UnavailableScheduleOccurrence = typeof UnavailableScheduleOccurrence.Type

export const ScheduleOccurrence = Schema.Union([
  AvailableScheduleOccurrence,
  UnavailableScheduleOccurrence,
])
export type ScheduleOccurrence = typeof ScheduleOccurrence.Type

export const isAvailableScheduleOccurrence = Schema.is(AvailableScheduleOccurrence)
/**
 * Keeps known game starts in order while retaining an unavailable provider row
 * at its original schedule position.
 */
export const orderByScheduledStart = (
  occurrences: ReadonlyArray<ScheduleOccurrence>,
): ReadonlyArray<ScheduleOccurrence> => {
  const available = occurrences.filter(isAvailableScheduleOccurrence).toSorted((left, right) => {
    return DateTime.toEpochMillis(left.game.startsAt) - DateTime.toEpochMillis(right.game.startsAt)
  })
  let index = 0

  return occurrences.map((occurrence) => {
    if (!isAvailableScheduleOccurrence(occurrence)) {
      return occurrence
    }
    const ordered = available[index]
    index += 1
    return ordered ?? occurrence
  })
}

export interface Schedule {
  readonly date: ScheduleDate
  readonly occurrences: ReadonlyArray<ScheduleOccurrence>
}

export const Schedule = Schema.Struct({
  date: ScheduleDate,
  occurrences: Schema.Array(ScheduleOccurrence),
})

/** Whether this slate needs a live refresh rather than a one-time fetch. */
export const hasActivelyInProgressGame = (schedule: Schedule): boolean =>
  schedule.occurrences.some(
    (occurrence) =>
      isAvailableScheduleOccurrence(occurrence) &&
      Status.isActivelyInProgress(occurrence.game.status),
  )

export class ScheduleUnavailable extends Data.TaggedError('ScheduleUnavailable') {}

export interface ScheduleServiceApi {
  readonly get: (date: DateTime.DateTime) => Effect.Effect<Schedule, ScheduleUnavailable>
}

/** Public application service: normalized schedules and typed application errors only. */
export class ScheduleService extends Context.Service<ScheduleService, ScheduleServiceApi>()(
  '@macklinu/ballgame/ScheduleService',
) {}
