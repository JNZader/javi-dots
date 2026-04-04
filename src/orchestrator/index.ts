import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import type { SetupOptions, SetupStep, Manifest } from '../types/index.js'
import { MANIFEST_DIR, MANIFEST_PATH } from '../constants.js'

const execFileAsync = promisify(execFile)

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('which', [cmd])
    return true
  } catch {
    return false
  }
}

export async function runSetup(options: SetupOptions, onStep: StepCallback): Promise<void> {
  const { clis, ghagga, kiteguard, hookProfile, agentWorkspace, dryRun } = options
  const cliList = clis.join(',')

  // Step 1: Install javi-ai for selected CLIs
  report(onStep, 'javi-ai', 'Install AI framework (javi-ai)', 'running')
  try {
    if (!dryRun) {
      await execFileAsync('npx', ['javi-ai', 'install', '--cli', cliList], {
        timeout: 120000,
        env: { ...process.env, FORCE_COLOR: '0' },
      })
    }
    report(onStep, 'javi-ai', 'Install AI framework (javi-ai)', 'done', `CLIs: ${cliList}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'javi-ai', 'Install AI framework (javi-ai)', 'error',
      `Failed. Run: npm install -g javi-ai && javi-ai install --cli ${cliList}`)
    void msg // acknowledge error
  }

  // Step 2: Install agent-teams-lite (SDD) — MANDATORY
  report(onStep, 'sdd', 'Install SDD framework (agent-teams-lite)', 'running')
  try {
    const gitExists = await commandExists('git')
    if (!gitExists) throw new Error('git not found — required to clone agent-teams-lite')

    if (!dryRun) {
      const atlDir = path.join(MANIFEST_DIR, 'agent-teams-lite')
      // Clone or pull
      if (fs.existsSync(atlDir)) {
        await execFileAsync('git', ['-C', atlDir, 'pull', '--ff-only'], { timeout: 30000 })
      } else {
        fs.mkdirSync(MANIFEST_DIR, { recursive: true })
        await execFileAsync('git', ['clone', '--depth', '1',
          'https://github.com/Gentleman-Programming/agent-teams-lite.git', atlDir],
          { timeout: 60000 })
      }
      // Run install for each CLI
      // ATL uses different agent names than javi-dots CLI ids
      const ATL_AGENT_MAP: Record<string, string> = {
        claude: 'claude-code',
        opencode: 'opencode',
        gemini: 'gemini-cli',
        codex: 'codex',
      }
      const setupScript = path.join(atlDir, 'scripts', 'setup.sh')
      if (fs.existsSync(setupScript)) {
        for (const cli of clis) {
          const atlAgent = ATL_AGENT_MAP[cli]
          if (!atlAgent) continue // skip CLIs not supported by ATL (qwen, copilot)
          await execFileAsync('bash', [setupScript, '--agent', atlAgent], {
            timeout: 30000,
            cwd: atlDir,
          })
        }
      }
    }
    report(onStep, 'sdd', 'Install SDD framework (agent-teams-lite)', 'done', `CLIs: ${cliList}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'sdd', 'Install SDD framework (agent-teams-lite)', 'error', msg)
  }

  // Step 3: Install engram — MANDATORY
  report(onStep, 'engram', 'Install persistent memory (engram)', 'running')
  try {
    const engramExists = await commandExists('engram')

    if (!engramExists && !dryRun) {
      // Try brew install
      const brewExists = await commandExists('brew')
      if (brewExists) {
        await execFileAsync('brew', ['install', 'gentleman-programming/tap/engram'], { timeout: 120000 })
      } else {
        throw new Error('engram not found and brew not available. Install manually: https://github.com/Gentleman-Programming/engram')
      }
    }

    if (!dryRun) {
      // Configure for each CLI
      for (const cli of clis) {
        const cliName = cli === 'claude' ? 'claude-code' : cli
        try {
          await execFileAsync('engram', ['setup', cliName], { timeout: 15000 })
        } catch {
          // Some CLIs may not have engram setup — not fatal
        }
      }
    }
    report(onStep, 'engram', 'Install persistent memory (engram)', 'done')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'engram', 'Install persistent memory (engram)', 'error', msg)
  }

  // Step 4: Configure ghagga — OPTIONAL
  if (ghagga) {
    report(onStep, 'ghagga', 'Configure code review (ghagga)', 'running')
    try {
      const ghaggaExists = await commandExists('ghagga')
      if (ghaggaExists && !dryRun) {
        await execFileAsync('ghagga', ['init'], { timeout: 15000 })
      } else if (!ghaggaExists) {
        report(onStep, 'ghagga', 'Configure code review (ghagga)', 'skipped',
          'ghagga not installed. Get it: https://github.com/JNZader/ghagga')
        // Write manifest anyway
        writeManifest(clis, ghagga, kiteguard, dryRun)
        report(onStep, 'manifest', 'Save configuration', 'done')
        return
      }
      report(onStep, 'ghagga', 'Configure code review (ghagga)', 'done')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      report(onStep, 'ghagga', 'Configure code review (ghagga)', 'error', msg)
    }
  } else {
    report(onStep, 'ghagga', 'Configure code review (ghagga)', 'skipped', 'Not selected')
  }

  // Step 5: Configure kiteguard — OPTIONAL
  if (kiteguard) {
    const { runKiteguardSetup } = await import('./kiteguard.js')
    await runKiteguardSetup(dryRun, onStep)
  } else {
    report(onStep, 'kiteguard', 'Configure runtime security (kiteguard)', 'skipped', 'Not selected')
  }

  // Step 6: Apply hook profile — OPTIONAL
  if (hookProfile) {
    const { applyBuiltInProfile } = await import('./profiles.js')
    await applyBuiltInProfile(hookProfile, dryRun, onStep)
  } else {
    report(onStep, 'hook-profile', 'Hook reliability profile', 'skipped', 'Not selected')
  }

  // Step 7: Configure agent workspace — OPTIONAL
  if (agentWorkspace) {
    const { runAgentWorkspaceSetup } = await import('./agent-workspace.js')
    await runAgentWorkspaceSetup(dryRun, onStep)
  } else {
    report(onStep, 'agent-workspace', 'Agent workspace setup', 'skipped', 'Not selected')
  }

  // Step 8: Write manifest
  writeManifest(clis, ghagga, kiteguard, dryRun)
  report(onStep, 'manifest', 'Save configuration', 'done')
}

function writeManifest(clis: SetupOptions['clis'], ghagga: boolean, kiteguard: boolean, dryRun: boolean): void {
  if (!dryRun) {
    const manifest: Manifest = {
      version: '0.1.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clis,
      engram: true,
      sdd: true,
      ghagga,
      kiteguard,
    }
    fs.mkdirSync(MANIFEST_DIR, { recursive: true })
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  }
}
