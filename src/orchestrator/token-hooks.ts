import fs from 'fs'
import path from 'path'
import type { SetupStep, TokenHookMode, TokenAnatomyEntry, TokenWasteReport, TokenHookStatus } from '../types/index.js'
import {
  TOKEN_GUARD_PATH,
  TOKEN_GUARD_SCRIPT_NAME,
  SETTINGS_PATH,
  MANIFEST_DIR,
  WOLF_DIR,
} from '../constants.js'
import { readFileIfExists, tokenEstimate } from './utils.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

// ── Settings.json Hook Types ─────────────────────────────────────────────

interface SettingsHookEntry {
  type: string
  command: string
}

interface SettingsJson {
  hooks?: {
    PreToolUse?: SettingsHookEntry[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ── Guard Script Generation ──────────────────────────────────────────────

const LEDGER_PATH = path.join(WOLF_DIR, 'ledger.jsonl')

export function generateGuardScript(mode: TokenHookMode): string {
  const blockOrWarn = mode === 'block'
    ? `    echo "BLOCKED by javi-dots token-guard: repeated read of $FILE_PATH" >&2
    exit 2`
    : `    echo "WARNING (javi-dots token-guard): repeated read of $FILE_PATH" >&2
    exit 0`

  return `#!/usr/bin/env bash
# javi-dots token lifecycle guard — auto-generated, do not edit manually
# Mode: ${mode}
# Detects repeated file reads via Claude Code PreToolUse hooks
set -euo pipefail

TOOL_NAME="\${TOOL_NAME:-}"
FILE_PATH="\${TOOL_INPUT_FILE_PATH:-\${TOOL_INPUT_PATH:-}}"
LEDGER="${LEDGER_PATH}"
SESSION_ID="\${CLAUDE_SESSION_ID:-unknown}"

# Only intercept Read tool calls
if [ "$TOOL_NAME" != "Read" ]; then
  exit 0
fi

# Skip if no file path
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Ensure ledger directory exists
mkdir -p "$(dirname "$LEDGER")"

# Estimate tokens (rough: wc -w)
TOKENS=0
if [ -f "$FILE_PATH" ]; then
  TOKENS=$(wc -w < "$FILE_PATH" 2>/dev/null || echo 0)
fi

# Check if file was already read in this session
ALREADY_READ=false
if [ -f "$LEDGER" ]; then
  if grep -q "\\"file\\":\\"$FILE_PATH\\".*\\"session\\":\\"$SESSION_ID\\"" "$LEDGER" 2>/dev/null; then
    ALREADY_READ=true
  fi
fi

# Log this read event
echo "{\\"type\\":\\"file-read\\",\\"file\\":\\"$FILE_PATH\\",\\"tokens\\":$TOKENS,\\"session\\":\\"$SESSION_ID\\",\\"repeated\\":$ALREADY_READ,\\"timestamp\\":$(date +%s)}" >> "$LEDGER"

# If repeated read, take action based on mode
if [ "$ALREADY_READ" = "true" ]; then
${blockOrWarn}
fi

# First read — allow
exit 0
`
}

// ── Hook Installation ────────────────────────────────────────────────────

export function installHook(
  mode: TokenHookMode,
  onStep: StepCallback,
): { action: 'created' | 'updated' | 'already-installed'; guardPath: string; settingsPath: string } {
  report(onStep, 'guard-script', 'Generating token guard script', 'running')

  // Write guard script
  const script = generateGuardScript(mode)
  fs.mkdirSync(path.dirname(TOKEN_GUARD_PATH), { recursive: true })
  fs.writeFileSync(TOKEN_GUARD_PATH, script, { mode: 0o755 })

  report(onStep, 'guard-script', 'Generating token guard script', 'done', `mode=${mode}`)

  // Install hook into settings.json
  report(onStep, 'settings-hook', 'Adding PreToolUse hook to settings.json', 'running')

  const hookEntry: SettingsHookEntry = {
    type: 'command',
    command: `bash ${TOKEN_GUARD_PATH}`,
  }

  const content = readFileIfExists(SETTINGS_PATH)
  let settings: SettingsJson = {}

  if (content) {
    try {
      settings = JSON.parse(content) as SettingsJson
    } catch {
      settings = {}
    }
  }

  // Check if already installed
  if (settings.hooks?.PreToolUse) {
    const alreadyInstalled = settings.hooks.PreToolUse.some(
      h => h.command?.includes(TOKEN_GUARD_SCRIPT_NAME)
    )
    if (alreadyInstalled) {
      report(onStep, 'settings-hook', 'Adding PreToolUse hook to settings.json', 'done', 'already installed')
      return { action: 'already-installed', guardPath: TOKEN_GUARD_PATH, settingsPath: SETTINGS_PATH }
    }
  }

  const action = content ? 'updated' as const : 'created' as const

  if (!settings.hooks) {
    settings.hooks = {}
  }
  if (!settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = []
  }

  settings.hooks.PreToolUse.push(hookEntry)

  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))

  report(onStep, 'settings-hook', 'Adding PreToolUse hook to settings.json', 'done', action)

  return { action, guardPath: TOKEN_GUARD_PATH, settingsPath: SETTINGS_PATH }
}

// ── Hook Removal ─────────────────────────────────────────────────────────

export function removeHook(onStep: StepCallback): { removed: boolean } {
  report(onStep, 'remove-guard', 'Removing token guard script', 'running')

  // Remove guard script
  if (fs.existsSync(TOKEN_GUARD_PATH)) {
    fs.unlinkSync(TOKEN_GUARD_PATH)
    report(onStep, 'remove-guard', 'Removing token guard script', 'done')
  } else {
    report(onStep, 'remove-guard', 'Removing token guard script', 'skipped', 'not found')
  }

  // Remove from settings.json
  report(onStep, 'remove-hook', 'Removing hook from settings.json', 'running')

  const content = readFileIfExists(SETTINGS_PATH)
  if (!content) {
    report(onStep, 'remove-hook', 'Removing hook from settings.json', 'skipped', 'no settings.json')
    return { removed: false }
  }

  let settings: SettingsJson
  try {
    settings = JSON.parse(content) as SettingsJson
  } catch {
    report(onStep, 'remove-hook', 'Removing hook from settings.json', 'skipped', 'invalid JSON')
    return { removed: false }
  }

  if (!settings.hooks?.PreToolUse) {
    report(onStep, 'remove-hook', 'Removing hook from settings.json', 'skipped', 'no hooks found')
    return { removed: false }
  }

  const before = settings.hooks.PreToolUse.length
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
    h => !h.command?.includes(TOKEN_GUARD_SCRIPT_NAME)
  )
  const after = settings.hooks.PreToolUse.length

