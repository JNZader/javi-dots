import React from 'react'
import { Box, Text } from 'ink'
import { theme, glyph } from './theme.js'

interface Props {
  subtitle?: string
  dryRun?: boolean
}

const TITLE = `${glyph.star} javidots  Developer workstation setup`

// Fixed inner width (characters between the box walls)
const BOX_WIDTH = 45

function pad(content: string): string {
  const len = [...content].length  // unicode-safe length
  const spaces = BOX_WIDTH - len
  return content + ' '.repeat(Math.max(0, spaces))
}

export default function Header({ subtitle, dryRun }: Props) {
  const top    = '╭' + glyph.separator.repeat(BOX_WIDTH) + '╮'
  const bottom = '╰' + glyph.separator.repeat(BOX_WIDTH) + '╯'
  const titleLine = pad('  ' + TITLE + '  ')

  const subContent = [
    subtitle,
    dryRun ? 'DRY RUN' : null,
  ].filter(Boolean).join('  │  ')

  const subLine = subContent ? pad('  ' + subContent + '  ') : null

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.muted}>{top}</Text>
      <Box>
        <Text color={theme.muted}>│</Text>
        <Text bold color={theme.primary}>{titleLine}</Text>
        <Text color={theme.muted}>│</Text>
      </Box>
      {subLine && (
        <Box>
          <Text color={theme.muted}>│</Text>
          <Text color={dryRun ? theme.warning : theme.muted}>{subLine}</Text>
          <Text color={theme.muted}>│</Text>
        </Box>
      )}
      <Text color={theme.muted}>{bottom}</Text>
    </Box>
  )
}
