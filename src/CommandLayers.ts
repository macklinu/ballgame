export interface AppCommandHandlers {
  readonly quit: () => void
}

export interface ScheduleCommandHandlers {
  readonly previousDate: () => void
  readonly nextDate: () => void
  readonly today: () => void
  readonly openGoToDate: () => void
  readonly previousOccurrence: () => void
  readonly nextOccurrence: () => void
  readonly openSelectedGame: () => void
  readonly openHelp: () => void
}

export interface DetailCommandHandlers {
  readonly back: () => void
  readonly openHelp: () => void
}

export const appCommandLayer = (handlers: AppCommandHandlers) => ({
  priority: 0,
  commands: [{ name: 'app.quit', run: handlers.quit }],
  bindings: [{ key: 'q', cmd: 'app.quit' }],
})

export const scheduleCommandLayer = (handlers: ScheduleCommandHandlers) => ({
  priority: 100,
  commands: [
    { name: 'schedule.previous-date', run: handlers.previousDate },
    { name: 'schedule.next-date', run: handlers.nextDate },
    { name: 'schedule.today', run: handlers.today },
    { name: 'schedule.go-to-date', run: handlers.openGoToDate },
    { name: 'schedule.previous-occurrence', run: handlers.previousOccurrence },
    { name: 'schedule.next-occurrence', run: handlers.nextOccurrence },
    { name: 'schedule.open-selected', run: handlers.openSelectedGame },
    { name: 'schedule.help', run: handlers.openHelp },
  ],
  bindings: [
    { key: 'p', cmd: 'schedule.previous-date' },
    { key: 'n', cmd: 'schedule.next-date' },
    { key: 't', cmd: 'schedule.today' },
    { key: 'g', cmd: 'schedule.go-to-date' },
    { key: 'left', cmd: 'schedule.previous-occurrence' },
    { key: 'right', cmd: 'schedule.next-occurrence' },
    { key: 'return', cmd: 'schedule.open-selected' },
    { key: '?', cmd: 'schedule.help' },
  ],
})

export const detailCommandLayer = (handlers: DetailCommandHandlers) => ({
  priority: 100,
  commands: [
    { name: 'detail.back', run: handlers.back },
    { name: 'detail.help', run: handlers.openHelp },
  ],
  bindings: [
    { key: 'escape', cmd: 'detail.back' },
    { key: '?', cmd: 'detail.help' },
  ],
})
