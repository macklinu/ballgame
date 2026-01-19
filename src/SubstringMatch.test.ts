import { expect, test } from 'vitest'

import { buildSubstringSegments } from './SubstringMatch'

test('empty input and substring returns empty segments', () => {
  expect(buildSubstringSegments('', '')).toEqual([])
})

test('no matches when substring is empty', () => {
  expect(buildSubstringSegments('ok', '')).toEqual([{ value: 'ok', isMatch: false }])
})

test('matches first parts of string (case-insensitive)', () => {
  expect(buildSubstringSegments('LAD', 'la')).toEqual([
    { value: 'LA', isMatch: true },
    { value: 'D', isMatch: false },
  ])
})

test('matches entire string (case-insensitive)', () => {
  expect(buildSubstringSegments('LAD', 'lad')).toEqual([{ value: 'LAD', isMatch: true }])
})
