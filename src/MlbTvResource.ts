import * as Effect from 'effect/Effect'

import * as Game from './Game'
import { appAtomRuntime } from './Runtime'

const openMlbTv = Effect.fn('MlbTv.open')(function* (gameRef: Game.GameRef) {
  const gameService = yield* Game.GameService
  yield* gameService.openMlbTv(gameRef)
})

export const openMlbTvAtom = appAtomRuntime.fn(openMlbTv)
