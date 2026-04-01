import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

import { execFile } from 'child_process'
import fs from 'fs'
import { checkClaudeMd, checkSkills, checkMcpConfig, checkHooks, runHealth } from './health.js'

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

function mockExistsSync(pathSet: Set<string>) {
  ;(fs.existsSync as Mock).mockImplementation((p: string) => pathSet.has(p))
}

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

// ── checkClaudeMd ────────────────────────────────────────────────────────────
describe('checkClaudeMd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fs.existsSync as Mock).mockReturnValue(true)
  })

  it('returns empty when CLAUDE.md does not exist', () => {
    mockReadFile({})
    const findings = checkClaudeMd()
    expect(findings).toHaveLength(0)
  })

  it('reports structural finding for oversized CLAUDE.md', () => {
    // Generate content with >5000 whitespace-separated tokens
    const bigContent = Array.from({ length: 6000 }, (_, i) => `word${i}`).join(' ')
    mockReadFile({ [expect.any(String) as unknown as string]: bigContent })
    // Need to mock the actual path — let's use a broader approach
    ;(fs.readFileSync as Mock).mockReturnValue(bigContent)

    const findings = checkClaudeMd()
    const sizeFinding = findings.find(f => f.message.includes('tokens'))
    expect(sizeFinding).toBeDefined()
    expect(sizeFinding!.severity).toBe('structural')
    expect(sizeFinding!.category).toBe('claude-md')
  })

  it('reports no size warning for small CLAUDE.md', () => {
    const smallContent = 'Some simple rules here'
    ;(fs.readFileSync as Mock).mockReturnValue(smallContent)

    const findings = checkClaudeMd()
    const sizeFinding = findings.find(f => f.message.includes('tokens'))
    expect(sizeFinding).toBeUndefined()
  })

  it('detects duplicate rules', () => {
    const content = [
      '# Rules',
      '- Never use console.log in production code',
      '- Always write tests first',
      '- Never use console.log in production code',
      '',
    ].join('\n')
    ;(fs.readFileSync as Mock).mockReturnValue(content)

    const findings = checkClaudeMd()
    const dups = findings.filter(f => f.message.includes('Duplicate'))
    expect(dups).toHaveLength(1)
    expect(dups[0]!.severity).toBe('incremental')
  })

  it('does not flag short or header lines as duplicates', () => {
    const content = [
      '# Section 1',
      '# Section 1',
      '---',
      '---',
      'short',
      'short',
    ].join('\n')
    ;(fs.readFileSync as Mock).mockReturnValue(content)

    const findings = checkClaudeMd()
    const dups = findings.filter(f => f.message.includes('Duplicate'))
    expect(dups).toHaveLength(0)
  })

  it('detects dead file references', () => {
    const content = 'Read the skill at `~/nonexistent/path/SKILL.md` for details.'
    ;(fs.readFileSync as Mock).mockReturnValue(content)
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const findings = checkClaudeMd()
    const deadRefs = findings.filter(f => f.message.includes('Dead file'))
    expect(deadRefs.length).toBeGreaterThanOrEqual(1)
    expect(deadRefs[0]!.severity).toBe('critical')
  })
})

// ── checkSkills ──────────────────────────────────────────────────────────────
describe('checkSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when skills dir does not exist', () => {
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const findings = checkSkills()
    expect(findings).toHaveLength(0)
  })

  it('reports structural finding for directory without SKILL.md', () => {
    ;(fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p.endsWith('skills')) return true
      if (p.endsWith('SKILL.md')) return false
      return true
    })
    ;(fs.readdirSync as Mock).mockReturnValue(['react-19'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })

    const findings = checkSkills()
    const missing = findings.find(f => f.message.includes('no SKILL.md'))
    expect(missing).toBeDefined()
    expect(missing!.severity).toBe('structural')
    expect(missing!.category).toBe('skills')
  })

  it('reports incremental finding for missing frontmatter', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readdirSync as Mock).mockReturnValue(['my-skill'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })
    ;(fs.readFileSync as Mock).mockReturnValue('# My Skill\nNo frontmatter here')

    const findings = checkSkills()
    const fmFinding = findings.find(f => f.message.includes('frontmatter'))
    expect(fmFinding).toBeDefined()
    expect(fmFinding!.severity).toBe('incremental')
  })

  it('reports incremental finding for frontmatter missing name', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readdirSync as Mock).mockReturnValue(['my-skill'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })
    ;(fs.readFileSync as Mock).mockReturnValue('---\ndescription: something\n---\n# Content')

    const findings = checkSkills()
    const fmFinding = findings.find(f => f.message.includes('missing name'))
    expect(fmFinding).toBeDefined()
  })

  it('reports no findings for valid skill with proper frontmatter', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readdirSync as Mock).mockReturnValue(['valid-skill'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })
    ;(fs.readFileSync as Mock).mockReturnValue('---\nname: Valid Skill\ndescription: Does things\n---\n# Content')

    const findings = checkSkills()
    expect(findings).toHaveLength(0)
  })

  it('skips _shared and hidden directories', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readdirSync as Mock).mockReturnValue(['_shared', '.hidden'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })

    const findings = checkSkills()
    expect(findings).toHaveLength(0)
  })
})

