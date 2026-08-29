import * as Effect from 'effect/Effect'
import * as EffectSchedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'
import * as Atom from 'effect/unstable/reactivity/Atom'

import * as Game from './Game'
import { appAtomRuntime } from './Runtime'
import * as Status from './Status'

const getGameOverview = Effect.fn('GameOverview.getGameOverview')(function* (
  gameRef: Game.GameRef,
) {
  const gameService = yield* Game.GameService
  return yield* gameService.get(gameRef)
})

const shouldContinueRefreshing = (overview: Game.GameOverview): boolean =>
  Status.isActivelyInProgress(overview.game.status)

/**
 * The detail route owns this subscription while mounted. Active game snapshots
 * refresh in place; scheduled and terminal snapshots complete after their first
 * truthful response.
 */
export const gameOverviewAtom = Atom.family((gameRef: Game.GameRef) =>
  appAtomRuntime.atom(
    Stream.fromEffectSchedule(getGameOverview(gameRef), EffectSchedule.spaced('15 seconds')).pipe(
      Stream.takeUntil((overview) => !shouldContinueRefreshing(overview)),
    ),
  ),
)
