import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { useCIMode } from './CIContext.js'
import { theme, glyph } from './theme.js'
import { BUILT_IN_PROFILES } from '../constants.js'
import type { HookProfileId } from '../types/index.js'

interface Props {
  onConfirm: (profileId: HookProfileId) => void
}

// Items: each profile + a "skip" option
type SelectorItem = { id: HookProfileId; label: string; description: string }

const ITEMS: SelectorItem[] = [
  ...BUILT_IN_PROFILES.map(p => ({ id: p.id as HookProfileId, label: p.label, description: p.description })),
  { id: null, label: 'Skip', description: 'No hook profile — configure manually later' },
]

export default function HookProfileSelector({ onConfirm }: Props) {
  const isCI = useCIMode()
  const autoConfirmed = useRef(false)
  const [cursor, setCursor] = useState(0)

  // Auto-confirm in CI mode (default: standard)
  useEffect(() => {
    if (isCI && !autoConfirmed.current) {
      autoConfirmed.current = true
      onConfirm('standard')
    }
  }, [isCI]) // eslint-disable-line react-hooks/exhaustive-deps

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor(prev => (prev - 1 + ITEMS.length) % ITEMS.length)
    }
    if (key.downArrow) {
      setCursor(prev => (prev + 1) % ITEMS.length)
    }
    if (key.return) {
      onConfirm(ITEMS[cursor]!.id)
    }
    if (input === 'j') {
      setCursor(prev => (prev + 1) % ITEMS.length)
    }
    if (input === 'k') {
      setCursor(prev => (prev - 1 + ITEMS.length) % ITEMS.length)
    }
  }, { isActive: !isCI })

  return (
    <Box flexDirection="column">
      <Text bold>Select a hook reliability profile:</Text>

      <Box marginTop={1} flexDirection="column">
        {ITEMS.map((item, i) => {
          const isSelected = i === cursor
          const color = item.id === null ? theme.muted : isSelected ? theme.primary : theme.muted
          return (
            <Box key={String(item.id ?? 'skip')} marginLeft={2}>
              <Text color={color}>
                {isSelected ? glyph.filledDot : glyph.emptyDot}{' '}
              </Text>
              <Text bold={isSelected} color={color}>{item.label}</Text>
              <Text color={theme.muted}>{'  '}</Text>
              <Text color={theme.muted} dimColor>{item.description}</Text>
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          {glyph.pointer} Up/Down or j/k to navigate  Enter to confirm
        </Text>
      </Box>
    </Box>
  )
}
