import { Atom, useAtom } from '@effect-atom/atom-react'
import * as Data from 'effect/Data'
import * as Option from 'effect/Option'
import { Box, type BoxProps } from 'ink'
import { useCallback, type PropsWithChildren } from 'react'

import type { View } from './View'

export type Dialog = Data.TaggedEnum<{
  Help: Readonly<{ currentView: View }>
  GoToDate: {}
}>
export const Dialog = Data.taggedEnum<Dialog>()

const dialogAtom = Atom.make<Option.Option<Dialog>>(Option.none())

export const useCurrentDialog = () => {
  const [dialog, setDialog] = useAtom(dialogAtom)

  const showDialog = useCallback(
    (newDialog: Dialog) => {
      setDialog(Option.some(newDialog))
    },
    [setDialog]
  )

  const closeDialog = useCallback(() => {
    setDialog(Option.none())
  }, [setDialog])

  return {
    dialog,
    showDialog,
    closeDialog,
  }
}

export const Component = ({
  children,
  ...props
}: PropsWithChildren<BoxProps>) => (
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
