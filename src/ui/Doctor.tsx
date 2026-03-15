import React, { useEffect, useState, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { runDoctor } from '../orchestrator/doctor.js'
import type { DoctorCheck } from '../types/index.js'
import Header from './Header.js'
import { theme } from './theme.js'

type CheckStatus = DoctorCheck['status']

const STATUS_ICON: Record<CheckStatus, string> = {
  ok:   '✓',
  fail: '✗',
  skip: '–',
}

const STATUS_COLOR: Record<CheckStatus, string> = {
  ok:   theme.success,
  fail: theme.error,
  skip: theme.muted,
}

export default function Doctor() {
  const { exit } = useApp()
  const [checks, setChecks] = useState<DoctorCheck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const runCheck = useCallback(() => {
    setLoading(true)
    setChecks(null)
    setError(null)
    runDoctor()
      .then(r => { setChecks(r.checks); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  useEffect(() => { runCheck() }, [runCheck])

  useInput((input, key) => {
    if (input.toLowerCase() === 'r') {
      runCheck()
    }
    if (input.toLowerCase() === 'q' || key.return || key.escape) {
      exit()
    }
  })

  // Compute health score
  const nonSkip = checks?.filter(c => c.status !== 'skip') ?? []
  const passed  = nonSkip.filter(c => c.status === 'ok').length
  const total   = nonSkip.length

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle="doctor" />

      {loading && (
        <Text color={theme.warning}>
          <Spinner type="dots" />
          {' Running checks...'}
        </Text>
      )}

      {error && (
        <Text color={theme.error}>✗ Error: {error}</Text>
      )}

      {checks && (
        <Box flexDirection="column">
          {/* Health score */}
          <Box marginBottom={1}>
            <Text bold>Health: </Text>
            <Text bold color={passed === total ? theme.success : theme.warning}>
              {passed}/{total} checks passed
            </Text>
            {total > 0 && (
              <Text color={theme.muted}>
                {' '}({Math.round((passed / total) * 100)}%)
              </Text>
            )}
          </Box>

          {/* Check list */}
          <Box flexDirection="column">
            {checks.map((check, i) => (
              <Box key={i}>
                <Text color={STATUS_COLOR[check.status] as any}>
                  {'  '}
                  {STATUS_ICON[check.status]}
                  {' '}
                  {check.name}
                  {check.detail
                    ? <Text color={theme.muted} dimColor>{'  '}{check.detail}</Text>
                    : null}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Bottom hint */}
      {!loading && (
        <Box marginTop={1}>
          <Text color={theme.muted} dimColor>
            Press r to refresh, q to quit
          </Text>
        </Box>
      )}
    </Box>
  )
}
