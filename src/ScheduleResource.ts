import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import * as EffectSchedule from 'effect/Schedule'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { appAtomRuntime } from './Runtime'
import * as Schedule from './Schedule'

export const ScheduleSnapshot = Schema.Struct({
  schedule: Schedule.Schedule,
  refreshedAt: Schema.DateTimeUtc,
})
export type ScheduleSnapshot = typeof ScheduleSnapshot.Type

export const ReadySchedule = Schema.TaggedStruct('Ready', {
  snapshot: ScheduleSnapshot,
})
export type ReadySchedule = typeof ReadySchedule.Type

/** A provider-independent transient state suitable for direct display. */
export const RetryingSchedule = Schema.TaggedStruct('Retrying', {
  lastSuccessful: Schema.OptionFromOptionalKey(ScheduleSnapshot),
})
export type RetryingSchedule = typeof RetryingSchedule.Type

/** The complete public state of a date-specific live schedule refresh. */
export const ScheduleRefresh = Schema.Union([ReadySchedule, RetryingSchedule]).pipe(
  Schema.toTaggedUnion('_tag'),
)
export type ScheduleRefresh = typeof ScheduleRefresh.Type

const refreshInterval = '15 seconds'

const shouldContinuePolling = ScheduleRefresh.match({
  Ready: ({ snapshot }) => Schedule.hasActivelyInProgressGame(snapshot.schedule),
  Retrying: () => true,
})

/**
 * Fetches once immediately, then only polls an active selected-day slate.
 * Failures become a concise public retrying state and retain any prior snapshot.
 */
export const scheduleRefreshForDate = (date: DateTime.DateTime) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const scheduleService = yield* Schedule.ScheduleService
      const lastSuccessful = yield* Ref.make<Option.Option<ScheduleSnapshot>>(Option.none())

      const refresh = Effect.fn('ScheduleRefresh.refresh')(function* () {
        const previous = yield* Ref.get(lastSuccessful)

        return yield* scheduleService.get(date).pipe(
          Effect.flatMap((schedule) =>
            DateTime.now.pipe(
              Effect.map((refreshedAt) => ScheduleSnapshot.make({ schedule, refreshedAt })),
            ),
          ),
          Effect.tap((snapshot) => Ref.set(lastSuccessful, Option.some(snapshot))),
          Effect.map((snapshot) => ReadySchedule.make({ snapshot })),
          Effect.catchTag('ScheduleUnavailable', () =>
            Effect.succeed(
              RetryingSchedule.make({
                lastSuccessful: previous,
              }),
            ),
          ),
        )
      })

      return Stream.fromEffectSchedule(refresh(), EffectSchedule.spaced(refreshInterval)).pipe(
        Stream.takeUntil((refresh) => !shouldContinuePolling(refresh)),
      )
    }),
  )

export const scheduleForDateAtom = Atom.family((date: DateTime.DateTime) =>
  appAtomRuntime.atom(scheduleRefreshForDate(date)),
)
