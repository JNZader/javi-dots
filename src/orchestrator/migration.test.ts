import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock child_process for invocation-assertion tests. The real-tar behavior
// tests live in migration.tar.test.ts (no mock).
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile } from 'child_process'
import type { Mock } from 'vitest'
import { migrateFromAtl, migrateSkillDir } from './migration.js'
import type { SetupStep } from '../types/index.js'

function mockExecSequence(steps: Array<{ stdout?: string; stderr?: string; fail?: boolean }>): void {
  let i = 0
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: unknown, _opts: unknown, cb?: Function) => {
      const step = steps[i++] ?? steps[steps.length - 1]
      const callback = typeof _opts === 'function' ? _opts : cb
      if (typeof callback !== 'function') return
      if (step.fail) {
        const err = new Error(step.stderr ?? '') as Error & { stdout?: string; stderr?: string }
        err.stderr = step.stderr ?? ''
        err.stdout = step.stdout ?? ''
        callback(err, { stdout: step.stdout ?? '', stderr: step.stderr ?? '' })
      } else {
        callback(null, { stdout: step.stdout ?? '', stderr: step.stderr ?? '' })
      }
    },
  )
}

let tmpHome = ''
let tmpManifest = ''

beforeEach(() => {
  ;(execFile as unknown as Mock).mockReset()
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'javi-migration-home-'))
  tmpManifest = path.join(tmpHome, '.javidots')
  fs.mkdirSync(tmpManifest, { recursive: true })
})

afterEach(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch {}
})

describe('migrateFromAtl', () => {
  it('returns success + skipped step when no ATL dir exists', async () => {
    const steps: SetupStep[] = []
    const result = await migrateFromAtl(false, (s) => steps.push(s), tmpManifest, false)
    expect(result.success).toBe(true)
    expect(result.detail).toMatch(/No ATL dir/)
    expect(steps.find((s) => s.id === 'migrate-from-atl')?.status).toBe('skipped')
    expect(execFile).not.toHaveBeenCalled()
  })

  it('invokes gentle-ai install with --agent <list>, --preset full-gentleman, --persona custom, GENTLE_AI_YES=1', async () => {
    const atlDir = path.join(tmpManifest, 'agent-teams-lite')
    fs.mkdirSync(atlDir, { recursive: true })
    fs.writeFileSync(path.join(atlDir, 'marker.txt'), 'x')
    fs.writeFileSync(
      path.join(tmpManifest, 'manifest.json'),
      JSON.stringify({ clis: ['claude', 'opencode'] }),
    )

    const calls: { cmd: string; args: string[]; env?: NodeJS.ProcessEnv }[] = []
    ;(execFile as unknown as Mock).mockImplementation(
      (cmd: string, args: string[], opts: unknown, cb?: Function) => {
        const callback = typeof opts === 'function' ? opts : cb
        let env: NodeJS.ProcessEnv | undefined
        if (opts && typeof opts === 'object' && 'env' in (opts as Record<string, unknown>)) {
          env = (opts as { env?: NodeJS.ProcessEnv }).env
        }
        if (args[0] === '-czf') {
          // Tar mock — write a placeholder so the rename in the module succeeds.
          fs.writeFileSync(args[1] as string, '')
        }
        calls.push({ cmd, args, env })
        if (typeof callback === 'function') callback(null, { stdout: '', stderr: '' })
      },
    )

    const result = await migrateFromAtl(false, () => {}, tmpManifest, true)

    expect(result.success).toBe(true)
    const gentleAiCall = calls.find((c) => c.cmd === 'gentle-ai')
    expect(gentleAiCall).toBeDefined()
    expect(gentleAiCall?.args).toEqual([
      'install', '--agent', 'claude-code,opencode',
      '--preset', 'full-gentleman', '--persona', 'custom',
    ])
    expect(gentleAiCall?.env?.GENTLE_AI_YES).toBe('1')
  })

  it('reports error when backup fails (does NOT remove ATL dir)', async () => {
    const atlDir = path.join(tmpManifest, 'agent-teams-lite')
    fs.mkdirSync(atlDir, { recursive: true })
    fs.writeFileSync(path.join(atlDir, 'marker.txt'), 'x')

    mockExecSequence([{ fail: true, stderr: 'tar broke' }])

    const result = await migrateFromAtl(false, () => {}, tmpManifest, false)

    expect(result.success).toBe(false)
    expect(result.detail).toMatch(/backup failed: tar broke/)
    expect(fs.existsSync(atlDir)).toBe(true)
  })

  it('dry-run returns success without invoking execFile', async () => {
    const atlDir = path.join(tmpManifest, 'agent-teams-lite')
    fs.mkdirSync(atlDir, { recursive: true })
    fs.writeFileSync(path.join(atlDir, 'marker.txt'), 'x')

    const result = await migrateFromAtl(true, () => {}, tmpManifest, false)

    expect(result.success).toBe(true)
    expect(result.detail).toMatch(/dry-run/)
    expect(fs.existsSync(atlDir)).toBe(true)
    expect(execFile).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(tmpManifest, 'backups'))).toBe(false)
  })

  it('is idempotent: second run is a skip no-op after a successful migration', async () => {
    const atlDir = path.join(tmpManifest, 'agent-teams-lite')
    fs.mkdirSync(atlDir, { recursive: true })
    fs.writeFileSync(path.join(atlDir, 'marker.txt'), 'x')

    // First run: mock tar to write placeholder so rename succeeds.
    ;(execFile as unknown as Mock).mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb?: Function) => {
        const callback = typeof _opts === 'function' ? _opts : cb
        if (typeof callback !== 'function') return
        if (args[0] === '-czf') fs.writeFileSync(args[1] as string, '')
        callback(null, { stdout: '', stderr: '' })
      },
    )

    const first = await migrateFromAtl(false, () => {}, tmpManifest, false)
    expect(first.success).toBe(true)
    expect(fs.existsSync(atlDir)).toBe(false)

    ;(execFile as unknown as Mock).mockReset()
    const second = await migrateFromAtl(false, () => {}, tmpManifest, false)
    expect(second.success).toBe(true)
    expect(second.detail).toMatch(/No ATL dir/)
  })
})

