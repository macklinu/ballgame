import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

import * as Game from './Game'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

export const startsAt = Schema.decodeSync(Schema.DateTimeUtcFromString)('2025-04-05T19:10:00Z')
export const selectedDate = Schedule.ScheduleDate.make('2025-04-05')

interface FixtureGameOptions {
  readonly ref: string
  readonly state: Status.GameState
  readonly away: string
  readonly home: string
  readonly score?: { readonly away: number; readonly home: number }
  readonly progress?: Game.GameProgress
}

export const makeFixtureGame = ({
  ref,
  state,
  away,
  home,
  score,
  progress,
}: FixtureGameOptions): Game.Game =>
  Game.Game.make({
    ref: Game.GameRef.make(ref),
    type: 'RegularSeason',
    startsAt,
    awayTeam: Team.Team.make({
      ref: Team.TeamRef.make(`away-${ref}`),
      name: `${away} Club`,
      abbreviation: away,
      shortName: away,
    }),
    homeTeam: Team.Team.make({
      ref: Team.TeamRef.make(`home-${ref}`),
      name: `${home} Club`,
      abbreviation: home,
      shortName: home,
    }),
    status: Status.GameStatus.make({ state, label: state, reason: Option.none() }),
    score: score === undefined ? Option.none() : Option.some(Game.Score.make(score)),
    progress: progress === undefined ? Option.none() : Option.some(progress),
  })

export const availableOccurrence = (game: Game.Game): Schedule.AvailableScheduleOccurrence =>
  Schedule.AvailableScheduleOccurrence.make({
    selectedDate,
    game,
    rescheduledTo: Option.none(),
    rescheduledFrom: Option.none(),
  })

export const activeProgress = Game.GameProgress.make({
  scheduledInnings: Option.some(9),
  currentInning: Option.some(7),
  inningHalf: Option.some('Bottom'),
  outs: Option.some(1),
})

export const extraInningProgress = Game.GameProgress.make({
  scheduledInnings: Option.some(9),
  currentInning: Option.some(10),
  inningHalf: Option.some('Bottom'),
  outs: Option.none(),
})
