import { describe, it, expect } from 'vitest'
import os from 'os'
import path from 'path'
import {
  HOME, MANIFEST_DIR, MANIFEST_PATH, CLI_OPTIONS,
  TELEMETRY_CACHE_PATH, TELEMETRY_CACHE_VERSION, CLAUDE_PROJECTS_DIR, TELEMETRY_PERIODS,
} from './constants.js'

describe('constants', () => {
  it('HOME equals os.homedir()', () => {
    expect(HOME).toBe(os.homedir())
  })

  it('MANIFEST_DIR is HOME/.javidots', () => {
    expect(MANIFEST_DIR).toBe(path.join(os.homedir(), '.javidots'))
  })

  it('MANIFEST_PATH is HOME/.javidots/manifest.json', () => {
    expect(MANIFEST_PATH).toBe(path.join(os.homedir(), '.javidots', 'manifest.json'))
  })

  it('TELEMETRY_CACHE_PATH is HOME/.javidots/telemetry.json', () => {
    expect(TELEMETRY_CACHE_PATH).toBe(path.join(os.homedir(), '.javidots', 'telemetry.json'))
  })

  it('TELEMETRY_CACHE_VERSION is 1', () => {
    expect(TELEMETRY_CACHE_VERSION).toBe(1)
  })

  it('CLAUDE_PROJECTS_DIR is HOME/.claude/projects', () => {
    expect(CLAUDE_PROJECTS_DIR).toBe(path.join(os.homedir(), '.claude', 'projects'))
  })

  it('TELEMETRY_PERIODS has daily, weekly, monthly', () => {
    expect(TELEMETRY_PERIODS).toEqual(['daily', 'weekly', 'monthly'])
  })

  it('CLI_OPTIONS has 6 entries with correct ids', () => {
    expect(CLI_OPTIONS).toHaveLength(6)
    const ids = CLI_OPTIONS.map((o) => o.id)
    expect(ids).toEqual(['claude', 'opencode', 'gemini', 'qwen', 'codex', 'copilot'])

    // Also verify labels are non-empty and match expected values (kills label StringLiteral mutants)
    const labels = CLI_OPTIONS.map((o) => o.label)
    expect(labels).toEqual([
      'Claude Code',
      'OpenCode',
      'Gemini CLI',
      'Qwen',
      'Codex CLI',
      'GitHub Copilot',
    ])
  })
})
