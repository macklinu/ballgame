import { describe, it } from '@effect/vitest'
import * as Schema from 'effect/Schema'
import { FastCheck } from 'effect/testing'

import * as Game from './Game'

describe('Game.currentTime', () => {
  it.prop(
    'should return the correct current time for Preview games',
    { game: Schema.toArbitrary(Game.PreviewGame)(FastCheck) },
    ({ game: _game }) => {
      // TODO
    },
  )
})
