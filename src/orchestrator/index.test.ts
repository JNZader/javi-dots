import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { SetupOptions, SetupStep } from '../types/index.js'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('fs', () => {
  const fns = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    mkdtempSync: vi.fn(() => '/tmp/javidots-test-staging'),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    copyFileSync: vi.fn(),
    chmodSync: vi.fn(),
    rmSync: vi.fn(),
    utimesSync: vi.fn(),
  }
  return { default: fns, ...fns }
})

// Mock backup.ts + brew-trust.ts + mcp.ts's registerEngramMcpForCli so the
// orchestrator tests don't need the full submodule dependency graph. We assert
// their INVOCATIONS through the orchestrator, not their internal behavior.
vi.mock('./backup.js', () => ({
  writeSnapshot: vi.fn(async () => ({ skipped: true })),
  pruneBackups: vi.fn(async () => ({ removed: [], kept: [] })),
  restoreSnapshot: vi.fn(async () => ({ restored: [], failed: [] })),
}))
vi.mock('./brew-trust.js', () => ({
  ensureBrewTrust: vi.fn(async () => []),
}))
vi.mock('./mcp.js', () => ({
  registerEngramMcpForCli: vi.fn(async () => ({
    configPath: '/tmp/mock-mcp-config.json',
    action: 'created',
  })),
}))

import { execFile } from 'child_process'
import fs from 'fs'
import { runSetup, validateJaviAiAssets } from './index.js'
import { writeSnapshot as writeSnapshotMock } from './backup.js'
import { registerEngramMcpForCli } from './mcp.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Make execFile invoke its callback successfully */
function execFileSucceeds(stdout = '') {
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
      // promisify passes (cmd, args, opts, cb) or (cmd, args, cb)
      const callback = cb ?? _opts
      if (typeof callback === 'function') callback(null, { stdout, stderr: '' })
    },
  )
}

/** Make execFile fail for specific commands, succeed for others */
function execFileRouted(routes: Record<string, 'ok' | 'fail' | string>) {
  ;(execFile as unknown as Mock).mockImplementation(
    (cmd: string, args: string[], opts: unknown, cb?: Function) => {
      const callback = (typeof opts === 'function' ? opts : cb) as Function
      const key = cmd === 'which' ? `which:${args[0]}` : cmd

      if (routes[key] === 'fail') {
        callback(new Error(`${key} failed`))
      } else {
        const stdout = typeof routes[key] === 'string' ? routes[key] : `/usr/bin/${args?.[0] ?? cmd}`
        callback(null, { stdout, stderr: '' })
      }
    },
  )
}

function collectSteps(steps: SetupStep[]) {
  return (step: SetupStep) => steps.push({ ...step })
}