describe('migrateSkillDir', () => {
  it('returns success + skipped step when no legacy skill/ dir exists', async () => {
    const steps: SetupStep[] = []
    const result = await migrateSkillDir(false, (s) => steps.push(s), tmpHome)
    expect(result.success).toBe(true)
    expect(result.detail).toMatch(/No legacy skill/)
    expect(steps.find((s) => s.id === 'migrate-skill-dir')?.status).toBe('skipped')
  })

  it('removes empty legacy dir even when there are no skill entries', async () => {
    const opencodeConfig = path.join(tmpHome, '.config', 'opencode')
    const legacy = path.join(opencodeConfig, 'skill')
    fs.mkdirSync(legacy, { recursive: true })
    fs.writeFileSync(path.join(legacy, '.hidden'), 'x')

    const result = await migrateSkillDir(false, () => {}, tmpHome)

    expect(result.success).toBe(true)
    expect(result.detail).toMatch(/empty legacy skill dir removed/)
    expect(fs.existsSync(legacy)).toBe(false)
  })

  it('dry-run does not modify filesystem', async () => {
    const opencodeConfig = path.join(tmpHome, '.config', 'opencode')
    const legacy = path.join(opencodeConfig, 'skill')
    fs.mkdirSync(path.join(legacy, 'would-move'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'would-move', 'SKILL.md'), 'x')

    const result = await migrateSkillDir(true, () => {}, tmpHome)

    expect(result.success).toBe(true)
    expect(result.detail).toMatch(/dry-run/)
    expect(result.moved).toEqual(['would-move'])
    expect(fs.existsSync(legacy)).toBe(true)
    expect(fs.existsSync(path.join(tmpHome, '.javidots', 'backups'))).toBe(false)
  })

  it('is idempotent: second run after a successful migration is a skip no-op', async () => {
    const opencodeConfig = path.join(tmpHome, '.config', 'opencode')
    const legacy = path.join(opencodeConfig, 'skill')
    fs.mkdirSync(path.join(legacy, 'one'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'one', 'SKILL.md'), 'x')

    // Mock tar so backup.tar.gz write doesn't actually try to archive the source.
    ;(execFile as unknown as Mock).mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb?: Function) => {
        const callback = typeof _opts === 'function' ? _opts : cb
        if (typeof callback !== 'function') return
        if (args[0] === '-czf') fs.writeFileSync(args[1] as string, '')
        callback(null, { stdout: '', stderr: '' })
      },
    )

    const first = await migrateSkillDir(false, () => {}, tmpHome)
    expect(first.success).toBe(true)
    expect(fs.existsSync(legacy)).toBe(false)

    ;(execFile as unknown as Mock).mockReset()
    const second = await migrateSkillDir(false, () => {}, tmpHome)
    expect(second.success).toBe(true)
    expect(second.detail).toMatch(/No legacy skill/)
  })
})