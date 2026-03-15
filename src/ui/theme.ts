export const theme = {
  primary:  'cyan',
  success:  'green',
  warning:  'yellow',
  error:    'red',
  muted:    'gray',
  accent:   'magenta',
  white:    'white',
} as const

export type ThemeColor = typeof theme[keyof typeof theme]

// Shared unicode glyphs
export const glyph = {
  diamond:    '◆',
  filledDot:  '◉',
  emptyDot:   '○',
  check:      '✓',
  cross:      '✗',
  dash:       '–',
  pointer:    '▶',
  star:       '✦',
  separator:  '─',
} as const
