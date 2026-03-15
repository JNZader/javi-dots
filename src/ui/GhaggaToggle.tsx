import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme, glyph } from './theme.js'

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

      <Box marginTop={1} marginLeft={2}>
        <Text color={enabled ? theme.success : theme.muted}>
          {enabled ? glyph.filledDot : glyph.emptyDot}{' '}
        </Text>
        <Text bold color={enabled ? theme.success : theme.muted}>ghagga</Text>
        <Text color={theme.muted}>{'  '}</Text>
        <Text color={theme.muted}>Multi-LLM AI code review for your PRs</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          Space toggle  Enter confirm
        </Text>
      </Box>
    </Box>
  )
}
