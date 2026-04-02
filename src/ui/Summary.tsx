import React, { useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import type { SetupStep, AI_CLI } from '../types/index.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

interface Props {
  steps: SetupStep[]
  dryRun: boolean
  selectedClis?: AI_CLI[]
  elapsedMs?: number
  ghagga?: boolean
  kiteguard?: boolean
}

export default function Summary({ steps, dryRun, selectedClis, elapsedMs, ghagga, kiteguard }: Props) {
  const { exit } = useApp()
  const isCI = useCIMode()

  const done    = steps.filter(s => s.status === 'done')
  const errors  = steps.filter(s => s.status === 'error')
  const skipped = steps.filter(s => s.status === 'skipped')
  const elapsed = elapsedMs != null
    ? `${(elapsedMs / 1000).toFixed(1)}s`
    : null

  // Auto-exit in CI mode
  useEffect(() => {
    if (isCI) {
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, exit])

  useInput((_input, key) => {
    if (key.return || key.escape) exit()
  }, { isActive: !isCI })

  const cliList  = selectedClis ?? []
  const firstCli = cliList[0] ?? 'claude'

  return (
    <Box flexDirection="column">
      {/* Title with elapsed time */}
      <Text bold color={errors.length > 0 ? theme.warning : theme.success}>
        {dryRun
          ? `${glyph.emptyDot} Dry run complete`
          : `${glyph.check} Setup complete!`}
        {elapsed && <Text color={theme.muted}>  Completed in {elapsed}</Text>}
      </Text>

      {/* Dry run note */}
      {dryRun && (
        <Box marginTop={1}>
          <Text color={theme.warning} bold>  No changes were made (dry run)</Text>
        </Box>
      )}

      {/* Step results grouped by status */}
      <Box marginTop={1} flexDirection="column">
        {done.map(step => (
          <Text key={step.id} color={theme.success}>
            {'  '}{glyph.check} {step.label}
            {step.detail ? <Text color={theme.muted} dimColor>  {step.detail}</Text> : null}
          </Text>
        ))}
        {skipped.map(step => (
          <Text key={step.id} color={theme.muted}>
            {'  '}{glyph.dash} {step.label}
            {step.detail ? <Text dimColor>  {step.detail}</Text> : null}
          </Text>
        ))}
        {errors.map(step => (
          <Text key={step.id} color={theme.error}>
            {'  '}{glyph.cross} {step.label}
            {step.detail ? <Text dimColor>  {step.detail}</Text> : null}
          </Text>
        ))}
      </Box>

      {/* Next steps */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.primary}>  Next steps:</Text>
        <Text color={theme.muted}>{'    Start coding:         '}<Text color={theme.white}>{firstCli}</Text></Text>
        <Text color={theme.muted}>{'    Init a new project:   '}<Text color={theme.white}>npx javi-forge init</Text></Text>
        <Text color={theme.muted}>{'    Check health:         '}<Text color={theme.white}>npx javidots doctor</Text></Text>
        {!ghagga && (
          <Text color={theme.muted}>{'    Add code review:      '}<Text color={theme.white}>npx javidots --ghagga</Text></Text>
        )}
        {!kiteguard && (
          <Text color={theme.muted}>{'    Add runtime security: '}<Text color={theme.white}>npx javidots --kiteguard</Text></Text>
        )}
      </Box>

      {/* Exit hint */}
      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>Press Enter to exit</Text>
      </Box>
    </Box>
  )
}
