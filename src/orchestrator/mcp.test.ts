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
  detectConfigured,
  installServer,
  validateServer,
  runMcpSetup,
} from './mcp.js'
import type { McpServerDef } from '../types/index.js'

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

const testServer: McpServerDef = {
  name: 'test-server',
  npmPackage: '@test/mcp-server',
  command: 'test-bin',
  args: ['--serve'],
}

// ── detectConfigured ────────────────────────────────────────────────────────
describe('detectConfigured', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty set when no config files exist', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = detectConfigured()
    expect(result.size).toBe(0)
  })

  it('detects servers from mcpServers key', () => {
    const config = {
      mcpServers: {
        engram: { command: 'engram', args: ['mcp'] },
        filesystem: { command: 'npx', args: ['-y', '@anthropic/filesystem-mcp'] },
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(config))

    const result = detectConfigured()
    expect(result.has('engram')).toBe(true)
    expect(result.has('filesystem')).toBe(true)
    expect(result.size).toBe(2)
  })

  it('skips invalid JSON gracefully', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('not json {{{')

    const result = detectConfigured()
    expect(result.size).toBe(0)
  })

  it('returns empty set when mcpServers key is absent', () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ someOther: true }))

    const result = detectConfigured()
    expect(result.size).toBe(0)
  })
})

// ── installServer ───────────────────────────────────────────────────────────
describe('installServer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns installed with dry-run detail when dryRun is true', async () => {
    const result = await installServer(testServer, '/tmp/test.json', true)

    expect(result.status).toBe('installed')
    expect(result.detail).toBe('dry-run')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('creates config file with server entry when file does not exist', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const result = await installServer(testServer, '/tmp/test.json', false)

    expect(result.status).toBe('installed')
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

    const written = JSON.parse((fs.writeFileSync as Mock).mock.calls[0][1] as string)
    expect(written.mcpServers['test-server']).toEqual({
      command: 'test-bin',
      args: ['--serve'],
    })
  })

  it('merges into existing config without overwriting other servers', async () => {
    const existing = {
      mcpServers: {
        'other-server': { command: 'other', args: [] },
      },
      someKey: 'preserved',
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(existing))
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const result = await installServer(testServer, '/tmp/test.json', false)

    expect(result.status).toBe('installed')
    const written = JSON.parse((fs.writeFileSync as Mock).mock.calls[0][1] as string)
    expect(written.mcpServers['other-server']).toEqual({ command: 'other', args: [] })
    expect(written.mcpServers['test-server']).toEqual({ command: 'test-bin', args: ['--serve'] })
    expect(written.someKey).toBe('preserved')
  })

  it('creates directory if it does not exist', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    await installServer(testServer, '/tmp/new-dir/test.json', false)

    expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/new-dir', { recursive: true })
  })
})

// ── validateServer ──────────────────────────────────────────────────────────
describe('validateServer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns true when command binary exists in PATH', async () => {
    whichRouted({ 'test-bin': '/usr/bin/test-bin' })
    expect(await validateServer(testServer)).toBe(true)
  })

  it('returns false when command binary is not found', async () => {
    whichRouted({ 'test-bin': null })
    expect(await validateServer(testServer)).toBe(false)
  })

  it('handles commands with arguments by checking first token', async () => {
    const serverWithArgs: McpServerDef = {
      name: 'complex',
      npmPackage: '@test/complex',
      command: 'npx',
      args: ['-y', 'some-package'],
    }
    whichRouted({ npx: '/usr/bin/npx' })
    expect(await validateServer(serverWithArgs)).toBe(true)
  })
})

// ── runMcpSetup ─────────────────────────────────────────────────────────────
describe('runMcpSetup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marks already-configured servers as already-present', async () => {
    const config = {
      mcpServers: {
        engram: { command: 'engram', args: ['mcp'] },
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(config))
    ;(fs.existsSync as Mock).mockReturnValue(true)
    whichRouted({ npx: '/usr/bin/npx', engram: '/usr/bin/engram' })

    const result = await runMcpSetup(false)

    const engramResult = result.results.find(r => r.server.name === 'engram')
    expect(engramResult).toBeDefined()
    expect(engramResult!.status).toBe('already-present')
  })

  it('installs missing servers', async () => {
    // No servers configured
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    ;(fs.existsSync as Mock).mockReturnValue(true)
    whichRouted({ npx: '/usr/bin/npx', engram: '/usr/bin/engram' })

    const result = await runMcpSetup(false)

    const installed = result.results.filter(r => r.status === 'installed')
    expect(installed.length).toBeGreaterThan(0)
  })

  it('returns dry-run results without writing files', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = await runMcpSetup(true)

    const installed = result.results.filter(r => r.status === 'installed')
    expect(installed.length).toBeGreaterThan(0)
    for (const r of installed) {
      expect(r.detail).toBe('dry-run')
    }
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('returns configPath pointing to claude.json', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = await runMcpSetup(true)

    expect(result.configPath).toContain('.claude.json')
  })
})
