import { it } from '@effect/vitest'
import { testRender } from '@opentui/react/test-utils'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { describe, expect } from 'vitest'

import * as Game from './Game'
import { PregameDetails } from './GamePregameDetails'

describe('pregame details', () => {
  it.effect('renders probable pitchers and an unannounced lineup state', () =>
    Effect.gen(function* () {
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(
            <PregameDetails
              awayTeamName='Away Club'
              homeTeamName='Home Club'
              probablePitchers={Game.ProbablePitchers.make({
                away: Option.some(
                  Game.Player.make({
                    ref: Game.PlayerRef.make('pitcher-away'),
                    name: 'Away Starter',
                    position: Option.some('P'),
                  }),
                ),
                home: Option.none(),
              })}
              lineups={Option.none()}
            />,
            { width: 80, height: 16 },
          ),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Probable pitchers')
      expect(frame).toContain('Away Starter (P)')
      expect(frame).toContain('Home: Not announced')
      expect(frame).toContain('Lineups not announced.')
    }),
  )

  it.effect('renders available lineups', () =>
    Effect.gen(function* () {
      const setup = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          testRender(
            <PregameDetails
              awayTeamName='Away Club'
              homeTeamName='Home Club'
              probablePitchers={Game.ProbablePitchers.make({
                away: Option.none(),
                home: Option.none(),
              })}
              lineups={Option.some(
                Game.Lineups.make({
                  away: [
                    Game.LineupPlayer.make({
                      player: Game.Player.make({
                        ref: Game.PlayerRef.make('away-batter'),
                        name: 'Away Leadoff',
                        position: Option.some('CF'),
                      }),
                      battingOrder: Option.some(1),
                    }),
                  ],
                  home: [
                    Game.LineupPlayer.make({
                      player: Game.Player.make({
                        ref: Game.PlayerRef.make('home-batter'),
                        name: 'Home Leadoff',
                        position: Option.some('SS'),
                      }),
                      battingOrder: Option.some(1),
                    }),
                  ],
                }),
              )}
            />,
            { width: 80, height: 16 },
          ),
        ),
        (rendered) => Effect.sync(() => rendered.renderer.destroy()),
      )
      yield* Effect.tryPromise(() => setup.renderOnce())

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Away Club')
      expect(frame).toContain('1. Away Leadoff (CF)')
      expect(frame).toContain('Home Club')
      expect(frame).toContain('1. Home Leadoff (SS)')
    }),
  )
})
