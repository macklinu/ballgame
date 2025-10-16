import { Box, type BoxProps } from 'ink'
import type { PropsWithChildren } from 'react'

export const Dialog = ({ children, ...props }: PropsWithChildren<BoxProps>) => (
  <Box
    position='absolute'
    borderStyle='single'
    paddingY={1}
    minWidth={24}
    paddingX={4}
    flexDirection='column'
    gap={1}
    {...props}
  >
    {children}
  </Box>
)
