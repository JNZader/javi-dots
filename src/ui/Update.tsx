import React, { useState, useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import { runUpdate } from '../orchestrator/update.js'
import Progress from './Progress.js'
import Summary from './Summary.js'
import Header from './Header.js'
import type { AI_CLI, Manifest, SetupStep } from '../types/index.js'
import { MANIFEST_PATH } from '../constants.js'
import { theme } from './theme.js'

type Stage = 'loading' | 'confirm' | 'updating' | 'done' | 'no-install'

interface UpdateProps {
  dryRun?: boolean
}

export default function Update({ dryRun = false }: UpdateProps) {
  const { exit } = useApp()
  const [stage, setStage] = useState<Stage>('loading')
  const [installedClis, setInstalledClis] = useState<AI_CLI[]>([])
  const [ghagga, setGhagga] = useState(false)
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [startTime] = useState<number>(Date.now())

  useEffect(() => {
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
      const manifest: Manifest = JSON.parse(raw)
      if (manifest.clis.length === 0) {
        setStage('no-install')
      } else {
        setInstalledClis(manifest.clis)
        setGhagga(manifest.ghagga)
        setStage('confirm')
      }
    } catch {
      setStage('no-install')
    }
  }, [])

  const startUpdate = async () => {
    setStage('updating')
    await runUpdate(dryRun, (step) => {
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
  }

  useInput((input, key) => {
    if (stage === 'confirm') {
      if (input.toLowerCase() === 'y' || key.return) {
        void startUpdate()
      } else if (input.toLowerCase() === 'n' || key.escape) {
        exit()
      }
    }
    if (stage === 'no-install') {
      if (key.return || key.escape) exit()
    }
  })

  const subtitle =
    stage === 'updating' ? 'updating...' :
    stage === 'done'     ? 'complete'    :
    'update'

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle={subtitle} dryRun={dryRun} />

      {stage === 'loading' && (
        <Text color={theme.warning}>
          <Spinner type="dots" />
          {' Loading manifest...'}
        </Text>
      )}

      {stage === 'no-install' && (
        <Box flexDirection="column">
          <Text color={theme.error}>✗ No javidots installation found.</Text>
          <Text color={theme.muted}>Run <Text bold>npx javidots</Text> first.</Text>
          <Box marginTop={1}>
            <Text color={theme.muted} dimColor>Press Enter to exit</Text>
          </Box>
        </Box>
      )}

      {stage === 'confirm' && (
        <Box flexDirection="column">
          <Text>
            Update will re-install for:{' '}
            <Text bold color={theme.primary}>{installedClis.join(', ')}</Text>
          </Text>
          <Box marginTop={1}>
            <Text>Continue? </Text>
            <Text bold>[Y/n] </Text>
          </Box>
        </Box>
      )}

      {stage === 'updating' && (
        <Progress
          steps={steps}
          selectedClis={installedClis}
          onDone={() => setStage('done')}
        />
      )}

      {stage === 'done' && (
        <Summary
          steps={steps}
          dryRun={dryRun}
          selectedClis={installedClis}
          elapsedMs={Date.now() - startTime}
          ghagga={ghagga}
        />
      )}
    </Box>
  )
}
