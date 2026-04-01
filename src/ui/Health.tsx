import React, { useEffect, useState, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { runHealth } from '../orchestrator/health.js'
import type { HealthFinding, HealthSeverity } from '../types/index.js'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

const SEVERITY_ICON: Record<HealthSeverity, string> = {
  critical:    glyph.cross,
  structural:  glyph.diamond,
  incremental: glyph.dash,
}

const SEVERITY_COLOR: Record<HealthSeverity, string> = {
  critical:    theme.error,
  structural:  theme.warning,
  incremental: theme.primary,
}

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  critical:    'Critical',
  structural:  'Structural',
  incremental: 'Incremental',
}

function groupBySeverity(findings: HealthFinding[]): Record<HealthSeverity, HealthFinding[]> {
  const groups: Record<HealthSeverity, HealthFinding[]> = {
    critical: [],
    structural: [],
    incremental: [],
  }
  for (const f of findings) {
    groups[f.severity].push(f)
  }
  return groups
}

export default function Health() {
  const { exit } = useApp()
  const isCI = useCIMode()
  const [findings, setFindings] = useState<HealthFinding[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const runCheck = useCallback(() => {
    setLoading(true)
    setFindings(null)
    setError(null)
    runHealth()
      .then(r => { setFindings(r); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  useEffect(() => { runCheck() }, [runCheck])

  // Auto-exit in CI mode once loading finishes
  useEffect(() => {
    if (isCI && !loading) {
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, loading, exit])

  useInput((input, key) => {
    if (input.toLowerCase() === 'r') runCheck()
    if (input.toLowerCase() === 'q' || key.return || key.escape) exit()
  }, { isActive: !isCI })

  // Health score
  const total = findings?.length ?? 0
  const criticalCount = findings?.filter(f => f.severity === 'critical').length ?? 0

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle="health" />

      {loading && (
        <Text color={theme.warning}>
          <Spinner type="dots" />
          {' Auditing agent configuration...'}
        </Text>
      )}

      {error && (
        <Text color={theme.error}>{glyph.cross} Error: {error}</Text>
      )}

      {findings && (
        <Box flexDirection="column">
          {/* Health score */}
          <Box marginBottom={1}>
            <Text bold>Health: </Text>
            {total === 0 ? (
              <Text bold color={theme.success}>
                {glyph.check} No issues found
              </Text>
            ) : (
              <Text bold color={criticalCount > 0 ? theme.error : theme.warning}>
                {total} {total === 1 ? 'finding' : 'findings'}
                {criticalCount > 0 && ` (${criticalCount} critical)`}
              </Text>
            )}
          </Box>

          {/* Findings grouped by severity */}
          {(['critical', 'structural', 'incremental'] as const).map(severity => {
            const group = groupBySeverity(findings)[severity]
            if (group.length === 0) return null
            return (
              <Box key={severity} flexDirection="column" marginBottom={1}>
                <Text bold color={SEVERITY_COLOR[severity] as any}>
                  {SEVERITY_LABEL[severity]} ({group.length})
                </Text>
                {group.map((f, i) => (
                  <Box key={i} flexDirection="column" marginLeft={2}>
                    <Text color={SEVERITY_COLOR[f.severity] as any}>
                      {SEVERITY_ICON[f.severity]} [{f.category}] {f.message}
                    </Text>
                    <Text color={theme.muted} dimColor>
                      {'  '}Fix: {f.fix}
                    </Text>
                  </Box>
                ))}
              </Box>
            )
          })}
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
