import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { SetupStep, Manifest } from '../types/index.js'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('./index.js', () => ({
  runSetup: vi.fn(),
}))

import fs from 'fs'
import { runSetup } from './index.js'
import { runUpdate } from './update.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
const validManifest: Manifest = {
  version: '0.1.0',
  installedAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  clis: ['claude', 'opencode'],
  engram: true,
  sdd: true,
  ghagga: true,
  kiteguard: false,
  rtk: true,
}

function collectSteps(steps: SetupStep[]) {
  return (step: SetupStep) => steps.push({ ...step })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('runUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(runSetup as Mock).mockResolvedValue(undefined)
  })

  it('no manifest: returns { success: false }', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const steps: SetupStep[] = []
    const result = await runUpdate(false, collectSteps(steps))

    expect(result.success).toBe(false)
    expect(result.detail).toContain('No manifest found')
  })

  it('invalid JSON: returns { success: false }', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue('not valid json {{{')

    const steps: SetupStep[] = []
    const result = await runUpdate(false, collectSteps(steps))

    expect(result.success).toBe(false)
  })

  it('valid manifest: calls runSetup with manifest values', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))

    const steps: SetupStep[] = []
    await runUpdate(false, collectSteps(steps))

    expect(runSetup).toHaveBeenCalledWith(
      {
        clis: ['claude', 'opencode'],
        ghagga: true,
        kiteguard: false,
        hookProfile: null,
        agentWorkspace: false,
        dryRun: false,
      },
      expect.any(Function),
    )
  })

  it('returns { success: true } with CLI list', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))

    const steps: SetupStep[] = []
    const result = await runUpdate(false, collectSteps(steps))

    expect(result.success).toBe(true)
    expect(result.detail).toContain('claude')
    expect(result.detail).toContain('opencode')
    // Verify the join separator is ', ' (kills StringLiteral mutant on join)
    expect(result.detail).toContain('claude, opencode')
  })

  it('dryRun forwarded to runSetup', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))

    const steps: SetupStep[] = []
    await runUpdate(true, collectSteps(steps))

    expect(runSetup).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
      expect.any(Function),
    )
  })
})
