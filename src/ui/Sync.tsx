import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { SetupStep } from '../types/index.js'
import { runSync, runStatus } from '../orchestrator/sync.js'

interface SyncProps {
  mode: 'sync' | 'status'
  dryRun: boolean
}

const STATUS_ICON: Record<string, string> = {
  pending: '\u25cb',
  done:    '\u2713',
  error:   '\u2717',
  skipped: '\u2013',
}

export default function Sync({ mode, dryRun }: SyncProps) {
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [done, setDone] = useState(false)

  const onStep = (step: SetupStep) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === step.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = step
        return next
      }
      return [...prev, step]
    })
  }

  useEffect(() => {
    const run = async () => {
      try {
        if (mode === 'sync') {
          await runSync(dryRun, onStep)
        } else {
          await runStatus(onStep)
        }
      } catch (e: unknown) {
        onStep({ id: 'fatal', label: 'Fatal error', status: 'error', detail: String(e) })
      }
      setDone(true)
    }
    run()
  }, [mode, dryRun])

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="#00d4ff">javi-dots</Text>
        <Text> {mode === 'sync' ? 'sync' : 'status'}</Text>
        {mode === 'sync' && dryRun && <Text color="yellow"> (dry-run)</Text>}
      </Box>

      {steps.map(step => (
        <Box key={step.id} marginLeft={2}>
          {step.status === 'running' ? (
            <Text color="yellow">
              <Spinner type="dots" />
              {' '}{step.label}
              {step.detail ? <Text color="gray" dimColor>  {step.detail}</Text> : null}
            </Text>
          ) : (
            <Text color={step.status === 'done' ? 'green' : step.status === 'error' ? 'red' : 'gray'}>
              {STATUS_ICON[step.status]} {step.label}
              {step.detail ? <Text color="gray" dimColor>  {step.detail}</Text> : null}
            </Text>
          )}
        </Box>
      ))}

      {done && (
        <Box marginTop={1}>
          <Text color="gray">Done.</Text>
        </Box>
      )}
    </Box>
  )
}
