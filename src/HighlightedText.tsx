import type { RGBA } from '@opentui/core'

import type { TextSegment } from './SubstringMatch'

export const HighlightedText = ({
  segments,
  highlightColor,
}: {
  segments: TextSegment[]
  highlightColor: string | RGBA
}) => (
  <text>
    {segments.map(({ value, isMatch }, index) => (
      <span key={value + index} bg={isMatch ? highlightColor : undefined}>
        {value}
      </span>
    ))}
  </text>
)
