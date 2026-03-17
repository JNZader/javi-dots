import fs from 'fs'
import path from 'path'
import type { AI_CLI, SyncStatus, SyncResult, SetupStep, EditorConfig } from '../types/index.js'
import {
  CONFIG_REPO_DIR,
  CONFIG_SKILLS_DIR,
  CONFIG_HOOKS_DIR,
  SYNC_STATE_PATH,
  EDITOR_CONFIGS,
  MANIFEST_PATH,
} from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

// ── Sync State ──────────────────────────────────────────────────────────────

interface SyncState {
  lastSync: Record<string, string>
}

function readSyncState(): SyncState {
  try {
    if (fs.existsSync(SYNC_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(SYNC_STATE_PATH, 'utf-8')) as SyncState
    }
  } catch { /* ignore */ }
  return { lastSync: {} }
}

function writeSyncState(state: SyncState): void {
  const dir = path.dirname(SYNC_STATE_PATH)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 2))
}

// ── Directory Helpers ───────────────────────────────────────────────────────

function countEntries(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter(e => !e.startsWith('.')).length
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function copyDirContents(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0
  ensureDir(dest)
  const entries = fs.readdirSync(src).filter(e => !e.startsWith('.'))
  let count = 0
  for (const entry of entries) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
    count++
  }
  return count
}

function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest)
  const entries = fs.readdirSync(src)
  for (const entry of entries) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ── Get Installed CLIs ──────────────────────────────────────────────────────

function getInstalledClis(): AI_CLI[] {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
      return manifest.clis ?? []
    }
  } catch { /* ignore */ }
  return []
}

function getEditorConfig(cli: AI_CLI): EditorConfig | undefined {
  return EDITOR_CONFIGS.find(e => e.id === cli)
}

// ── Init Config Repo ────────────────────────────────────────────────────────

/**
 * Initialize the central config repository if it doesn't exist.
 */
export function initConfigRepo(): boolean {
  if (fs.existsSync(CONFIG_REPO_DIR)) return false

  ensureDir(CONFIG_SKILLS_DIR)
  ensureDir(CONFIG_HOOKS_DIR)

  // Create a README
  fs.writeFileSync(
    path.join(CONFIG_REPO_DIR, 'README.md'),
    `# javi-dots Central Config

This directory holds shared skills, hooks, and configs that are synced
across all your AI coding editors via \`javi-dots sync\`.

## Structure

- \`skills/\` — Shared skill definitions (SKILL.md files)
- \`hooks/\`  — Shared hook scripts
- \`prompts/\` — Reusable prompt templates

## Usage

1. Add skills/hooks here
2. Run \`javi-dots sync\` to distribute to all configured editors
3. Run \`javi-dots status\` to see sync state
`,
    'utf-8'
  )

  return true
}

// ── Sync ────────────────────────────────────────────────────────────────────

/**
 * Sync central config to all installed editors.
 */
export async function runSync(
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  // Init config repo if needed
  const wasCreated = !dryRun ? initConfigRepo() : false
  if (wasCreated) {
    report(onStep, 'init-repo', 'Initialize central config repo', 'done', '~/.javidots/config/')
  }

  const clis = getInstalledClis()
  if (clis.length === 0) {
    report(onStep, 'no-clis', 'No CLIs configured', 'skipped',
      'run javi-dots setup first')
    return
  }

  const syncState = readSyncState()
  const now = new Date().toISOString()

  for (const cli of clis) {
    const editor = getEditorConfig(cli)
    if (!editor) continue

    const stepId = `sync-${cli}`
    report(onStep, stepId, `Sync to ${editor.label}`, 'running')

    const result: SyncResult = {
      editor: cli,
      skillsCopied: 0,
      hooksCopied: 0,
      configsCopied: 0,
      errors: [],
    }

    try {
      // Sync skills
      if (fs.existsSync(CONFIG_SKILLS_DIR)) {
        if (!dryRun) {
          result.skillsCopied = copyDirContents(CONFIG_SKILLS_DIR, editor.skillsDir)
        } else {
          result.skillsCopied = countEntries(CONFIG_SKILLS_DIR)
        }
      }

      // Sync hooks (only for editors that support them)
      if (editor.hooksDir && fs.existsSync(CONFIG_HOOKS_DIR)) {
        if (!dryRun) {
          result.hooksCopied = copyDirContents(CONFIG_HOOKS_DIR, editor.hooksDir)
        } else {
          result.hooksCopied = countEntries(CONFIG_HOOKS_DIR)
        }
      }

      // Update sync state
      if (!dryRun) {
        syncState.lastSync[cli] = now
      }

      const detail = `${result.skillsCopied} skills, ${result.hooksCopied} hooks`
      report(onStep, stepId, `Sync to ${editor.label}`, 'done',
        dryRun ? `dry-run: would sync ${detail}` : detail)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      report(onStep, stepId, `Sync to ${editor.label}`, 'error', msg)
    }
  }

  if (!dryRun) {
    writeSyncState(syncState)
  }
}

// ── Status ──────────────────────────────────────────────────────────────────

/**
 * Check sync status for all configured editors.
 */
export async function runStatus(
  onStep: StepCallback
): Promise<void> {
  const clis = getInstalledClis()
  if (clis.length === 0) {
    report(onStep, 'no-clis', 'No CLIs configured', 'skipped',
      'run javi-dots setup first')
    return
  }

  const syncState = readSyncState()
  const centralSkills = countEntries(CONFIG_SKILLS_DIR)
  const centralHooks = countEntries(CONFIG_HOOKS_DIR)

  report(onStep, 'central', 'Central config repo', 'done',
    `${centralSkills} skills, ${centralHooks} hooks`)

  for (const cli of clis) {
    const editor = getEditorConfig(cli)
    if (!editor) continue

    const stepId = `status-${cli}`
    const dirExists = fs.existsSync(editor.globalDir)
    const skillCount = countEntries(editor.skillsDir)
    const hookCount = editor.hooksDir ? countEntries(editor.hooksDir) : 0
    const lastSync = syncState.lastSync[cli]

    if (!dirExists) {
      report(onStep, stepId, editor.label, 'skipped', 'config directory not found')
    } else {
      const syncInfo = lastSync ? `last sync: ${lastSync.split('T')[0]}` : 'never synced'
      report(onStep, stepId, editor.label, 'done',
        `${skillCount} skills, ${hookCount} hooks — ${syncInfo}`)
    }
  }
}
