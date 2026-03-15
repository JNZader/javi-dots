import React from 'react'
import { Box, Text, useInput } from 'ink'
import type { AI_CLI } from '../types/index.js'
import { theme } from './theme.js'

interface Props {
  clis: AI_CLI[]
  ghagga: boolean
  dryRun: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function Confirmation({ clis, ghagga, dryRun, onConfirm, onCancel }: Props) {
  useInput((_input, key) => {
    if (key.return) onConfirm()
    if (key.escape) onCancel()
  })

  return (
    <Box flexDirection="column">
      <Text bold>Setup Plan:</Text>
      <Text color={theme.muted}>{'─'.repeat(32)}</Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.muted}>{'  AI CLIs:      '}</Text>
          <Text color={theme.primary} bold>{clis.join(', ')}</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  AI Framework: '}</Text>
          <Text color={theme.accent}>javi-ai install</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  SDD:          '}</Text>
          <Text color={theme.success}>agent-teams-lite (mandatory)</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  Memory:       '}</Text>
          <Text color={theme.success}>engram (mandatory)</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  Code Review:  '}</Text>
          <Text color={ghagga ? theme.success : theme.muted}>
            {ghagga ? 'ghagga (enabled)' : 'ghagga (skipped)'}
          </Text>
        </Box>
      </Box>

      {dryRun && (
        <Box marginTop={1}>
          <Text color={theme.warning} bold>  No changes will be made (dry run)</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          [Enter] Confirm  [Esc] Cancel
        </Text>
      </Box>
    </Box>
  )
}
