import { useStdout } from 'ink'
import { useCallback, useState } from 'react'

import { useStdoutResize } from './use-stdout-resize'

export function useStdoutDimensions() {
  const { stdout } = useStdout()
  const [dimensions, setDimensions] = useState<[number, number]>([
    stdout.columns,
    stdout.rows,
  ])

  const updateDimensions = useCallback(() => {
    setDimensions([stdout.columns, stdout.rows])
  }, [stdout])

  useStdoutResize(updateDimensions)

  return dimensions
}
