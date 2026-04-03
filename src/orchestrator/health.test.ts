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
import {
  checkClaudeMd,
  checkSkills,
  checkMcpConfig,
  checkHooks,
  runHealth,
  analyzeSignalToNoise,
  computeTokenCosts,
  computeScore,
} from './health.js'

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

// ── analyzeSignalToNoise ─────────────────────────────────────────────────────
describe('analyzeSignalToNoise', () => {
  it('returns high ratio for content with many actionable lines', () => {
    const content = [
      '- Rule one: always use strict mode',
      '- Rule two: never skip tests',
      '- Rule three: document everything',
      '* Use TypeScript strict',
      '1. First step instructions',
      '| Column | Value |',
      '| data1 | data2 |',
      'key: value pair here',
      '',
      '# Header',
    ].join('\n')

    const result = analyzeSignalToNoise(content)
    expect(result.ratio).toBeGreaterThanOrEqual(70)
    expect(result.signalLines).toBeGreaterThan(result.noiseLines)
    expect(result.totalLines).toBe(10)
  })

  it('returns low ratio for content with mostly filler', () => {
    const content = [
      '# Section One',
      '',
      'This is some prose that explains things in general terms.',
      '',
      '---',
      '',
      '# Section Two',
      '',
      'More general description without specific instructions.',
      '',
      '<!-- comment -->',
      '',
      '# Section Three',
      '',
      'Yet another paragraph of filler text.',
      '',
      '',
      '',
      '',
      '- One actual rule here',
    ].join('\n')

    const result = analyzeSignalToNoise(content)
    expect(result.ratio).toBeLessThanOrEqual(30)
    expect(result.noiseLines).toBeGreaterThan(result.signalLines)
  })

  it('handles empty content', () => {
    const result = analyzeSignalToNoise('')
    expect(result.totalLines).toBe(1)
    expect(result.ratio).toBe(0)
  })

  it('identifies code blocks as signal', () => {
    const content = [
      '```typescript',
      'const x = 1',
      '```',
    ].join('\n')

    const result = analyzeSignalToNoise(content)
    // code block markers are signal
    expect(result.signalLines).toBeGreaterThanOrEqual(2)
  })
})

