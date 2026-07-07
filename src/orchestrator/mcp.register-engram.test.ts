import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  registerEngramMcpForCli,
  resolveEngramConfigPath,
} from './mcp.js'
import type { AI_CLI } from '../types/index.js'

let tmpHome = ''

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'javi-mcp-test-'))
})

afterEach(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch {}
})

describe('resolveEngramConfigPath', () => {
  it('returns the per-CLI canonical config path', () => {
    const cases: Array<{ cli: AI_CLI; expected: string }> = [
      { cli: 'claude', expected: path.join(tmpHome, '.claude.json') },
      { cli: 'opencode', expected: path.join(tmpHome, '.config', 'opencode', 'opencode.json') },
      { cli: 'gemini', expected: path.join(tmpHome, '.gemini', 'settings.json') },
      { cli: 'qwen', expected: path.join(tmpHome, '.qwen', 'settings.json') },
      { cli: 'copilot', expected: path.join(tmpHome, '.copilot', 'mcp.json') },
    ]
    for (const { cli, expected } of cases) {
      expect(resolveEngramConfigPath(cli, tmpHome)).toBe(expected)
    }
  })

  it('returns codex config path (TOML — caller must skip)', () => {
    expect(resolveEngramConfigPath('codex', tmpHome)).toBe(path.join(tmpHome, '.codex', 'config.toml'))
  })
})

describe('registerEngramMcpForCli', () => {
  it('writes engram entry to ~/.claude.json when file does not exist (action: created)', async () => {
    const r = await registerEngramMcpForCli('claude', tmpHome)
    expect(r.action).toBe('created')
    expect(r.configPath).toBe(path.join(tmpHome, '.claude.json'))
    const raw = fs.readFileSync(r.configPath, 'utf-8')
    const parsed = JSON.parse(raw) as { mcpServers: { engram: { command: string[]; args: string[]; type: string } } }
    expect(parsed.mcpServers.engram).toEqual({
      command: ['engram'],
      args: ['mcp'],
      type: 'local',
    })
  })

  it('deep-merges into an existing opencode.json `mcp` block (action: updated)', async () => {
    const configPath = path.join(tmpHome, '.config', 'opencode', 'opencode.json')
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    const existing = {
      $schema: 'https://opencode.ai/config.json',
      plugin: ['opencode-anthropic-auth@latest'],
      mcp: {
        context7: { url: 'https://mcp.context7.com/mcp', type: 'remote', enabled: true },
      },
      permission: { bash: { '*': 'allow' } },
    }
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2))

    const r = await registerEngramMcpForCli('opencode', tmpHome)

    expect(r.action).toBe('updated')
    expect(r.configPath).toBe(configPath)
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      $schema: string
      plugin: string[]
      mcp: { engram: { command: string[]; args: string[]; type: string }; context7: unknown }
      permission: { bash: { '*': string } }
    }
    // Preserved keys
    expect(parsed.$schema).toBe('https://opencode.ai/config.json')
    expect(parsed.plugin).toEqual(['opencode-anthropic-auth@latest'])
    expect(parsed.permission.bash['*']).toBe('allow')
    // Existing MCP unmodified, engram added
    expect(parsed.mcp.context7).toEqual({ url: 'https://mcp.context7.com/mcp', type: 'remote', enabled: true })
    expect(parsed.mcp.engram).toEqual({ command: ['engram'], args: ['mcp'], type: 'local' })
  })

  it('throws on EACCES (does NOT swallow unlike the prior engram setup <cli> path)', async () => {
    // Create a read-only subdir and pre-place a claude.json inside with
    // read-only perms too so the registerEngramMcpForCli writeFileSync FAILS.
    // Note: registerEngramMcpForCli resolves the config path as
    //   `<home>/.claude.json` for claude — so home = roDir puts the read
    //   attempt at `roDir/.claude.json`.
    const roDir = path.join(tmpHome, 'readonly')
    fs.mkdirSync(roDir, { recursive: true })
    const roFile = path.join(roDir, '.claude.json')
    fs.writeFileSync(roFile, '{}')
    // Lock the file and dir: no writes, no removes, no renames.
    fs.chmodSync(roFile, 0o400) // read-only file
    fs.chmodSync(roDir, 0o500) // read + traverse only (no write/delete)

    try {
      await expect(
        registerEngramMcpForCli('claude', roDir),
      ).rejects.toThrow()
    } finally {
      // Restore perms so afterEach can clean up.
      try { fs.chmodSync(roDir, 0o755) } catch {}
      try { fs.chmodSync(roFile, 0o644) } catch {}
    }
  })

  it('idempotent: second call on same path returns action updated (no duplicate entry)', async () => {
    await registerEngramMcpForCli('claude', tmpHome)
    const r2 = await registerEngramMcpForCli('claude', tmpHome)
    expect(r2.action).toBe('updated')
    const raw = fs.readFileSync(r2.configPath, 'utf-8')
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> }
    const engramCount = Object.keys(parsed.mcpServers).filter((k) => k === 'engram').length
    expect(engramCount).toBe(1)
  })

  it('codex returns action skipped (TOML handled later)', async () => {
    const r = await registerEngramMcpForCli('codex', tmpHome)
    expect(r.action).toBe('skipped')
    expect(r.configPath).toBe(path.join(tmpHome, '.codex', 'config.toml'))
    // No file written for codex in this iteration.
    expect(fs.existsSync(r.configPath)).toBe(false)
  })
})