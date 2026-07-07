import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import type { SetupStep } from '../types/index.js'
import { writeSnapshot } from './backup.js'

const execFileAsync = promisify(execFile)

export interface MigrateResult {
  success: boolean
  detail: string
  moved?: string[]
  backupId?: string
}

const ATL_DIR_NAMES = ['agent-teams-lite']
const ATL_REPO_URL = 'https://github.com/Gentleman-Programming/agent-teams-lite.git'

// Map javi-dots CLI ids to gentle-ai agent names (matches the prior
// ATL_AGENT_MAP used by the orchestrator's ATL setup path).
const GENTLE_AI_AGENT_MAP: Record<string, string> = {
  claude: 'claude-code',
  opencode: 'opencode',
  gemini: 'gemini-cli',
  qwen: 'qwen',
  codex: 'codex',
  copilot: 'copilot',
}

function toGentleAiAgentName(cli: string): string {
  return GENTLE_AI_AGENT_MAP[cli] ?? cli
}

/**
 * Migrate a workstation set up by an older `javi-dots` (which cloned
 * `agent-teams-lite` into `~/.javidots/agent-teams-lite/`) to the gentle-ai
 * backed stack. The function:
 *   1. detects the ATL dir under MANIFEST_DIR
 *   2. tar.gz-backs it up to ~/.javidots/backups/atl-migration-<ts>/
 *   3. removes the ATL dir after the backup succeeds
 *   4. invokes `GENTLE_AI_YES=1 gentle-ai install --agent <detected-clis>
 *      --preset full-gentleman --persona custom` to re-establish SDD files
 *
 * Idempotent: if no ATL dir exists, the function is a no-op reporting skipped.
 *
 * `manifestDir` defaults to `~/.javidots/` but is an explicit arg for
 * testability — same convention as backup.ts backupsDir.
 */
export async function migrateFromAtl(
  dryRun: boolean,
  onStep: (s: SetupStep) => void,
  manifestDir: string = path.join(os.homedir(), '.javidots'),
  invokeGentleAi: boolean = true,
): Promise<MigrateResult> {
  const backupsDir = path.join(manifestDir, 'backups')
  const detectedClis = detectInstalledClis(manifestDir)

  let atlDir: string | null = null
  for (const name of ATL_DIR_NAMES) {
    const candidate = path.join(manifestDir, name)
    if (fs.existsSync(candidate)) {
      atlDir = candidate
      break
    }
  }

  if (!atlDir) {
    onStep({ id: 'migrate-from-atl', label: 'Migrate from ATL', status: 'skipped', detail: 'No ~/.javidots/agent-teams-lite/ directory found' })
    return { success: true, detail: 'No ATL dir to migrate' }
  }

  onStep({ id: 'migrate-from-atl', label: 'Migrate from ATL', status: 'running', detail: `Found ${atlDir}` })

  if (dryRun) {
    return {
      success: true,
      detail: `dry-run: would backup ${atlDir} to ${backupsDir}/atl-migration-<ts>/atl.tar.gz and remove the dir`,
    }
  }

  // Step 1: backup
  const backupId = `atl-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`
  fs.mkdirSync(path.join(backupsDir, backupId), { recursive: true })
  const tarballPath = path.join(backupsDir, backupId, 'atl.tar.gz')
  const tarballTmp = `${tarballPath}.tmp`
  try {
    // tar the ATL dir as `agent-teams-lite/` so the archive is self-describing.
    await execFileAsync('tar', ['-czf', tarballTmp, '-C', manifestDir, path.basename(atlDir)], { timeout: 30_000 })
    fs.renameSync(tarballTmp, tarballPath)
  } catch (e) {
    try { fs.unlinkSync(tarballTmp) } catch {}
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'migrate-from-atl', label: 'Migrate from ATL', status: 'error', detail: `backup failed: ${msg}` })
    return { success: false, detail: `backup failed: ${msg}` }
  }

  // Inject a manifest noting this is an ATL backup.
  const atlManifest = {
    id: backupId,
    created_at: new Date().toISOString(),
    root_dir: path.join(backupsDir, backupId),
    source: 'migrate-from-atl',
    atlDir,
    backupTarball: tarballPath,
  }
  fs.writeFileSync(path.join(backupsDir, backupId, 'manifest.json'), JSON.stringify(atlManifest, null, 2))

  // Step 2: remove the ATL dir after successful backup
  try {
    fs.rmSync(atlDir, { recursive: true, force: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'migrate-from-atl', label: 'Migrate from ATL', status: 'error', detail: `rm failed: ${msg}` })
    return { success: false, detail: `rm failed: ${msg}`, backupId }
  }

  // Step 3: gentle-ai install (best-effort; caller can disable for tests)
  if (invokeGentleAi) {
    try {
      const agentList = detectedClis.length > 0
        ? detectedClis.map(toGentleAiAgentName).join(',')
        : 'claude-code'
      await execFileAsync(
        'gentle-ai',
        ['install', '--agent', agentList, '--preset', 'full-gentleman', '--persona', 'custom'],
        { timeout: 120_000, env: { ...process.env, GENTLE_AI_YES: '1' } },
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      onStep({ id: 'migrate-from-atl', label: 'Migrate from ATL', status: 'error', detail: `gentle-ai install failed after ATL removal: ${msg}` })
      return { success: false, detail: `gentle-ai install failed: ${msg}`, backupId }
    }
  }

  onStep({ id: 'migrate-from-atl', label: 'Migrate from ATL', status: 'done', detail: `Backed up to ${tarballPath}, removed ${atlDir}, gentle-ai install OK` })
  return { success: true, detail: `migrated; backup at ${tarballPath}`, backupId }
}

