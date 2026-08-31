import { it } from '@effect/vitest'
import { testRender } from '@opentui/react/test-utils'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { describe, expect } from 'vitest'

import * as Game from './Game'
import { PregameDetails } from './GamePregameDetails'

describe('pregame details', () => {
  it.effect('renders probable pitchers and an explicit lineup state', () =>
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
})
