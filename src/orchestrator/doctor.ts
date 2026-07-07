import fs from 'fs'
import path from 'path'
import type { DoctorCheck, Manifest } from '../types/index.js'
import { MANIFEST_DIR, MANIFEST_PATH } from '../constants.js'
import { which } from './utils.js'

export async function runDoctor(): Promise<{
  manifest: Manifest | null
  checks: DoctorCheck[]
}> {
  const checks: DoctorCheck[] = []

  // Check manifest
  let manifest: Manifest | null = null
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
    manifest = JSON.parse(raw)
    checks.push({ name: 'javidots manifest', status: 'ok', detail: `Installed: ${manifest!.installedAt}` })
  } catch {
    checks.push({ name: 'javidots manifest', status: 'fail', detail: 'Not installed. Run: npx javidots' })
  }

  // Check javi-ai
  const javiAiPath = await which('javi-ai')
  checks.push(javiAiPath
    ? { name: 'javi-ai', status: 'ok', detail: javiAiPath }
    : { name: 'javi-ai', status: 'fail', detail: 'Not found. Run: npm install -g javi-ai' })

  // Check engram
  const engramPath = await which('engram')
  checks.push(engramPath
    ? { name: 'engram', status: 'ok', detail: engramPath }
    : { name: 'engram', status: 'fail', detail: 'Not found. Run: brew install gentleman-programming/tap/engram' })

  // Check git (general purpose — gentle-ai does not require it anymore for
  // SDD because it doesn't clone any external repo, but git is still needed
  // for general dev workflows and gentle-ai may use it to detect project roots).
  const gitPath = await which('git')
  checks.push(gitPath
    ? { name: 'git', status: 'ok', detail: gitPath }
    : { name: 'git', status: 'fail', detail: 'Required for git operations' })

  // Check gentle-ai (replaces the previous agent-teams-lite dir check)
  const gentleAiPath = await which('gentle-ai')
  checks.push(gentleAiPath
    ? { name: 'gentle-ai', status: 'ok', detail: gentleAiPath }
    : {
        name: 'gentle-ai',
        status: 'fail',
        detail: 'gentle-ai not found. Run: brew trust --formula gentleman-programming/tap/gentle-ai && brew install gentleman-programming/tap/gentle-ai',
      })

  // Check rtk (optional — token compression)
  const rtkPath = await which('rtk')
  checks.push(rtkPath
    ? { name: 'rtk', status: 'ok', detail: rtkPath }
    : { name: 'rtk', status: 'skip', detail: 'Optional — brew install rtk-ai/tap/rtk or cargo install rtk' })

  // Check ghagga (optional)
  const ghaggaPath = await which('ghagga')
  checks.push(ghaggaPath
    ? { name: 'ghagga', status: 'ok', detail: ghaggaPath }
    : { name: 'ghagga', status: 'skip', detail: 'Optional — https://github.com/JNZader/ghagga' })

  // Check configured CLIs
  if (manifest?.clis) {
    for (const cli of manifest.clis) {
      const cliPath = await which(cli === 'claude' ? 'claude' : cli)
      checks.push(cliPath
        ? { name: `CLI: ${cli}`, status: 'ok', detail: cliPath }
        : { name: `CLI: ${cli}`, status: 'fail', detail: `${cli} not found in PATH` })
    }
  }

  return { manifest, checks }
}
