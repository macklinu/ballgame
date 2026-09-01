import { it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { describe, expect } from 'vitest'

import * as Game from './Game'
import { BoxscoreDetails } from './GameBoxscoreDetails'
import * as OpenTuiTest from './OpenTuiTest'
import * as Status from './Status'
import * as Team from './Team'

const game = Game.Game.make({
  ref: Game.GameRef.make('game-1'),
  type: 'RegularSeason',
  startsAt: Schema.decodeSync(Schema.DateTimeUtcFromString)('2025-04-05T20:10:00Z'),
  awayTeam: Team.Team.make({
    ref: Team.TeamRef.make('team-away'),
    name: 'Away Club',
    abbreviation: 'AWY',
    shortName: 'Away',
  }),
  homeTeam: Team.Team.make({
    ref: Team.TeamRef.make('team-home'),
    name: 'Home Club',
    abbreviation: 'HME',
    shortName: 'Home',
  }),
  status: Status.GameStatus.make({ state: 'Final', label: 'Final', reason: Option.none() }),
  score: Option.none(),
})

const activeGame = Game.Game.make({
  ...game,
  status: Status.GameStatus.make({ state: 'Active', label: 'Top 1st', reason: Option.none() }),
})

describe('boxscore details', () => {
  it.effect('renders a linescore and available and unavailable table sections', () =>
    Effect.gen(function* () {
      const ui = yield* OpenTuiTest.make({
        node: (
          <BoxscoreDetails
            game={game}
            linescore={Option.some(
              Game.Linescore.make({
                scheduledInnings: Option.some(9),
                currentInning: Option.some(1),
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
            )}
            boxscore={Option.some(
              Game.Boxscore.make({
                away: Game.TeamBoxscore.make({
                  batting: [
                    Game.BattingBoxscoreLine.make({
                      player: Game.Player.make({
                        ref: Game.PlayerRef.make('batter-away'),
                        name: 'Away Batter',
                        position: Option.some('CF'),
                      }),
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
                      player: Game.Player.make({
                        ref: Game.PlayerRef.make('pitcher-away'),
                        name: 'Away Pitcher',
                        position: Option.some('P'),
                      }),
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
            )}
          />
        ),
        options: { width: 100, height: 40 },
      })
      yield* ui.renderOnce

      const frame = yield* ui.captureCharFrame
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

  it.effect('renders score-bearing sections for an active game', () =>
    Effect.gen(function* () {
      const ui = yield* OpenTuiTest.make({
        node: (
          <BoxscoreDetails game={activeGame} linescore={Option.none()} boxscore={Option.none()} />
        ),
        options: { width: 80, height: 16 },
      })
      yield* ui.renderOnce

      const frame = yield* ui.captureCharFrame
      expect(frame).toContain('Inning linescore')
      expect(frame).toContain('Linescore unavailable.')
      expect(frame).toContain('Batting unavailable.')
      expect(frame).toContain('Pitching unavailable.')
    }),
  )
})
