import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import type { SetupStep, TokenHookMode } from '../types/index.js'
import { runTokenHooks } from '../orchestrator/token-hooks.js'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

interface TokenHooksProps {
  action: 'install' | 'remove' | 'status' | 'report'
  mode: TokenHookMode
  dryRun: boolean
}

const STATUS_ICON: Record<string, string> = {
  done: glyph.check,
  error: glyph.cross,
  skipped: glyph.dash,
}

export default function TokenHooks({ action, mode, dryRun }: TokenHooksProps) {
  const { exit } = useApp()
  const isCI = useCIMode()
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
    runTokenHooks(action, mode, onStep)
      .catch(e => onStep({ id: 'fatal', label: 'Error', status: 'error', detail: String(e) }))
      .finally(() => setDone(true))
  }, [action, mode])

  useEffect(() => {
    if (isCI && done) {
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, done, exit])

  const subtitle = action === 'install'
    ? `tokens hooks install (${mode})`
    : action === 'remove'
    ? 'tokens hooks remove'
    : action === 'status'
    ? 'tokens hooks status'
    : 'tokens hooks report'

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle={subtitle} dryRun={dryRun} />

      {steps.map(s => (
        <Box key={s.id} marginLeft={2}>
          {s.status === 'running'
            ? <Text color={theme.warning}><Spinner type="dots" /> {s.label}</Text>
            : <Text color={s.status === 'done' ? theme.success : s.status === 'error' ? theme.error : theme.muted}>
                {STATUS_ICON[s.status] ?? glyph.dash} {s.label}
                {s.detail ? <Text color={theme.muted} dimColor>  {s.detail}</Text> : null}
              </Text>}
        </Box>
      ))}

      {done && <Box marginTop={1}><Text color={theme.muted}>Done.</Text></Box>}
    </Box>
  )
}
