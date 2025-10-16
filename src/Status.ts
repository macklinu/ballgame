import * as Schema from 'effect/Schema'

export class Status extends Schema.Class<Status>('Status')({
  abstractGameState: Schema.String,
  codedGameState: Schema.String,
  detailedState: Schema.String,
  statusCode: Schema.String,
  startTimeTBD: Schema.Boolean,
}) {}

export class LiveStatus extends Status.extend<LiveStatus>('LiveStatus')({
  abstractGameCode: Schema.Literal('L'),
}) {}

export class FinalStatus extends Status.extend<FinalStatus>('FinalStatus')({
  abstractGameCode: Schema.Literal('F'),
}) {}

export class PreviewStatus extends Status.extend<PreviewStatus>(
  'PreviewStatus'
)({
  abstractGameCode: Schema.Literal('P'),
}) {}
