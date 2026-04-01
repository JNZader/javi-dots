import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Header from './Header.js'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'
import {
  resolveSkillPath,
  validateDescription,
  detectHighRiskKeywords,
  createPhases,
  toSlug,
} from '../orchestrator/nano.js'
import type { NanoPhase } from '../types/index.js'

interface NanoProps {
  description: string
}

const PHASE_GLYPHS: Record<NanoPhase['status'], string> = {
  pending: glyph.dash,
  running: glyph.diamond,
  done: glyph.check,
  error: glyph.cross,
  escalated: glyph.diamond,
}

const PHASE_COLORS: Record<NanoPhase['status'], string> = {
  pending: theme.muted,
  running: theme.warning,
  done: theme.success,
  error: theme.error,
  escalated: theme.warning,
}

export default function Nano({ description }: NanoProps) {
  const { exit } = useApp()
  const isCI = useCIMode()
  const [phases] = useState<NanoPhase[]>(createPhases)
  const [error, setError] = useState<string | null>(null)
  const [skillPath, setSkillPath] = useState<string | null>(null)
  const [riskWarnings, setRiskWarnings] = useState<string[]>([])
  const [slug, setSlug] = useState('')

  useEffect(() => {
    // Validate description
    const validation = validateDescription(description)
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid description')
      return
    }

    setSlug(toSlug(description))

    // Check for high-risk keywords
    const warnings = detectHighRiskKeywords(description)
    if (warnings.length > 0) setRiskWarnings(warnings)

    // Resolve skill path
    const resolved = resolveSkillPath()
    setSkillPath(resolved)
  }, [description])

  // Auto-exit in CI mode
  useEffect(() => {
    if (isCI && (error || skillPath !== undefined)) {
      const t = setTimeout(() => exit(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isCI, error, skillPath, exit])

  useInput((input, key) => {
    if (input.toLowerCase() === 'q' || key.escape) exit()
  }, { isActive: !isCI })

  return (
    <Box flexDirection="column" padding={1}>
      <Header subtitle="nano" />

      {error && (
        <Text color={theme.error}>{glyph.cross} {error}</Text>
      )}

      {!error && (
        <Box flexDirection="column">
          {/* Description + slug */}
          <Box marginBottom={1} flexDirection="column">
            <Text bold color={theme.primary}>Change: <Text color="white">{description}</Text></Text>
            <Text color={theme.muted} dimColor>slug: {slug}</Text>
          </Box>

          {/* Risk warnings */}
          {riskWarnings.length > 0 && (
            <Box marginBottom={1} flexDirection="column">
              <Text color={theme.warning}>
                {glyph.diamond} High-risk keywords detected: {riskWarnings.join(', ')}
              </Text>
              <Text color={theme.muted} dimColor>
                Consider using /sdd-new for changes with these characteristics
              </Text>
            </Box>
          )}

          {/* Skill path */}
          <Box marginBottom={1}>
            {skillPath ? (
              <Text color={theme.success}>{glyph.check} Skill loaded: {skillPath}</Text>
            ) : (
              <Text color={theme.warning}>{glyph.diamond} Skill not found — nano will run with defaults</Text>
            )}
          </Box>

          {/* Phases */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>Phases</Text>
            {phases.map(phase => (
              <Text key={phase.id} color={PHASE_COLORS[phase.status]}>
                {'  '}{PHASE_GLYPHS[phase.status]} {phase.label}
                {phase.detail && <Text color={theme.muted} dimColor>  {phase.detail}</Text>}
              </Text>
            ))}
          </Box>

          {/* Instructions */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={theme.primary}>Workflow</Text>
            <Text color={theme.muted}>
              {'  '}The nano workflow runs inline in your AI session:
            </Text>
            <Text color={theme.muted}>
              {'  '}1. Challenge — scope and risk assessment
            </Text>
            <Text color={theme.muted}>
              {'  '}2. Plan — 3-7 concrete steps with file paths
            </Text>
            <Text color={theme.muted}>
              {'  '}3. Build — implement and test
            </Text>
            <Text color={theme.muted}>
              {'  '}4. Review — self-review checklist
            </Text>
          </Box>
        </Box>
      )}

      {/* Bottom hint */}
      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>q quit</Text>
      </Box>
    </Box>
  )
}
