import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('./utils.js', () => ({
  which: vi.fn(),
}))

import { execFile } from 'child_process'
import { which } from './utils.js'
import { ensureBrewTrust } from './brew-trust.js'

function execRejects(stderr: string, stdout = ''): void {
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      if (typeof callback === 'function') {
        const err = new Error(stderr) as Error & { stdout?: string; stderr?: string }
        err.stderr = stderr
        err.stdout = stdout
        callback(err, { stdout, stderr })
      }
    },
  )
}

function execSucceeds(stdout = ''): void {
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      if (typeof callback === 'function') callback(null, { stdout, stderr: '' })
    },
  )
}

function execSequence(steps: Array<{ stdout?: string; stderr?: string; fail?: boolean }>): void {
  let i = 0
  ;(execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
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

beforeEach(() => {
  ;(execFile as unknown as Mock).mockReset()
  ;(which as unknown as Mock).mockReset()
})

describe('ensureBrewTrust', () => {
  it('returns [] when brew is not on PATH (non-fatal)', async () => {
    ;(which as unknown as Mock).mockResolvedValue(null)
    const results = await ensureBrewTrust(['gentleman-programming/tap/gentle-ai'])
    expect(results).toEqual([])
    expect(execFile).not.toHaveBeenCalled()
  })

  it('runs `brew tap` then `brew trust --formula` per formula on happy path', async () => {
    ;(which as unknown as Mock).mockResolvedValue('/usr/local/bin/brew')
    execSucceeds('Trusted formula: gentleman-programming/tap/gentle-ai')

    const results = await ensureBrewTrust([
      'gentleman-programming/tap/gentle-ai',
      'gentleman-programming/tap/engram',
    ])

    expect(results).toEqual([
      { formula: 'gentleman-programming/tap/gentle-ai', ok: true, detail: 'trusted' },
      { formula: 'gentleman-programming/tap/engram', ok: true, detail: 'trusted' },
    ])
    const calls = (execFile as unknown as Mock).mock.calls.map(
      (c: unknown[]) => [c[0], c[1]] as [string, string[]],
    )
    expect(calls).toEqual([
      ['brew', ['tap', 'gentleman-programming/tap']],
      ['brew', ['trust', '--formula', 'gentleman-programming/tap/gentle-ai']],
      ['brew', ['tap', 'gentleman-programming/tap']],
      ['brew', ['trust', '--formula', 'gentleman-programming/tap/engram']],
    ])
  })

  it('returns ok=true with detail "already trusted" when stderr says so (non-fatal)', async () => {
    ;(which as unknown as Mock).mockResolvedValue('/usr/local/bin/brew')
    execSequence([
      { stdout: '' }, // brew tap succeeds
      { fail: true, stderr: 'already trusted' }, // trust no-ops
    ])

    const results = await ensureBrewTrust(['gentleman-programming/tap/gentle-ai'])

    expect(results).toEqual([
      { formula: 'gentleman-programming/tap/gentle-ai', ok: true, detail: 'already trusted' },
    ])
  })

  it('surfaces actionable chmod remediation on "Refusing to write insecure trust store"', async () => {
    ;(which as unknown as Mock).mockResolvedValue('/usr/local/bin/brew')
    execSequence([
      { stdout: '' }, // brew tap succeeds
      {
        fail: true,
        stderr: 'Error: Refusing to write insecure trust store: trust store directory /home/javier/.homebrew is group or world writable.',
      },
    ])

    const [result] = await ensureBrewTrust(['gentleman-programming/tap/gentle-ai'])

    expect(result?.ok).toBe(false)
    expect(result?.detail).toMatch(/Refusing to write insecure trust store/)
    expect(result?.detail).toMatch(/chmod 755/)
    expect(result?.detail).toMatch(/~\/.homebrew/)
  })

  it('skips trust step when brew tap fails (returns one result, ok=false)', async () => {
    ;(which as unknown as Mock).mockResolvedValue('/usr/local/bin/brew')
    execSequence([
      { fail: true, stderr: 'tap not found' },
    ])

    const results = await ensureBrewTrust(['gentleman-programming/tap/gentle-ai'])

    expect(results).toHaveLength(1)
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.detail).toMatch(/brew tap .* failed: tap not found/)
  })

  it('never invokes whole-tap trust (`brew trust <tap>` without --formula)', async () => {
    ;(which as unknown as Mock).mockResolvedValue('/usr/local/bin/brew')
    execSucceeds()

    await ensureBrewTrust([
      'gentleman-programming/tap/gentle-ai',
      'rtk-ai/tap/rtk',
    ])

    const trustCalls = (execFile as unknown as Mock).mock.calls
      .filter((c: unknown[]) => (c[1] as string[])[1] === 'trust')
      .map((c: unknown[]) => (c[1] as string[]).join(' '))
    for (const callArgs of trustCalls) {
      expect(callArgs).toContain('--formula')
    }
  })

  it('throws on malformed formula string', async () => {
    ;(which as unknown as Mock).mockResolvedValue('/usr/local/bin/brew')
    execSucceeds()

    await expect(
      ensureBrewTrust(['not-a-valid-formula']),
    ).rejects.toThrow(/Malformed formula 'not-a-valid-formula'/)
  })
})