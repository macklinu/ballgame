import { describe, it } from '@effect/vitest'
import * as Arbitrary from 'effect/Arbitrary'

import * as Game from './Game'

describe('Game.currentTime', () => {
  it.prop(
    'should return the correct current time for Preview games',
    { game: Arbitrary.make(Game.PreviewGame) },
    ({ game }) => {
      // TODO
    }
  )
})
