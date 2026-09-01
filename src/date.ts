import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'

const localCalendarDatePattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u

export const isSameDay = (a: DateTime.DateTime, b: DateTime.DateTime) =>
  DateTime.formatIsoDate(a) === DateTime.formatIsoDate(b)

export const now = (): DateTime.DateTime =>
  DateTime.makeZonedUnsafe(DateTime.nowUnsafe(), {
    timeZone: DateTime.zoneMakeLocal(),
  }).pipe(DateTime.startOf('day'))

export const nextDay = (date: DateTime.DateTime) =>
  date.pipe(DateTime.add({ days: 1 }), DateTime.startOf('day'))

export const previousDay = (date: DateTime.DateTime) =>
  date.pipe(DateTime.subtract({ days: 1 }), DateTime.startOf('day'))

/** Parses a user-entered calendar day in the viewer's local timezone. */
export const parseLocalCalendarDate = (input: string): Option.Option<DateTime.Zoned> => {
  const match = localCalendarDatePattern.exec(input)
  if (match?.groups === undefined) {
    return Option.none()
  }

  const year = Number(match.groups.year)
  const month = Number(match.groups.month)
  const day = Number(match.groups.day)

  return DateTime.makeZoned(
    { year, month, day },
    { timeZone: DateTime.zoneMakeLocal(), adjustForTimeZone: true },
  ).pipe(Option.filter((date) => DateTime.formatIsoDate(date) === input))
}
