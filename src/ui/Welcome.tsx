import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

interface Props {
  onDone: () => void
}

const FEATURES = [
  { color: theme.accent,  label: 'AI CLIs    ', desc: 'Claude, OpenCode, Gemini, Qwen, Codex, Copilot' },
  { color: theme.primary, label: 'SDD        ', desc: 'Spec-Driven Development (mandatory)' },
  { color: theme.success, label: 'Memory     ', desc: 'Persistent AI memory via engram (mandatory)' },
  { color: theme.warning, label: 'Review     ', desc: 'Code review via ghagga (optional)' },
] as const

export default function Welcome({ onDone }: Props) {
  const isCI = useCIMode()

  useEffect(() => {
    const timer = setTimeout(onDone, isCI ? 0 : 1500)
    return () => clearTimeout(timer)
  }, [onDone, isCI])

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <Text>Set up your AI-powered dev environment:</Text>
        <Box marginTop={1} flexDirection="column">
          {FEATURES.map((f, i) => (
            <Text key={i}>
              <Text color={f.color}>{glyph.diamond} {f.label}</Text>
              <Text color={theme.muted}> {f.desc}</Text>
            </Text>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text color={theme.muted} dimColor>
            <Spinner type="dots" />
            {' Checking your system...'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
