import React from 'react'
import { Box, Text, useInput } from 'ink'
import type { AI_CLI } from '../types/index.js'
import { theme, glyph } from './theme.js'

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
      <Text bold>Setup Plan</Text>
      <Text color={theme.muted}>{glyph.separator.repeat(36)}</Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.muted}>{'  AI CLIs:      '}</Text>
          <Text color={theme.primary} bold>{clis.join(', ')}</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  AI Framework: '}</Text>
          <Text color={theme.accent}>javi-ai</Text>
          <Text color={theme.muted}> (skills, configs, orchestrators)</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  SDD:          '}</Text>
          <Text color={theme.success}>agent-teams-lite {glyph.check} mandatory</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  Memory:       '}</Text>
          <Text color={theme.success}>engram {glyph.check} mandatory</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'  Code Review:  '}</Text>
          {ghagga ? (
            <Text color={theme.success}>ghagga {glyph.check} enabled</Text>
          ) : (
            <Text color={theme.muted}>ghagga {glyph.cross} skipped</Text>
          )}
        </Box>
      </Box>

      {dryRun && (
        <Box marginTop={1}>
          <Text color={theme.warning} bold>  No changes will be made (dry run)</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          [Enter] Confirm  [Esc] Back
        </Text>
      </Box>
    </Box>
  )
}