  if (before === after) {
    report(onStep, 'remove-hook', 'Removing hook from settings.json', 'skipped', 'hook not found')
    return { removed: false }
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
  report(onStep, 'remove-hook', 'Removing hook from settings.json', 'done')

  return { removed: true }
}

// ── Hook Status ──────────────────────────────────────────────────────────

export function getHookStatus(): TokenHookStatus {
  const guardExists = fs.existsSync(TOKEN_GUARD_PATH)

  if (!guardExists) {
    return { installed: false, mode: null }
  }

  // Read guard script to detect mode
  const script = readFileIfExists(TOKEN_GUARD_PATH)
  if (!script) {
    return { installed: false, mode: null }
  }

  // Check settings.json for the hook entry
  const content = readFileIfExists(SETTINGS_PATH)
  if (!content) {
    return { installed: false, mode: null }
  }

  let hookInSettings = false
  try {
    const settings = JSON.parse(content) as SettingsJson
    hookInSettings = settings.hooks?.PreToolUse?.some(
      h => h.command?.includes(TOKEN_GUARD_SCRIPT_NAME)
    ) ?? false
  } catch {
    // invalid JSON
  }

  if (!hookInSettings) {
    return { installed: false, mode: null }
  }

  // Detect mode from script content
  const mode: TokenHookMode = script.includes('# Mode: block') ? 'block' : 'warn'

  return { installed: true, mode }
}

// ── Anatomy Map ──────────────────────────────────────────────────────────

export function buildAnatomyMap(ledgerPath?: string): TokenAnatomyEntry[] {
  const lPath = ledgerPath ?? LEDGER_PATH
  if (!fs.existsSync(lPath)) return []

  const content = fs.readFileSync(lPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const fileMap = new Map<string, {
    readCount: number
    totalTokens: number
    firstRead: number
    lastRead: number
  }>()

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as {
        type?: string
        file?: string
        tokens?: number
        timestamp?: number
      }

      if (event.type !== 'file-read' || !event.file) continue

      const existing = fileMap.get(event.file)
      const ts = event.timestamp ?? 0
      const tokens = event.tokens ?? 0

      if (existing) {
        existing.readCount += 1
        existing.totalTokens += tokens
        existing.firstRead = Math.min(existing.firstRead, ts)
        existing.lastRead = Math.max(existing.lastRead, ts)
      } else {
        fileMap.set(event.file, {
          readCount: 1,
          totalTokens: tokens,
          firstRead: ts,
          lastRead: ts,
        })
      }
    } catch { /* skip malformed lines */ }
  }

