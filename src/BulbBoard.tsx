import { TextAttributes, type ScrollBoxRenderable } from '@opentui/core'
import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'
import { useEffect, useRef } from 'react'

import { type ScheduleOccurrenceRef, isSelectedOccurrence, occurrenceRef } from './AppState'
import * as Game from './Game'
import * as Schedule from './Schedule'
import * as Status from './Status'

const bulbGlyphs = {
  A: ['○●○', '●○●', '●●●', '●○●', '●○●'],
  B: ['●●○', '●○●', '●●○', '●○●', '●●○'],
  C: ['○●●', '●○○', '●○○', '●○○', '○●●'],
  D: ['●●○', '●○●', '●○●', '●○●', '●●○'],
  E: ['●●●', '●○○', '●●○', '●○○', '●●●'],
  F: ['●●●', '●○○', '●●○', '●○○', '●○○'],
  G: ['○●●', '●○○', '●○●', '●○●', '○●●'],
  H: ['●○●', '●○●', '●●●', '●○●', '●○●'],
  I: ['●●●', '○●○', '○●○', '○●○', '●●●'],
  J: ['○○●', '○○●', '○○●', '●○●', '○●○'],
  K: ['●○●', '●●○', '●○○', '●●○', '●○●'],
  L: ['●○○', '●○○', '●○○', '●○○', '●●●'],
  M: ['●○●', '●●●', '●●●', '●○●', '●○●'],
  N: ['●○●', '●●○', '●●○', '●●●', '●○●'],
  O: ['○●○', '●○●', '●○●', '●○●', '○●○'],
  P: ['●●○', '●○●', '●●○', '●○○', '●○○'],
  Q: ['○●○', '●○●', '●○●', '●●●', '○●●'],
  R: ['●●○', '●○●', '●●○', '●●○', '●○●'],
  S: ['○●●', '●○○', '○●○', '○○●', '●●○'],
  T: ['●●●', '○●○', '○●○', '○●○', '○●○'],
  U: ['●○●', '●○●', '●○●', '●○●', '○●○'],
  V: ['●○●', '●○●', '●○●', '○●○', '○●○'],
  W: ['●○●', '●○●', '●●●', '●●●', '●○●'],
  X: ['●○●', '●○●', '○●○', '●○●', '●○●'],
  Y: ['●○●', '●○●', '○●○', '○●○', '○●○'],
  Z: ['●●●', '○○●', '○●○', '●○○', '●●●'],
  0: ['●●●', '●○●', '●○●', '●○●', '●●●'],
  1: ['○●○', '●●○', '○●○', '○●○', '●●●'],
  2: ['●●○', '○○●', '○●○', '●○○', '●●●'],
  3: ['●●○', '○○●', '○●○', '○○●', '●●○'],
  4: ['●○●', '●○●', '●●●', '○○●', '○○●'],
  5: ['●●●', '●○○', '●●○', '○○●', '●●○'],
  6: ['○●●', '●○○', '●●○', '●○●', '○●○'],
  7: ['●●●', '○○●', '○●○', '●○○', '●○○'],
  8: ['○●○', '●○●', '○●○', '●○●', '○●○'],
  9: ['○●○', '●○●', '○●●', '○○●', '●●○'],
  '?': ['●●●', '○○●', '○●○', '○○○', '○●○'],
} as const

const gameTypeLabels: Record<Game.GameType, string> = {
  SpringTraining: 'Spring training',
  Exhibition: 'Exhibition',
  RegularSeason: 'Regular season',
  AllStar: 'All-Star game',
  Postseason: 'Postseason',
  Other: 'Other official game',
}

const stateMarkers: Record<Status.GameState, string> = {
  Scheduled: 'SCH',
  Warmup: 'WUP',
  Active: 'LIV',
  Delayed: 'DLY',
  UnderReview: 'REV',
  Suspended: 'SUS',
  Final: 'FIN',
  CompletedEarly: 'FIN',
  Tied: 'TIE',
  Forfeit: 'FOR',
  Postponed: 'PPD',
  Cancelled: 'CAN',
  Unknown: 'UNK',
}

const stateLabels: Record<Status.GameState, string> = {
  Scheduled: 'Scheduled',
  Warmup: 'Warmup',
  Active: 'Live',
  Delayed: 'Delayed',
  UnderReview: 'Under review',
  Suspended: 'Suspended',
  Final: 'Final',
  CompletedEarly: 'Completed early',
  Tied: 'Tied',
  Forfeit: 'Forfeit',
  Postponed: 'Postponed',
  Cancelled: 'Cancelled',
  Unknown: 'Unknown state',
}

const boardRowId = ({ selectedDate, gameRef }: ScheduleOccurrenceRef): string =>
  `bulb-board-row-${selectedDate}-${gameRef}`

const glyphFor = (character: string): ReadonlyArray<string> =>
  bulbGlyphs[character as keyof typeof bulbGlyphs] ?? bulbGlyphs['?']

const BulbWord = ({ value }: { readonly value: string }) => {
  const glyphs = Array.from(value.toUpperCase()).map(glyphFor)

  return (
    <box flexDirection='column' flexShrink={0}>
      {Array.from({ length: 5 }, (_, row) => (
        <text key={row}>{glyphs.map((glyph) => glyph[row]).join(' ')}</text>
      ))}
    </box>
  )
}

