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
  loadSecurityRules,
  saveSecurityRules,
  generateGuardScript,
  generateHookEntry,
  installSecurityHook,
  runSecurityAudit,
  runSecurityInstall,
} from './security.js'
import { DEFAULT_SECURITY_RULES, SECURITY_GUARD_PATH } from '../constants.js'

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

// ── loadSecurityRules ────────────────────────────────────────────────────────
describe('loadSecurityRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default rules when no custom rules file exists', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const { rules, source } = loadSecurityRules()
    expect(source).toBe('default')
    expect(rules).toEqual(DEFAULT_SECURITY_RULES)
  })

  it('returns custom rules when valid file exists', () => {
    const customRules = [
      { id: 'custom-1', pattern: 'evil', category: 'custom', description: 'Block evil', enabled: true },
    ]
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(customRules))

    const { rules, source } = loadSecurityRules()
    expect(source).toBe('custom')
    expect(rules).toEqual(customRules)
  })

  it('returns default rules when file contains invalid JSON', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('not json {{{')

    const { rules, source } = loadSecurityRules()
    expect(source).toBe('default')
    expect(rules).toEqual(DEFAULT_SECURITY_RULES)
  })

  it('returns default rules when file contains empty array', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('[]')

    const { rules, source } = loadSecurityRules()
    expect(source).toBe('default')
  })
})

// ── saveSecurityRules ────────────────────────────────────────────────────────
describe('saveSecurityRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes rules as JSON to the expected path', () => {
    const rules = [
      { id: 'r1', pattern: 'rm', category: 'destructive' as const, description: 'Block rm', enabled: true },
    ]
    saveSecurityRules(rules)

    expect(fs.mkdirSync).toHaveBeenCalled()
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('security-rules.json'),
      JSON.stringify(rules, null, 2),
    )
  })
})

// ── generateGuardScript ──────────────────────────────────────────────────────
describe('generateGuardScript', () => {
  it('generates bash script with grep checks for enabled rules', () => {
    const rules = [
      { id: 'rm-rf', pattern: 'rm\\s+-rf', category: 'destructive' as const, description: 'Block rm -rf', enabled: true },
      { id: 'disabled', pattern: 'echo', category: 'custom' as const, description: 'Disabled rule', enabled: false },
    ]

    const script = generateGuardScript(rules)

    expect(script).toContain('#!/usr/bin/env bash')
    expect(script).toContain('rm\\s+-rf')
    expect(script).toContain('BLOCKED by javi-dots security [rm-rf]')
    expect(script).not.toContain('disabled')
    expect(script).toContain('exit 0')
  })

  it('generates script with no checks when all rules disabled', () => {
    const rules = [
      { id: 'r1', pattern: 'rm', category: 'destructive' as const, description: 'X', enabled: false },
    ]

    const script = generateGuardScript(rules)
    expect(script).not.toContain('grep')
    expect(script).toContain('exit 0')
  })
})

// ── generateHookEntry ────────────────────────────────────────────────────────
describe('generateHookEntry', () => {
  it('returns a command hook entry referencing security-guard.sh', () => {
    const entry = generateHookEntry()

    expect(entry.type).toBe('command')
    expect(entry.command).toContain('security-guard.sh')
    expect(entry.command).toContain('bash')
  })
})

