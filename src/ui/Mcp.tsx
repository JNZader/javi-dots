import React, { useEffect, useState, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { runMcpSetup } from '../orchestrator/mcp.js'
import type { McpSetupResult, McpServerStatus } from '../types/index.js'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

const STATUS_ICON: Record<McpServerStatus, string> = {
  'installed':       glyph.check,
  'already-present': glyph.dash,
  'failed':          glyph.cross,
}

const STATUS_COLOR: Record<McpServerStatus, string> = {
  'installed':       theme.success,
  'already-present': theme.muted,
  'failed':          theme.error,
}

const STATUS_LABEL: Record<McpServerStatus, string> = {
  'installed':       'Installed',
  'already-present': 'Already present',
  'failed':          'Failed',
}

interface McpProps {
  dryRun: boolean
}

export default function Mcp({ dryRun }: McpProps) {
  const { exit } = useApp()
  const isCI = useCIMode()
  const [result, setResult] = useState<McpSetupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const runSetup = useCallback(() => {
    setLoading(true)
    setResult(null)
    setError(null)
    runMcpSetup(dryRun)
      .then(r => { setResult(r); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [dryRun])

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

  // Counts
  const installed = result?.results.filter(r => r.status === 'installed').length ?? 0
  const present = result?.results.filter(r => r.status === 'already-present').length ?? 0
  const failed = result?.results.filter(r => r.status === 'failed').length ?? 0

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle="mcp" />

      {loading && (
        <Text color={theme.warning}>
          <Spinner type="dots" />
          {' Setting up MCP servers...'}
        </Text>
      )}

      {error && (
        <Text color={theme.error}>{glyph.cross} Error: {error}</Text>
      )}

      {result && (
        <Box flexDirection="column">
          {/* Summary */}
          <Box marginBottom={1}>
            <Text bold>MCP Servers: </Text>
            <Text color={theme.success}>{installed} installed</Text>
            <Text color={theme.muted}>{' / '}</Text>
            <Text color={theme.muted}>{present} already present</Text>
            {failed > 0 && (
              <>
                <Text color={theme.muted}>{' / '}</Text>
                <Text color={theme.error}>{failed} failed</Text>
              </>
            )}
          </Box>

          {/* Per-server results */}
          <Box flexDirection="column" marginBottom={1}>
            {result.results.map((r, i) => (
              <Box key={i} flexDirection="column" marginLeft={2}>
                <Text color={STATUS_COLOR[r.status] as any}>
                  {STATUS_ICON[r.status]} {r.server.name}
                  <Text color={theme.muted} dimColor>
                    {'  '}{STATUS_LABEL[r.status]}
                    {r.detail && ` — ${r.detail}`}
                  </Text>
                </Text>
              </Box>
            ))}
          </Box>

          {/* Config path */}
          <Box marginBottom={1}>
            <Text color={theme.muted} dimColor>
              Config: {result.configPath}
            </Text>
          </Box>

          {dryRun && (
            <Box marginBottom={1}>
              <Text color={theme.warning}>
                {glyph.diamond} Dry-run mode — no changes made
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
