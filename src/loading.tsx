import { Spinner } from '@inkjs/ui'
import { Text } from 'ink'

export const Loading = () => (
  // @ts-expect-error label as <Text> works so why not
  <Spinner label={<Text dimColor>Loading...</Text>} type='dotsCircle' />
)
