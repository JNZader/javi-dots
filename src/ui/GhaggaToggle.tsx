import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

interface Props {
  onConfirm: (ghagga: boolean) => void
}

export default function GhaggaToggle({ onConfirm }: Props) {
  const isCI = useCIMode()
  const autoConfirmed = useRef(false)
  const [enabled, setEnabled] = useState(false)

  // Auto-confirm in CI mode (default: disabled)
  useEffect(() => {
    if (isCI && !autoConfirmed.current) {
      autoConfirmed.current = true
      onConfirm(false)
    }
  }, [isCI]) // eslint-disable-line react-hooks/exhaustive-deps

  useInput((input, key) => {
    if (input === ' ' || key.upArrow || key.downArrow) {
      setEnabled(prev => !prev)
    }
    if (key.return) {
      onConfirm(enabled)
    }
  }, { isActive: !isCI })

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
