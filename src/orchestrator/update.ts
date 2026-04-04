import fs from 'fs'
import type { Manifest, SetupStep } from '../types/index.js'
import { MANIFEST_PATH } from '../constants.js'
import { runSetup } from './index.js'

export async function runUpdate(
  dryRun: boolean,
  onStep: (step: SetupStep) => void
): Promise<{ success: boolean; detail: string }> {
  let manifest: Manifest
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
    manifest = JSON.parse(raw)
  } catch {
    return { success: false, detail: 'No manifest found. Run: npx javidots' }
  }

  await runSetup({
    clis: manifest.clis,
    ghagga: manifest.ghagga,
    kiteguard: manifest.kiteguard ?? false,
    hookProfile: null,
    agentWorkspace: false,
    dryRun,
  }, onStep)

  return { success: true, detail: `Updated for: ${manifest.clis.join(', ')}` }
}
