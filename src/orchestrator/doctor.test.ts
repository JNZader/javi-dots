import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Manifest } from '../types/index.js'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

import { execFile } from 'child_process'
import fs from 'fs'
import { runDoctor } from './doctor.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function whichRouted(bins: Record<string, string | null>) {
  ;(execFile as unknown as Mock).mockImplementation(
    (cmd: string, args: string[], _opts: unknown, cb?: Function) => {
      const callback = (typeof _opts === 'function' ? _opts : cb) as Function
      if (cmd === 'which') {
        const bin = args[0]
        const path = bins[bin]
        if (path) {
          callback(null, { stdout: path, stderr: '' })
        } else {
          callback(new Error(`${bin} not found`))
        }
      } else {
        callback(null, { stdout: '', stderr: '' })
      }
    },
  )
}

const validManifest: Manifest = {
  version: '0.1.0',
  installedAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  clis: ['claude', 'opencode'],
  engram: true,
  sdd: true,
  ghagga: false,
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('runDoctor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fs.existsSync as Mock).mockReturnValue(false)
  })

  // ── Manifest checks ──────────────────────────────────────────────────────
  it('manifest exists and valid: ok with installedAt', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    whichRouted({ 'javi-ai': '/usr/bin/javi-ai', engram: '/usr/bin/engram', git: '/usr/bin/git', ghagga: null })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const { checks, manifest } = await runDoctor()

    const manifestCheck = checks.find((c) => c.name === 'javidots manifest')
    expect(manifestCheck).toBeDefined()
    expect(manifestCheck!.status).toBe('ok')
    expect(manifestCheck!.detail).toContain('2025-01-01')
    expect(manifest).toBeDefined()
  })

  it('manifest missing: fail with instruction', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const { checks, manifest } = await runDoctor()

    const manifestCheck = checks.find((c) => c.name === 'javidots manifest')
    expect(manifestCheck!.status).toBe('fail')
    expect(manifestCheck!.detail).toContain('npx javidots')
    expect(manifest).toBeNull()
  })

  it('manifest invalid JSON: fail', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue('not valid json {{{')
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const { checks } = await runDoctor()

    const manifestCheck = checks.find((c) => c.name === 'javidots manifest')
    expect(manifestCheck!.status).toBe('fail')
  })

  // ── Binary checks ────────────────────────────────────────────────────────
  it('javi-ai found: ok', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': '/usr/local/bin/javi-ai', engram: null, git: null, ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'javi-ai')
    expect(check!.status).toBe('ok')
  })

  it('javi-ai not found: fail', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'javi-ai')
    expect(check!.status).toBe('fail')
  })

  it('engram found: ok', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: '/usr/local/bin/engram', git: null, ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'engram')
    expect(check!.status).toBe('ok')
  })

  it('engram not found: fail', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'engram')
    expect(check!.status).toBe('fail')
  })

  it('git found: ok', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: '/usr/bin/git', ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'git')
    expect(check!.status).toBe('ok')
  })

  it('git not found: fail', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'git')
    expect(check!.status).toBe('fail')
  })

  // ── agent-teams-lite dir ─────────────────────────────────────────────────
  it('ATL dir exists: ok', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'agent-teams-lite')
    expect(check!.status).toBe('ok')
  })

  it('ATL dir absent: fail', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'agent-teams-lite')
    expect(check!.status).toBe('fail')
  })

  // ── ghagga ────────────────────────────────────────────────────────────────
  it('ghagga not found: skip (NOT fail)', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })

    const { checks } = await runDoctor()
    const check = checks.find((c) => c.name === 'ghagga')
    expect(check!.status).toBe('skip')
    expect(check!.status).not.toBe('fail')
  })

  // ── Dynamic CLI checks ───────────────────────────────────────────────────
  it('manifest with clis: dynamic CLI checks emitted for each', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validManifest))
    whichRouted({
      'javi-ai': '/usr/bin/javi-ai',
      engram: '/usr/bin/engram',
      git: '/usr/bin/git',
      ghagga: null,
      claude: '/usr/bin/claude',
      opencode: '/usr/bin/opencode',
    })
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const { checks } = await runDoctor()

    const claudeCheck = checks.find((c) => c.name === 'CLI: claude')
    expect(claudeCheck).toBeDefined()
    expect(claudeCheck!.status).toBe('ok')

    const opencodeCheck = checks.find((c) => c.name === 'CLI: opencode')
    expect(opencodeCheck).toBeDefined()
    expect(opencodeCheck!.status).toBe('ok')
  })

  it('null manifest: no dynamic CLI checks', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    whichRouted({ 'javi-ai': null, engram: null, git: null, ghagga: null })

    const { checks } = await runDoctor()

    const cliChecks = checks.filter((c) => c.name.startsWith('CLI:'))
    expect(cliChecks).toHaveLength(0)
  })
})
