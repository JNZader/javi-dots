import React, { useEffect, useState, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { runEspSetup } from '../orchestrator/esp.js'
import type { EspSetupResult } from '../orchestrator/esp.js'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

export default function Esp() {
  const { exit } = useApp()
  const isCI = useCIMode()
  const [result, setResult] = useState<EspSetupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const runSetup = useCallback(() => {
    setLoading(true)
    setResult(null)
    setError(null)
    runEspSetup()
      .then(r => { setResult(r); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  useEffect(() => { runSetup() }, [runSetup])

  // Auto-exit in CI mode once loading finishes
  useEffect(() => {
    if (isCI && !loading) {
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, loading, exit])

  useInput((input, key) => {
    if (input.toLowerCase() === 'r') runSetup()
    if (input.toLowerCase() === 'q' || key.return || key.escape) exit()
  }, { isActive: !isCI })

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle="esp" />

      {loading && (
        <Text color={theme.warning}>
          <Spinner type="dots" />
          {' Setting up Claude ESP tmux integration...'}
        </Text>
      )}

      {error && (
        <Text color={theme.error}>{glyph.cross} Error: {error}</Text>
      )}

      {result && (
        <Box flexDirection="column">
          {/* Prerequisites */}
          <Box marginBottom={1} flexDirection="column">
            <Text bold>Prerequisites</Text>
            <Text color={result.tmuxAvailable ? theme.success : theme.error}>
              {'  '}{result.tmuxAvailable ? glyph.check : glyph.cross} tmux
              {!result.tmuxAvailable && (
                <Text color={theme.muted} dimColor>{'  '}Install: brew install tmux</Text>
              )}
            </Text>
            <Text color={result.espInstalled ? theme.success : theme.error}>
              {'  '}{result.espInstalled ? glyph.check : glyph.cross} claude-esp
              {!result.espInstalled && (
                <Text color={theme.muted} dimColor>{'  '}Install: npm install -g claude-esp</Text>
              )}
            </Text>
          </Box>

          {/* Setup results */}
          {result.bindingResult && (
            <Box marginBottom={1} flexDirection="column">
              <Text bold>Setup</Text>
              <Text color={theme.success}>
                {'  '}{glyph.check} Toggle script: {result.scriptPath}
              </Text>
              <Text color={result.bindingResult.alreadyExists ? theme.muted : theme.success}>
                {'  '}{result.bindingResult.alreadyExists ? glyph.dash : glyph.check}
                {' '}Tmux binding (C-e)
                {result.bindingResult.alreadyExists
                  ? <Text color={theme.muted} dimColor>{'  '}already configured</Text>
                  : <Text color={theme.muted} dimColor>{'  '}added to ~/.tmux.conf</Text>
                }
              </Text>
            </Box>
          )}

          {/* Usage hint */}
          {result.bindingResult && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color={theme.primary}>Usage</Text>
              <Text color={theme.muted}>
                {'  '}Press Ctrl+E in tmux to toggle the ESP pane
              </Text>
              <Text color={theme.muted}>
                {'  '}Run: tmux source-file ~/.tmux.conf (to reload)
              </Text>
            </Box>
          )}

          {/* Missing prerequisites message */}
          {(!result.tmuxAvailable || !result.espInstalled) && (
            <Box marginBottom={1}>
              <Text color={theme.warning}>
                {glyph.diamond} Install missing prerequisites and run again
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Bottom hint */}
      {!loading && (
        <Box marginTop={1}>
          <Text color={theme.muted} dimColor>
            r refresh  q quit
          </Text>
        </Box>
      )}
    </Box>
  )
}
