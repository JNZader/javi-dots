import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface Props {
  onConfirm: (ghagga: boolean) => void
}

export default function GhaggaToggle({ onConfirm }: Props) {
  const [enabled, setEnabled] = useState(false)

  useInput((input, key) => {
    if (input === ' ' || key.upArrow || key.downArrow) {
      setEnabled(prev => !prev)
    }
    if (key.return) {
      onConfirm(enabled)
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>Enable code review automation?</Text>

      <Box
        marginTop={1}
        flexDirection="column"
        borderStyle="single"
        borderLeft
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        borderColor={theme.muted}
        paddingLeft={1}
      >
        <Box>
          <Text color={!enabled ? theme.primary : 'white'}>
            {!enabled ? '▶ ' : '  '}
            {!enabled ? '◉' : '○'} Skip ghagga
          </Text>
        </Box>
        <Box>
          <Text color={enabled ? theme.primary : 'white'}>
            {enabled ? '▶ ' : '  '}
            {enabled ? '◉' : '○'} Enable ghagga
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted} dimColor>
          ghagga provides multi-agent code review for PRs.
        </Text>
        <Text color={theme.muted} dimColor>
          ↑↓/Space toggle  Enter confirm
        </Text>
      </Box>
    </Box>
  )
}
