import fs from 'fs'
import path from 'path'
import type { SecurityRule, SecurityAuditResult, SecurityCategory } from '../types/index.js'
import {
  SECURITY_RULES_PATH,
  SECURITY_GUARD_PATH,
  SETTINGS_PATH,
  MANIFEST_DIR,
  DEFAULT_SECURITY_RULES,
  ALL_SECURITY_CATEGORIES,
} from '../constants.js'
import { readFileIfExists } from './utils.js'

// ── Load / Save Rules ─────────────────────────────────────────────────

export function loadSecurityRules(): { rules: SecurityRule[]; source: 'custom' | 'default' } {
  const content = readFileIfExists(SECURITY_RULES_PATH)

  if (content) {
    try {
      const parsed = JSON.parse(content) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { rules: parsed as SecurityRule[], source: 'custom' }
      }
    } catch {
      // Invalid JSON — fall through to defaults
    }
  }

  return { rules: DEFAULT_SECURITY_RULES as SecurityRule[], source: 'default' }
}

export function saveSecurityRules(rules: SecurityRule[]): void {
  fs.mkdirSync(path.dirname(SECURITY_RULES_PATH), { recursive: true })
  fs.writeFileSync(SECURITY_RULES_PATH, JSON.stringify(rules, null, 2))
}

// ── Guard Script Generation ───────────────────────────────────────────

export function generateGuardScript(rules: SecurityRule[]): string {
  const enabledRules = rules.filter(r => r.enabled)

  const checks = enabledRules.map(r =>
    `  # ${r.description}\n  if echo "$INPUT" | grep -qE '${r.pattern}'; then\n    echo "BLOCKED by javi-dots security [${r.id}]: ${r.description}" >&2\n    exit 2\n  fi`
  ).join('\n\n')

  return `#!/usr/bin/env bash
# javi-dots security guard — auto-generated, do not edit manually
# Blocks dangerous commands via Claude Code PreToolUse hooks
set -euo pipefail

INPUT="$*"

${checks}

# Command allowed
exit 0
`
}

export function writeGuardScript(rules: SecurityRule[]): void {
  const script = generateGuardScript(rules)
  fs.mkdirSync(path.dirname(SECURITY_GUARD_PATH), { recursive: true })
  fs.writeFileSync(SECURITY_GUARD_PATH, script, { mode: 0o755 })
}

// ── Settings.json Hook Installation ───────────────────────────────────

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

export function generateHookEntry(): SettingsHookEntry {
  return {
    type: 'command',
    command: `bash ${SECURITY_GUARD_PATH}`,
  }
}

export function installSecurityHook(dryRun = false): { action: 'created' | 'updated' | 'already-installed'; settingsPath: string } {
  const hookEntry = generateHookEntry()
  const content = readFileIfExists(SETTINGS_PATH)
  let settings: SettingsJson = {}

  if (content) {
    try {
      settings = JSON.parse(content) as SettingsJson
    } catch {
      // Invalid settings.json — start fresh
      settings = {}
    }
  }

  // Check if already installed
  if (settings.hooks?.PreToolUse) {
    const existing = settings.hooks.PreToolUse
    const alreadyInstalled = existing.some(
      h => h.command?.includes('security-guard.sh')
    )
    if (alreadyInstalled) {
      return { action: 'already-installed', settingsPath: SETTINGS_PATH }
    }
  }

  const action = content ? 'updated' : 'created'

  if (!dryRun) {
    if (!settings.hooks) {
      settings.hooks = {}
    }
    if (!settings.hooks.PreToolUse) {
      settings.hooks.PreToolUse = []
    }

    settings.hooks.PreToolUse.push(hookEntry)

    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
  }

  return { action, settingsPath: SETTINGS_PATH }
}

// ── Security Audit ────────────────────────────────────────────────────

export function runSecurityAudit(): SecurityAuditResult {
  const { rules } = loadSecurityRules()
  const enabledRules = rules.filter(r => r.enabled)

  // Count by category
  const categoryMap = new Map<string, number>()
  for (const rule of enabledRules) {
    categoryMap.set(rule.category, (categoryMap.get(rule.category) ?? 0) + 1)
  }

  const categories = Array.from(categoryMap.entries()).map(([category, count]) => ({
    category,
    count,
  }))

  // Check which default categories are missing
  const presentCategories = new Set(categoryMap.keys())
  const missingCategories = ALL_SECURITY_CATEGORIES
    .filter(c => !presentCategories.has(c))

  // Check hook installation
  const settingsContent = readFileIfExists(SETTINGS_PATH)
  let hookInstalled = false
  if (settingsContent) {
    try {
      const settings = JSON.parse(settingsContent) as SettingsJson
      hookInstalled = settings.hooks?.PreToolUse?.some(
        h => h.command?.includes('security-guard.sh')
      ) ?? false
    } catch {
      // Invalid JSON
    }
  }

  const guardScriptExists = fs.existsSync(SECURITY_GUARD_PATH)

  return {
    totalRules: rules.length,
    enabledRules: enabledRules.length,
    categories,
    hookInstalled,
    guardScriptExists,
    missingCategories: [...missingCategories],
  }
}

// ── Full Install Orchestration ────────────────────────────────────────

export interface SecurityInstallResult {
  rulesSource: 'custom' | 'default'
  rulesCount: number
  hookAction: 'created' | 'updated' | 'already-installed'
  settingsPath: string
  guardScriptPath: string
}

export function runSecurityInstall(dryRun = false): SecurityInstallResult {
  const { rules, source } = loadSecurityRules()

  if (!dryRun) {
    // Save rules if using defaults (first time)
    if (source === 'default') {
      saveSecurityRules(rules)
    }

    // Generate guard script
    writeGuardScript(rules)
  }

  // Install hook into settings.json
  const { action, settingsPath } = installSecurityHook(dryRun)

  return {
    rulesSource: source,
    rulesCount: rules.filter(r => r.enabled).length,
    hookAction: action,
    settingsPath,
    guardScriptPath: SECURITY_GUARD_PATH,
  }
}
