import React, { useEffect, useRef } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { SetupStep, AI_CLI } from '../types/index.js'
import { theme } from './theme.js'

interface Props {
  steps: SetupStep[]
  selectedClis?: AI_CLI[]
  onDone?: () => void
}

const STATUS_ICON: Record<string, string> = {
  pending: '○',
  done:    '✓',
  error:   '✗',
  skipped: '–',
}

const STATUS_COLOR: Record<string, string> = {
  pending: theme.muted,
  running: theme.warning,
  done:    theme.success,
  error:   theme.error,
  skipped: theme.muted,
}

export default function Progress({ steps, selectedClis, onDone }: Props) {
  const doneRef = useRef(false)

  const total     = steps.length
  const completed = steps.filter(s => s.status === 'done' || s.status === 'skipped').length
  const hasError  = steps.some(s => s.status === 'error')
  const allFinished = total > 0 && steps.every(
    s => s.status === 'done' || s.status === 'error' || s.status === 'skipped'
  )

  // Auto-advance when all steps finish with no errors
  useEffect(() => {
    if (allFinished && !hasError && !doneRef.current && onDone) {
      doneRef.current = true
      const t = setTimeout(onDone, 600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [allFinished, hasError, onDone])

  return (
    <Box flexDirection="column">
      {/* Summary header */}
      <Box marginBottom={1} flexDirection="column">
        {selectedClis && selectedClis.length > 0 && (
          <Text color={theme.muted}>
            {'Setting up for: '}
            <Text color={theme.primary}>{selectedClis.join(', ')}</Text>
          </Text>
        )}
        {total > 0 && (
          <Text color={theme.muted}>
            {'Progress: '}
            <Text color={completed === total ? theme.success : theme.warning}>
              {completed}/{total} steps
            </Text>
          </Text>
        )}
      </Box>

      {/* Steps */}
      <Box flexDirection="column">
        {steps.map(step => (
          <Box key={step.id} marginLeft={2}>
            {step.status === 'running' ? (
              <Text color={theme.warning}>
                <Spinner type="dots" />
                {' '}{step.label}
                {step.detail ? <Text color={theme.muted} dimColor>  {step.detail}</Text> : null}
              </Text>
            ) : (
              <Text color={(STATUS_COLOR[step.status] ?? theme.muted) as any}>
                {STATUS_ICON[step.status] ?? '○'} {step.label}
                {step.detail ? <Text color={theme.muted} dimColor>  {step.detail}</Text> : null}
              </Text>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
