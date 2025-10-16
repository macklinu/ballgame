import { Box, type BoxProps } from 'ink'
import type { PropsWithChildren } from 'react'

import { useStdoutDimensions } from './use-stdout-dimensions'

export const FullScreenBox = ({
  children,
  ...props
}: PropsWithChildren<Omit<BoxProps, 'width' | 'height'>>) => {
  const [width, height] = useStdoutDimensions()
  return (
    <Box width={width} height={height} {...props}>
      {children}
    </Box>
  )
}
