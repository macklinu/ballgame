import { it as effectIt } from '@effect/vitest'
import { ScrollBoxRenderable } from '@opentui/core'
import { testRender } from '@opentui/react/test-utils'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { act, useState } from 'react'
import { describe, expect } from 'vitest'

import type { ScheduleOccurrenceRef } from './AppState'
import * as Game from './Game'
import { GameDetails } from './GameDetails'
import * as Schedule from './Schedule'
import * as Status from './Status'
import * as Team from './Team'

const startsAt = Schema.decodeSync(Schema.DateTimeUtcFromString)('2025-04-05T20:10:00Z')
const occurrence: ScheduleOccurrenceRef = {
  selectedDate: Schedule.ScheduleDate.make('2025-04-05'),
  gameRef: Game.GameRef.make('game-1'),
}

const awayTeam = Team.Team.make({
  ref: Team.TeamRef.make('team-away'),
  name: 'Away Club',
  abbreviation: 'AWY',
  shortName: 'Away',
})

const homeTeam = Team.Team.make({
  ref: Team.TeamRef.make('team-home'),
  name: 'Home Club',
  abbreviation: 'HME',
  shortName: 'Home',
})

const player = (ref: string, name: string, position: string): Game.Player =>
  Game.Player.make({ ref: Game.PlayerRef.make(ref), name, position: Option.some(position) })

const game = (gameStatus: Status.GameStatus): Game.Game =>
  Game.Game.make({
    ref: occurrence.gameRef,
    type: 'RegularSeason',
    startsAt,
    awayTeam,
    homeTeam,
    status: gameStatus,
    score: Option.none(),
  })

const pitchers = Game.ProbablePitchers.make({
  away: Option.some(player('pitcher-away', 'Away Starter', 'P')),
  home: Option.some(player('pitcher-home', 'Home Starter', 'P')),
})

const scheduledOverview = Game.GameOverview.make({
  game: game(
    Status.GameStatus.make({ state: 'Scheduled', label: 'Scheduled', reason: Option.none() }),
  ),
  linescore: Option.none(),
  probablePitchers: pitchers,
  lineups: Option.none(),
  boxscore: Option.none(),
})

const scoreOverview = Game.GameOverview.make({
  game: game(Status.GameStatus.make({ state: 'Final', label: 'Final', reason: Option.none() })),
  linescore: Option.some(
    Game.Linescore.make({
      scheduledInnings: Option.some(9),
      currentInning: Option.some(9),
      inningHalf: Option.some('Bottom'),
      away: Game.TeamLinescore.make({
        runs: Option.some(3),
        hits: Option.some(8),
        errors: Option.some(1),
        leftOnBase: Option.none(),
      }),
      home: Game.TeamLinescore.make({
        runs: Option.some(5),
        hits: Option.some(9),
        errors: Option.some(0),
        leftOnBase: Option.none(),
      }),
      innings: [
        Game.InningLinescore.make({
          number: 1,
          away: Game.TeamLinescore.make({
            runs: Option.some(1),
            hits: Option.none(),
            errors: Option.none(),
            leftOnBase: Option.none(),
          }),
          home: Game.TeamLinescore.make({
            runs: Option.some(0),
            hits: Option.none(),
            errors: Option.none(),
            leftOnBase: Option.none(),
          }),
        }),
      ],
    }),
  ),
  probablePitchers: pitchers,
  lineups: Option.none(),
  boxscore: Option.some(
    Game.Boxscore.make({
      away: Game.TeamBoxscore.make({
        batting: [
          Game.BattingBoxscoreLine.make({
            player: player('batter-away', 'Away Batter', 'CF'),
            stats: Game.BattingLine.make({
              atBats: Option.some(4),
              runs: Option.some(1),
              hits: Option.some(2),
              doubles: Option.none(),
              triples: Option.none(),
              homeRuns: Option.some(0),
              runsBattedIn: Option.some(1),
              walks: Option.some(0),
              strikeOuts: Option.some(1),
              average: Option.some('.250'),
            }),
          }),
        ],
        pitching: [
          Game.PitchingBoxscoreLine.make({
            player: player('pitcher-away-line', 'Away Pitcher', 'P'),
            stats: Game.PitchingLine.make({
              inningsPitched: Option.some('6.0'),
              hits: Option.some(5),
              runs: Option.some(2),
              earnedRuns: Option.some(2),
              walks: Option.some(1),
              strikeOuts: Option.some(7),
              homeRuns: Option.some(1),
              earnedRunAverage: Option.some('3.00'),
            }),
          }),
        ],
      }),
      home: Game.TeamBoxscore.make({ batting: [], pitching: [] }),
    }),
  ),
})

