import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { SetupStep, Manifest } from '../types/index.js'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    rmSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

import { execFile } from 'child_process'
import fs from 'fs'
import { runUninstall } from './uninstall.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
const validManifest: Manifest = {
  version: '0.1.0',
  installedAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  clis: ['claude', 'opencode'],
  engram: true,
  sdd: true,
  ghagga: false,
}

function execFileSucceeds() {
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
      const callback = cb ?? _opts
      if (typeof callback === 'function') callback(null, { stdout: '', stderr: '' })
    },
  )
}

function execFileFails(errorMsg = 'command failed') {
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
      const callback = cb ?? _opts
      if (typeof callback === 'function') callback(new Error(errorMsg))
    },
  )
}

function collectSteps(steps: SetupStep[]) {
  return (step: SetupStep) => steps.push({ ...step })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('runUninstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fs.existsSync as Mock).mockReturnValue(false)
  })

  it('no manifest: returns { success: false }', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const steps: SetupStep[] = []
    const result = await runUninstall(false, collectSteps(steps))

    expect(result.success).toBe(false)
    expect(result.detail).toContain('nothing to uninstall')
  })

  it('dryRun=true: never calls execFileAsync, rmSync, unlinkSync', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()

    const steps: SetupStep[] = []
    await runUninstall(true, collectSteps(steps))

    expect(execFile).not.toHaveBeenCalled()
    expect(fs.rmSync).not.toHaveBeenCalled()
    expect(fs.unlinkSync).not.toHaveBeenCalled()

    // Steps should still be emitted with correct ids
    const ids = steps.map((s) => s.id)
    expect(ids).toContain('javi-ai')
    expect(ids).toContain('atl')
    expect(ids).toContain('manifest')
  })

  // ── Step 1: javi-ai uninstall ─────────────────────────────────────────────
  it('step 1 success: running then done', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    const javiAiSteps = steps.filter((s) => s.id === 'javi-ai')
    expect(javiAiSteps[0].status).toBe('running')
    expect(javiAiSteps[0].label).toContain('javi-ai')
    expect(javiAiSteps[1].status).toBe('done')
    expect(javiAiSteps[1].label).toContain('javi-ai')
  })

  it('step 1 failure: error', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileFails('npx javi-ai uninstall failed')

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    const javiAiError = steps.find((s) => s.id === 'javi-ai' && s.status === 'error')
    expect(javiAiError).toBeDefined()
    expect(javiAiError!.label).toContain('javi-ai')
    expect(javiAiError!.detail).toContain('failed')
  })

  // ── Step 2: agent-teams-lite removal ──────────────────────────────────────
  it('step 2 dir exists: rmSync called with recursive+force', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    expect(fs.rmSync).toHaveBeenCalledWith(
      expect.stringContaining('agent-teams-lite'),
      { recursive: true, force: true },
    )
  })

  it('step 2 dir absent: rmSync NOT called, still done', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    expect(fs.rmSync).not.toHaveBeenCalled()
    const atlDone = steps.find((s) => s.id === 'atl' && s.status === 'done')
    expect(atlDone).toBeDefined()
    expect(atlDone!.label).toContain('agent-teams-lite')
  })

  it('step 2 failure: error', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()
    ;(fs.existsSync as Mock).mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('agent-teams-lite')) return true
      return false
    })
    ;(fs.rmSync as Mock).mockImplementation(() => {
      throw new Error('rmSync failed')
    })

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    const atlError = steps.find((s) => s.id === 'atl' && s.status === 'error')
    expect(atlError).toBeDefined()
    expect(atlError!.label).toContain('agent-teams-lite')
    expect(atlError!.detail).toContain('rmSync failed')
  })

  // ── Step 3: manifest removal ─────────────────────────────────────────────
  it('step 3 manifest exists: unlinkSync called', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()
    // existsSync returns false for ATL dir but true for manifest
    ;(fs.existsSync as Mock).mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('manifest.json')) return true
      return false
    })

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    expect(fs.unlinkSync).toHaveBeenCalled()
  })

  it('step 3 manifest absent: unlinkSync NOT called, still done', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    expect(fs.unlinkSync).not.toHaveBeenCalled()
    const manifestDone = steps.find((s) => s.id === 'manifest' && s.status === 'done')
    expect(manifestDone).toBeDefined()
    expect(manifestDone!.label).toContain('manifest')
  })

  it('step 3 failure: error', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()
    ;(fs.existsSync as Mock).mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('manifest.json')) return true
      return false
    })
    ;(fs.unlinkSync as Mock).mockImplementation(() => {
      throw new Error('unlinkSync failed')
    })

    const steps: SetupStep[] = []
    await runUninstall(false, collectSteps(steps))

    const manifestError = steps.find((s) => s.id === 'manifest' && s.status === 'error')
    expect(manifestError).toBeDefined()
    expect(manifestError!.label).toContain('manifest')
    expect(manifestError!.detail).toContain('unlinkSync failed')
  })

  // ── Overall result ────────────────────────────────────────────────────────
  it('all succeed: returns { success: true }', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    execFileSucceeds()

    const steps: SetupStep[] = []
    const result = await runUninstall(false, collectSteps(steps))

    expect(result.success).toBe(true)
    expect(result.detail).toContain('successfully')
  })
})
