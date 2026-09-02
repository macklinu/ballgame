import { expect, test } from 'vitest'

import { formatGameState } from './DailyScheduleState'
import { activeProgress, extraInningProgress, makeFixtureGame } from './DailyScheduleTest'

test('formats scheduled games with their local start time', () => {
  const game = makeFixtureGame({
    ref: 'scheduled',
    state: 'Scheduled',
    away: 'TOR',
    home: 'CLE',
  })

  expect(formatGameState(game)).toMatch(/^\d{1,2}:\d{2}(?:\s?[AP]M)?$/)
})

test.each([
  {
    name: 'an active game with inning and outs',
    game: makeFixtureGame({
      ref: 'active',
      state: 'Active',
      away: 'KC',
      home: 'DET',
      score: { away: 3, home: 2 },
      progress: activeProgress,
    }),
    expected: 'B7  1 out',
  },
  {
    name: 'an active game without usable progress',
    game: makeFixtureGame({
      ref: 'active-without-progress',
      state: 'Active',
      away: 'KC',
      home: 'DET',
    }),
    expected: 'In progress',
  },
  {
    name: 'an extra-inning final',
    game: makeFixtureGame({
      ref: 'extra-inning-final',
      state: 'Final',
      away: 'NYM',
      home: 'TB',
      score: { away: 5, home: 4 },
      progress: extraInningProgress,
    }),
    expected: 'F/10',
  },
  {
    name: 'a regular final',
    game: makeFixtureGame({ ref: 'regular-final', state: 'Final', away: 'NYM', home: 'TB' }),
    expected: 'F',
  },
  {
    name: 'a delayed game',
    game: makeFixtureGame({ ref: 'delayed', state: 'Delayed', away: 'BOS', home: 'NYY' }),
    expected: 'Delayed',
  },
  {
    name: 'a postponed game',
    game: makeFixtureGame({ ref: 'postponed', state: 'Postponed', away: 'ATL', home: 'WSH' }),
    expected: 'PPD',
  },
  {
    name: 'a suspended game',
    game: makeFixtureGame({ ref: 'suspended', state: 'Suspended', away: 'CHC', home: 'STL' }),
    expected: 'Suspended',
  },
  {
    name: 'a cancelled game',
    game: makeFixtureGame({ ref: 'cancelled', state: 'Cancelled', away: 'OAK', home: 'LAA' }),
    expected: 'Cancelled',
  },
  {
    name: 'an unavailable game',
    game: makeFixtureGame({ ref: 'unknown', state: 'Unknown', away: 'MIA', home: 'PIT' }),
    expected: 'Unavailable',
  },
] as const)('formats $name', ({ game, expected }) => {
  expect(formatGameState(game)).toBe(expected)
})
