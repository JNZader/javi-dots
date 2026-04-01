import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

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

import { execFile } from 'child_process'
import fs from 'fs'
import {
  checkEspInstalled,
  checkTmuxAvailable,
  installEspBinding,
  writeToggleScript,
  runEspSetup,
} from './esp.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function whichRouted(bins: Record<string, string | null>) {
  ;(execFile as unknown as Mock).mockImplementation(
    (cmd: string, args: string[], _opts: unknown, cb?: Function) => {
      const callback = (typeof _opts === 'function' ? _opts : cb) as Function
      if (cmd === 'which') {
        const bin = args[0]
        const resolved = bins[bin]
        if (resolved) {
          callback(null, { stdout: resolved, stderr: '' })
        } else {
          callback(new Error(`${bin} not found`))
        }
      } else {
        callback(null, { stdout: '', stderr: '' })
      }
    },
  )
}

// ── checkEspInstalled ────────────────────────────────────────────────────────
describe('checkEspInstalled', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns true when claude-esp is in PATH', async () => {
    whichRouted({ 'claude-esp': '/usr/local/bin/claude-esp' })
    expect(await checkEspInstalled()).toBe(true)
  })

  it('returns false when claude-esp is not found', async () => {
    whichRouted({ 'claude-esp': null })
    expect(await checkEspInstalled()).toBe(false)
  })
})

// ── checkTmuxAvailable ──────────────────────────────────────────────────────
describe('checkTmuxAvailable', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns true when tmux is in PATH', async () => {
    whichRouted({ tmux: '/usr/bin/tmux' })
    expect(await checkTmuxAvailable()).toBe(true)
  })

  it('returns false when tmux is not found', async () => {
    whichRouted({ tmux: null })
    expect(await checkTmuxAvailable()).toBe(false)
  })
})

// ── installEspBinding ───────────────────────────────────────────────────────
describe('installEspBinding', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates new tmux.conf with binding when file does not exist', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = installEspBinding('/tmp/test-tmux.conf')

    expect(result).toEqual({ added: true, alreadyExists: false })
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
    const written = (fs.writeFileSync as Mock).mock.calls[0][1] as string
    expect(written).toContain('bind-key C-e')
    expect(written).toContain('esp-toggle.sh')
  })

  it('appends binding to existing tmux.conf', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('set -g mouse on\n')

    const result = installEspBinding('/tmp/test-tmux.conf')

    expect(result).toEqual({ added: true, alreadyExists: false })
    const written = (fs.writeFileSync as Mock).mock.calls[0][1] as string
    expect(written).toContain('set -g mouse on')
    expect(written).toContain('bind-key C-e')
  })

  it('does not duplicate if binding already exists', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('bind-key C-e run-shell "~/.javi-dots/esp-toggle.sh"\n')

    const result = installEspBinding('/tmp/test-tmux.conf')

    expect(result).toEqual({ added: false, alreadyExists: true })
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('detects existing binding by esp-toggle.sh reference', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('# some config\nbind-key C-e run-shell "/home/user/.javi-dots/esp-toggle.sh"\n')

    const result = installEspBinding('/tmp/test-tmux.conf')

    expect(result).toEqual({ added: false, alreadyExists: true })
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('adds newline before comment if file does not end with newline', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('set -g mouse on')

    installEspBinding('/tmp/test-tmux.conf')

    const written = (fs.writeFileSync as Mock).mock.calls[0][1] as string
    // Should have a newline between existing content and comment
    expect(written).toMatch(/on\n\n# Claude ESP/)
  })
})

// ── writeToggleScript ───────────────────────────────────────────────────────
describe('writeToggleScript', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('writes script and returns path when dir exists', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const scriptPath = writeToggleScript('/tmp/test-dir')

    expect(scriptPath).toBe('/tmp/test-dir/esp-toggle.sh')
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

    const [writtenPath, content, opts] = (fs.writeFileSync as Mock).mock.calls[0]
    expect(writtenPath).toBe('/tmp/test-dir/esp-toggle.sh')
    expect(content).toContain('#!/usr/bin/env bash')
    expect(content).toContain('claude-esp watch')
    expect(content).toContain('JAVI_ESP')
    expect(opts).toEqual({ mode: 0o755, encoding: 'utf-8' })
  })

  it('creates directory if it does not exist', () => {
    ;(fs.existsSync as Mock).mockReturnValue(false)

    writeToggleScript('/tmp/new-dir')

    expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/new-dir', { recursive: true })
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
  })

  it('script contains toggle logic (kill existing or create new)', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)

    writeToggleScript('/tmp/test-dir')

    const content = (fs.writeFileSync as Mock).mock.calls[0][1] as string
    expect(content).toContain('kill-pane')
    expect(content).toContain('split-window')
    expect(content).toContain('30%')
  })
})

// ── runEspSetup ─────────────────────────────────────────────────────────────
describe('runEspSetup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null for binding/script when tmux is missing', async () => {
    whichRouted({ tmux: null, 'claude-esp': '/usr/bin/claude-esp' })

    const result = await runEspSetup()

    expect(result.tmuxAvailable).toBe(false)
    expect(result.espInstalled).toBe(true)
    expect(result.bindingResult).toBeNull()
    expect(result.scriptPath).toBeNull()
  })

  it('returns null for binding/script when claude-esp is missing', async () => {
    whichRouted({ tmux: '/usr/bin/tmux', 'claude-esp': null })

    const result = await runEspSetup()

    expect(result.tmuxAvailable).toBe(true)
    expect(result.espInstalled).toBe(false)
    expect(result.bindingResult).toBeNull()
    expect(result.scriptPath).toBeNull()
  })

  it('installs binding and script when both prerequisites are available', async () => {
    whichRouted({ tmux: '/usr/bin/tmux', 'claude-esp': '/usr/bin/claude-esp' })
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readFileSync as Mock).mockReturnValue('# existing config\n')

    const result = await runEspSetup()

    expect(result.tmuxAvailable).toBe(true)
    expect(result.espInstalled).toBe(true)
    expect(result.bindingResult).toEqual({ added: true, alreadyExists: false })
    expect(result.scriptPath).toContain('esp-toggle.sh')
  })

  it('reports alreadyExists when binding was previously installed', async () => {
    whichRouted({ tmux: '/usr/bin/tmux', 'claude-esp': '/usr/bin/claude-esp' })
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readFileSync as Mock).mockReturnValue('bind-key C-e run-shell "~/.javi-dots/esp-toggle.sh"\n')

    const result = await runEspSetup()

    expect(result.bindingResult).toEqual({ added: false, alreadyExists: true })
    expect(result.scriptPath).toContain('esp-toggle.sh')
  })
})
