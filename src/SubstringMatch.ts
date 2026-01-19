export interface TextSegment {
  value: string
  isMatch: boolean
}

export const buildSubstringSegments = (input: string, substring: string): TextSegment[] => {
  if (input.length === 0) {
    return []
  }

  if (substring.length === 0) {
    return [{ value: input, isMatch: false }]
  }

  const index = input.toLowerCase().indexOf(substring?.toLowerCase())

  if (index !== 0) {
    return [{ value: input, isMatch: false }]
  }

  const segments: TextSegment[] = [{ isMatch: true, value: input.slice(index, substring.length) }]
  if (substring.length < input.length) {
    segments.push({ isMatch: false, value: input.slice(substring.length, input.length) })
  }

  return segments
}