const postponedOverview = Game.GameOverview.make({
  game: game(
    Status.GameStatus.make({
      state: 'Postponed',
      label: 'Postponed',
      reason: Option.some('Rain'),
    }),
  ),
  linescore: Option.none(),
  probablePitchers: Game.ProbablePitchers.make({ away: Option.none(), home: Option.none() }),
  lineups: Option.none(),
  boxscore: Option.none(),
})

const refreshedScoreOverview = Game.GameOverview.make({
  ...scoreOverview,
  game: Game.Game.make({
    ...scoreOverview.game,
    status: Status.GameStatus.make({
      state: 'Final',
      label: 'Final (refreshed)',
      reason: Option.none(),
    }),
  }),
})

const gameDetailScrollBox = (
  setup: Awaited<ReturnType<typeof testRender>>,
): ScrollBoxRenderable => {
  const renderable = setup.renderer.root.findDescendantById('game-details-scroll')
  if (!(renderable instanceof ScrollBoxRenderable)) {
    throw new Error('Expected the game detail scrollbox')
  }
  return renderable
}

describe('game details', () => {
  effectIt.effect('renders scheduled context, pitchers, and an explicit lineup state', () =>
    Effect.gen(function* () {
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(<GameDetails overview={scheduledOverview} occurrence={occurrence} />, {
            width: 100,
            height: 40,
          }),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Away Club at Home Club')
      expect(frame).toContain('Scheduled for')
      expect(frame).toContain('Probable pitchers')
      expect(frame).toContain('Away Starter (P)')
      expect(frame).toContain('Lineups not announced.')
      expect(frame).toContain('Page Up/Page Down page')
    }),
  )

  effectIt.effect('keeps scheduled details visible in a compact terminal', () =>
    Effect.gen(function* () {
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(<GameDetails overview={scheduledOverview} occurrence={occurrence} />, {
            width: 80,
            height: 24,
          }),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Probable pitchers')
      expect(frame).toContain('Lineups not announced.')
    }),
  )

  effectIt.effect('renders a linescore and compact available batting and pitching data', () =>
    Effect.gen(function* () {
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(<GameDetails overview={scoreOverview} occurrence={occurrence} />, {
            width: 100,
            height: 40,
          }),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Inning linescore')
      expect(frame).toContain('AWY')
      expect(frame).toContain('Batting')
      expect(frame).toContain('Away Batter')
      expect(frame).toContain('Home Club batting unavailable.')
      expect(frame).toContain('Pitching')
      expect(frame).toContain('Away Pitcher')
      expect(frame).toContain('Home Club pitching unavailable.')
    }),
  )

  effectIt.effect('renders non-score-bearing status without invented score or stat sections', () =>
    Effect.gen(function* () {
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(<GameDetails overview={postponedOverview} occurrence={occurrence} />, {
            width: 100,
            height: 40,
          }),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Postponed')
      expect(frame).toContain('Reason: Rain')
      expect(frame).toContain('Selected schedule: 2025-04-05')
      expect(frame).not.toContain('Inning linescore')
      expect(frame).not.toContain('Batting')
      expect(frame).not.toContain('Pitching')
    }),
  )

  effectIt.effect('returns to the board when Escape reaches the focused scrollbox', () =>
    Effect.gen(function* () {
      let backCount = 0
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(
            <GameDetails
              overview={scoreOverview}
              occurrence={occurrence}
              onBack={() => {
                backCount += 1
              }}
            />,
            { width: 100, height: 18, kittyKeyboard: true },
          ),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())
      yield* Effect.sync(() => gameDetailScrollBox(setup).focus())
      yield* Effect.sync(() => setup.mockInput.pressEscape())

      expect(backCount).toBe(1)
    }),
  )

  effectIt.effect('preserves the mounted scrollbox position through a refreshed snapshot', () =>
    Effect.gen(function* () {
      let refresh: () => void = () => {}

      const RefreshableDetails = () => {
        const [overview, setOverview] = useState(scoreOverview)
        refresh = () => setOverview(refreshedScoreOverview)
        return <GameDetails overview={overview} occurrence={occurrence} isRefreshing />
      }
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() => testRender(<RefreshableDetails />, { width: 100, height: 18 })),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())
      const scrollbox = gameDetailScrollBox(setup)
      yield* Effect.sync(() => scrollbox.scrollBy(4))
      yield* Effect.tryPromise(() => setup.renderOnce())

      yield* Effect.sync(() => act(refresh))
      yield* Effect.tryPromise(() => setup.renderOnce())

      expect(gameDetailScrollBox(setup)).toBe(scrollbox)
      expect(scrollbox.scrollTop).toBeGreaterThan(0)
      expect(setup.captureCharFrame()).toContain('Final (refreshed)')
    }),
  )
})
