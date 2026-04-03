import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

import fs from 'fs'
import {
  loadCache,
  saveCache,
  parseSessionFile,
  scanSessions,
  aggregateByPeriod,
  runTelemetry,
} from './telemetry.js'
import type { TelemetryCache, TelemetrySession, SetupStep } from '../types/index.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFakeJSONL(...entries: Array<Record<string, unknown>>): string {
  return entries.map(e => JSON.stringify(e)).join('\n') + '\n'
}

function makeSession(overrides: Partial<TelemetrySession> = {}): TelemetrySession {
  return {
    sessionId: 'test-session-1',
    projectDir: 'my-project',
    startTime: 1711929600000, // 2024-04-01 00:00:00 UTC
    endTime: 1711933200000,   // 2024-04-01 01:00:00 UTC
    durationMinutes: 60,
    inputTokens: 5000,
    outputTokens: 3000,
    cacheReadTokens: 1000,
    cacheWriteTokens: 500,
    totalCost: 0.05,
    model: 'claude-sonnet-4-20250514',
    toolCalls: { Read: 10, Bash: 5 },
    messageCount: 15,
    ...overrides,
  }
}

function collectSteps(steps: SetupStep[]) {
  return (step: SetupStep) => {
    const idx = steps.findIndex(s => s.id === step.id)
    if (idx >= 0) steps[idx] = step
    else steps.push(step)
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── loadCache ──────────────────────────────────────────────────────────
  describe('loadCache', () => {
    it('returns empty cache when file does not exist', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)
      const cache = loadCache()
      expect(cache.version).toBe(1)
      expect(cache.sessions).toEqual({})
      expect(cache.lastScanAt).toBe(0)
    })

    it('returns parsed cache when file is valid', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      const mockCache: TelemetryCache = {
        version: 1,
        lastScanAt: 1000,
        sessions: { 'abc': makeSession({ sessionId: 'abc' }) },
      }
      ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockCache))

      const cache = loadCache()
      expect(cache.version).toBe(1)
      expect(cache.lastScanAt).toBe(1000)
      expect(cache.sessions['abc']).toBeDefined()
      expect(cache.sessions['abc']!.sessionId).toBe('abc')
    })

    it('returns empty cache when file contains invalid JSON', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue('not json{{{')

      const cache = loadCache()
      expect(cache.sessions).toEqual({})
    })

    it('returns empty cache when sessions field is missing', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ version: 1 }))

      const cache = loadCache()
      expect(cache.sessions).toEqual({})
    })
  })

  // ── saveCache ──────────────────────────────────────────────────────────
  describe('saveCache', () => {
    it('writes JSON to temp path and renames atomically', () => {
      const cache: TelemetryCache = {
        version: 1,
        lastScanAt: Date.now(),
        sessions: {},
      }

      saveCache(cache)

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.javidots'),
        { recursive: true },
      )
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('telemetry.json.tmp'),
        expect.stringContaining('"version": 1'),
      )
      expect(fs.renameSync).toHaveBeenCalledWith(
        expect.stringContaining('telemetry.json.tmp'),
        expect.stringContaining('telemetry.json'),
      )
    })

    it('writes valid JSON including sessions', () => {
      const cache: TelemetryCache = {
        version: 1,
        lastScanAt: 999,
        sessions: { 'x': makeSession({ sessionId: 'x' }) },
      }

      saveCache(cache)

      const writtenContent = (fs.writeFileSync as Mock).mock.calls[0][1] as string
      const parsed = JSON.parse(writtenContent)
      expect(parsed.version).toBe(1)
      expect(parsed.sessions['x'].sessionId).toBe('x')
    })
  })

  // ── parseSessionFile ───────────────────────────────────────────────────
  describe('parseSessionFile', () => {
    it('returns null when file does not exist', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)
      expect(parseSessionFile('/nonexistent.jsonl')).toBeNull()
    })

    it('returns null for empty file', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue('')
      expect(parseSessionFile('/empty.jsonl')).toBeNull()
    })

    it('extracts tokens, cost, model, tools from JSONL', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(makeFakeJSONL(
        { timestamp: 1000, usage: { input_tokens: 100, output_tokens: 50 }, costUSD: 0.01, model: 'claude-sonnet-4-20250514' },
        { timestamp: 2000, usage: { input_tokens: 200, output_tokens: 100, cache_read_input_tokens: 50 }, costUSD: 0.02, model: 'claude-sonnet-4-20250514' },
        { timestamp: 3000, tool_name: 'Read' },
        { timestamp: 4000, tool_name: 'Read' },
        { timestamp: 5000, tool_name: 'Bash' },
      ))

      const session = parseSessionFile('/projects/myproj/abc.jsonl')
      expect(session).not.toBeNull()
      expect(session!.inputTokens).toBe(300)
      expect(session!.outputTokens).toBe(150)
      expect(session!.cacheReadTokens).toBe(50)
      expect(session!.totalCost).toBeCloseTo(0.03)
      expect(session!.model).toBe('claude-sonnet-4-20250514')
      expect(session!.toolCalls['Read']).toBe(2)
      expect(session!.toolCalls['Bash']).toBe(1)
      expect(session!.messageCount).toBe(2)
      expect(session!.startTime).toBe(1000)
      expect(session!.endTime).toBe(5000)
    })

    it('skips malformed JSON lines gracefully', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(
        '{"timestamp":1000,"usage":{"input_tokens":100,"output_tokens":50},"costUSD":0.01,"model":"sonnet"}\nnot json at all\n{"timestamp":2000}\n'
      )

      const session = parseSessionFile('/projects/myproj/abc.jsonl')
      expect(session).not.toBeNull()
      expect(session!.inputTokens).toBe(100)
    })

    it('determines primary model by highest count', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(makeFakeJSONL(
        { timestamp: 1000, model: 'sonnet' },
        { timestamp: 2000, model: 'sonnet' },
        { timestamp: 3000, model: 'opus' },
      ))

      const session = parseSessionFile('/projects/myproj/abc.jsonl')
      expect(session!.model).toBe('sonnet')
    })
  })

  // ── scanSessions ───────────────────────────────────────────────────────
  describe('scanSessions', () => {
    it('returns unchanged cache when projects dir does not exist', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)

      const cache: TelemetryCache = { version: 1, lastScanAt: 0, sessions: {} }
      const result = scanSessions(cache)
      expect(result.sessions).toEqual({})
      expect(result.lastScanAt).toBeGreaterThan(0)
    })

    it('parses new sessions and skips cached ones', () => {
      const existingSession = makeSession({ sessionId: 'already-cached' })
      const cache: TelemetryCache = {
        version: 1,
        lastScanAt: 100,
        sessions: { 'already-cached': existingSession },
      }

      ;(fs.existsSync as Mock).mockImplementation((p: string) => {
        if (p.includes('projects')) return true
        // parseSessionFile checks
        return true
      })
      ;(fs.readdirSync as Mock).mockImplementation((p: string) => {
        if (p.includes('projects') && !p.includes('/')) return ['my-project']
        // Check if it's the projects dir itself
        if (p.endsWith('projects')) return ['my-project']
        // project dir contents
        return ['already-cached.jsonl', 'new-session.jsonl']
      })
      ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })
      ;(fs.readFileSync as Mock).mockReturnValue(makeFakeJSONL(
        { timestamp: 5000, usage: { input_tokens: 100, output_tokens: 50 }, costUSD: 0.01, model: 'sonnet' },
      ))

      const result = scanSessions(cache)

      // Should keep cached session
      expect(result.sessions['already-cached']).toBeDefined()
      // Should parse new session
      expect(result.sessions['new-session']).toBeDefined()
      expect(result.sessions['new-session']!.inputTokens).toBe(100)
    })

    it('handles empty projects directory', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readdirSync as Mock).mockReturnValue([])

      const cache: TelemetryCache = { version: 1, lastScanAt: 0, sessions: {} }
      const result = scanSessions(cache)
      expect(Object.keys(result.sessions)).toHaveLength(0)
    })
  })

  // ── aggregateByPeriod ──────────────────────────────────────────────────
  describe('aggregateByPeriod', () => {
    it('groups sessions by day correctly', () => {
      const sessions: TelemetrySession[] = [
        makeSession({ sessionId: 's1', startTime: new Date('2026-04-01T10:00:00Z').getTime(), inputTokens: 1000, outputTokens: 500, totalCost: 0.01 }),
        makeSession({ sessionId: 's2', startTime: new Date('2026-04-01T14:00:00Z').getTime(), inputTokens: 2000, outputTokens: 1000, totalCost: 0.02 }),
        makeSession({ sessionId: 's3', startTime: new Date('2026-04-02T10:00:00Z').getTime(), inputTokens: 500, outputTokens: 200, totalCost: 0.005 }),
      ]

      const result = aggregateByPeriod(sessions, 'daily')
      expect(result).toHaveLength(2)

      // Results are sorted descending, so 04-02 first
      const day2 = result.find(r => r.period === '2026-04-02')
      const day1 = result.find(r => r.period === '2026-04-01')

      expect(day1).toBeDefined()
      expect(day1!.sessionCount).toBe(2)
      expect(day1!.totalTokens).toBe(4500)
      expect(day1!.totalCost).toBeCloseTo(0.03)

      expect(day2).toBeDefined()
      expect(day2!.sessionCount).toBe(1)
      expect(day2!.totalTokens).toBe(700)
    })

    it('groups sessions by week correctly', () => {
      // Two sessions in the same ISO week, one in a different week
      const sessions: TelemetrySession[] = [
        makeSession({ sessionId: 's1', startTime: new Date('2026-04-06T10:00:00Z').getTime() }), // Monday W15
        makeSession({ sessionId: 's2', startTime: new Date('2026-04-07T10:00:00Z').getTime() }), // Tuesday W15
        makeSession({ sessionId: 's3', startTime: new Date('2026-04-13T10:00:00Z').getTime() }), // Monday W16
      ]

      const result = aggregateByPeriod(sessions, 'weekly')
      expect(result).toHaveLength(2)

      const week15 = result.find(r => r.period.includes('W15'))
      const week16 = result.find(r => r.period.includes('W16'))
      expect(week15!.sessionCount).toBe(2)
      expect(week16!.sessionCount).toBe(1)
    })

    it('groups sessions by month correctly', () => {
      const sessions: TelemetrySession[] = [
        makeSession({ sessionId: 's1', startTime: new Date('2026-03-15T10:00:00Z').getTime() }),
        makeSession({ sessionId: 's2', startTime: new Date('2026-04-01T10:00:00Z').getTime() }),
        makeSession({ sessionId: 's3', startTime: new Date('2026-04-20T10:00:00Z').getTime() }),
      ]

      const result = aggregateByPeriod(sessions, 'monthly')
      expect(result).toHaveLength(2)

      const april = result.find(r => r.period === '2026-04')
      const march = result.find(r => r.period === '2026-03')
      expect(april!.sessionCount).toBe(2)
      expect(march!.sessionCount).toBe(1)
    })

    it('computes top models and tools per period', () => {
      const sessions: TelemetrySession[] = [
        makeSession({
          sessionId: 's1',
          startTime: new Date('2026-04-01T10:00:00Z').getTime(),
          model: 'sonnet',
          toolCalls: { Read: 10, Bash: 5 },
        }),
        makeSession({
          sessionId: 's2',
          startTime: new Date('2026-04-01T14:00:00Z').getTime(),
          model: 'opus',
          toolCalls: { Read: 3, Edit: 7 },
        }),
      ]

      const result = aggregateByPeriod(sessions, 'daily')
      const day = result[0]!
      expect(day.topModels).toHaveLength(2)
      expect(day.topTools.length).toBeGreaterThanOrEqual(3)
      // Read should be the top tool (10 + 3 = 13)
      expect(day.topTools[0]!.tool).toBe('Read')
      expect(day.topTools[0]!.count).toBe(13)
    })

    it('skips sessions with no startTime', () => {
      const sessions: TelemetrySession[] = [
        makeSession({ sessionId: 's1', startTime: 0 }),
        makeSession({ sessionId: 's2', startTime: new Date('2026-04-01T10:00:00Z').getTime() }),
      ]

      const result = aggregateByPeriod(sessions, 'daily')
      expect(result).toHaveLength(1)
    })
  })

  // ── runTelemetry ───────────────────────────────────────────────────────
  describe('runTelemetry', () => {
    it('reports skipped when no projects dir exists', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)

      const steps: SetupStep[] = []
      await runTelemetry('summary', collectSteps(steps))

      const scan = steps.find(s => s.id === 'scan')
      expect(scan).toBeDefined()
      expect(scan!.status).toBe('skipped')
      expect(scan!.detail).toContain('no Claude Code session data')
    })

    it('reports skipped when no sessions are found', async () => {
      ;(fs.existsSync as Mock).mockImplementation((p: string) => {
        if (p.includes('projects')) return true
        if (p.includes('telemetry.json')) return false
        return false
      })
      ;(fs.readdirSync as Mock).mockReturnValue([])

      const steps: SetupStep[] = []
      await runTelemetry('summary', collectSteps(steps))

      const scan = steps.find(s => s.id === 'scan')
      expect(scan!.status).toBe('skipped')
      expect(scan!.detail).toContain('no sessions')
    })

    it('reports full summary for valid sessions', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('telemetry.json')) {
          return JSON.stringify({ version: 1, lastScanAt: 0, sessions: {} })
        }
        return makeFakeJSONL(
          { timestamp: 1000, usage: { input_tokens: 5000, output_tokens: 3000 }, costUSD: 0.05, model: 'sonnet' },
          { timestamp: 60000, tool_name: 'Read' },
          { timestamp: 120000, tool_name: 'Bash' },
        )
      })
      ;(fs.readdirSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('projects')) return ['my-project']
        return ['session-1.jsonl']
      })
      ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })

      const steps: SetupStep[] = []
      await runTelemetry('summary', collectSteps(steps))

      expect(steps.find(s => s.id === 'scan')!.status).toBe('done')
      expect(steps.find(s => s.id === 'sessions')!.detail).toBe('1')
      expect(steps.find(s => s.id === 'tokens')!.detail).toContain('K')
      expect(steps.find(s => s.id === 'cost')!.detail).toContain('$')
      expect(steps.find(s => s.id === 'duration')!.detail).toContain('min')
    })

    it('reports session listing for sessions mode', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('telemetry.json')) {
          return JSON.stringify({ version: 1, lastScanAt: 0, sessions: {} })
        }
        return makeFakeJSONL(
          { timestamp: 1711929600000, usage: { input_tokens: 100, output_tokens: 50 }, costUSD: 0.01, model: 'sonnet' },
        )
      })
      ;(fs.readdirSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('projects')) return ['my-project']
        return ['sess-abc.jsonl']
      })
      ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })

      const steps: SetupStep[] = []
      await runTelemetry('sessions', collectSteps(steps))

      // Should have a session detail step
      const sessionStep = steps.find(s => s.id.startsWith('s-'))
      expect(sessionStep).toBeDefined()
      expect(sessionStep!.detail).toContain('sonnet')
    })

    it('reports period aggregation for daily mode', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('telemetry.json')) {
          return JSON.stringify({ version: 1, lastScanAt: 0, sessions: {} })
        }
        return makeFakeJSONL(
          { timestamp: new Date('2026-04-01T10:00:00Z').getTime(), usage: { input_tokens: 100, output_tokens: 50 }, costUSD: 0.01, model: 'sonnet' },
        )
      })
      ;(fs.readdirSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('projects')) return ['proj']
        return ['sess1.jsonl']
      })
      ;(fs.statSync as Mock).mockReturnValue({ isDirectory: () => true })

      const steps: SetupStep[] = []
      await runTelemetry('daily', collectSteps(steps))

      const periodStep = steps.find(s => s.id.startsWith('p-'))
      expect(periodStep).toBeDefined()
      expect(periodStep!.detail).toContain('sessions')
      expect(periodStep!.detail).toContain('tokens')
    })
  })
})
