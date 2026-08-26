import * as DateTime from 'effect/DateTime'

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
