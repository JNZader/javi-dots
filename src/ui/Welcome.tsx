import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import Header from './Header.js'
import { theme } from './theme.js'

interface Props {
  onDone: () => void
}

export default function Welcome({ onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <Text>Set up your AI-powered dev environment:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>
            <Text color={theme.accent}>◆ AI CLIs     </Text>
            <Text color={theme.muted}> Claude, OpenCode, Gemini, Qwen, Codex, Copilot</Text>
          </Text>
          <Text>
            <Text color={theme.primary}>◆ SDD         </Text>
            <Text color={theme.muted}> Spec-Driven Development (mandatory)</Text>
          </Text>
          <Text>
            <Text color={theme.success}>◆ Memory      </Text>
            <Text color={theme.muted}> Persistent AI memory via engram (mandatory)</Text>
          </Text>
          <Text>
            <Text color={theme.warning}>◆ Review      </Text>
            <Text color={theme.muted}> Code review via ghagga (optional)</Text>
          </Text>
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
