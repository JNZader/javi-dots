import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}))

import fs from 'fs'
import { execFile } from 'child_process'
import { configureKiteguardHooks, runKiteguardSetup } from './kiteguard.js'
import { SECURITY_GUARD_PATH } from '../constants.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function mockReadFile(pathMap: Record<string, string | null>) {
  ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
    const content = pathMap[p]
    if (content === null || content === undefined) {
      throw new Error('ENOENT')
    }
    return content
  })
}

function mockExecFile(cmdMap: Record<string, boolean>) {
  ;(execFile as unknown as Mock).mockImplementation((cmd: string, args?: string[]) => {
    const key = args ? `${cmd} ${args.join(' ')}` : cmd
    // Check if any key in cmdMap is a prefix of the actual command
    for (const [pattern, success] of Object.entries(cmdMap)) {
      if (key.includes(pattern)) {
        if (success) return Promise.resolve({ stdout: '/usr/bin/' + cmd, stderr: '' })
        return Promise.reject(new Error(`${cmd} not found`))
      }
    }
    // Default: command not found
    return Promise.reject(new Error(`${cmd} not found`))
  })
}

// ── configureKiteguardHooks ─────────────────────────────────────────────────
describe('configureKiteguardHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates settings.json with all 4 hooks when it does not exist', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = configureKiteguardHooks(false)

    expect(result.action).toBe('created')
    expect(result.hooksConfigured).toBe(4)
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

    const written = (fs.writeFileSync as Mock).mock.calls[0]![1] as string
    const parsed = JSON.parse(written)
    expect(parsed.hooks.UserPromptSubmit).toHaveLength(1)
    expect(parsed.hooks.PreToolUse).toHaveLength(1)
    expect(parsed.hooks.PostToolUse).toHaveLength(1)
    expect(parsed.hooks.Stop).toHaveLength(1)
    expect(parsed.hooks.PreToolUse[0].command).toBe('kiteguard hook PreToolUse')
  })

  it('appends to existing hooks without removing them', () => {
    const existing = {
      hooks: {
        PreToolUse: [{ type: 'command', command: `bash ${SECURITY_GUARD_PATH}` }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(existing))

    const result = configureKiteguardHooks(false)

    expect(result.action).toBe('updated')
    const written = (fs.writeFileSync as Mock).mock.calls[0]![1] as string
    const parsed = JSON.parse(written)
    // Existing security-guard.sh should still be there
    expect(parsed.hooks.PreToolUse).toHaveLength(2)
    expect(parsed.hooks.PreToolUse[0].command).toContain('security-guard.sh')
    expect(parsed.hooks.PreToolUse[1].command).toBe('kiteguard hook PreToolUse')
  })

  it('returns already-installed when all kiteguard hooks exist', () => {
    const existing = {
      hooks: {
        UserPromptSubmit: [{ type: 'command', command: 'kiteguard hook UserPromptSubmit' }],
        PreToolUse: [{ type: 'command', command: 'kiteguard hook PreToolUse' }],
        PostToolUse: [{ type: 'command', command: 'kiteguard hook PostToolUse' }],
        Stop: [{ type: 'command', command: 'kiteguard hook Stop' }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(existing))

    const result = configureKiteguardHooks(false)

    expect(result.action).toBe('already-installed')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('does not write in dry-run mode', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = configureKiteguardHooks(true)

    expect(result.action).toBe('created')
    expect(result.hooksConfigured).toBe(4)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('handles invalid JSON in settings.json gracefully', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('broken {{{')

    const result = configureKiteguardHooks(false)

    expect(result.action).toBe('updated')
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('is idempotent — does not duplicate hooks on repeated install', () => {
    // First install creates hooks
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    configureKiteguardHooks(false)

    // Get what was written and use it as existing settings
    const firstWrite = (fs.writeFileSync as Mock).mock.calls[0]![1] as string
    vi.clearAllMocks()
    ;(fs.readFileSync as Mock).mockReturnValue(firstWrite)

    const result = configureKiteguardHooks(false)

    expect(result.action).toBe('already-installed')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })
})

// ── runKiteguardSetup ───────────────────────────────────────────────────────
describe('runKiteguardSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips binary install when kiteguard already exists', async () => {
    mockExecFile({ 'which kiteguard': true })
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const steps: Array<{ id: string; status: string }> = []
    const result = await runKiteguardSetup(false, (step) => steps.push({ id: step.id, status: step.status }))

    expect(result.binaryAction).toBe('existed')
    expect(result.hookAction).toBe('created')
  })

  it('installs via cargo when binary missing and cargo available', async () => {
    ;(execFile as unknown as Mock).mockImplementation((cmd: string, args?: string[]) => {
      const fullCmd = args ? `${cmd} ${args.join(' ')}` : cmd
      if (fullCmd.includes('which kiteguard')) return Promise.reject(new Error('not found'))
      if (fullCmd.includes('which cargo')) return Promise.resolve({ stdout: '/usr/bin/cargo', stderr: '' })
      if (fullCmd.includes('cargo install kiteguard')) return Promise.resolve({ stdout: '', stderr: '' })
      return Promise.reject(new Error('not found'))
    })
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = await runKiteguardSetup(false)

    expect(result.binaryAction).toBe('installed')
  })

  it('reports skipped when binary missing and cargo not available', async () => {
    mockExecFile({ 'which kiteguard': false, 'which cargo': false })
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const steps: Array<{ id: string; status: string; detail?: string }> = []
    const result = await runKiteguardSetup(false, (step) => steps.push({ id: step.id, status: step.status, detail: step.detail }))

    expect(result.binaryAction).toBe('skipped')
    expect(result.hooksConfigured).toBe(0)
    const lastStep = steps[steps.length - 1]
    expect(lastStep?.status).toBe('skipped')
    expect(lastStep?.detail).toContain('cargo not found')
  })

  it('respects dry-run mode', async () => {
    mockExecFile({ 'which kiteguard': false })
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = await runKiteguardSetup(true)

    // In dry-run, binary detection still runs, but no cargo install or file writes
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })
})
