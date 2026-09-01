import * as DateTime from 'effect/DateTime'
import * as Option from 'effect/Option'
import { describe, expect, test } from 'vitest'

import { parseLocalCalendarDate } from './date'

describe('parseLocalCalendarDate', () => {
  test('keeps a valid ISO calendar day in the local timezone', () => {
    const date = Option.getOrThrow(parseLocalCalendarDate('2024-02-29'))

    expect(DateTime.formatIsoDate(date)).toBe('2024-02-29')
  })

  test.each(['2025-02-29', '2025-02-30', '2025-4-05', '2025-04-05T00:00:00Z'])(
    'rejects %s as a local calendar day',
    (input) => {
      expect(parseLocalCalendarDate(input)).toEqual(Option.none())
    },
  )
})
