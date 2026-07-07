import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import type { SetupStep, Manifest } from '../types/index.js'
import { MANIFEST_DIR, MANIFEST_PATH } from '../constants.js'
import { writeSnapshot } from './backup.js'

const execFileAsync = promisify(execFile)

export async function runUninstall(
  dryRun: boolean,
  onStep: (step: SetupStep) => void
): Promise<{ success: boolean; detail: string }> {
  let manifest: Manifest
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
    manifest = JSON.parse(raw)
  } catch {
    return { success: false, detail: 'No manifest found — nothing to uninstall' }
  }

  void manifest // acknowledge read

  // Step 0: Backup snapshot before any destructive action (per spec
  // "Backup Snapshot Before Managed Writes" — symmetric with install).
  onStep({ id: 'backup', label: 'Snapshot config files', status: 'running' })
  try {
    if (!dryRun) {
      // Best-effort snapshot of the same files we manage at install time.
      const os = await import('os')
      const home = os.homedir()
      const candidates = [
        path.join(home, '.claude', 'CLAUDE.md'),
        path.join(home, '.config', 'opencode', 'opencode.json'),
        path.join(home, '.claude', 'settings.json'),
        path.join(home, '.claude.json'),
      ].filter((p) => fs.existsSync(p))
      if (candidates.length > 0) {
        const backupsDir = path.join(MANIFEST_DIR, 'backups')
        const snap = await writeSnapshot(candidates, backupsDir)
        onStep({
          id: 'backup',
          label: 'Snapshot config files',
          status: snap.skipped ? 'skipped' : 'done',
          detail: snap.skipped ? 'No managed files to snapshot' : `Backup at ${snap.manifest?.root_dir}`,
        })
      } else {
        onStep({ id: 'backup', label: 'Snapshot config files', status: 'skipped', detail: 'No managed files to snapshot' })
      }
    } else {
      onStep({ id: 'backup', label: 'Snapshot config files', status: 'skipped', detail: 'dry-run' })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'backup', label: 'Snapshot config files', status: 'error', detail: msg })
  }

  // Step 1: Uninstall javi-ai (hardened npx with -y + @latest per spec
  // "npx Hardening For javi-ai Invocation" — applies to uninstall too).
  onStep({ id: 'javi-ai', label: 'Uninstall javi-ai', status: 'running' })
  try {
    if (!dryRun) {
      await execFileAsync('npx', ['-y', 'javi-ai@latest', 'uninstall'], { timeout: 60000 })
    }
    onStep({ id: 'javi-ai', label: 'Uninstall javi-ai', status: 'done' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'javi-ai', label: 'Uninstall javi-ai', status: 'error', detail: msg })
  }

  // Step 2: gentle-ai uninstall (replaces the prior ATL clone removal step).
  // Per spec "REMOVED > agent-teams-lite installation > uninstalling javi-dots
  // no longer touches ATL" — we delegate to gentle-ai's own uninstall for the
  // selected CLIs. The brew-installed `gentle-ai` binary owns its own file
  // layouts (skills, SDD orchestrators, plugins) so it knows how to remove
  // them safely.
  onStep({ id: 'gentle-ai', label: 'gentle-ai uninstall', status: 'running' })
  try {
    if (!dryRun) {
      const os = await import('os')
      const home = os.homedir()
      const gentleAiPath = await import('./utils.js').then((m) => m.which('gentle-ai'))
      if (await gentleAiPath) {
        const GENTLE_AI_AGENT_MAP: Record<string, string> = {
          claude: 'claude-code',
          opencode: 'opencode',
          gemini: 'gemini-cli',
          qwen: 'qwen',
          codex: 'codex',
          copilot: 'copilot',
        }
        const clis: string[] = Array.isArray(manifest.clis) ? manifest.clis : []
        const agentList = clis.map((c) => GENTLE_AI_AGENT_MAP[c] ?? c).join(',')
        if (agentList.length > 0) {
          await execFileAsync(
            'gentle-ai',
            ['uninstall', '--agent', agentList],
            { timeout: 60000, env: { ...process.env, GENTLE_AI_YES: '1' } },
          )
        }
      } else {
        onStep({
          id: 'gentle-ai',
          label: 'gentle-ai uninstall',
          status: 'skipped',
          detail: `gentle-ai binary not found; skipping (legacy ATL dirs at ${path.join(home, '.javidots', 'agent-teams-lite')} are not removed by javi-dots)`,
        })
      }
    }
    onStep({ id: 'gentle-ai', label: 'gentle-ai uninstall', status: 'done' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'gentle-ai', label: 'gentle-ai uninstall', status: 'error', detail: msg })
  }

  // Step 3: Remove manifest
  onStep({ id: 'manifest', label: 'Remove javidots manifest', status: 'running' })
  try {
    if (!dryRun && fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH)
    }
    onStep({ id: 'manifest', label: 'Remove javidots manifest', status: 'done' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'manifest', label: 'Remove javidots manifest', status: 'error', detail: msg })
  }

  return { success: true, detail: 'Uninstalled successfully' }
}