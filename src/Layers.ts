import * as BunServices from '@effect/platform-bun/BunServices'
import * as Layer from 'effect/Layer'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import * as Mlb from './mlb-adapter'

/** The single live composition boundary keeps provider details behind #5's services. */
export const appLayer = Mlb.layerLive.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(BunServices.layer),
)
