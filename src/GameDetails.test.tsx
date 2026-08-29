import { ScrollBoxRenderable } from '@opentui/core'
/* oxlint-disable effecttsgo/async-function -- OpenTUI's renderer test harness is promise-based. */
import { testRender } from '@opentui/react/test-utils'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { act, useState } from 'react'
import { describe, expect, test } from 'vitest'

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

const status = (
  state: Status.GameState,
  label: string = state,
  reason: Option.Option<string> = Option.none(),
) => Status.GameStatus.make({ state, label, reason })

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
  game: game(status('Scheduled', 'Scheduled')),
  linescore: Option.none(),
  probablePitchers: pitchers,
  lineups: Option.none(),
  boxscore: Option.none(),
})

const scoreOverview = Game.GameOverview.make({
  game: game(status('Final', 'Final')),
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
  game: game(status('Postponed', 'Postponed', Option.some('Rain'))),
  linescore: Option.none(),
  probablePitchers: Game.ProbablePitchers.make({ away: Option.none(), home: Option.none() }),
  lineups: Option.none(),
  boxscore: Option.none(),
})

const refreshedScoreOverview = Game.GameOverview.make({
  ...scoreOverview,
  game: Game.Game.make({
    ...scoreOverview.game,
    status: status('Final', 'Final (refreshed)'),
  }),
})

const render = async (overview: Game.GameOverview) => {
  const setup = await testRender(<GameDetails overview={overview} occurrence={occurrence} />, {
    width: 100,
    height: 40,
  })
  await setup.renderOnce()

  return setup
}

const destroy = (setup: Awaited<ReturnType<typeof testRender>>) =>
  act(() => setup.renderer.destroy())

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
  test('renders scheduled context, pitchers, and an explicit lineup state', async () => {
    const setup = await render(scheduledOverview)

    try {
      const frame = setup.captureCharFrame()
      expect(frame).toContain('Away Club at Home Club')
      expect(frame).toContain('Scheduled for')
      expect(frame).toContain('Probable pitchers')
      expect(frame).toContain('Away Starter (P)')
      expect(frame).toContain('Lineups not announced.')
      expect(frame).toContain('Page Up/Page Down page')
    } finally {
      destroy(setup)
    }
  })

  test('keeps scheduled details visible in a compact terminal', async () => {
    const setup = await testRender(
      <GameDetails overview={scheduledOverview} occurrence={occurrence} />,
      {
        width: 80,
        height: 24,
      },
    )

    try {
      await setup.renderOnce()
      const frame = setup.captureCharFrame()
      expect(frame).toContain('Probable pitchers')
      expect(frame).toContain('Lineups not announced.')
    } finally {
      destroy(setup)
    }
  })

  test('renders a linescore and compact available batting and pitching data', async () => {
    const setup = await render(scoreOverview)

    try {
      const frame = setup.captureCharFrame()
      expect(frame).toContain('Inning linescore')
      expect(frame).toContain('AWY')
      expect(frame).toContain('Batting')
      expect(frame).toContain('Away Batter')
      expect(frame).toContain('Home Club batting unavailable.')
      expect(frame).toContain('Pitching')
      expect(frame).toContain('Away Pitcher')
      expect(frame).toContain('Home Club pitching unavailable.')
    } finally {
      destroy(setup)
    }
  })

  test('renders non-score-bearing status without invented score or stat sections', async () => {
    const setup = await render(postponedOverview)

    try {
      const frame = setup.captureCharFrame()
      expect(frame).toContain('Postponed')
      expect(frame).toContain('Reason: Rain')
      expect(frame).toContain('Selected schedule: 2025-04-05')
      expect(frame).not.toContain('Inning linescore')
      expect(frame).not.toContain('Batting')
      expect(frame).not.toContain('Pitching')
    } finally {
      destroy(setup)
    }
  })

  test('returns to the board when Escape reaches the focused scrollbox', async () => {
    let backCount = 0
    const setup = await testRender(
      <GameDetails
        overview={scoreOverview}
        occurrence={occurrence}
        onBack={() => {
          backCount += 1
        }}
      />,
      { width: 100, height: 18, kittyKeyboard: true },
    )

    try {
      await setup.renderOnce()
      gameDetailScrollBox(setup).focus()
      setup.mockInput.pressEscape()
      expect(backCount).toBe(1)
    } finally {
      destroy(setup)
    }
  })

  test('preserves the mounted scrollbox position through a refreshed snapshot', async () => {
    let refresh: () => void = () => {}

    const RefreshableDetails = () => {
      const [overview, setOverview] = useState(scoreOverview)
      refresh = () => setOverview(refreshedScoreOverview)
      return <GameDetails overview={overview} occurrence={occurrence} isRefreshing />
    }
    const setup = await testRender(<RefreshableDetails />, { width: 100, height: 18 })

    try {
      await setup.renderOnce()
      const scrollbox = gameDetailScrollBox(setup)
      scrollbox.scrollBy(4)
      await setup.renderOnce()

      act(refresh)
      await setup.renderOnce()

      expect(gameDetailScrollBox(setup)).toBe(scrollbox)
      expect(scrollbox.scrollTop).toBeGreaterThan(0)
      expect(setup.captureCharFrame()).toContain('Final (refreshed)')
    } finally {
      destroy(setup)
    }
  })
})
