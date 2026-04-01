import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}))

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => Buffer.from('deadbeef', 'hex')),
  },
  randomBytes: vi.fn(() => Buffer.from('deadbeef', 'hex')),
}))

import fs from 'fs'
import {
  ensureWolfDir,
  getCurrentSessionId,
  getSessionPath,
  recordEvent,
  parseSessionFile,
  detectRepeatedReads,
  getSessionReport,
  listSessions,
  runTokenReport,
} from './tokens.js'
import type { TokenEvent, SetupStep } from '../types/index.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeEvents(...types: Array<{ type: string; file?: string; tokens?: number }>): string {
  return types
    .map(t => JSON.stringify({ ...t, timestamp: Date.now() }))
    .join('\n') + '\n'
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── ensureWolfDir ───────────────────────────────────────────────────────
  describe('ensureWolfDir', () => {
    it('creates .wolf/sessions/ directory recursively', () => {
      ensureWolfDir()
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.wolf/sessions'),
        { recursive: true },
      )
    })
  })

  // ── getCurrentSessionId ─────────────────────────────────────────────────
  describe('getCurrentSessionId', () => {
    it('returns date-hash format', () => {
      const id = getCurrentSessionId()
      expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-f0-9]+$/)
    })
  })

  // ── getSessionPath ──────────────────────────────────────────────────────
  describe('getSessionPath', () => {
    it('returns path ending in .jsonl', () => {
      const p = getSessionPath('2026-03-31-abc123')
      expect(p).toContain('.wolf/sessions/2026-03-31-abc123.jsonl')
    })
  })

  // ── recordEvent ─────────────────────────────────────────────────────────
  describe('recordEvent', () => {
    it('appends event as JSON line to session file', () => {
      recordEvent('test-session', { type: 'file-read', file: '/src/app.ts' })

      expect(fs.mkdirSync).toHaveBeenCalled()
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-session.jsonl'),
        expect.stringContaining('"type":"file-read"'),
      )
    })

    it('returns event with timestamp', () => {
      const event = recordEvent('test-session', { type: 'session-start' })
      expect(event.timestamp).toBeGreaterThan(0)
      expect(event.type).toBe('session-start')
    })
  })

  // ── parseSessionFile ────────────────────────────────────────────────────
  describe('parseSessionFile', () => {
    it('returns empty array when file does not exist', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)
      expect(parseSessionFile('/nonexistent.jsonl')).toEqual([])
    })

    it('parses valid JSONL lines', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(
        makeEvents(
          { type: 'session-start' },
          { type: 'file-read', file: '/a.ts' },
        ),
      )

      const events = parseSessionFile('/test.jsonl')
      expect(events).toHaveLength(2)
      expect(events[0]!.type).toBe('session-start')
      expect(events[1]!.type).toBe('file-read')
    })

    it('skips malformed lines', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(
        '{"type":"session-start","timestamp":1}\nnot json\n{"type":"output","timestamp":2}\n',
      )

      const events = parseSessionFile('/test.jsonl')
      expect(events).toHaveLength(2)
    })
  })

  // ── detectRepeatedReads ─────────────────────────────────────────────────
  describe('detectRepeatedReads', () => {
    it('returns empty when no file is read enough times', () => {
      const events: TokenEvent[] = [
        { type: 'file-read', timestamp: 1, file: '/a.ts' },
        { type: 'file-read', timestamp: 2, file: '/b.ts' },
      ]
      expect(detectRepeatedReads(events)).toEqual([])
    })

    it('detects files read at or above threshold', () => {
      const events: TokenEvent[] = [
        { type: 'file-read', timestamp: 1, file: '/a.ts' },
        { type: 'file-read', timestamp: 2, file: '/a.ts' },
        { type: 'file-read', timestamp: 3, file: '/a.ts' },
        { type: 'file-read', timestamp: 4, file: '/b.ts' },
      ]
      const repeated = detectRepeatedReads(events, 3)
      expect(repeated).toEqual(['/a.ts'])
    })

    it('sorts by read count descending', () => {
      const events: TokenEvent[] = [
        ...Array.from({ length: 3 }, () => ({ type: 'file-read' as const, timestamp: 1, file: '/a.ts' })),
        ...Array.from({ length: 5 }, () => ({ type: 'file-read' as const, timestamp: 1, file: '/b.ts' })),
      ]
      const repeated = detectRepeatedReads(events, 3)
      expect(repeated).toEqual(['/b.ts', '/a.ts'])
    })

    it('ignores non-file-read events', () => {
      const events: TokenEvent[] = [
        { type: 'tool-call', timestamp: 1, tool: 'Bash' },
        { type: 'tool-call', timestamp: 2, tool: 'Bash' },
        { type: 'tool-call', timestamp: 3, tool: 'Bash' },
      ]
      expect(detectRepeatedReads(events)).toEqual([])
    })

    it('ignores file-read events without file field', () => {
      const events: TokenEvent[] = [
        { type: 'file-read', timestamp: 1 },
        { type: 'file-read', timestamp: 2 },
        { type: 'file-read', timestamp: 3 },
      ]
      expect(detectRepeatedReads(events)).toEqual([])
    })
  })

  // ── getSessionReport ────────────────────────────────────────────────────
  describe('getSessionReport', () => {
    it('returns zeroed report for missing session', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)

      const report = getSessionReport('nonexistent')
      expect(report.events).toBe(0)
      expect(report.totalTokens).toBe(0)
      expect(report.topFiles).toEqual([])
      expect(report.repeatedReads).toEqual([])
    })

    it('aggregates events correctly', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readFileSync as Mock).mockReturnValue(
        makeEvents(
          { type: 'session-start' },
          { type: 'file-read', file: '/a.ts', tokens: 500 },
          { type: 'file-read', file: '/a.ts', tokens: 500 },
          { type: 'file-read', file: '/a.ts', tokens: 500 },
          { type: 'tool-call', tokens: 200 },
          { type: 'output', tokens: 1000 },
          { type: 'session-end' },
        ),
      )

      const report = getSessionReport('test-session')
      expect(report.events).toBe(7)
      expect(report.byType['file-read']).toBe(3)
      expect(report.byType['session-start']).toBe(1)
      expect(report.totalTokens).toBe(2700)
      expect(report.topFiles[0]).toEqual({ file: '/a.ts', reads: 3 })
      expect(report.repeatedReads).toContain('/a.ts')
    })
  })

  // ── listSessions ────────────────────────────────────────────────────────
  describe('listSessions', () => {
    it('returns empty array when wolf dir does not exist', () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)
      expect(listSessions()).toEqual([])
    })

    it('lists sessions sorted reverse chronologically', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readdirSync as Mock).mockReturnValue([
        '2026-03-29-aaa.jsonl',
        '2026-03-31-ccc.jsonl',
        '2026-03-30-bbb.jsonl',
      ])

      const sessions = listSessions()
      expect(sessions).toEqual([
        '2026-03-31-ccc',
        '2026-03-30-bbb',
        '2026-03-29-aaa',
      ])
    })

    it('filters non-jsonl files', () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readdirSync as Mock).mockReturnValue([
        '2026-03-31-abc.jsonl',
        '.DS_Store',
        'readme.txt',
      ])

      expect(listSessions()).toEqual(['2026-03-31-abc'])
    })
  })

  // ── runTokenReport ──────────────────────────────────────────────────────
  describe('runTokenReport', () => {
    it('reports skipped when no .wolf dir', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(false)

      const steps: SetupStep[] = []
      await runTokenReport(step => {
        const idx = steps.findIndex(s => s.id === step.id)
        if (idx >= 0) steps[idx] = step
        else steps.push(step)
      })

      const scan = steps.find(s => s.id === 'scan')
      expect(scan).toBeDefined()
      expect(scan!.status).toBe('skipped')
      expect(scan!.detail).toContain('no .wolf/')
    })

    it('reports skipped when no sessions exist', async () => {
      ;(fs.existsSync as Mock).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('sessions')) return true
        return false
      })
      ;(fs.readdirSync as Mock).mockReturnValue([])

      const steps: SetupStep[] = []
      await runTokenReport(step => {
        const idx = steps.findIndex(s => s.id === step.id)
        if (idx >= 0) steps[idx] = step
        else steps.push(step)
      })

      const scan = steps.find(s => s.id === 'scan')
      expect(scan!.status).toBe('skipped')
    })

    it('reports full breakdown for valid session', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readdirSync as Mock).mockReturnValue(['2026-03-31-abc.jsonl'])
      ;(fs.readFileSync as Mock).mockReturnValue(
        makeEvents(
          { type: 'session-start' },
          { type: 'file-read', file: '/a.ts', tokens: 1000 },
          { type: 'output', tokens: 500 },
          { type: 'session-end' },
        ),
      )

      const steps: SetupStep[] = []
      await runTokenReport(step => {
        const idx = steps.findIndex(s => s.id === step.id)
        if (idx >= 0) steps[idx] = step
        else steps.push(step)
      })

      expect(steps.find(s => s.id === 'scan')!.status).toBe('done')
      expect(steps.find(s => s.id === 'events')!.detail).toBe('4')
      expect(steps.find(s => s.id === 'tokens')!.detail).toContain('2K')
      expect(steps.find(s => s.id === 'repeated')!.status).toBe('done')
    })

    it('reports repeated reads as error status', async () => {
      ;(fs.existsSync as Mock).mockReturnValue(true)
      ;(fs.readdirSync as Mock).mockReturnValue(['2026-03-31-abc.jsonl'])
      ;(fs.readFileSync as Mock).mockReturnValue(
        makeEvents(
          { type: 'file-read', file: '/a.ts' },
          { type: 'file-read', file: '/a.ts' },
          { type: 'file-read', file: '/a.ts' },
        ),
      )

      const steps: SetupStep[] = []
      await runTokenReport(step => {
        const idx = steps.findIndex(s => s.id === step.id)
        if (idx >= 0) steps[idx] = step
        else steps.push(step)
      })

      const repeated = steps.find(s => s.id === 'repeated')
      expect(repeated).toBeDefined()
      expect(repeated!.status).toBe('error')
      expect(repeated!.detail).toContain('/a.ts')
    })
  })
})
