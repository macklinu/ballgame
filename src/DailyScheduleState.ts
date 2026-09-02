import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'

import * as Game from './Game'

const formatActiveGameState = (progress: Game.Game['progress']): string => {
  if (Option.isNone(progress)) {
    return 'In progress'
  }

  const { currentInning, inningHalf, outs } = progress.value
  if (Option.isNone(currentInning) || Option.isNone(inningHalf)) {
    return 'In progress'
  }

  const outText = Option.isNone(outs) ? '' : `  ${outs.value} ${outs.value === 1 ? 'out' : 'outs'}`
  return `${inningHalf.value === 'Top' ? 'T' : 'B'}${currentInning.value}${outText}`
}

const formatFinalGameState = (progress: Game.Game['progress']): string => {
  if (Option.isNone(progress)) {
    return 'F'
  }

  const { currentInning, scheduledInnings } = progress.value
  if (Option.isNone(currentInning) || Option.isNone(scheduledInnings)) {
    return 'F'
  }

  return currentInning.value > scheduledInnings.value ? `F/${currentInning.value}` : 'F'
}

export const formatGameState = (game: Game.Game): string => {
  switch (game.status.state) {
    case 'Scheduled':
      return DateTime.formatLocal(game.startsAt, { timeStyle: 'short' })
    case 'Warmup':
      return 'Warmup'
    case 'Active':
      return formatActiveGameState(game.progress)
    case 'Delayed':
      return 'Delayed'
    case 'UnderReview':
      return 'Review'
    case 'Suspended':
      return 'Suspended'
    case 'Final':
    case 'CompletedEarly':
      return formatFinalGameState(game.progress)
    case 'Tied':
      return 'Tied'
    case 'Forfeit':
      return 'Forfeit'
    case 'Postponed':
      return 'PPD'
    case 'Cancelled':
      return 'Cancelled'
    case 'Unknown':
      return 'Unavailable'
  }
}
