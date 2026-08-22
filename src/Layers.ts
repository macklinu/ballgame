import * as BunFileSystem from '@effect/platform-bun/BunFileSystem'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as References from 'effect/References'

const FileLoggerLive = Logger.layer([
  Logger.toFile(Logger.formatJson, 'debug.log', { batchWindow: 500 }),
]).pipe(Layer.provide(BunFileSystem.layer))

export const all = Layer.mergeAll(
  FileLoggerLive,
  Layer.succeed(References.MinimumLogLevel, 'Debug'),
)
