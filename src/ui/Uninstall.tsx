import React, { useState, useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import { runUninstall } from '../orchestrator/uninstall.js'
import type { AI_CLI, Manifest, SetupStep } from '../types/index.js'
import { MANIFEST_PATH } from '../constants.js'
import Header from './Header.js'
import { theme } from './theme.js'

type Stage = 'loading' | 'confirm' | 'uninstalling' | 'done' | 'no-install'

export default function Uninstall() {
  const { exit } = useApp()
  const [stage, setStage] = useState<Stage>('loading')
  const [clis, setClis] = useState<AI_CLI[]>([])
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
      const manifest: Manifest = JSON.parse(raw)
      if (manifest.clis.length === 0) {
        setStage('no-install')
      } else {
        setClis(manifest.clis)
        setStage('confirm')
      }
    } catch {
      setStage('no-install')
    }
  }, [])

  const doUninstall = async () => {
    setStage('uninstalling')
    try {
      await runUninstall(false, (step) => {
        setSteps(prev => {
          const idx = prev.findIndex(s => s.id === step.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = step
            return next
          }
          return [...prev, step]
        })
      })
      setStage('done')
    } catch (e) {
      setError(String(e))
      setStage('done')
    }
  }

  useInput((input, key) => {
    if (stage === 'confirm') {
      if (input.toLowerCase() === 'y' || key.return) {
        void doUninstall()
      } else if (input.toLowerCase() === 'n' || key.escape) {
        exit()
      }
    }
    if (stage === 'no-install' || stage === 'done') {
      if (key.return || key.escape) exit()
    }
  })

  const subtitle =
    stage === 'uninstalling' ? 'uninstalling...' :
    stage === 'done'         ? 'complete'        :
    'uninstall'

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle={subtitle} />

      {stage === 'loading' && (
        <Text color={theme.warning}>
          <Spinner type="dots" />
          {' Loading manifest...'}
        </Text>
      )}

      {stage === 'no-install' && (
        <Box flexDirection="column">
          {error
            ? <Text color={theme.error}>✗ Error: {error}</Text>
            : <Text color={theme.error}>✗ No javidots installation found.</Text>
          }
          <Box marginTop={1}>
            <Text color={theme.muted} dimColor>Press Enter to exit</Text>
          </Box>
        </Box>
      )}

      {stage === 'confirm' && (
        <Box flexDirection="column">
          <Text>
            The following will be removed for:{' '}
            <Text bold color={theme.primary}>{clis.join(', ')}</Text>
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.error}>  ✗ javi-ai managed files</Text>
            <Text color={theme.error}>  ✗ agent-teams-lite clone</Text>
            <Text color={theme.error}>  ✗ javidots manifest</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.muted} dimColor>
              Note: Your AI CLIs (claude, opencode, etc.) will NOT be removed.
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text>Continue? </Text>
            <Text bold color={theme.error}>[y/N] </Text>
          </Box>
        </Box>
      )}

      {stage === 'uninstalling' && (
        <Box flexDirection="column">
          <Text color={theme.warning}>
            <Spinner type="dots" />
            {' Removing javidots managed files...'}
          </Text>
          <Box marginTop={1} flexDirection="column">
            {steps.map(step => (
              <Text key={step.id} color={step.status === 'done' ? theme.success : step.status === 'error' ? theme.error : theme.muted}>
                {'  '}{step.status === 'done' ? '✓' : step.status === 'error' ? '✗' : '○'} {step.label}
                {step.detail ? <Text color={theme.muted} dimColor>  {step.detail}</Text> : null}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {stage === 'done' && (
        <Box flexDirection="column">
          <Text bold color={error ? theme.error : theme.success}>
            {error ? '✗ Uninstall failed' : '✓ Uninstall complete'}
          </Text>
          {error && <Text color={theme.error}>  {error}</Text>}
          {!error && (
            <Box marginTop={1} flexDirection="column">
              {steps.map(step => (
                <Text key={step.id} color={step.status === 'done' ? theme.success : theme.error}>
                  {'  '}{step.status === 'done' ? '✓' : '✗'} {step.label}
                  {step.detail ? <Text color={theme.muted} dimColor>  {step.detail}</Text> : null}
                </Text>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.muted} dimColor>Press Enter to exit</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
