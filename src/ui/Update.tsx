import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import fs from 'fs'
import { runUpdate } from '../orchestrator/update.js'
import Progress from './Progress.js'
import Summary from './Summary.js'
import Header from './Header.js'
import type { AI_CLI, Manifest, SetupStep } from '../types/index.js'
import { MANIFEST_PATH } from '../constants.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

type Stage = 'loading' | 'confirm' | 'updating' | 'done' | 'no-install'

interface UpdateProps {
  dryRun?: boolean
}

export default function Update({ dryRun = false }: UpdateProps) {
  const { exit } = useApp()
  const isCI = useCIMode()
  const autoActed = useRef(false)
  const [stage, setStage] = useState<Stage>('loading')
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [startTime] = useState<number>(Date.now())

  useEffect(() => {
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
      const m: Manifest = JSON.parse(raw)
      if (m.clis.length === 0) {
        setStage('no-install')
      } else {
        setManifest(m)
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

  // Auto-confirm or auto-exit in CI mode
  useEffect(() => {
    if (!isCI || autoActed.current) return
    if (stage === 'confirm') {
      autoActed.current = true
      void startUpdate()
    }
    if (stage === 'no-install') {
      autoActed.current = true
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  useInput((input, key) => {
    if (stage === 'confirm') {
      if (input.toLowerCase() === 'y' || key.return) void startUpdate()
      else if (input.toLowerCase() === 'n' || key.escape) exit()
    }
    if (stage === 'no-install') {
      if (key.return || key.escape) exit()
    }
  }, { isActive: !isCI })

  const subtitle =
    stage === 'updating' ? 'updating...' :
    stage === 'done'     ? 'complete'    :
    'update'

  const clis = manifest?.clis ?? []

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
          <Text color={theme.error}>{glyph.cross} No javidots installation found.</Text>
          <Text color={theme.muted}>Run <Text bold>npx javidots</Text> first.</Text>
          <Box marginTop={1}>
            <Text color={theme.muted} dimColor>Press Enter to exit</Text>
          </Box>
        </Box>
      )}

      {stage === 'confirm' && manifest && (
        <Box flexDirection="column">
          <Text bold>Update Plan</Text>
          <Text color={theme.muted}>{glyph.separator.repeat(36)}</Text>

          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color={theme.muted}>{'  AI CLIs:      '}</Text>
              <Text color={theme.primary} bold>{clis.join(', ')}</Text>
            </Box>
            <Box>
              <Text color={theme.muted}>{'  SDD:          '}</Text>
              <Text color={manifest.sdd ? theme.success : theme.muted}>
                {manifest.sdd ? `${glyph.check} installed` : `${glyph.cross} not installed`}
              </Text>
            </Box>
            <Box>
              <Text color={theme.muted}>{'  Memory:       '}</Text>
              <Text color={manifest.engram ? theme.success : theme.muted}>
                {manifest.engram ? `${glyph.check} installed` : `${glyph.cross} not installed`}
              </Text>
            </Box>
            <Box>
              <Text color={theme.muted}>{'  Code Review:  '}</Text>
              <Text color={manifest.ghagga ? theme.success : theme.muted}>
                {manifest.ghagga ? `${glyph.check} enabled` : `${glyph.cross} skipped`}
              </Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text>Continue? </Text>
            <Text bold>[Y/n] </Text>
          </Box>
        </Box>
      )}

      {stage === 'updating' && (
        <Progress
          steps={steps}
          selectedClis={clis}
          onDone={() => setStage('done')}
        />
      )}

      {stage === 'done' && (
        <Summary
          steps={steps}
          dryRun={dryRun}
          selectedClis={clis}
          elapsedMs={Date.now() - startTime}
          ghagga={manifest?.ghagga}
        />
      )}
    </Box>
  )
}
