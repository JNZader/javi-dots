import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { SetupOptions, SetupStep, Manifest } from '../types/index.js'
import { MANIFEST_DIR, MANIFEST_PATH, CLAUDE_MD_PATH } from '../constants.js'
import { ensureBrewTrust } from './brew-trust.js'
import { writeSnapshot } from './backup.js'
import { registerEngramMcpForCli } from './mcp.js'

const execFileAsync = promisify(execFile)

type StepCallback = (step: SetupStep) => void

interface JaviAiAssetTarget {
  cli: SetupOptions['clis'][number]
  label: string
  paths: string[]
}

function javiAiAssetTargets(homeDir: string): JaviAiAssetTarget[] {
  return [
    {
      cli: 'claude',
      label: 'Claude skills/config',
      paths: [
        path.join(homeDir, '.claude', 'skills'),
        path.join(homeDir, '.claude', 'CLAUDE.md'),
        path.join(homeDir, '.claude', 'settings.json'),
      ],
    },
    {
      cli: 'opencode',
      label: 'OpenCode skills/config',
      paths: [
        path.join(homeDir, '.config', 'opencode', 'skills'),
        path.join(homeDir, '.config', 'opencode', 'opencode.json'),
      ],
    },
    {
      cli: 'gemini',
      label: 'Gemini skills/config',
      paths: [
        path.join(homeDir, '.gemini', 'skills'),
        path.join(homeDir, '.gemini', 'settings.json'),
      ],
    },
    {
      cli: 'qwen',
      label: 'Qwen skills/config',
      paths: [
        path.join(homeDir, '.qwen', 'skills'),
        path.join(homeDir, '.qwen', 'QWEN.md'),
        path.join(homeDir, '.qwen', 'settings.json'),
      ],
    },
    {
      cli: 'codex',
      label: 'Codex skills/config',
      paths: [
        path.join(homeDir, '.codex', 'skills'),
        path.join(homeDir, '.codex', 'config.toml'),
      ],
    },
    {
      cli: 'copilot',
      label: 'Copilot skills/config',
      paths: [
        path.join(homeDir, '.copilot', 'skills'),
        path.join(homeDir, '.copilot', 'instructions', 'base-rules.instructions.md'),
        path.join(homeDir, '.copilot', 'instructions', 'sdd-orchestrator.instructions.md'),
        path.join(homeDir, '.copilot', 'agents', 'sdd-orchestrator.md'),
      ],
    },
  ]
}

function hasDirectoryEntries(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.readdirSync(dirPath).some(entry => !entry.startsWith('.'))
  } catch {
    return false
  }
}

function hasInstalledAsset(assetPath: string): boolean {
  try {
    if (!fs.existsSync(assetPath)) return false
    const stat = fs.statSync(assetPath)
    return stat.isDirectory() ? hasDirectoryEntries(assetPath) : stat.isFile()
  } catch {
    return false
  }
}

function validateJaviAiAssets(clis: SetupOptions['clis'], homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? ''): string[] {
  if (!homeDir) return ['HOME is not set; cannot validate javi-ai assets']

  return javiAiAssetTargets(homeDir)
    .filter(target => clis.includes(target.cli))
    .flatMap(target => {
      const missing = target.paths.filter(assetPath => !hasInstalledAsset(assetPath))
      return missing.length > 0 ? [`${target.label} missing: ${missing.join(', ')}`] : []
    })
}

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

export { validateJaviAiAssets }