// ── computeTokenCosts ───────────────────────────────────────────────────────
describe('computeTokenCosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns entries for existing sources', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readdirSync as Mock).mockReturnValue(['react-19', 'typescript'])
    ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('CLAUDE.md')) return 'word '.repeat(100)
      if (p.includes('SKILL.md')) return 'word '.repeat(50)
      if (p.includes('settings.json')) return 'word '.repeat(20)
      if (p.includes('.claude.json')) return 'word '.repeat(30)
      throw new Error('ENOENT')
    })

    const result = computeTokenCosts()
    expect(result.entries.length).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)

    // Verify sorted descending
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i - 1]!.tokens).toBeGreaterThanOrEqual(result.entries[i]!.tokens)
    }
  })

  it('calculates correct percentages summing to total', () => {
    ;(fs.existsSync as Mock).mockReturnValue(true)
    ;(fs.readdirSync as Mock).mockReturnValue([])
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('CLAUDE.md')) return 'word '.repeat(100)
      throw new Error('ENOENT')
    })

    const result = computeTokenCosts()
    const sum = result.entries.reduce((s, e) => s + e.tokens, 0)
    expect(sum).toBe(result.total)
  })

  it('returns empty breakdown when no files exist', () => {
    ;(fs.existsSync as Mock).mockReturnValue(false)
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = computeTokenCosts()
    expect(result.entries).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ── computeScore ────────────────────────────────────────────────────────────
describe('computeScore', () => {
  it('returns 100 for zero findings with good S/N', () => {
    const snr = { signalLines: 80, noiseLines: 20, totalLines: 100, ratio: 80 }
    const score = computeScore([], snr)
    // 100 + 5 (bonus) = 105, clamped to 100
    expect(score).toBe(100)
  })

  it('returns 100 for zero findings and null S/N', () => {
    const score = computeScore([], null)
    expect(score).toBe(100)
  })

  it('deducts 15 per critical finding', () => {
    const findings = [
      { category: 'claude-md' as const, severity: 'critical' as const, message: 'a', fix: 'b' },
      { category: 'claude-md' as const, severity: 'critical' as const, message: 'c', fix: 'd' },
      { category: 'claude-md' as const, severity: 'critical' as const, message: 'e', fix: 'f' },
    ]
    const score = computeScore(findings, null)
    // 100 - 3*15 = 55
    expect(score).toBe(55)
  })

  it('floors at 0 for many critical findings', () => {
    const findings = Array.from({ length: 10 }, () => ({
      category: 'claude-md' as const,
      severity: 'critical' as const,
      message: 'x',
      fix: 'y',
    }))
    const score = computeScore(findings, null)
    // 100 - 10*15 = -50, clamped to 0
    expect(score).toBe(0)
  })

  it('applies S/N bonus for high ratio', () => {
    const snr = { signalLines: 80, noiseLines: 20, totalLines: 100, ratio: 75 }
    // 1 structural finding: 100 - 8 + 5 = 97
    const findings = [
      { category: 'skills' as const, severity: 'structural' as const, message: 'x', fix: 'y' },
    ]
    const score = computeScore(findings, snr)
    expect(score).toBe(97)
  })

  it('applies S/N penalty for low ratio', () => {
    const snr = { signalLines: 10, noiseLines: 90, totalLines: 100, ratio: 10 }
    const score = computeScore([], snr)
    // 100 - 10 = 90
    expect(score).toBe(90)
  })

  it('applies excessive token penalty', () => {
    const score = computeScore([], null, 15_000)
    // 100 - 10 = 90
    expect(score).toBe(90)
  })

  it('combines all deductions correctly', () => {
    const findings = [
      { category: 'claude-md' as const, severity: 'critical' as const, message: 'a', fix: 'b' },
      { category: 'skills' as const, severity: 'structural' as const, message: 'c', fix: 'd' },
    ]
    const snr = { signalLines: 10, noiseLines: 90, totalLines: 100, ratio: 10 }
    const score = computeScore(findings, snr, 15_000)
    // 100 - 15 - 8 - 10 (snr penalty) - 10 (token penalty) = 57
    expect(score).toBe(57)
  })
})

// ── runHealth ────────────────────────────────────────────────────────────────
describe('runHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns HealthReport with empty findings when everything is clean', async () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const report = await runHealth()
    expect(report.findings).toHaveLength(0)
    expect(report.score).toBe(100)
    expect(report.tokenCosts).toBeDefined()
    expect(report.tokenCosts.entries).toHaveLength(0)
    expect(report.signalToNoise).toBeNull()
  })

  it('returns HealthReport shape with all required fields', async () => {
    const content = '- A rule line here\n'.repeat(20)
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('CLAUDE.md')) return content
      throw new Error('ENOENT')
    })
    ;(fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p.includes('CLAUDE.md') || p.includes('.claude')) return true
      return false
    })

    const report = await runHealth()
    expect(report).toHaveProperty('findings')
    expect(report).toHaveProperty('score')
    expect(report).toHaveProperty('tokenCosts')
    expect(report).toHaveProperty('signalToNoise')
    expect(typeof report.score).toBe('number')
    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
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

    const report = await runHealth()
    const findings = report.findings
    expect(findings.length).toBeGreaterThan(0)

    // Verify critical comes before structural
    const criticalIdx = findings.findIndex(f => f.severity === 'critical')
    const structuralIdx = findings.findIndex(f => f.severity === 'structural')
    if (criticalIdx >= 0 && structuralIdx >= 0) {
      expect(criticalIdx).toBeLessThan(structuralIdx)
    }
  })
})
