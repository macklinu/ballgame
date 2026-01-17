import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientError from '@effect/platform/HttpClientError'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

import * as Game from './Game'

export class ScheduleDate extends Schema.Class<ScheduleDate>('ScheduleDate')({
  date: Schema.DateTimeUtc,
  totalGames: Schema.Number,
  games: Schema.Array(Game.GameSchema),
}) {}

export class ScheduleResponse extends Schema.Class<ScheduleResponse>('ScheduleResponse')({
  totalGames: Schema.Number,
  dates: Schema.Array(ScheduleDate),
}) {}

export class ScheduleService extends Context.Tag('@macklinu/ballgame/Schedule/ScheduleService')<
  ScheduleService,
  {
    readonly getSchedule: (
      date: string
    ) => Effect.Effect<ScheduleDate, ParseResult.ParseError | HttpClientError.HttpClientError>
  }
>() {
  static readonly layerLive = Layer.effect(
    ScheduleService,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient

      return ScheduleService.of({
        getSchedule: (date) =>
          httpClient
            .get('https://statsapi.mlb.com/api/v1/schedule', {
              urlParams: {
                sportId: 1,
                date,
                hydrate: ['team', 'game', 'linescore'].join(','),
              },
            })
            .pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(ScheduleResponse)),
              Effect.flatMap(({ dates }) =>
                dates[0]
                  ? Effect.succeed(dates[0])
                  : Effect.die(new Error('Missing dates for schedule query'))
              ),
              Effect.withSpan('ScheduleService.getSchedule')
            ),
      })
    })
  )
}