/**
 * Move `~/.config/opencode/skill/` (singular, legacy) entries into
 * `~/.config/opencode/skills/` (plural, canonical). Canonical wins on
 * conflict — entries already present in the destination are NOT overwritten;
 * the legacy copy is removed.
 *
 * Idempotent: second run is a no-op (source dir is gone).
 *
 * `homeDir` defaults to `os.homedir()` but is an explicit arg for testability.
 */
export async function migrateSkillDir(
  dryRun: boolean,
  onStep: (s: SetupStep) => void,
  homeDir: string = os.homedir(),
): Promise<MigrateResult> {
  const opencodeConfigDir = path.join(homeDir, '.config', 'opencode')
  const legacyDir = path.join(opencodeConfigDir, 'skill')
  const canonicalDir = path.join(opencodeConfigDir, 'skills')

  if (!fs.existsSync(legacyDir)) {
    onStep({ id: 'migrate-skill-dir', label: 'Migrate skill/ to skills/', status: 'skipped', detail: `No ${legacyDir} directory found` })
    return { success: true, detail: 'No legacy skill/ dir to migrate' }
  }

  onStep({ id: 'migrate-skill-dir', label: 'Migrate skill/ to skills/', status: 'running', detail: `Found ${legacyDir}` })

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(legacyDir, { withFileTypes: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'migrate-skill-dir', label: 'Migrate skill/ to skills/', status: 'error', detail: `readdir failed: ${msg}` })
    return { success: false, detail: `readdir failed: ${msg}` }
  }

  // Filter to directories only (skills live as <name>/SKILL.md)
  const skillEntries = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  if (skillEntries.length === 0) {
    // Nothing to move but the legacy dir exists. Remove it so it can't shadow.
    if (!dryRun) {
      try { fs.rmSync(legacyDir, { recursive: true, force: true }) } catch {}
    }
    onStep({ id: 'migrate-skill-dir', label: 'Migrate skill/ to skills/', status: 'done', detail: 'empty legacy dir removed' })
    return { success: true, detail: 'empty legacy skill dir removed' }
  }

  // Backup snapshot of the legacy dir before we move anything — rule:
  // "no destructive commands without confirmation". The backup is created
  // unconditionally even if dry-run is true, because dry-run should not
  // mutate filesystem; so we gate the backup write behind !dryRun as well.
  let backupId: string | undefined
  const moved: string[] = []

  // Collect paths to snapshot: every SKILL.md (and anything) under the legacy dir.
  const snapshotPaths = collectSkillFiles(legacyDir)
  if (!dryRun && snapshotPaths.length > 0) {
    const backupsDir = path.join(homeDir, '.javidots', 'backups')
    const id = `skill-dir-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`
    const snap = await writeSnapshot(snapshotPaths, backupsDir, id)
    if (!snap.skipped && snap.manifest) {
      backupId = snap.manifest.id
    }
  }

  if (dryRun) {
    return {
      success: true,
      detail: `dry-run: would move ${skillEntries.length} skill entries from ${legacyDir} to ${canonicalDir}; existing dest wins on conflict; then remove empty legacy dir`,
      moved: skillEntries.map((e) => e.name),
    }
  }

  // Move each entry, canonical-on-conflict.
  for (const entry of skillEntries) {
    const src = path.join(legacyDir, entry.name)
    const dst = path.join(canonicalDir, entry.name)
    try {
      if (!fs.existsSync(canonicalDir)) {
        fs.mkdirSync(canonicalDir, { recursive: true })
      }
      if (fs.existsSync(dst)) {
        // Canonical entry already exists — keep the canonical copy, remove the legacy one.
        fs.rmSync(src, { recursive: true, force: true })
      } else {
        fs.renameSync(src, dst)
      }
      moved.push(entry.name)
    } catch (e) {
      // We do NOT abort the whole migration on a single entry failure; we log
      // and continue so the user can recover individual entries manually.
      onStep({ id: 'migrate-skill-dir', label: 'Migrate skill/ to skills/', status: 'error', detail: `failed to move ${entry.name}: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  // Final: remove the now-empty legacy dir.
  try {
    // Re-check: only remove if empty (no leftover entries).
    const leftover = fs.readdirSync(legacyDir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'))
    if (leftover.length === 0) {
      fs.rmSync(legacyDir, { recursive: true, force: true })
    }
  } catch {
    // If the dir is already gone or partially populated, we accept the state.
  }

  onStep({ id: 'migrate-skill-dir', label: 'Migrate skill/ to skills/', status: 'done', detail: `Moved ${moved.length} skill(s); legacy dir cleaned; backup ${backupId ?? 'n/a'}` })
  return { success: true, detail: `migrated ${moved.length} skill(s)`, moved, backupId }
}

/**
 * Detect installed CLIs by reading the manifest in `manifestDir`.
 * Returns empty array if no manifest or no `clis` field.
 */
function detectInstalledClis(manifestDir: string): string[] {
  try {
    const manifestPath = path.join(manifestDir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) return []
    const raw = fs.readFileSync(manifestPath, 'utf-8')
    const parsed = JSON.parse(raw) as { clis?: string[] }
    return parsed.clis ?? []
  } catch {
    return []
  }
}

/**
 * Collect all SKILL.md (and any file) absolute paths under `dir`, recursively.
 * Used to seed a backup snapshot before the migration remove.
 */
function collectSkillFiles(dir: string): string[] {
  const out: string[] = []
  function walk(d: string): void {
    let ents: fs.Dirent[]
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) walk(full)
      else out.push(full)
    }
  }
  walk(dir)
  return out
}