const teamAbbreviation = (value: string): string =>
  Array.from(value.toUpperCase()).slice(0, 3).join('').padEnd(3, ' ')

const statusDescription = (status: Status.GameStatus): string => {
  const label = stateLabels[status.state]
  return status.label === label ? label : `${label}: ${status.label}`
}

const AvailableGameRow = ({
  occurrence,
  isSelected,
  onOpenOccurrence,
}: {
  readonly occurrence: Schedule.AvailableScheduleOccurrence
  readonly isSelected: boolean
  readonly onOpenOccurrence: (occurrence: Schedule.AvailableScheduleOccurrence) => void
}) => {
  const { game } = occurrence

  return (
    <box
      id={boardRowId(occurrenceRef(occurrence))}
      flexDirection='row'
      flexShrink={0}
      gap={1}
      onMouseUp={(event) => {
        onOpenOccurrence(occurrence)
        event.stopPropagation()
      }}
    >
      <text attributes={isSelected ? TextAttributes.BOLD : TextAttributes.DIM}>
        {isSelected ? '▶' : ' '}
      </text>
      <BulbWord value={teamAbbreviation(game.awayTeam.abbreviation)} />
      {Option.match(game.score, {
        onNone: () => null,
        onSome: (score) => <BulbWord value={String(score.away)} />,
      })}
      <text>@</text>
      <BulbWord value={teamAbbreviation(game.homeTeam.abbreviation)} />
      {Option.match(game.score, {
        onNone: () => null,
        onSome: (score) => <BulbWord value={String(score.home)} />,
      })}
      <BulbWord value={stateMarkers[game.status.state]} />
      <box flexDirection='column' flexShrink={1}>
        <text>{gameTypeLabels[game.type]}</text>
        <text>
          {teamAbbreviation(game.awayTeam.abbreviation).trim()} @{' '}
          {teamAbbreviation(game.homeTeam.abbreviation).trim()} ·{' '}
          {DateTime.formatLocal(game.startsAt, { timeStyle: 'short' })}
        </text>
        <text>{statusDescription(game.status)}</text>
        {Option.match(game.status.reason, {
          onNone: () => null,
          onSome: (reason) => <text attributes={TextAttributes.DIM}>Reason: {reason}</text>,
        })}
      </box>
    </box>
  )
}

const UnavailableGameRow = ({
  occurrence,
}: {
  readonly occurrence: Schedule.UnavailableScheduleOccurrence
}) => (
  <box flexDirection='row' flexShrink={0} gap={1}>
    <text attributes={TextAttributes.DIM}> </text>
    <BulbWord value='UNK' />
    <box flexDirection='column'>
      <text>Unavailable game</text>
      <text>{occurrence.message}</text>
    </box>
  </box>
)

export interface BulbBoardProps {
  readonly occurrences: ReadonlyArray<Schedule.ScheduleOccurrence>
  readonly selection: Option.Option<ScheduleOccurrenceRef>
  readonly onOpenOccurrence: (occurrence: Schedule.AvailableScheduleOccurrence) => void
}

/** A selectable daily scoreboard with fixed 3×5 bulb glyphs for primary game data. */
export const BulbBoard = ({ occurrences, selection, onOpenOccurrence }: BulbBoardProps) => {
  const scrollboxRef = useRef<ScrollBoxRenderable | null>(null)
  const orderedOccurrences = Schedule.orderByScheduledStart(occurrences)

  useEffect(() => {
    Option.match(selection, {
      onNone: () => undefined,
      onSome: (selected) => scrollboxRef.current?.scrollChildIntoView(boardRowId(selected)),
    })
  }, [selection])

  return (
    <box width='100%' flexGrow={1} flexShrink={1} flexDirection='column'>
      <box flexDirection='column' alignItems='center' paddingBottom={1}>
        <text attributes={TextAttributes.DIM}>▶ selected · Up/Down selects · Enter opens</text>
      </box>
      {orderedOccurrences.length === 0 ? (
        <box flexGrow={1} justifyContent='center' alignItems='center'>
          <text>No games today.</text>
        </box>
      ) : (
        <scrollbox
          id='bulb-board-scroll'
          ref={scrollboxRef}
          flexGrow={1}
          flexShrink={1}
          scrollY
          contentOptions={{ flexDirection: 'column', gap: 1, paddingLeft: 1, paddingBottom: 1 }}
          verticalScrollbarOptions={{ showArrows: true }}
        >
          {orderedOccurrences.map((occurrence, index) =>
            Schedule.isAvailableScheduleOccurrence(occurrence) ? (
              <AvailableGameRow
                key={`available-${occurrence.selectedDate}-${occurrence.game.ref}`}
                occurrence={occurrence}
                isSelected={isSelectedOccurrence(selection, occurrence)}
                onOpenOccurrence={onOpenOccurrence}
              />
            ) : (
              <UnavailableGameRow
                key={`unavailable-${occurrence.selectedDate}-${index}`}
                occurrence={occurrence}
              />
            ),
          )}
        </scrollbox>
      )}
    </box>
  )
}
