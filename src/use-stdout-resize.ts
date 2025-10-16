import { useStdout } from 'ink'
import { useEffect } from 'react'

export const useStdoutResize = (callback: () => void) => {
  const { stdout } = useStdout()

  useEffect(() => {
    stdout.on('resize', callback)
    return () => {
      stdout.off('resize', callback)
    }
  }, [stdout, callback])
}