const defaultOpts: SetupOptions = {
  clis: ['claude', 'opencode'],
  ghagga: false,
  kiteguard: false,
  hookProfile: null,
  agentWorkspace: false,
  dryRun: false,
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('runSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fs.existsSync as Mock).mockReturnValue(false)
    ;(fs.mkdirSync as Mock).mockReturnValue(undefined)
    ;(fs.writeFileSync as Mock).mockReturnValue(undefined)
    ;(fs.readdirSync as Mock).mockReturnValue(['asset'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => false, isFile: () => true })
  })

  // ── dryRun mode (Tier 1 mutation targets) ────────────────────────────────
  describe('dryRun mode', () => {
    it('dryRun=true: never calls execFileAsync', async () => {
      // which calls still need to work for commandExists
      execFileSucceeds()
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, dryRun: true }, collectSteps(steps))

      // execFile is only called for `which` checks, never for actual commands
      const calls = (execFile as unknown as Mock).mock.calls
      for (const call of calls) {
        expect(call[0]).toBe('which')
      }
    })

    it('dryRun=true: never writes to filesystem', async () => {
      execFileSucceeds()
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, dryRun: true }, collectSteps(steps))

      expect(fs.mkdirSync).not.toHaveBeenCalled()
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('dryRun=true: still emits step callbacks with correct statuses', async () => {
      execFileSucceeds()
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, dryRun: true }, collectSteps(steps))

      // Should have steps for javi-ai, gentle-ai (replaces 'sdd'), engram,
      // ghagga, rtk, manifest. 'sdd' id is no longer used — Step 2 emits id
      // 'gentle-ai'.
      const ids = steps.map((s) => s.id)
      expect(ids).toContain('javi-ai')
      expect(ids).toContain('gentle-ai')
      expect(ids).toContain('engram')
      expect(ids).toContain('ghagga')
      expect(ids).toContain('rtk')
      expect(ids).toContain('manifest')
      // No 'sdd' step id (that was the legacy ATL step).
      expect(ids).not.toContain('sdd')
    })

    it('dryRun=true, ghagga=false: ghagga step is skipped', async () => {
      execFileSucceeds()
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, dryRun: true, ghagga: false }, collectSteps(steps))

      const ghaggaStep = steps.find((s) => s.id === 'ghagga' && s.status !== 'running')
      expect(ghaggaStep).toBeDefined()
      expect(ghaggaStep!.status).toBe('skipped')
    })

    it('dryRun=true, ghagga=true: ghagga step is done (not skipped) when binary exists', async () => {
      execFileSucceeds() // which ghagga succeeds
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, dryRun: true, ghagga: true }, collectSteps(steps))

      const ghaggaDone = steps.find((s) => s.id === 'ghagga' && s.status === 'done')
      expect(ghaggaDone).toBeDefined()
    })
  })

  // ── Step 1: javi-ai ──────────────────────────────────────────────────────
  describe('Step 1 — javi-ai', () => {
    it('success: emits running then done with CLI list', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(true)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const javiAiSteps = steps.filter((s) => s.id === 'javi-ai')
      expect(javiAiSteps[0].status).toBe('running')
      expect(javiAiSteps[0].label).toContain('javi-ai')
      expect(javiAiSteps[1].status).toBe('done')
      expect(javiAiSteps[1].label).toContain('javi-ai')
      expect(javiAiSteps[1].detail).toContain('claude,opencode')
    })

    it('post-install validation failure emits actionable incomplete-assets error', async () => {
      execFileRouted({ 'which:git': 'ok', 'which:engram': 'ok', 'which:ghagga': 'ok', npx: 'ok' })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, clis: ['codex'] }, collectSteps(steps))

      const javiAiError = steps.find((s) => s.id === 'javi-ai' && s.status === 'error')
      expect(javiAiError).toBeDefined()
      expect(javiAiError!.detail).toContain('assets are incomplete')
      expect(javiAiError!.detail).toContain('.codex')
      expect(javiAiError!.detail).toContain('config.toml')
    })

    it('validateJaviAiAssets returns missing active paths for selected CLIs', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)

      const missing = validateJaviAiAssets(['codex'], '/home/test')

      expect(missing).toHaveLength(1)
      expect(missing[0]).toContain('/home/test/.codex/skills')
      expect(missing[0]).toContain('/home/test/.codex/config.toml')
    })

    it('failure: emits error with install instructions', async () => {
      execFileRouted({ 'which:git': 'ok', 'which:engram': 'ok', 'which:ghagga': 'ok', npx: 'fail' })
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const javiAiError = steps.find((s) => s.id === 'javi-ai' && s.status === 'error')
      expect(javiAiError).toBeDefined()
      expect(javiAiError!.detail).toContain('npm install -g javi-ai')
    })
  })

  // ── Step 2: gentle-ai (replaces archived agent-teams-lite) ──────────────
  describe('Step 2 — gentle-ai', () => {
    it('gentle-ai already on PATH: invokes install with --agent <list> --preset full-gentleman --persona custom + GENTLE_AI_YES=1', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const gentleAiCall = calls.find(
        (c: unknown[]) => c[0] === 'gentle-ai' && (c[1] as string[])[0] === 'install',
      )
      expect(gentleAiCall).toBeDefined()
      expect((gentleAiCall![1] as string[])).toEqual([
        'install',
        '--agent',
        'claude-code,opencode',
        '--preset',
        'full-gentleman',
        '--persona',
        'custom',
      ])
      const opts = gentleAiCall![2] as { env?: Record<string, string> } | undefined
      expect(opts?.env?.GENTLE_AI_YES).toBe('1')
    })

    it('no `git` requirement: gentle-ai path does NOT call `git clone agent-teams-lite`', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const gitCloneCall = calls.find(
        (c: unknown[]) =>
          c[0] === 'git' && (c[1] as string[]).includes('clone'),
      )
      expect(gitCloneCall).toBeUndefined()
    })

    it('gentle-ai not on PATH, brew present: installs via brew then runs install', async () => {
      // First `which gentle-ai` fails, then brew install succeeds, then
      // gentle-ai install runs.
      let gentleAiWhichFails = true
      ;(execFile as unknown as Mock).mockImplementation(
        (cmd: string, args: string[], opts: unknown, cb?: Function) => {
          const callback = (typeof opts === 'function' ? opts : cb) as Function
          if (cmd === 'which' && args[0] === 'gentle-ai' && gentleAiWhichFails) {
            gentleAiWhichFails = false
            callback(new Error('not found'))
            return
          }
          callback(null, { stdout: '', stderr: '' })
        },
      )
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const brewInstallGentleAi = calls.find(
        (c: unknown[]) =>
          c[0] === 'brew' &&
          (c[1] as string[]).includes('install') &&
          (c[1] as string[]).includes('gentleman-programming/tap/gentle-ai'),
      )
      expect(brewInstallGentleAi).toBeDefined()
      const gentleAiInstall = calls.find(
        (c: unknown[]) => c[0] === 'gentle-ai' && (c[1] as string[])[0] === 'install',
      )
      expect(gentleAiInstall).toBeDefined()
    })

    it('gentle-ai install failure: emits error step (NOT skipped)', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)
      // which gentle-ai succeeds, but `gentle-ai install` rejects.
      let installRejected = false
      ;(execFile as unknown as Mock).mockImplementation(
        (cmd: string, args: string[], opts: unknown, cb?: Function) => {
          const callback = (typeof opts === 'function' ? opts : cb) as Function
          if (cmd === 'gentle-ai' && (args as string[])[0] === 'install' && !installRejected) {
            installRejected = true
            callback(new Error('gentle-ai: invalid agent flag'))
            return
          }
          callback(null, { stdout: '', stderr: '' })
        },
      )
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const gentleAiError = steps.find((s) => s.id === 'gentle-ai' && s.status === 'error')
      expect(gentleAiError).toBeDefined()
      expect(gentleAiError!.detail).toContain('gentle-ai: invalid agent flag')
    })
  })

  // ── Step 3: engram (now uses registerEngramMcpForCli, no `engram setup <cli>`) ─
  describe('Step 3 — engram', () => {
    it('already installed: skips brew, registers engram as MCP via registerEngramMcpForCli', async () => {
      execFileRouted({
        'which:gentle-ai': 'ok',
        'which:engram': '/usr/local/bin/engram',
        'which:ghagga': 'ok',
        'which:brew': 'ok',
        npx: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      // Should NOT call `engram setup <cli>` (the legacy swallow-catch path).
      const engramSetupCalls = calls.filter(
        (c: unknown[]) => c[0] === 'engram' && (c[1] as string[])[0] === 'setup',
      )
      expect(engramSetupCalls).toHaveLength(0)
      // Should also not call brew (we said engram already installed).
      const brewCall = calls.find(
        (c: unknown[]) => c[0] === 'brew' && (c[1] as string[]).includes('install'),
      )
      expect(brewCall).toBeUndefined()
    })

    it('not installed + brew available: installs via brew', async () => {
      execFileRouted({
        'which:git': 'ok',
        'which:engram': 'fail',
        'which:brew': 'ok',
        'which:ghagga': 'ok',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
        brew: 'ok',
        engram: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const brewCall = calls.find(
        (c: unknown[]) => c[0] === 'brew' && (c[1] as string[]).includes('install'),
      )
      expect(brewCall).toBeDefined()
    })

    it('not installed + brew missing: emits error', async () => {
      execFileRouted({
        'which:git': 'ok',
        'which:engram': 'fail',
        'which:brew': 'fail',
        'which:ghagga': 'ok',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const engramError = steps.find((s) => s.id === 'engram' && s.status === 'error')
      expect(engramError).toBeDefined()
      expect(engramError!.label).toContain('engram')
      expect(engramError!.detail).toContain('brew not available')
    })

    it('per-CLI engram register failure is surfaced (NOT swallowed per spec)', async () => {
      // registerEngramMcpForCli throws (e.g. EACCES) — the orchestrator must
      // NOT swallow it. The engram step should report 'error'.
      execFileRouted({
        'which:gentle-ai': 'ok',
        'which:engram': '/usr/local/bin/engram',
        'which:brew': 'ok',
        'which:ghagga': 'ok',
        npx: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      ;(registerEngramMcpForCli as unknown as Mock).mockRejectedValue(
        new Error('registerEngramMcpForCli: write to /home/test/.claude.json failed: EACCES: permission denied'),
      )
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const engramError = steps.find((s) => s.id === 'engram' && s.status === 'error')
      expect(engramError).toBeDefined()
      expect(engramError!.detail).toMatch(/EACCES|registerEngramMcpForCli/)
    })
  })

  // ── Step 4: ghagga ────────────────────────────────────────────────────────
  describe('Step 4 — ghagga', () => {
    it('ghagga=false: step skipped with "Not selected"', async () => {
      execFileSucceeds()
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, ghagga: false }, collectSteps(steps))

      const ghaggaSkip = steps.find((s) => s.id === 'ghagga' && s.status === 'skipped')
      expect(ghaggaSkip).toBeDefined()
      expect(ghaggaSkip!.label).toContain('ghagga')
      expect(ghaggaSkip!.detail).toBe('Not selected')
    })

    it('ghagga=true, binary exists: runs ghagga init, done', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, ghagga: true }, collectSteps(steps))

      const ghaggaDone = steps.find((s) => s.id === 'ghagga' && s.status === 'done')
      expect(ghaggaDone).toBeDefined()
      expect(ghaggaDone!.label).toContain('ghagga')

      const calls = (execFile as unknown as Mock).mock.calls
      const ghaggaCall = calls.find(
        (c: unknown[]) => c[0] === 'ghagga' && (c[1] as string[]).includes('init'),
      )
      expect(ghaggaCall).toBeDefined()
    })

    it('ghagga=true, binary missing: skipped with install instructions', async () => {
      execFileRouted({
        'which:git': 'ok',
        'which:engram': 'ok',
        'which:ghagga': 'fail',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
        engram: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, ghagga: true }, collectSteps(steps))

      const ghaggaSkip = steps.find((s) => s.id === 'ghagga' && s.status === 'skipped')
      expect(ghaggaSkip).toBeDefined()
      expect(ghaggaSkip!.label).toContain('ghagga')
      expect(ghaggaSkip!.detail).toContain('ghagga not installed')
    })

    it('ghagga=true, init throws: error', async () => {
      // ghagga exists but init fails
      ;(execFile as unknown as Mock).mockImplementation(
        (cmd: string, args: string[], opts: unknown, cb?: Function) => {
          const callback = (typeof opts === 'function' ? opts : cb) as Function
          if (cmd === 'which') {
            callback(null, { stdout: `/usr/bin/${args[0]}`, stderr: '' })
          } else if (cmd === 'ghagga') {
            callback(new Error('ghagga init failed'))
          } else {
            callback(null, { stdout: '', stderr: '' })
          }
        },
      )
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, ghagga: true }, collectSteps(steps))

      const ghaggaError = steps.find((s) => s.id === 'ghagga' && s.status === 'error')
      expect(ghaggaError).toBeDefined()
    })
  })

  // ── Manifest ──────────────────────────────────────────────────────────────
  describe('Manifest', () => {
    it('ghagga binary missing early-return still writes manifest', async () => {
      execFileRouted({
        'which:git': 'ok',
        'which:engram': 'ok',
        'which:ghagga': 'fail',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
        engram: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, ghagga: true }, collectSteps(steps))

      // Even though ghagga binary is missing, manifest should still be emitted
      const manifestDone = steps.find((s) => s.id === 'manifest' && s.status === 'done')
      expect(manifestDone).toBeDefined()
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('writes valid JSON with correct shape after successful setup', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      expect(fs.writeFileSync).toHaveBeenCalled()
      // Find the manifest write call (the one whose path matches MANIFEST_PATH).
      // The first writeFileSync may now be from registerEngramMcpForCli writing
      // per-CLI MCP config; pick the one whose first arg is MANIFEST_PATH.
      const allCalls = (fs.writeFileSync as Mock).mock.calls as unknown[][]
      const manifestWrite = allCalls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).endsWith('manifest.json'),
      )
      expect(manifestWrite).toBeDefined()
      const written = JSON.parse(manifestWrite![1] as string)
      expect(written).toMatchObject({
        version: '0.2.0',
        clis: ['claude', 'opencode'],
        engram: true,
        sdd: true,
        ghagga: false,
        rtk: true,
      })
      expect(written.installedAt).toBeDefined()
      expect(written.updatedAt).toBeDefined()
    })
  })
})
