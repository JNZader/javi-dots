import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { FIXED_ROOT, FIXED_MANIFEST, FIXED_PROFILE } = vi.hoisted(() => {
  const p = require('path')
  const o = require('os')
  const root = p.join(o.tmpdir(), `javi-dots-replication-${Date.now()}`)
  return {
    FIXED_ROOT: root as string,
    FIXED_MANIFEST: p.join(root, 'manifest.json') as string,
    FIXED_PROFILE: p.join(root, 'replication-profile.json') as string,
  }
})

vi.mock('../constants.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants.js')>()
  return {
    ...actual,
    MANIFEST_PATH: FIXED_MANIFEST,
    REPLICATION_PROFILE_PATH: FIXED_PROFILE,
    DEFAULT_MCP_SERVERS: [
      { name: 'engram', npmPackage: 'engram', command: 'engram', args: ['mcp'] },
      { name: 'filesystem', npmPackage: 'filesystem', command: 'npx', args: ['filesystem'] },
    ],
  }
})

import {
  createPortableReplicationProfile,
  exportPortableReplicationProfile,
  isPortableReplicationPath,
  writePortableReplicationProfile,
} from './replication.js'

describe('portable replication profile', () => {
  beforeEach(() => {
    fs.rmSync(FIXED_ROOT, { recursive: true, force: true })
    fs.mkdirSync(FIXED_ROOT, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(FIXED_ROOT, { recursive: true, force: true })
  })

  it('creates a minimal Claude profile when no manifest exists', () => {
    const profile = createPortableReplicationProfile(new Date('2026-05-16T00:00:00.000Z'))

    expect(profile.version).toBe(1)
    expect(profile.generatedAt).toBe('2026-05-16T00:00:00.000Z')
    expect(profile.clis).toEqual(['claude'])
    expect(profile.preset).toBe('minimal')
    expect(profile.features).toContain('skills')
    expect(profile.features).toContain('configs')
    expect(profile.tools).toContain('engram')
    expect(profile.tools).toContain('agent-teams-lite')
    expect(profile.mcpServers).toEqual(['engram', 'filesystem'])
  })

  it('derives CLIs and optional tools from javi-dots manifest', () => {
    fs.writeFileSync(FIXED_MANIFEST, JSON.stringify({
      version: '0.1.0',
      installedAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
      clis: ['claude', 'opencode', 'codex'],
      engram: true,
      sdd: true,
      ghagga: true,
      kiteguard: true,
      rtk: true,
    }))

    const profile = createPortableReplicationProfile(new Date('2026-05-16T00:00:00.000Z'))

    expect(profile.clis).toEqual(['claude', 'opencode', 'codex'])
    expect(profile.preset).toBe('full')
    expect(profile.tools).toEqual(expect.arrayContaining(['ghagga', 'kiteguard', 'rtk']))
  })

  it('writes profile JSON to the configured path', () => {
    const profile = createPortableReplicationProfile(new Date('2026-05-16T00:00:00.000Z'))
    const writtenPath = writePortableReplicationProfile(profile)

    expect(writtenPath).toBe(FIXED_PROFILE)
    expect(JSON.parse(fs.readFileSync(FIXED_PROFILE, 'utf-8'))).toMatchObject({
      version: 1,
      source: 'javi-dots',
    })
  })

  it('exports to a custom path', () => {
    const targetPath = path.join(FIXED_ROOT, 'nested', 'profile.json')
    const profile = exportPortableReplicationProfile(targetPath)

    expect(profile.version).toBe(1)
    expect(fs.existsSync(targetPath)).toBe(true)
  })

  it('rejects sensitive and runtime paths from portable replication', () => {
    const blocked = [
      path.join(os.homedir(), '.claude', '.credentials.json'),
      path.join(os.homedir(), '.codex', 'auth.json'),
      path.join(os.homedir(), '.gemini', 'oauth_creds.json'),
      path.join(os.homedir(), '.qwen', 'debug', 'trace.log'),
      path.join(os.homedir(), '.codex', 'sessions', '2026', 'session.jsonl'),
      path.join(os.homedir(), '.claude', 'paste-cache', 'blob.txt'),
      path.join(os.homedir(), '.codex', 'state_5.sqlite'),
      path.join(os.homedir(), '.env.local'),
    ]

    for (const filePath of blocked) {
      expect(isPortableReplicationPath(filePath), filePath).toBe(false)
    }
  })

  it('allows managed portable config paths', () => {
    const allowed = [
      path.join(os.homedir(), '.claude', 'CLAUDE.md'),
      path.join(os.homedir(), '.claude', 'settings.json'),
      path.join(os.homedir(), '.codex', 'config.toml'),
      path.join(os.homedir(), '.gemini', 'settings.json'),
      path.join(os.homedir(), '.copilot', 'instructions', 'base-rules.instructions.md'),
    ]

    for (const filePath of allowed) {
      expect(isPortableReplicationPath(filePath), filePath).toBe(true)
    }
  })
})