  return Array.from(fileMap.entries())
    .map(([file, data]) => ({ file, ...data }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
}

// ── Waste Computation ────────────────────────────────────────────────────

export function computeWaste(anatomy: TokenAnatomyEntry[]): TokenWasteReport {
  let totalRepeatedReads = 0
  let estimatedWastedTokens = 0
  let totalTokens = 0

  for (const entry of anatomy) {
    totalTokens += entry.totalTokens
    if (entry.readCount > 1) {
      const repeats = entry.readCount - 1
      totalRepeatedReads += repeats
      // Estimate: each repeated read wastes (totalTokens / readCount) tokens
      const tokensPerRead = entry.totalTokens / entry.readCount
      estimatedWastedTokens += Math.round(tokensPerRead * repeats)
    }
  }

  const savingsPercent = totalTokens > 0
    ? Math.round((estimatedWastedTokens / totalTokens) * 100)
    : 0

  return { totalRepeatedReads, estimatedWastedTokens, savingsPercent }
}

// ── Orchestrator Entry Point ─────────────────────────────────────────────

export async function runTokenHooks(
  action: 'install' | 'remove' | 'status' | 'report',
  mode: TokenHookMode = 'warn',
  onStep: StepCallback,
): Promise<void> {
  switch (action) {
    case 'install': {
      const result = installHook(mode, onStep)
      report(onStep, 'result', 'Token hook installation', 'done',
        `${result.action} — guard: ${result.guardPath}`)
      break
    }

    case 'remove': {
      const result = removeHook(onStep)
      report(onStep, 'result', 'Token hook removal', result.removed ? 'done' : 'skipped',
        result.removed ? 'removed successfully' : 'hook was not installed')
      break
    }

    case 'status': {
      const status = getHookStatus()
      report(onStep, 'status', 'Token hook status', 'done',
        status.installed ? `installed (mode: ${status.mode})` : 'not installed')
      break
    }

    case 'report': {
      report(onStep, 'anatomy', 'Building token anatomy map', 'running')
      const anatomy = buildAnatomyMap()

      if (anatomy.length === 0) {
        report(onStep, 'anatomy', 'Building token anatomy map', 'skipped',
          'no ledger data found — install hook first')
        return
      }

      report(onStep, 'anatomy', 'Building token anatomy map', 'done',
        `${anatomy.length} files tracked`)

      // Top files
      const topFiles = anatomy.slice(0, 10)
      for (const entry of topFiles) {
        const shortFile = entry.file.length > 50
          ? '...' + entry.file.slice(-47)
          : entry.file
        report(onStep, `file-${entry.file}`, shortFile, 'done',
          `${entry.readCount}x reads, ~${Math.round(entry.totalTokens / 1000)}K tokens`)
      }

      // Waste report
      const waste = computeWaste(anatomy)
      report(onStep, 'waste', 'Token waste analysis', waste.totalRepeatedReads > 0 ? 'error' : 'done',
        `${waste.totalRepeatedReads} repeated reads, ~${Math.round(waste.estimatedWastedTokens / 1000)}K wasted tokens (${waste.savingsPercent}% savings potential)`)

      break
    }
  }
}
