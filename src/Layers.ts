import * as BunFileSystem from '@effect/platform-bun/BunFileSystem'
import * as PlatformLogger from '@effect/platform/PlatformLogger'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'

const FileLoggerLive = Logger.replaceScoped(
  Logger.defaultLogger,
  Logger.jsonLogger.pipe(PlatformLogger.toFile('debug.log', { batchWindow: '500  millis' }))
).pipe(Layer.provide(BunFileSystem.layer))

export const all = Layer.mergeAll(FileLoggerLive, Logger.minimumLogLevel(LogLevel.Debug))
