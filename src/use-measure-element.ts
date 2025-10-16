import { measureElement, type DOMElement } from 'ink'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useStdoutResize } from './use-stdout-resize'

export const useMeasureElement = () => {
  const ref = useRef<DOMElement | null>(null)
  const [output, setOutput] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  const onResize = useCallback(() => {
    if (!ref.current) return
    setOutput(measureElement(ref.current))
  }, [])

  useEffect(() => {
    onResize()
  }, [onResize])

  useStdoutResize(onResize)

  return { ref, width: output.width, height: output.height }
}
