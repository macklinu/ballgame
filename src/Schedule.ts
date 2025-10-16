import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

import * as Game from './Game'

export class ScheduleResponse extends Schema.Class<ScheduleResponse>(
  'ScheduleResponse'
)({
  totalGames: Schema.Number,
  dates: Schema.Array(
    Schema.Struct({
      date: Schema.DateTimeUtc,
      totalGames: Schema.Number,
      games: Schema.Array(Game.GameSchema),
    })
  ),
}) {}

export const getSchedule = Effect.fn(function* (date: string) {
  const httpClient = yield* HttpClient.HttpClient

  const url = new URL('https://statsapi.mlb.com/api/v1/schedule')
  url.searchParams.set('sportId', '1')
  url.searchParams.set('date', date)
  url.searchParams.set('hydrate', ['team', 'game', 'linescore'].join(','))

  return yield* httpClient
    .get(url)
    .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(ScheduleResponse)))
})