// ── installSecurityHook ──────────────────────────────────────────────────────
describe('installSecurityHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates settings.json when it does not exist', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = installSecurityHook(false)

    expect(result.action).toBe('created')
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.json'),
      expect.stringContaining('security-guard.sh'),
    )
  })

  it('appends to existing PreToolUse hooks', () => {
    const existing = {
      hooks: {
        PreToolUse: [{ type: 'command', command: 'echo existing' }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(existing))

    const result = installSecurityHook(false)

    expect(result.action).toBe('updated')
    const written = (fs.writeFileSync as Mock).mock.calls[0]![1] as string
    const parsed = JSON.parse(written)
    expect(parsed.hooks.PreToolUse).toHaveLength(2)
    expect(parsed.hooks.PreToolUse[0].command).toBe('echo existing')
    expect(parsed.hooks.PreToolUse[1].command).toContain('security-guard.sh')
  })

  it('returns already-installed when hook exists', () => {
    const existing = {
      hooks: {
        PreToolUse: [{ type: 'command', command: `bash ${SECURITY_GUARD_PATH}` }],
      },
    }
    ;(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(existing))

    const result = installSecurityHook(false)

    expect(result.action).toBe('already-installed')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('does not write in dry-run mode', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = installSecurityHook(true)

    expect(result.action).toBe('created')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('handles invalid JSON in settings.json gracefully', () => {
    ;(fs.readFileSync as Mock).mockReturnValue('broken {{{')

    const result = installSecurityHook(false)

    expect(result.action).toBe('updated')
    expect(fs.writeFileSync).toHaveBeenCalled()
  })
})

// ── runSecurityAudit ─────────────────────────────────────────────────────────
describe('runSecurityAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports full coverage with default rules and hook installed', () => {
    // loadSecurityRules reads security-rules.json, readSettings reads settings.json
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('security-rules.json')) {
        throw new Error('ENOENT')
      }
      if (p.includes('settings.json')) {
        return JSON.stringify({
          hooks: { PreToolUse: [{ type: 'command', command: `bash ${SECURITY_GUARD_PATH}` }] },
        })
      }
      throw new Error('ENOENT')
    })
    ;(fs.existsSync as Mock).mockReturnValue(true)

    const audit = runSecurityAudit()

    expect(audit.hookInstalled).toBe(true)
    expect(audit.guardScriptExists).toBe(true)
    expect(audit.enabledRules).toBe(DEFAULT_SECURITY_RULES.length)
    expect(audit.missingCategories).toHaveLength(0)
    expect(audit.categories.length).toBeGreaterThan(0)
  })

  it('reports missing coverage when no hooks installed', () => {
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('settings.json')) {
        return JSON.stringify({})
      }
      throw new Error('ENOENT')
    })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const audit = runSecurityAudit()

    expect(audit.hookInstalled).toBe(false)
    expect(audit.guardScriptExists).toBe(false)
  })

  it('identifies missing categories when rules are partial', () => {
    const partialRules = [
      { id: 'r1', pattern: 'rm', category: 'destructive', description: 'X', enabled: true },
    ]
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('security-rules.json')) {
        return JSON.stringify(partialRules)
      }
      if (p.includes('settings.json')) {
        return JSON.stringify({})
      }
      throw new Error('ENOENT')
    })
    ;(fs.existsSync as Mock).mockReturnValue(false)

    const audit = runSecurityAudit()

    expect(audit.missingCategories).toContain('remote-exec')
    expect(audit.missingCategories).toContain('reverse-shell')
    expect(audit.missingCategories).toContain('credential-read')
    expect(audit.missingCategories).not.toContain('destructive')
  })
})

// ── runSecurityInstall ───────────────────────────────────────────────────────
describe('runSecurityInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('installs with default rules on fresh system', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = runSecurityInstall(false)

    expect(result.rulesSource).toBe('default')
    expect(result.rulesCount).toBe(DEFAULT_SECURITY_RULES.length)
    expect(result.hookAction).toBe('created')
    // Should have written: security-rules.json, security-guard.sh, settings.json
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3)
  })

  it('does not write files in dry-run mode', () => {
    ;(fs.readFileSync as Mock).mockImplementation(() => { throw new Error('ENOENT') })

    const result = runSecurityInstall(true)

    expect(result.rulesSource).toBe('default')
    expect(result.hookAction).toBe('created')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('uses custom rules when available', () => {
    const customRules = [
      { id: 'c1', pattern: 'evil', category: 'custom', description: 'Block evil', enabled: true },
    ]
    ;(fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes('security-rules.json')) {
        return JSON.stringify(customRules)
      }
      throw new Error('ENOENT')
    })

    const result = runSecurityInstall(false)

    expect(result.rulesSource).toBe('custom')
    expect(result.rulesCount).toBe(1)
    // Custom rules → should NOT rewrite rules file, only guard + settings
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2)
  })
})
