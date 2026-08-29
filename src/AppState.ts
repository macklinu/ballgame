import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { nextDay, now, parseLocalCalendarDate, previousDay } from './date'
import * as Game from './Game'
import * as Schedule from './Schedule'

/** A date-specific identity for a selectable schedule occurrence. */
export interface ScheduleOccurrenceRef {
  readonly selectedDate: Schedule.ScheduleDate
  readonly gameRef: Game.GameRef
}

export const ScheduleOccurrenceRef = Schema.Struct({
  selectedDate: Schedule.ScheduleDate,
  gameRef: Game.GameRef,
})

export const occurrenceRef = (
  occurrence: Schedule.AvailableScheduleOccurrence,
): ScheduleOccurrenceRef =>
  ScheduleOccurrenceRef.make({
    selectedDate: occurrence.selectedDate,
    gameRef: occurrence.game.ref,
  })

export const isSelectedOccurrence = (
  selection: Option.Option<ScheduleOccurrenceRef>,
  occurrence: Schedule.AvailableScheduleOccurrence,
): boolean =>
  Option.match(selection, {
    onNone: () => false,
    onSome: (selected) =>
      selected.selectedDate === occurrence.selectedDate && selected.gameRef === occurrence.game.ref,
  })

export type Route = Data.TaggedEnum<{
  Schedule: {}
  GameDetails: Readonly<{ occurrence: ScheduleOccurrenceRef }>
}>
export const Route = Data.taggedEnum<Route>()

export type Overlay = Data.TaggedEnum<{
  GoToDate: {}
  Help: {}
}>
export const Overlay = Data.taggedEnum<Overlay>()

export class InvalidLocalCalendarDate extends Schema.TaggedError<InvalidLocalCalendarDate>()(
  'InvalidLocalCalendarDate',
  { input: Schema.String },
) {}

export const selectedDateAtom = Atom.make(now()).pipe(Atom.keepAlive)
export const selectedOccurrenceAtom = Atom.make<Option.Option<ScheduleOccurrenceRef>>(Option.none())
export const routeStackAtom = Atom.make<ReadonlyArray<Route>>([Route.Schedule()])
export const overlayStackAtom = Atom.make<ReadonlyArray<Overlay>>([])

const availableOccurrences = (
  schedule: Schedule.Schedule,
): ReadonlyArray<Schedule.AvailableScheduleOccurrence> =>
  schedule.occurrences.filter(Schedule.isAvailableScheduleOccurrence)

const includesOccurrence = (
  occurrences: ReadonlyArray<Schedule.AvailableScheduleOccurrence>,
  selection: ScheduleOccurrenceRef,
): boolean =>
  occurrences.some(
    (occurrence) =>
      occurrence.selectedDate === selection.selectedDate &&
      occurrence.game.ref === selection.gameRef,
  )

export const firstAvailableOccurrence = (
  schedule: Schedule.Schedule,
): Option.Option<ScheduleOccurrenceRef> =>
  Option.fromNullishOr(availableOccurrences(schedule)[0]).pipe(Option.map(occurrenceRef))

export const moveSelection = (
  schedule: Schedule.Schedule,
  selection: Option.Option<ScheduleOccurrenceRef>,
  direction: 'previous' | 'next',
): Option.Option<ScheduleOccurrenceRef> => {
  const occurrences = availableOccurrences(schedule)
  if (occurrences.length === 0) {
    return Option.none()
  }

  const selectedIndex = Option.match(selection, {
    onNone: () => -1,
    onSome: (selected) =>
      occurrences.findIndex(
        (occurrence) =>
          occurrence.selectedDate === selected.selectedDate &&
          occurrence.game.ref === selected.gameRef,
      ),
  })
  const edge = direction === 'previous' ? occurrences.length - 1 : 0
  const nextIndex =
    selectedIndex === -1
      ? edge
      : Math.max(
          0,
          Math.min(occurrences.length - 1, selectedIndex + (direction === 'next' ? 1 : -1)),
        )
  const occurrence = occurrences[nextIndex]

  return occurrence === undefined ? Option.none() : Option.some(occurrenceRef(occurrence))
}

const resetSelection = (ctx: Atom.FnContext) => {
  ctx.set(selectedOccurrenceAtom, Option.none())
}

export const previousDateAtom = Atom.fnSync<void>((_, ctx) => {
  ctx.set(selectedDateAtom, previousDay(ctx(selectedDateAtom)))
  resetSelection(ctx)
})

export const nextDateAtom = Atom.fnSync<void>((_, ctx) => {
  ctx.set(selectedDateAtom, nextDay(ctx(selectedDateAtom)))
  resetSelection(ctx)
})

export const todayAtom = Atom.fnSync<void>((_, ctx) => {
  ctx.set(selectedDateAtom, now())
  resetSelection(ctx)
})

export const goToDateAtom = Atom.fn(
  Effect.fnUntraced(function* (input: string, ctx: Atom.FnContext) {
    const date = yield* Effect.fromOption(
      parseLocalCalendarDate(input),
      () => new InvalidLocalCalendarDate({ input }),
    )
    ctx.set(selectedDateAtom, date)
    resetSelection(ctx)
  }),
)

export const synchronizeSelectionAtom = Atom.fnSync<void, Schedule.Schedule>((schedule, ctx) => {
  const selection = ctx(selectedOccurrenceAtom)
  const occurrences = availableOccurrences(schedule)

  if (Option.isSome(selection) && includesOccurrence(occurrences, selection.value)) {
    return
  }

  ctx.set(selectedOccurrenceAtom, firstAvailableOccurrence(schedule))
})

export const selectPreviousOccurrenceAtom = Atom.fnSync<void, Schedule.Schedule>(
  (schedule, ctx) => {
    ctx.set(
      selectedOccurrenceAtom,
      moveSelection(schedule, ctx(selectedOccurrenceAtom), 'previous'),
    )
  },
)

export const selectNextOccurrenceAtom = Atom.fnSync<void, Schedule.Schedule>((schedule, ctx) => {
  ctx.set(selectedOccurrenceAtom, moveSelection(schedule, ctx(selectedOccurrenceAtom), 'next'))
})

export const selectOccurrenceAtom = Atom.fnSync<void, Schedule.AvailableScheduleOccurrence>(
  (occurrence, ctx) => {
    ctx.set(selectedOccurrenceAtom, Option.some(occurrenceRef(occurrence)))
  },
)

export const openSelectedGameAtom = Atom.fnSync<void>((_, ctx) => {
  Option.match(ctx(selectedOccurrenceAtom), {
    onNone: () => undefined,
    onSome: (occurrence) => {
      ctx.set(routeStackAtom, [...ctx(routeStackAtom), Route.GameDetails({ occurrence })])
    },
  })
})

export const popRouteAtom = Atom.fnSync<void>((_, ctx) => {
  const routes = ctx(routeStackAtom)
  if (routes.length > 1) {
    ctx.set(routeStackAtom, routes.slice(0, -1))
  }
})

export const openOverlayAtom = Atom.fnSync<void, Overlay>((overlay, ctx) => {
  ctx.set(overlayStackAtom, [...ctx(overlayStackAtom), overlay])
})

export const closeOverlayAtom = Atom.fnSync<void>((_, ctx) => {
  const overlays = ctx(overlayStackAtom)
  if (overlays.length > 0) {
    ctx.set(overlayStackAtom, overlays.slice(0, -1))
  }
})