export async function runSetup(options: SetupOptions, onStep: StepCallback): Promise<void> {
  const { clis, ghagga, kiteguard, hookProfile, agentWorkspace, dryRun } = options
  const cliList = clis.join(',')

  // Step 1: Install javi-ai for selected CLIs
  report(onStep, 'javi-ai', 'Install AI framework (javi-ai)', 'running')
  try {
    if (!dryRun) {
      await execFileAsync('npx', ['-y', 'javi-ai@latest', 'install', '--cli', cliList], {
        timeout: 120000,
        env: { ...process.env, FORCE_COLOR: '0' },
      })

      const missingAssets = validateJaviAiAssets(clis)
      if (missingAssets.length > 0) {
        throw new Error(`javi-ai install completed but assets are incomplete. ${missingAssets.join(' | ')}`)
      }
    }
    report(onStep, 'javi-ai', 'Install AI framework (javi-ai)', 'done', `CLIs: ${cliList}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const detail = msg.includes('assets are incomplete')
      ? `${msg}. Run: npm install -g javi-ai@latest && javi-ai install --cli ${cliList}`
      : `Failed. Run: npm install -g javi-ai@latest && javi-ai install --cli ${cliList}`
    report(onStep, 'javi-ai', 'Install AI framework (javi-ai)', 'error', detail)
  }

  // Brew tap-trust preflight: gentle-ai + engram must be trusted before
  // `brew install` from non-official taps. Homebrew 6 refuses to install
  // from untrusted taps. See spec "Brew Tap-Trust Preflight" scenario
  // "Fresh Homebrew 6 install on Linux/macOS".
  const brewExists = await commandExists('brew')
  if (brewExists && !dryRun) {
    await ensureBrewTrust([
      'gentleman-programming/tap/gentle-ai',
      'gentleman-programming/tap/engram',
    ])
  }

  // Backup snapshot of managed config files BEFORE gentle-ai install may
  // modify them. Even though we pass --persona custom (which preserves
  // user persona/prompt blocks), gentle-ai may still touch opencode.json
  // and ~/.claude/CLAUDE.md for managed components. See spec
  // "Backup Snapshot Before Managed Writes".
  const managedPathsForBackup = [
    CLAUDE_MD_PATH,
    path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(os.homedir(), '.claude.json'),
  ].filter((p) => fs.existsSync(p))
  let activeBackupId: string | undefined
  if (!dryRun && managedPathsForBackup.length > 0 && brewExists) {
    const backupsDir = path.join(MANIFEST_DIR, 'backups')
    const snap = await writeSnapshot(managedPathsForBackup, backupsDir)
    if (!snap.skipped && snap.manifest) {
      activeBackupId = snap.manifest.id
    }
  }

  // Step 2: Install gentle-ai ecosystem (modern SDD provider)
  // The CLI list map uses gentle-ai's agent name conventions; gentle-ai
  // runs non-interactively because we pass --agent, --preset, --persona
  // explicitly AND set GENTLE_AI_YES=1 to auto-accept any self-update prompt.
  report(onStep, 'gentle-ai', 'Install Gentle-AI ecosystem (gentle-ai)', 'running')
  try {
    const gentleAiExists = await commandExists('gentle-ai')

    if (!gentleAiExists && !dryRun) {
      if (brewExists) {
        await execFileAsync('brew', ['install', 'gentleman-programming/tap/gentle-ai'], { timeout: 120000 })
      } else {
        throw new Error('gentle-ai not found and brew not available. Install manually: https://github.com/Gentleman-Programming/gentle-ai')
      }
    }

    if (!dryRun) {
      // javi-dots short CLI ids → gentle-ai agent names
      const GENTLE_AI_AGENT_MAP: Record<string, string> = {
        claude: 'claude-code',
        opencode: 'opencode',
        gemini: 'gemini-cli',
        qwen: 'qwen',
        codex: 'codex',
        copilot: 'copilot',
      }
      const agentList = clis.map((c) => GENTLE_AI_AGENT_MAP[c] ?? c).join(',')
      await execFileAsync(
        'gentle-ai',
        ['install', '--agent', agentList, '--preset', 'full-gentleman', '--persona', 'custom'],
        {
          timeout: 120000,
          env: { ...process.env, GENTLE_AI_YES: '1', FORCE_COLOR: '0' },
        },
      )
    }
    report(onStep, 'gentle-ai', 'Install Gentle-AI ecosystem (gentle-ai)', 'done', `CLIs: ${cliList}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'gentle-ai', 'Install Gentle-AI ecosystem (gentle-ai)', 'error', msg)
  }

  // Step 3: Install engram — MANDATORY
  report(onStep, 'engram', 'Install persistent memory (engram)', 'running')
  try {
    const engramExists = await commandExists('engram')

    if (!engramExists && !dryRun) {
      if (brewExists) {
        await execFileAsync('brew', ['install', 'gentleman-programming/tap/engram'], { timeout: 120000 })
      } else {
        throw new Error('engram not found and brew not available. Install manually: https://github.com/Gentleman-Programming/engram')
      }
    }

    if (!dryRun) {
      // Register engram as local MCP server in each CLI's MCP config.
      // The brew binary source-of-truth; we do NOT swallow errors here (per
      // spec "engram Lifecycle Replaces engram setup <cli>" — the prior
      // catch-and-swallow was a hidden bug that masked missing subcommands).
      for (const cli of clis) {
        await registerEngramMcpForCli(cli as SetupOptions['clis'][number])
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

  // Step 7: Install RTK (Rust Token Killer) — OPTIONAL
  report(onStep, 'rtk', 'Install token compressor (rtk)', 'running')
  try {
    const rtkExists = await commandExists('rtk')

    if (!rtkExists && !dryRun) {
      // Try brew first, fall back to cargo
      const brewAvailable = await commandExists('brew')
      if (brewAvailable) {
        // Ensure rtk-ai tap is trusted before invoking brew install — same
        // preflight pattern used for gentle-ai/engram. Without trust Homebrew
        // 6 refuses with "Refusing to load formula from untrusted tap".
        await ensureBrewTrust(['rtk-ai/tap/rtk'])
        try {
          await execFileAsync('brew', ['install', 'rtk-ai/tap/rtk'], { timeout: 120000 })
        } catch {
          // brew tap may not exist yet — try cargo
          const cargoExists = await commandExists('cargo')
          if (cargoExists) {
            await execFileAsync('cargo', ['install', 'rtk'], { timeout: 180000 })
          } else {
            throw new Error('rtk not found. Install via: brew install rtk-ai/tap/rtk or cargo install rtk')
          }
        }
      } else {
        const cargoExists = await commandExists('cargo')
        if (cargoExists) {
          await execFileAsync('cargo', ['install', 'rtk'], { timeout: 180000 })
        } else {
          throw new Error('rtk not found and neither brew nor cargo available. Install via: brew install rtk-ai/tap/rtk')
        }
      }
    }

    // Initialize global config if rtk is now available
    if (!dryRun) {
      const rtkNowExists = rtkExists || await commandExists('rtk')
      if (rtkNowExists) {
        try {
          await execFileAsync('rtk', ['init', '-g'], { timeout: 15000 })
        } catch {
          // init may fail if already configured — non-fatal
        }
      }
    }

    report(onStep, 'rtk', 'Install token compressor (rtk)', 'done',
      dryRun ? 'dry-run: would install rtk and run rtk init -g' : 'rtk installed and configured')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    report(onStep, 'rtk', 'Install token compressor (rtk)', 'error', msg)
  }

  // Step 8: Configure agent workspace — OPTIONAL
  if (agentWorkspace) {
    const { runAgentWorkspaceSetup } = await import('./agent-workspace.js')
    await runAgentWorkspaceSetup(dryRun, onStep)
  } else {
    report(onStep, 'agent-workspace', 'Agent workspace setup', 'skipped', 'Not selected')
  }

  // Step 9: Write manifest
  writeManifest(clis, ghagga, kiteguard, dryRun)
  writeManifest(clis, ghagga, kiteguard, dryRun, activeBackupId)
  report(onStep, 'manifest', 'Save configuration', 'done')
}

function writeManifest(
  clis: SetupOptions['clis'],
  ghagga: boolean,
  kiteguard: boolean,
  dryRun: boolean,
  backupRef?: string,
): void {
  if (!dryRun) {
    const manifest: Manifest = {
      version: '0.2.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clis,
      engram: true,
      sdd: true, // provider gentle-ai (not ATL) — see openspec/changes/gentle-ai-migration
      ghagga,
      kiteguard,
      rtk: true,
      backupRef,
    }
    fs.mkdirSync(MANIFEST_DIR, { recursive: true })
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  }
}
