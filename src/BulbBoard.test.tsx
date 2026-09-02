import { it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { describe, expect } from 'vitest'

import { BulbBoard } from './BulbBoard'
import * as Game from './Game'
import * as OpenTuiTest from './OpenTuiTest'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

const selectedDate = Schedule.ScheduleDate.make('2025-04-05')

const at = (value: string) => Schema.decodeSync(Schema.DateTimeUtcFromString)(value)

const team = ({
  ref,
  abbreviation,
}: {
  readonly ref: string
  readonly abbreviation: string
}): Team.Team =>
  Team.Team.make({
    ref: Team.TeamRef.make(ref),
    name: `${abbreviation} Club`,
    abbreviation,
    shortName: abbreviation,
  })

const occurrence = ({
  ref,
  startsAt,
  type = 'RegularSeason',
  state = 'Scheduled',
  label = 'Scheduled',
  score,
}: {
  readonly ref: string
  readonly startsAt: string
  readonly type?: Game.GameType
  readonly state?: Status.GameState
  readonly label?: string
  readonly score?: { readonly away: number; readonly home: number }
}): Schedule.AvailableScheduleOccurrence =>
  Schedule.AvailableScheduleOccurrence.make({
    selectedDate,
    game: Game.Game.make({
      ref: Game.GameRef.make(ref),
      type,
      startsAt: at(startsAt),
      awayTeam: team({ ref: `away-${ref}`, abbreviation: `A${ref}` }),
      homeTeam: team({ ref: `home-${ref}`, abbreviation: `H${ref}` }),
      status: Status.GameStatus.make({ state, label, reason: Option.none() }),
      score: score === undefined ? Option.none() : Option.some(Game.Score.make(score)),
    }),
    rescheduledTo: Option.none(),
    rescheduledFrom: Option.none(),
  })

const unavailableOccurrence = Schedule.UnavailableScheduleOccurrence.make({
  selectedDate,
  message: 'Game data unavailable',
  diagnostic: new Schedule.ScheduleOccurrenceDiagnostic({
    message: 'The schedule entry could not be mapped.',
  }),
})

describe('bulb board', () => {
  it.effect('uses fixed bulb glyphs and text at 80 by 24 without color-only meaning', () =>
    Effect.gen(function* () {
      const game = occurrence({
        ref: 'final',
        startsAt: '2025-04-05T20:10:00Z',
        state: 'Final',
        label: 'Final',
        score: { away: 3, home: 5 },
      })
      const ui = yield* OpenTuiTest.make({
        node: (
          <BulbBoard
            occurrences={[game]}
            selection={Option.none()}
            onOpenOccurrence={() => undefined}
          />
        ),
        options: { width: 80, height: 24 },
      })

      yield* ui.renderOnce

      const frame = yield* ui.captureCharFrame
      expect(frame).toContain('Enter opens')
      expect(frame).toContain('●')
      expect(frame).toContain('○')
      expect(frame).toContain('Regular season')
      expect(frame).toContain('Final')
      expect(frame).toContain('AFI @ HFI')
    }),
  )

  it.effect('renders every required state, game type, and unavailable row', () =>
    Effect.gen(function* () {
      const states: ReadonlyArray<Schedule.ScheduleOccurrence> = [
        occurrence({ ref: 'spring', startsAt: '2025-04-05T17:10:00Z', type: 'SpringTraining' }),
        occurrence({
          ref: 'exhibition',
          startsAt: '2025-04-05T18:10:00Z',
          type: 'Exhibition',
          state: 'Active',
          label: 'Top 3rd',
        }),
        occurrence({
          ref: 'regular',
          startsAt: '2025-04-05T19:10:00Z',
          type: 'RegularSeason',
          state: 'Final',
          label: 'Final',
          score: { away: 3, home: 5 },
        }),
        occurrence({
          ref: 'all-star',
          startsAt: '2025-04-05T20:10:00Z',
          type: 'AllStar',
          state: 'Delayed',
          label: 'Delayed',
        }),
        occurrence({
          ref: 'postseason',
          startsAt: '2025-04-05T21:10:00Z',
          type: 'Postseason',
          state: 'Postponed',
          label: 'Postponed',
        }),
        occurrence({
          ref: 'other',
          startsAt: '2025-04-05T22:10:00Z',
          type: 'Other',
          state: 'Suspended',
          label: 'Suspended',
        }),
        occurrence({
          ref: 'cancelled',
          startsAt: '2025-04-05T23:10:00Z',
          state: 'Cancelled',
          label: 'Cancelled',
        }),
        unavailableOccurrence,
      ]
      const ui = yield* OpenTuiTest.make({
        node: (
          <BulbBoard
            occurrences={states}
            selection={Option.none()}
            onOpenOccurrence={() => undefined}
          />
        ),
        options: { width: 120, height: 60 },
      })

      yield* ui.renderOnce

      const frame = yield* ui.captureCharFrame
      for (const text of [
        'Scheduled',
        'Live: Top 3rd',
        'Final',
        'Delayed',
        'Postponed',
        'Suspended',
        'Cancelled',
        'Unavailable game',
        'Spring training',
        'Exhibition',
        'Regular season',
        'All-Star game',
        'Postseason',
        'Other official game',
      ]) {
        expect(frame).toContain(text)
      }
    }),
  )

  it.effect('keeps rows in scheduled-start order', () =>
    Effect.gen(function* () {
      const ui = yield* OpenTuiTest.make({
        node: (
          <BulbBoard
            occurrences={[
              occurrence({ ref: 'late', startsAt: '2025-04-05T23:10:00Z', label: 'Late start' }),
              occurrence({ ref: 'early', startsAt: '2025-04-05T17:10:00Z', label: 'Early start' }),
              occurrence({
                ref: 'middle',
                startsAt: '2025-04-05T20:10:00Z',
                label: 'Middle start',
              }),
            ]}
            selection={Option.none()}
            onOpenOccurrence={() => undefined}
          />
        ),
        options: { width: 120, height: 40 },
      })

      yield* ui.renderOnce

      const frame = yield* ui.captureCharFrame
      expect(frame.indexOf('Early start')).toBeLessThan(frame.indexOf('Middle start'))
      expect(frame.indexOf('Middle start')).toBeLessThan(frame.indexOf('Late start'))
    }),
  )

  it.effect('renders the concise no-games state', () =>
    Effect.gen(function* () {
      const ui = yield* OpenTuiTest.make({
        node: (
          <BulbBoard
            occurrences={[]}
            selection={Option.none()}
            onOpenOccurrence={() => undefined}
          />
        ),
        options: { width: 80, height: 24 },
      })

      yield* ui.renderOnce

      expect(yield* ui.captureCharFrame).toContain('No games today.')
    }),
  )
})