// ── checkMcpConfig ───────────────────────────────────────────────────────────
describe('checkMcpConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when no MCP config exists', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const findings = await checkMcpConfig()
    expect(findings).toHaveLength(0)
  })

  it('reports critical finding for invalid JSON', async () => {
    ;(fs.readFileSync as Mock).mockReturnValue('not json {{{')

    const findings = await checkMcpConfig()
    const invalid = findings.find(f => f.message.includes('Invalid JSON'))
    expect(invalid).toBeDefined()
    expect(invalid!.severity).toBe('critical')
    expect(invalid!.category).toBe('mcp')
  })

  it('reports critical finding for missing command binary', async () => {
    const config = {
      mcpServers: {
        myServer: { command: 'nonexistent-bin', args: ['--flag'] },
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(config))
    whichRouted({ 'nonexistent-bin': null })

    const findings = await checkMcpConfig()
    const missing = findings.find(f => f.message.includes('not found in PATH'))
    expect(missing).toBeDefined()
    expect(missing!.severity).toBe('critical')
  })

  it('no finding when command binary exists', async () => {
    const config = {
      mcpServers: {
        myServer: { command: 'npx', args: ['some-tool'] },
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(config))
    whichRouted({ npx: '/usr/bin/npx' })

    const findings = await checkMcpConfig()
    const missing = findings.find(f => f.message.includes('not found'))
    expect(missing).toBeUndefined()
  })

  it('reports structural finding for duplicate tools', async () => {
    const config = {
      mcpServers: {
        server1: { command: 'npx', tools: ['read', 'write'] },
        server2: { command: 'npx', tools: ['write', 'delete'] },
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(config))
    whichRouted({ npx: '/usr/bin/npx' })

    const findings = await checkMcpConfig()
    const dup = findings.find(f => f.message.includes('Duplicate tool'))
    expect(dup).toBeDefined()
    expect(dup!.severity).toBe('structural')
    expect(dup!.message).toContain('write')
  })
})

// ── checkHooks ───────────────────────────────────────────────────────────────
describe('checkHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when settings.json does not exist', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const findings = checkHooks()
    expect(findings).toHaveLength(0)
  })

  it('reports critical finding for invalid JSON', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('broken json')

    const findings = checkHooks()
    const invalid = findings.find(f => f.message.includes('Invalid JSON'))
    expect(invalid).toBeDefined()
    expect(invalid!.severity).toBe('critical')
  })

  it('detects dangerous rm -rf command', () => {
    const settings = {
      hooks: {
        PreToolUse: [{ command: 'bash -c "rm -rf /tmp/stuff"' }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(settings))

    const findings = checkHooks()
    const dangerous = findings.find(f => f.message.includes('rm -rf'))
    expect(dangerous).toBeDefined()
    expect(dangerous!.severity).toBe('critical')
    expect(dangerous!.category).toBe('hooks')
  })

  it('detects dangerous git push --force', () => {
    const settings = {
      hooks: {
        PostToolUse: ['git push --force origin main'],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(settings))

    const findings = checkHooks()
    const dangerous = findings.find(f => f.message.includes('git push --force'))
    expect(dangerous).toBeDefined()
    expect(dangerous!.severity).toBe('critical')
  })

  it('detects dangerous git reset --hard', () => {
    const settings = {
      hooks: {
        PreToolUse: [{ command: 'git reset --hard HEAD~1' }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(settings))

    const findings = checkHooks()
    const dangerous = findings.find(f => f.message.includes('git reset --hard'))
    expect(dangerous).toBeDefined()
    expect(dangerous!.severity).toBe('critical')
  })

  it('reports structural finding for missing script reference', () => {
    const settings = {
      hooks: {
        PreToolUse: [{ command: 'bash ~/.claude/hooks/nonexistent.sh' }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(settings))
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const findings = checkHooks()
    const missing = findings.find(f => f.message.includes('missing script'))
    expect(missing).toBeDefined()
    expect(missing!.severity).toBe('structural')
  })

  it('no findings for safe hooks', () => {
    const settings = {
      hooks: {
        PreToolUse: [{ command: 'echo "hello"' }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(settings))

    const findings = checkHooks()
    expect(findings).toHaveLength(0)
  })

  it('returns empty when hooks key is absent', () => {
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ someOtherKey: true }))

    const findings = checkHooks()
    expect(findings).toHaveLength(0)
  })
})

// ── runHealth ────────────────────────────────────────────────────────────────
describe('runHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when everything is clean', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const findings = await runHealth()
    expect(findings).toHaveLength(0)
  })

  it('sorts findings by severity: critical first', async () => {
    // Create a scenario with mixed severities
    // Oversized CLAUDE.md (structural) + dangerous hook (critical)
    const bigContent = Array.from({ length: 6000 }, (_, i) => `word${i}`).join(' ')
    const settings = {
      hooks: {
        PreToolUse: [{ command: 'rm -rf /tmp' }],
      },
    }

    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('CLAUDE.md')) return bigContent
      if (p.includes('settings.json')) return JSON.stringify(settings)
      throw new Error('ENOENT')
    })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const findings = await runHealth()
    expect(findings.length).toBeGreaterThan(0)

    // Verify critical comes before structural
    const criticalIdx = findings.findIndex(f => f.severity === 'critical')
    const structuralIdx = findings.findIndex(f => f.severity === 'structural')
    if (criticalIdx >= 0 && structuralIdx >= 0) {
      expect(criticalIdx).toBeLessThan(structuralIdx)
    }
  })
})
