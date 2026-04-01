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

import fs from 'fs'
import {
  resolveSkillPath,
  validateDescription,
  shouldEscalate,
  detectHighRiskKeywords,
  createPhases,
  advancePhase,
  formatResult,
  toSlug,
} from './nano.js'

// ── validateDescription ─────────────────────────────────────────────────────
describe('validateDescription', () => {
  it('rejects empty string', () => {
    const result = validateDescription('')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('rejects whitespace-only string', () => {
    const result = validateDescription('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('rejects description under 5 chars', () => {
    const result = validateDescription('fix')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('short')
  })

  it('rejects description over 200 chars', () => {
    const result = validateDescription('a'.repeat(201))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('long')
  })

  it('accepts valid description', () => {
    const result = validateDescription('add retry logic to fetch helper')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts description at exactly 5 chars', () => {
    const result = validateDescription('fix X')
    expect(result.valid).toBe(true)
  })

  it('accepts description at exactly 200 chars', () => {
    const result = validateDescription('a'.repeat(200))
    expect(result.valid).toBe(true)
  })
})

// ── shouldEscalate ──────────────────────────────────────────────────────────
describe('shouldEscalate', () => {
  it('escalates when risk is high', () => {
    const result = shouldEscalate('high', 3)
    expect(result.escalate).toBe(true)
    expect(result.reason).toContain('High')
  })

  it('escalates when risk is High (case insensitive)', () => {
    const result = shouldEscalate('High', 3)
    expect(result.escalate).toBe(true)
  })

  it('escalates when plan exceeds 7 steps', () => {
    const result = shouldEscalate('low', 8)
    expect(result.escalate).toBe(true)
    expect(result.reason).toContain('7 steps')
  })

  it('does not escalate for low risk and <= 7 steps', () => {
    const result = shouldEscalate('low', 5)
    expect(result.escalate).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('does not escalate at exactly 7 steps', () => {
    const result = shouldEscalate('medium', 7)
    expect(result.escalate).toBe(false)
  })
})

// ── detectHighRiskKeywords ──────────────────────────────────────────────────
describe('detectHighRiskKeywords', () => {
  it('detects "breaking" keyword', () => {
    const result = detectHighRiskKeywords('breaking change to the API')
    expect(result).toContain('breaking')
  })

  it('detects "migration" keyword', () => {
    const result = detectHighRiskKeywords('database migration for users table')
    expect(result).toContain('migration')
  })

  it('detects multiple keywords', () => {
    const result = detectHighRiskKeywords('architecture redesign of auth module')
    expect(result).toContain('architecture')
    expect(result).toContain('redesign')
  })

  it('returns empty array when no keywords found', () => {
    const result = detectHighRiskKeywords('add retry logic to fetch helper')
    expect(result).toEqual([])
  })

  it('is case insensitive', () => {
    const result = detectHighRiskKeywords('Breaking change to Migration system')
    expect(result).toContain('breaking')
    expect(result).toContain('migration')
  })
})

// ── createPhases ────────────────────────────────────────────────────────────
describe('createPhases', () => {
  it('returns 4 phases', () => {
    const phases = createPhases()
    expect(phases).toHaveLength(4)
  })

  it('all phases start as pending', () => {
    const phases = createPhases()
    expect(phases.every(p => p.status === 'pending')).toBe(true)
  })

  it('phases are in correct order', () => {
    const phases = createPhases()
    expect(phases.map(p => p.id)).toEqual(['challenge', 'plan', 'build', 'review'])
  })

  it('each phase has a label', () => {
    const phases = createPhases()
    expect(phases.every(p => p.label.length > 0)).toBe(true)
  })
})

// ── advancePhase ────────────────────────────────────────────────────────────
describe('advancePhase', () => {
  it('updates the target phase status', () => {
    const phases = createPhases()
    const updated = advancePhase(phases, 'challenge', 'done')
    const challenge = updated.find(p => p.id === 'challenge')
    expect(challenge?.status).toBe('done')
  })

  it('does not mutate original phases', () => {
    const phases = createPhases()
    advancePhase(phases, 'challenge', 'done')
    expect(phases[0].status).toBe('pending')
  })

  it('adds detail when provided', () => {
    const phases = createPhases()
    const updated = advancePhase(phases, 'plan', 'running', '5 steps')
    const plan = updated.find(p => p.id === 'plan')
    expect(plan?.detail).toBe('5 steps')
  })

  it('leaves other phases unchanged', () => {
    const phases = createPhases()
    const updated = advancePhase(phases, 'build', 'error', 'test failed')
    expect(updated.find(p => p.id === 'challenge')?.status).toBe('pending')
    expect(updated.find(p => p.id === 'plan')?.status).toBe('pending')
    expect(updated.find(p => p.id === 'review')?.status).toBe('pending')
  })
})

// ── formatResult ────────────────────────────────────────────────────────────
describe('formatResult', () => {
  it('formats a successful result', () => {
    const output = formatResult({
      description: 'add retry logic',
      slug: 'add-retry-logic',
      risk: 'low',
      filesModified: 2,
      filesCreated: 1,
      testsPassed: true,
      escalated: false,
      phases: createPhases(),
      skillPath: null,
    })
    expect(output).toContain('## Nano Complete')
    expect(output).toContain('add retry logic')
    expect(output).toContain('2 modified')
    expect(output).toContain('1 created')
    expect(output).toContain('pass')
  })

  it('includes escalation reason when escalated', () => {
    const output = formatResult({
      description: 'redesign auth',
      slug: 'redesign-auth',
      risk: 'high',
      filesModified: 0,
      filesCreated: 0,
      testsPassed: false,
      escalated: true,
      escalationReason: 'Risk is High',
      phases: createPhases(),
      skillPath: null,
    })
    expect(output).toContain('Escalated')
    expect(output).toContain('Risk is High')
  })

  it('shows fail when tests did not pass', () => {
    const output = formatResult({
      description: 'fix bug',
      slug: 'fix-bug',
      risk: 'low',
      filesModified: 1,
      filesCreated: 0,
      testsPassed: false,
      escalated: false,
      phases: createPhases(),
      skillPath: null,
    })
    expect(output).toContain('fail')
  })
})

// ── toSlug ──────────────────────────────────────────────────────────────────
describe('toSlug', () => {
  it('converts spaces to hyphens', () => {
    expect(toSlug('add retry logic')).toBe('add-retry-logic')
  })

  it('lowercases everything', () => {
    expect(toSlug('Fix Auth Bug')).toBe('fix-auth-bug')
  })

  it('removes special characters', () => {
    expect(toSlug('fix: auth (bug)')).toBe('fix-auth-bug')
  })

  it('truncates at 40 characters', () => {
    const long = 'this is a very long description that should be truncated to fit'
    expect(toSlug(long).length).toBeLessThanOrEqual(40)
  })

  it('collapses multiple spaces', () => {
    expect(toSlug('add   retry   logic')).toBe('add-retry-logic')
  })

  it('trims leading and trailing whitespace', () => {
    expect(toSlug('  add retry  ')).toBe('add-retry')
  })
})

// ── resolveSkillPath ────────────────────────────────────────────────────────
describe('resolveSkillPath', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns first existing path', () => {
    ;(fs.existsSync as Mock).mockImplementation((p: string) =>
      p.includes('.claude/skills/nano-mode')
    )
    const result = resolveSkillPath('/home/test')
    expect(result).toContain('nano-mode/SKILL.md')
    expect(result).toContain('.claude')
  })

  it('returns null when no skill file found', () => {
    ;(fs.existsSync as Mock).mockReturnValue(false)
    const result = resolveSkillPath('/home/test')
    expect(result).toBeNull()
  })

  it('falls back to opencode path when claude not found', () => {
    ;(fs.existsSync as Mock).mockImplementation((p: string) =>
      p.includes('.opencode/skills/nano-mode')
    )
    const result = resolveSkillPath('/home/test')
    expect(result).toContain('.opencode')
  })

  it('falls back to manifest dir as last resort', () => {
    ;(fs.existsSync as Mock).mockImplementation((p: string) =>
      p.includes('.javidots/skills/nano-mode')
    )
    const result = resolveSkillPath('/home/test')
    expect(result).toContain('.javidots')
  })
})
