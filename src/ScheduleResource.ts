import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as EffectSchedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { appAtomRuntime } from './Runtime'
import * as Schedule from './Schedule'

const getScheduleForDate = Effect.fn('Schedule.getScheduleForDate')(function* (
  date: DateTime.DateTime,
) {
  const scheduleService = yield* Schedule.ScheduleService
  return yield* scheduleService.get(date)
})

export const scheduleForDateAtom = Atom.family((date: DateTime.DateTime) =>
  appAtomRuntime.atom(
    Stream.fromEffectSchedule(getScheduleForDate(date), EffectSchedule.spaced('15 seconds')).pipe(
      Stream.takeUntil((schedule) => !Schedule.hasNonTerminalGame(schedule)),
    ),
  ),
)
