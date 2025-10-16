import { Atom } from '@effect-atom/atom-react'
import * as DateTime from 'effect/DateTime'

export const isSameDay = (a: DateTime.DateTime, b: DateTime.DateTime) =>
  DateTime.formatIsoDate(a) === DateTime.formatIsoDate(b)

export const now = (): DateTime.DateTime =>
  DateTime.unsafeMakeZoned(DateTime.unsafeNow(), {
    timeZone: DateTime.zoneMakeLocal(),
  }).pipe(DateTime.startOf('day'))

export const dateAtom = Atom.make(now()).pipe(Atom.keepAlive)

export const nextDay = (date: DateTime.DateTime) =>
  date.pipe(DateTime.add({ days: 1 }), DateTime.startOf('day'))

export const previousDay = (date: DateTime.DateTime) =>
  date.pipe(DateTime.subtract({ days: 1 }), DateTime.startOf('day'))
