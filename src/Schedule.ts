import * as FileSystem from '@effect/platform/FileSystem'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientError from '@effect/platform/HttpClientError'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import * as Path from '@effect/platform/Path'
import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

import * as Game from './Game'

export class ScheduleDate extends Schema.Class<ScheduleDate>('ScheduleDate')({
  date: Schema.DateTimeUtc,
  totalGames: Schema.Number,
  games: Schema.Array(Game.GameSchema),
}) {
  static readonly empty = (date: DateTime.DateTime): ScheduleDate =>
    ScheduleDate.make({
      date: DateTime.toUtc(date),
      games: [],
      totalGames: 0,
    })
}

export class ScheduleResponse extends Schema.Class<ScheduleResponse>('ScheduleResponse')({
  totalGames: Schema.Number,
  dates: Schema.Array(ScheduleDate),
}) {}

export class ScheduleService extends Context.Tag('@macklinu/ballgame/Schedule/ScheduleService')<
  ScheduleService,
  {
    readonly getSchedule: (
      date: DateTime.DateTime,
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
                date: DateTime.formatIsoDate(date),
                hydrate: ['team', 'game', 'linescore'].join(','),
              },
            })
            .pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(ScheduleResponse)),
              Effect.map(({ dates }) => dates[0] ?? ScheduleDate.empty(date)),
              Effect.withSpan('ScheduleService.getSchedule'),
            ),
      })
    }),
  )

  static readonly layerFromFileSystem = Layer.effect(
    ScheduleService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      return ScheduleService.of({
        getSchedule: (date) =>
          Effect.gen(function* () {
            const isoDate = DateTime.formatIsoDate(date)

            const json = yield* fs.readFileString(
              path.resolve('./src/fixtures/stats-api/schedule', `${isoDate}.json`),
            )
            const response = yield* Schema.decodeUnknown(
              Schema.compose(Schema.parseJson(), ScheduleResponse),
            )(json)
            return response.dates[0] ?? ScheduleDate.empty(date)
          }).pipe(
            Effect.catchTags({
              BadArgument: () => Effect.succeed(ScheduleDate.empty(date)),
              SystemError: () => Effect.succeed(ScheduleDate.empty(date)),
            }),
          ),
      })
    }),
  )
}
