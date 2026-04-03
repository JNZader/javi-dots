import React, { useEffect, useState, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { runHealth } from '../orchestrator/health.js'
import type { HealthFinding, HealthSeverity, HealthReport } from '../types/index.js'
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

function scoreColor(score: number): string {
  if (score > 80) return theme.success
  if (score > 50) return theme.warning
  return theme.error
}

function snrColor(ratio: number): string {
  if (ratio >= 70) return theme.success
  if (ratio >= 40) return theme.warning
  return theme.error
}

export default function Health() {
  const { exit } = useApp()
  const isCI = useCIMode()
  const [report, setReport] = useState<HealthReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const runCheck = useCallback(() => {
    setLoading(true)
    setReport(null)
    setError(null)
    runHealth()
      .then(r => { setReport(r); setLoading(false) })
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

  const findings = report?.findings ?? []
  const total = findings.length
  const criticalCount = findings.filter(f => f.severity === 'critical').length

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

      {report && (
        <Box flexDirection="column">
          {/* Overall score */}
          <Box marginBottom={1} flexDirection="column">
            <Box>
              <Text bold>Score: </Text>
              <Text bold color={scoreColor(report.score) as any}>
                {report.score}/100
              </Text>
            </Box>
          </Box>

          {/* Signal-to-noise ratio */}
          {report.signalToNoise && (
            <Box marginBottom={1}>
              <Text bold>Signal-to-Noise: </Text>
              <Text bold color={snrColor(report.signalToNoise.ratio) as any}>
                {report.signalToNoise.ratio}%
              </Text>
              <Text color={theme.muted} dimColor>
                {' '}({report.signalToNoise.signalLines} signal / {report.signalToNoise.totalLines} total lines)
              </Text>
            </Box>
          )}

          {/* Token cost summary */}
          {report.tokenCosts.entries.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold>Token Costs: </Text>
              <Text color={theme.muted} dimColor>
                Total: {report.tokenCosts.total.toLocaleString()} tokens
              </Text>
              {report.tokenCosts.entries.slice(0, 5).map((entry, i) => {
                const pct = report.tokenCosts.total > 0
                  ? Math.round((entry.tokens / report.tokenCosts.total) * 100)
                  : 0
                return (
                  <Box key={i} marginLeft={2}>
                    <Text color={theme.primary}>
                      {entry.source}: {entry.tokens.toLocaleString()} ({pct}%)
                    </Text>
                  </Box>
                )
              })}
              {report.tokenCosts.entries.length > 5 && (
                <Box marginLeft={2}>
                  <Text color={theme.muted} dimColor>
                    ...and {report.tokenCosts.entries.length - 5} more sources
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* Findings summary */}
          <Box marginBottom={1}>
            <Text bold>Findings: </Text>
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
