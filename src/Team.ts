import * as Schema from 'effect/Schema'

export class Team extends Schema.Class<Team>('Team')({
  id: Schema.Number.pipe(Schema.brand('TeamId')),
  name: Schema.String,
  abbreviation: Schema.String,
  shortName: Schema.String,
  link: Schema.String,
  score: Schema.Number.pipe(Schema.OptionFromUndefinedOr),
}) {}
