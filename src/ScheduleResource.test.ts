import { it } from '@effect/vitest'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'
import * as TestClock from 'effect/testing/TestClock'
import invariant from 'tiny-invariant'
import { describe, expect } from 'vitest'

import * as Game from './Game'
import * as Schedule from './Schedule'
import * as ScheduleResource from './ScheduleResource'
import * as Status from './Status'
import * as Team from './Team'

const selectedDate = Schema.decodeSync(Schema.DateTimeUtcFromString)('2025-04-05T00:00:00Z')

const team = ({ ref, name }: { readonly ref: string; readonly name: string }): Team.Team =>
  Team.Team.make({
    ref: Team.TeamRef.make(ref),
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    shortName: name,
  })

const scheduleWithState = ({ state }: { readonly state: Status.GameState }): Schedule.Schedule => {
  const date = Schedule.ScheduleDate.make('2025-04-05')
  const status = Status.GameStatus.make({ state, label: state, reason: Option.none() })
  const game = Game.Game.make({
    ref: Game.GameRef.make('game-1'),
    type: 'RegularSeason',
    startsAt: selectedDate,
    awayTeam: team({ ref: 'away', name: 'Away' }),
    homeTeam: team({ ref: 'home', name: 'Home' }),
    status,
    score: Option.none(),
    progress: Option.none(),
  })

  return Schedule.Schedule.make({
    date,
    occurrences: [
      Schedule.AvailableScheduleOccurrence.make({
        selectedDate: date,
        game,
        rescheduledTo: Option.none(),
        rescheduledFrom: Option.none(),
      }),
    ],
  })
}

type ControlledResponse = Effect.Effect<Schedule.Schedule, Schedule.ScheduleUnavailable>

const scheduleResponse = ({
  schedule,
}: {
  readonly schedule: Schedule.Schedule
}): ControlledResponse => Effect.succeed(schedule)

const unavailableResponse: ControlledResponse = Effect.fail(new Schedule.ScheduleUnavailable())

const takeResponse = (
  responses: ReadonlyArray<ControlledResponse>,
): readonly [ControlledResponse, ReadonlyArray<ControlledResponse>] => {
  const response = responses[0]
  invariant(response !== undefined, 'Test did not provide enough controlled schedule responses')

  return [response, responses.slice(1)]
}

const controlledScheduleService = ({
  responses,
}: {
  readonly responses: ReadonlyArray<ControlledResponse>
}) =>
  Effect.gen(function* () {
    const pending = yield* Ref.make(responses)
    const calls = yield* Ref.make(0)

    const get = Effect.fn('TestSchedule.get')(function* (_date: DateTime.DateTime) {
      const response = yield* Ref.modify(pending, takeResponse)
      yield* Ref.update(calls, (count) => count + 1)

      return yield* response
    })

    return {
      calls,
      layer: Layer.succeed(Schedule.ScheduleService, Schedule.ScheduleService.of({ get })),
    }
  })

const start = ({ date }: { readonly date: DateTime.DateTime }) =>
  Effect.gen(function* () {
    const updates = yield* Queue.unbounded<ScheduleResource.ScheduleRefresh>()
    yield* ScheduleResource.scheduleRefreshForDate(date).pipe(
      Stream.runForEach((refresh) => Queue.offer(updates, refresh)),
      Effect.forkScoped,
    )
    return updates
  })

const expectReadySchedule = ({
  refresh,
  state,
}: {
  readonly refresh: ScheduleResource.ScheduleRefresh
  readonly state: Status.GameState
}): ScheduleResource.ReadySchedule => {
  expect(refresh._tag).toBe('Ready')
  invariant(refresh._tag === 'Ready', 'Expected a ready schedule')

  const occurrence = refresh.snapshot.schedule.occurrences[0]
  expect(occurrence?._tag).toBe('Available')
  invariant(
    occurrence !== undefined && occurrence._tag === 'Available',
    'Expected an available schedule occurrence',
  )

  expect(occurrence.game.status.state).toBe(state)
  return refresh
}

describe('live schedule refresh', () => {
  it.effect('polls exactly every fifteen seconds while a slate is active', () =>
    Effect.gen(function* () {
      const controlled = yield* controlledScheduleService({
        responses: [
          scheduleResponse({ schedule: scheduleWithState({ state: 'Active' }) }),
          scheduleResponse({ schedule: scheduleWithState({ state: 'Final' }) }),
        ],
      })
      const updates = yield* start({ date: selectedDate }).pipe(Effect.provide(controlled.layer))
      expectReadySchedule({
        refresh: yield* Queue.take(updates),
        state: 'Active',
      })

      expect(yield* Ref.get(controlled.calls)).toBe(1)

      yield* TestClock.adjust('15 seconds')
      expectReadySchedule({ refresh: yield* Queue.take(updates), state: 'Final' })
      expect(yield* Ref.get(controlled.calls)).toBe(2)

      yield* TestClock.adjust('15 seconds')
      expect(yield* Ref.get(controlled.calls)).toBe(2)
    }),
  )

  it.effect('does not poll an inactive slate', () =>
    Effect.gen(function* () {
      const controlled = yield* controlledScheduleService({
        responses: [scheduleResponse({ schedule: scheduleWithState({ state: 'Scheduled' }) })],
      })
      const updates = yield* start({ date: selectedDate }).pipe(Effect.provide(controlled.layer))

      expectReadySchedule({ refresh: yield* Queue.take(updates), state: 'Scheduled' })
      expect(yield* Ref.get(controlled.calls)).toBe(1)
      yield* TestClock.adjust('15 seconds')
      expect(yield* Ref.get(controlled.calls)).toBe(1)
    }),
  )

  it.effect('retains the exact successful snapshot during a failed active refresh', () =>
    Effect.gen(function* () {
      const controlled = yield* controlledScheduleService({
        responses: [
          scheduleResponse({ schedule: scheduleWithState({ state: 'Active' }) }),
          unavailableResponse,
        ],
      })
      const updates = yield* start({ date: selectedDate }).pipe(Effect.provide(controlled.layer))
      const ready = expectReadySchedule({
        refresh: yield* Queue.take(updates),
        state: 'Active',
      })

      yield* TestClock.adjust('15 seconds')
      const retrying = yield* Queue.take(updates)

      expect(retrying).toEqual(
        ScheduleResource.RetryingSchedule.make({
          lastSuccessful: Option.some(ready.snapshot),
        }),
      )
      expect(yield* Ref.get(controlled.calls)).toBe(2)
    }),
  )

  it.effect('retries an initial failure until it receives an inactive slate', () =>
    Effect.gen(function* () {
      const controlled = yield* controlledScheduleService({
        responses: [
          unavailableResponse,
          scheduleResponse({ schedule: scheduleWithState({ state: 'Scheduled' }) }),
        ],
      })
      const updates = yield* start({ date: selectedDate }).pipe(Effect.provide(controlled.layer))
      const retrying = yield* Queue.take(updates)

      expect(retrying).toEqual(
        ScheduleResource.RetryingSchedule.make({
          lastSuccessful: Option.none(),
        }),
      )
      expect(yield* Ref.get(controlled.calls)).toBe(1)

      yield* TestClock.adjust('15 seconds')
      expectReadySchedule({ refresh: yield* Queue.take(updates), state: 'Scheduled' })
      expect(yield* Ref.get(controlled.calls)).toBe(2)

      yield* TestClock.adjust('15 seconds')
      expect(yield* Ref.get(controlled.calls)).toBe(2)
    }),
  )
})
