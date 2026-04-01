import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { SetupStep } from '../types/index.js'
import { runTokenReport } from '../orchestrator/tokens.js'

const STATUS_ICON: Record<string, string> = {
  done: '\u2713', error: '\u2717', skipped: '\u2013',
}

export default function Tokens() {
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [done, setDone] = useState(false)

  const onStep = (step: SetupStep) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === step.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = step; return n }
      return [...prev, step]
    })
  }

  useEffect(() => {
    runTokenReport(onStep)
      .catch(e => onStep({ id: 'fatal', label: 'Error', status: 'error', detail: String(e) }))
      .finally(() => setDone(true))
  }, [])

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="#00d4ff">javi-dots</Text>
        <Text> tokens</Text>
      </Box>
      {steps.map(s => (
        <Box key={s.id} marginLeft={2}>
          {s.status === 'running'
            ? <Text color="yellow"><Spinner type="dots" /> {s.label}</Text>
            : <Text color={s.status === 'done' ? 'green' : s.status === 'error' ? 'red' : 'gray'}>
                {STATUS_ICON[s.status]} {s.label}
                {s.detail ? <Text color="gray" dimColor>  {s.detail}</Text> : null}
              </Text>}
        </Box>
      ))}
      {done && <Box marginTop={1}><Text color="gray">Done.</Text></Box>}
    </Box>
  )
}
