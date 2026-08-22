import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as Atom from 'effect/unstable/reactivity/Atom'

export const isSameDay = (a: DateTime.DateTime, b: DateTime.DateTime) =>
  DateTime.formatIsoDate(a) === DateTime.formatIsoDate(b)

export const now = (): DateTime.DateTime =>
  DateTime.makeZonedUnsafe(DateTime.nowUnsafe(), {
    timeZone: DateTime.zoneMakeLocal(),
  }).pipe(DateTime.startOf('day'))

export const dateAtom = Atom.make(DateTime.makeUnsafe('2025-07-02') as DateTime.DateTime).pipe(
  Atom.keepAlive,
)

export const goToDateAtom = Atom.fn(
  Effect.fnUntraced(
    function* (input: string, ctx: Atom.FnContext) {
      const date = yield* Schema.decodeUnknownEffect(Schema.DateTimeUtcFromString)(input)
      ctx.set(dateAtom, date)
    },
    Effect.provide(DateTime.layerCurrentZoneNamed('UTC')),
  ),
)

export const nextDay = (date: DateTime.DateTime) =>
  date.pipe(DateTime.add({ days: 1 }), DateTime.startOf('day'))

export const previousDay = (date: DateTime.DateTime) =>
  date.pipe(DateTime.subtract({ days: 1 }), DateTime.startOf('day'))
