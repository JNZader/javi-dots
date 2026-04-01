import React, { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { runSecurityInstall, runSecurityAudit } from '../orchestrator/security.js'
import type { SecurityInstallResult } from '../orchestrator/security.js'
import type { SecurityAuditResult } from '../types/index.js'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'

interface SecurityProps {
  mode: 'install' | 'audit'
  dryRun: boolean
}

export default function Security({ mode, dryRun }: SecurityProps) {
  const { exit } = useApp()
  const isCI = useCIMode()
  const [installResult, setInstallResult] = useState<SecurityInstallResult | null>(null)
  const [auditResult, setAuditResult] = useState<SecurityAuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (mode === 'install') {
        setInstallResult(runSecurityInstall(dryRun))
      } else {
        setAuditResult(runSecurityAudit())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [mode, dryRun])

  useEffect(() => {
    if (isCI && (installResult || auditResult || error)) {
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, installResult, auditResult, error, exit])

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle={mode === 'install' ? 'security' : 'security audit'} dryRun={dryRun} />

      {error && (
        <Text color={theme.error}>{glyph.cross} Error: {error}</Text>
      )}

      {installResult && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color={theme.success}>
              {glyph.check} Security hooks {installResult.hookAction === 'already-installed' ? 'already installed' : 'installed'}
            </Text>
          </Box>
          <Text>  Rules: <Text bold>{installResult.rulesCount}</Text> enabled ({installResult.rulesSource})</Text>
          <Text>  Guard: <Text dimColor>{installResult.guardScriptPath}</Text></Text>
          <Text>  Hooks: <Text dimColor>{installResult.settingsPath}</Text> ({installResult.hookAction})</Text>
          {dryRun && (
            <Box marginTop={1}>
              <Text color={theme.warning}>{glyph.diamond} Dry run — no files were modified</Text>
            </Box>
          )}
        </Box>
      )}

      {auditResult && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Security Audit</Text>
          </Box>

          <Text>
            Hook installed: {auditResult.hookInstalled
              ? <Text color={theme.success}>{glyph.check} yes</Text>
              : <Text color={theme.error}>{glyph.cross} no</Text>}
          </Text>
          <Text>
            Guard script: {auditResult.guardScriptExists
              ? <Text color={theme.success}>{glyph.check} exists</Text>
              : <Text color={theme.error}>{glyph.cross} missing</Text>}
          </Text>
          <Text>
            Rules: <Text bold>{auditResult.enabledRules}</Text>/{auditResult.totalRules} enabled
          </Text>

          {auditResult.categories.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>Coverage by category:</Text>
              {auditResult.categories.map((c: { category: string; count: number }) => (
                <Text key={c.category}>
                  {'  '}{glyph.check} {c.category}: {c.count} {c.count === 1 ? 'rule' : 'rules'}
                </Text>
              ))}
            </Box>
          )}

          {auditResult.missingCategories.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={theme.warning}>Missing categories:</Text>
              {auditResult.missingCategories.map((c: string) => (
                <Text key={c} color={theme.warning}>
                  {'  '}{glyph.cross} {c}
                </Text>
              ))}
            </Box>
          )}

          {!auditResult.hookInstalled && (
            <Box marginTop={1}>
              <Text color={theme.warning}>
                {glyph.diamond} Run <Text bold>javi-dots security</Text> to install hooks
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
