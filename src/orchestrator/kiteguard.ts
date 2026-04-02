import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import type { SetupStep } from '../types/index.js'
import { SETTINGS_PATH, KITEGUARD_HOOKS, KITEGUARD_REPO_URL } from '../constants.js'
import { readFileIfExists } from './utils.js'

const execFileAsync = promisify(execFile)

// ── Types ────────────────────────────────────────────────────────────

interface SettingsHookEntry {
  type: string
  command: string
}

interface SettingsJson {
  hooks?: {
    [key: string]: SettingsHookEntry[] | unknown
  }
  [key: string]: unknown
}

export interface KiteguardInstallResult {
  binaryAction: 'existed' | 'installed' | 'skipped'
  hookAction: 'created' | 'updated' | 'already-installed'
  hooksConfigured: number
  settingsPath: string
}

type StepCallback = (step: SetupStep) => void

// ── Helpers ──────────────────────────────────────────────────────────

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('which', [cmd])
    return true
  } catch {
    return false
  }
}

function generateHookEntry(hookType: string): SettingsHookEntry {
  return {
    type: 'command',
    command: `kiteguard hook ${hookType}`,
  }
}

// ── Hook Configuration ───────────────────────────────────────────────

export function configureKiteguardHooks(dryRun = false): { action: 'created' | 'updated' | 'already-installed'; hooksConfigured: number; settingsPath: string } {
  const content = readFileIfExists(SETTINGS_PATH)
  let settings: SettingsJson = {}

  if (content) {
    try {
      settings = JSON.parse(content) as SettingsJson
    } catch {
      settings = {}
    }
  }

  // Check if kiteguard hooks are already installed (check any hook type)
  if (settings.hooks) {
    const existingHooks = settings.hooks as Record<string, SettingsHookEntry[]>
    const alreadyInstalled = KITEGUARD_HOOKS.every(hookType => {
      const hooks = existingHooks[hookType]
      return Array.isArray(hooks) && hooks.some(h => h.command?.includes('kiteguard'))
    })
    if (alreadyInstalled) {
      return { action: 'already-installed', hooksConfigured: KITEGUARD_HOOKS.length, settingsPath: SETTINGS_PATH }
    }
  }

  const action = content ? 'updated' : 'created'
  let hooksConfigured = 0

  if (!dryRun) {
    if (!settings.hooks) {
      settings.hooks = {}
    }

    for (const hookType of KITEGUARD_HOOKS) {
      const hooksKey = hookType as string
      if (!Array.isArray(settings.hooks[hooksKey])) {
        settings.hooks[hooksKey] = []
      }

      const hookArray = settings.hooks[hooksKey] as SettingsHookEntry[]
      const alreadyHasKiteguard = hookArray.some(h => h.command?.includes('kiteguard'))

      if (!alreadyHasKiteguard) {
        hookArray.push(generateHookEntry(hookType))
        hooksConfigured++
      }
    }

    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
  } else {
    hooksConfigured = KITEGUARD_HOOKS.length
  }

  return { action, hooksConfigured, settingsPath: SETTINGS_PATH }
}

// ── Full Install Orchestration ───────────────────────────────────────

export async function runKiteguardSetup(dryRun = false, onStep?: StepCallback): Promise<KiteguardInstallResult> {
  const report = (id: string, label: string, status: SetupStep['status'], detail?: string) => {
    onStep?.({ id, label, status, detail })
  }

  report('kiteguard', 'Configure runtime security (kiteguard)', 'running')

  // Step 1: Check if kiteguard binary exists
  let binaryAction: KiteguardInstallResult['binaryAction'] = 'skipped'
  const kiteguardExists = await commandExists('kiteguard')

  if (kiteguardExists) {
    binaryAction = 'existed'
  } else if (!dryRun) {
    // Try cargo install
    const cargoExists = await commandExists('cargo')
    if (cargoExists) {
      try {
        await execFileAsync('cargo', ['install', 'kiteguard'], { timeout: 120000 })
        binaryAction = 'installed'
      } catch {
        binaryAction = 'skipped'
        report('kiteguard', 'Configure runtime security (kiteguard)', 'skipped',
          `Install failed. Install manually: ${KITEGUARD_REPO_URL}`)
        return {
          binaryAction,
          hookAction: 'created',
          hooksConfigured: 0,
          settingsPath: SETTINGS_PATH,
        }
      }
    } else {
      binaryAction = 'skipped'
      report('kiteguard', 'Configure runtime security (kiteguard)', 'skipped',
        `cargo not found. Install kiteguard manually: ${KITEGUARD_REPO_URL}`)
      return {
        binaryAction,
        hookAction: 'created',
        hooksConfigured: 0,
        settingsPath: SETTINGS_PATH,
      }
    }
  }

  // Step 2: Configure hooks in settings.json
  const { action: hookAction, hooksConfigured, settingsPath } = configureKiteguardHooks(dryRun)

  const detail = binaryAction === 'existed'
    ? `Binary found, ${hooksConfigured} hooks ${hookAction}`
    : binaryAction === 'installed'
    ? `Binary installed via cargo, ${hooksConfigured} hooks ${hookAction}`
    : `Dry run — ${KITEGUARD_HOOKS.length} hooks would be configured`

  report('kiteguard', 'Configure runtime security (kiteguard)', 'done', detail)

  return { binaryAction, hookAction, hooksConfigured, settingsPath }
}
