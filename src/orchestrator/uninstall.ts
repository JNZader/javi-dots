import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import type { SetupStep, Manifest } from '../types/index.js'
import { MANIFEST_DIR, MANIFEST_PATH } from '../constants.js'

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

  // Step 1: Uninstall javi-ai
  onStep({ id: 'javi-ai', label: 'Uninstall javi-ai', status: 'running' })
  try {
    if (!dryRun) {
      await execFileAsync('npx', ['javi-ai', 'uninstall'], { timeout: 60000 })
    }
    onStep({ id: 'javi-ai', label: 'Uninstall javi-ai', status: 'done' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'javi-ai', label: 'Uninstall javi-ai', status: 'error', detail: msg })
  }

  // Step 2: Remove agent-teams-lite clone
  const atlDir = path.join(MANIFEST_DIR, 'agent-teams-lite')
  onStep({ id: 'atl', label: 'Remove agent-teams-lite', status: 'running' })
  try {
    if (!dryRun && fs.existsSync(atlDir)) {
      fs.rmSync(atlDir, { recursive: true, force: true })
    }
    onStep({ id: 'atl', label: 'Remove agent-teams-lite', status: 'done' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onStep({ id: 'atl', label: 'Remove agent-teams-lite', status: 'error', detail: msg })
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
