import React from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import type { SetupStep, AI_CLI } from '../types/index.js'
import { theme } from './theme.js'

interface Props {
  steps: SetupStep[]
  dryRun: boolean
  selectedClis?: AI_CLI[]
  elapsedMs?: number
  ghagga?: boolean
}

export default function Summary({ steps, dryRun, selectedClis, elapsedMs, ghagga }: Props) {
  const { exit } = useApp()

  const done   = steps.filter(s => s.status === 'done').length
  const errors = steps.filter(s => s.status === 'error')
  const skipped = steps.filter(s => s.status === 'skipped')
  const elapsed = elapsedMs != null
    ? `${(elapsedMs / 1000).toFixed(1)}s`
    : null

  useInput((_input, key) => {
    if (key.return || key.escape) exit()
  })

  const cliList = selectedClis ?? []
  const firstCli = cliList[0] ?? 'claude'

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Text bold color={errors.length > 0 ? theme.warning : theme.success}>
        {dryRun ? '○ Dry run complete' : '✓ Setup complete!'}
        {elapsed && <Text color={theme.muted}>  ({elapsed})</Text>}
      </Text>

      {/* Dry run note */}
      {dryRun && (
        <Box marginTop={1}>
          <Text color={theme.warning} bold>  No changes were made (dry run)</Text>
        </Box>
      )}

      {/* Step results */}
      <Box marginTop={1} flexDirection="column">
        {steps.filter(s => s.status === 'done').map(step => (
          <Text key={step.id} color={theme.success}>
            {'  ✓ '}{step.label}
            {step.detail ? <Text color={theme.muted} dimColor>  {step.detail}</Text> : null}
          </Text>
        ))}
        {skipped.map(step => (
          <Text key={step.id} color={theme.muted}>
            {'  – '}{step.label}
            {step.detail ? <Text dimColor>  {step.detail}</Text> : null}
          </Text>
        ))}
        {errors.map(step => (
          <Text key={step.id} color={theme.error}>
            {'  ✗ '}{step.label}
            {step.detail ? <Text dimColor>  {step.detail}</Text> : null}
          </Text>
        ))}
      </Box>

      {/* Next steps */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.primary}>  Next steps:</Text>
        <Text color={theme.muted}>{'    Start coding with AI:   '}<Text color="white">{firstCli}</Text></Text>
        <Text color={theme.muted}>{'    Initialize a project:   '}<Text color="white">npx javi-forge init</Text></Text>
        <Text color={theme.muted}>{'    Check installation:     '}<Text color="white">npx javidots doctor</Text></Text>
        {!ghagga && (
          <Text color={theme.muted}>{'    Add code review:        '}<Text color="white">npx javidots --ghagga</Text></Text>
        )}
      </Box>

      {/* Exit hint */}
      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>Press Enter to exit</Text>
      </Box>
    </Box>
  )
}
