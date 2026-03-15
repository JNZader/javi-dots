import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { SetupOptions, SetupStep } from '../types/index.js'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import { execFile } from 'child_process'
import fs from 'fs'
import { runSetup } from './index.js'

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
  dryRun: false,
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('runSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fs.existsSync as Mock).mockReturnValue(false)
    ;(fs.mkdirSync as Mock).mockReturnValue(undefined)
    ;(fs.writeFileSync as Mock).mockReturnValue(undefined)
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

      // Should have steps for javi-ai, sdd, engram, ghagga, manifest
      const ids = steps.map((s) => s.id)
      expect(ids).toContain('javi-ai')
      expect(ids).toContain('sdd')
      expect(ids).toContain('engram')
      expect(ids).toContain('ghagga')
      expect(ids).toContain('manifest')
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
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const javiAiSteps = steps.filter((s) => s.id === 'javi-ai')
      expect(javiAiSteps[0].status).toBe('running')
      expect(javiAiSteps[0].label).toContain('javi-ai')
      expect(javiAiSteps[1].status).toBe('done')
      expect(javiAiSteps[1].label).toContain('javi-ai')
      expect(javiAiSteps[1].detail).toContain('claude,opencode')
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

  // ── Step 2: SDD / agent-teams-lite ────────────────────────────────────────
  describe('Step 2 — SDD/agent-teams-lite', () => {
    it('git not found: emits error with "git not found"', async () => {
      execFileRouted({ 'which:git': 'fail', 'which:engram': 'ok', 'which:ghagga': 'ok', npx: 'ok' })
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const sddError = steps.find((s) => s.id === 'sdd' && s.status === 'error')
      expect(sddError).toBeDefined()
      expect(sddError!.label).toContain('agent-teams-lite')
      expect(sddError!.detail).toContain('git not found')
    })

    it('dir absent: calls git clone', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const cloneCall = calls.find(
        (c: unknown[]) => c[0] === 'git' && (c[1] as string[]).includes('clone'),
      )
      expect(cloneCall).toBeDefined()
    })

    it('dir exists: calls git pull --ff-only', async () => {
      execFileSucceeds()
      // First call to existsSync (atlDir) returns true, second (setupScript) returns true
      ;(fs.existsSync as Mock).mockReturnValue(true)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const pullCall = calls.find(
        (c: unknown[]) => c[0] === 'git' && (c[1] as string[]).includes('pull'),
      )
      expect(pullCall).toBeDefined()
    })

    it('per-CLI setup.sh called for each CLI', async () => {
      execFileSucceeds()
      ;(fs.existsSync as Mock).mockReturnValue(true)
      const steps: SetupStep[] = []
      await runSetup({ ...defaultOpts, clis: ['claude', 'opencode', 'gemini'] }, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const bashCalls = calls.filter(
        (c: unknown[]) => c[0] === 'bash' && (c[1] as string[]).includes('--agent'),
      )
      expect(bashCalls).toHaveLength(3)
      expect((bashCalls[0][1] as string[])[2]).toBe('claude')
      expect((bashCalls[1][1] as string[])[2]).toBe('opencode')
      expect((bashCalls[2][1] as string[])[2]).toBe('gemini')
    })

    it('clone failure: emits error', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)
      execFileRouted({
        'which:git': 'ok',
        'which:engram': 'ok',
        'which:ghagga': 'ok',
        npx: 'ok',
        git: 'fail',
        engram: 'ok',
      })
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const sddError = steps.find((s) => s.id === 'sdd' && s.status === 'error')
      expect(sddError).toBeDefined()
    })
  })

  // ── Step 3: engram ────────────────────────────────────────────────────────
  describe('Step 3 — engram', () => {
    it('already installed: skips brew, configures per CLI', async () => {
      execFileRouted({
        'which:git': 'ok',
        'which:engram': '/usr/local/bin/engram',
        'which:ghagga': 'ok',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
        engram: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      // Should not call brew
      const calls = (execFile as unknown as Mock).mock.calls
      const brewCall = calls.find((c: unknown[]) => c[0] === 'brew')
      expect(brewCall).toBeUndefined()

      // Should call engram setup for each CLI
      const engramSetupCalls = calls.filter(
        (c: unknown[]) => c[0] === 'engram' && (c[1] as string[])[0] === 'setup',
      )
      expect(engramSetupCalls.length).toBeGreaterThanOrEqual(2)
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

    it('claude mapped to claude-code for engram setup', async () => {
      execFileRouted({
        'which:git': 'ok',
        'which:engram': '/usr/local/bin/engram',
        'which:ghagga': 'ok',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
        engram: 'ok',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup({ clis: ['claude'], ghagga: false, dryRun: false }, collectSteps(steps))

      const calls = (execFile as unknown as Mock).mock.calls
      const engramSetupCall = calls.find(
        (c: unknown[]) => c[0] === 'engram' && (c[1] as string[])[0] === 'setup',
      )
      expect(engramSetupCall).toBeDefined()
      expect((engramSetupCall![1] as string[])[1]).toBe('claude-code')
    })

    it('per-CLI engram setup failure is swallowed (non-fatal)', async () => {
      // engram setup fails but overall engram step still reports 'done'
      execFileRouted({
        'which:git': 'ok',
        'which:engram': '/usr/local/bin/engram',
        'which:ghagga': 'ok',
        npx: 'ok',
        git: 'ok',
        bash: 'ok',
        engram: 'fail',
      })
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const steps: SetupStep[] = []
      await runSetup(defaultOpts, collectSteps(steps))

      const engramDone = steps.find((s) => s.id === 'engram' && s.status === 'done')
      expect(engramDone).toBeDefined()
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
      const writeCall = (fs.writeFileSync as Mock).mock.calls[0]
      const written = JSON.parse(writeCall[1] as string)
      expect(written).toMatchObject({
        version: '0.1.0',
        clis: ['claude', 'opencode'],
        engram: true,
        sdd: true,
        ghagga: false,
      })
      expect(written.installedAt).toBeDefined()
      expect(written.updatedAt).toBeDefined()
    })
  })
})
