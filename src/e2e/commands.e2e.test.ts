/**
 * E2E tests for javidots CLI — dry-run focused.
 *
 * Executes the REAL compiled CLI as a subprocess with CI=1
 * to ensure non-interactive auto-proceed/exit behavior.
 * Tests ONLY dry-run behavior — no system mutations.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import fs from 'fs'
import crypto from 'crypto'
import { describe, it, expect, afterEach } from 'vitest'

const execFileAsync = promisify(execFile)
const CLI_PATH = path.resolve(__dirname, '../../dist/index.js')

// ── Helpers ────────────────────────────────────────────────────────────

const sandboxes: string[] = []

function createSandbox(): string {
  const dir = path.join(os.tmpdir(), `javidots-e2e-${crypto.randomUUID()}`)
  fs.mkdirSync(dir, { recursive: true })
  sandboxes.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of sandboxes) {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  sandboxes.length = 0
})

async function runCLI(
  args: string[],
  env?: Record<string, string>,
  timeout = 30_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      timeout,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1', ...env },
    })
    return { stdout, stderr, exitCode: 0 }
  } catch (e: any) {
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.code ?? 1,
    }
  }
}

// ── Help & basic args ──────────────────────────────────────────────────

describe('help and basic args', () => {
  it('--help shows usage with all commands', async () => {
    const { stdout, exitCode } = await runCLI(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('javidots')
    expect(stdout).toContain('setup')
    expect(stdout).toContain('doctor')
    expect(stdout).toContain('update')
    expect(stdout).toContain('uninstall')
  })

  it('--help shows preset and flag options', async () => {
    const { stdout, exitCode } = await runCLI(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('full')
    expect(stdout).toContain('minimal')
    expect(stdout).toContain('--cli')
    expect(stdout).toContain('--dry-run')
    expect(stdout).toContain('--ghagga')
    expect(stdout).toContain('--no-ghagga')
  })
})

// ── Dry-run setup ──────────────────────────────────────────────────────

describe('dry-run setup', () => {
  it('--dry-run --preset minimal shows correct steps', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'minimal'])
    expect(exitCode).toBe(0)
    // javi-ai step
    expect(stdout).toMatch(/javi-ai/i)
    // SDD step (mandatory)
    expect(stdout).toMatch(/gentle-ai/i)
    // engram step (mandatory)
    expect(stdout).toMatch(/engram|memory/i)
    // ghagga skipped
    expect(stdout).toMatch(/ghagga.*Not selected/i)
  })

  it('--dry-run --preset full shows all 6 CLIs', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'full'])
    expect(exitCode).toBe(0)
    // All 6 CLIs should appear in the CLI list
    expect(stdout).toContain('claude')
    expect(stdout).toContain('opencode')
    expect(stdout).toContain('gemini')
    expect(stdout).toContain('qwen')
    expect(stdout).toContain('codex')
    expect(stdout).toContain('copilot')
  })

  it('--dry-run --cli claude --no-ghagga shows only claude', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--cli', 'claude', '--no-ghagga'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('claude')
    // Should show ghagga as skipped
    expect(stdout).toMatch(/ghagga.*Not selected/i)
  })

  it('--dry-run --cli claude,opencode --no-ghagga shows both CLIs', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--cli', 'claude,opencode', '--no-ghagga'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('claude')
    expect(stdout).toContain('opencode')
  })

  it('--dry-run does not create any files in sandbox', async () => {
    const sandbox = createSandbox()
    const { exitCode } = await runCLI(
      ['--dry-run', '--preset', 'minimal'],
      { HOME: sandbox },
    )
    expect(exitCode).toBe(0)
    // No .javidots directory should be created
    expect(fs.existsSync(path.join(sandbox, '.javidots'))).toBe(false)
    // No .claude directory should be created
    expect(fs.existsSync(path.join(sandbox, '.claude'))).toBe(false)
  })

  it('--dry-run --preset full --ghagga shows ghagga step', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'full', '--ghagga'])
    expect(exitCode).toBe(0)
    // ghagga should NOT show "Not selected" — it should show enabled or "not installed"
    expect(stdout).toContain('ghagga')
    expect(stdout).not.toMatch(/ghagga.*Not selected/i)
  })

  it('--dry-run --preset minimal skips ghagga', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'minimal'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/ghagga.*Not selected/i)
  })

  it('--dry-run SDD step is always present (mandatory)', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'minimal'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/gentle-ai/i)
  })

  it('--dry-run engram step is always present (mandatory)', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'minimal'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/engram|memory/i)
  })

  it('--dry-run shows "Dry run complete" in summary', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'minimal'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/dry run complete/i)
  })

  it('--dry-run shows "No changes were made" notice', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'minimal'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/no changes were made/i)
  })

  it('--dry-run --preset full enables ghagga via preset', async () => {
    const { stdout, exitCode } = await runCLI(['--dry-run', '--preset', 'full'])
    expect(exitCode).toBe(0)
    // Full preset should enable ghagga (may show "not installed" if binary absent)
    expect(stdout).toContain('ghagga')
    expect(stdout).not.toMatch(/ghagga.*Not selected/i)
  })
})

// ── Doctor ─────────────────────────────────────────────────────────────

describe('doctor', () => {
  it('runs without crashing', async () => {
    const { stdout, exitCode } = await runCLI(['doctor'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Health')
    expect(stdout).toMatch(/checks passed/i)
  })

  it('in clean sandbox shows manifest as fail', async () => {
    const sandbox = createSandbox()
    const { stdout, exitCode } = await runCLI(['doctor'], { HOME: sandbox })
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/manifest.*Not installed/i)
  })

  it('checks for required tools (javi-ai, engram, git)', async () => {
    const { stdout, exitCode } = await runCLI(['doctor'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('javi-ai')
    expect(stdout).toContain('engram')
    expect(stdout).toContain('git')
  })

  it('shows health score', async () => {
    const { stdout, exitCode } = await runCLI(['doctor'])
    expect(exitCode).toBe(0)
    // e.g. "2/5 checks passed (40%)"
    expect(stdout).toMatch(/\d+\/\d+ checks passed/)
  })
})

// ── Update ─────────────────────────────────────────────────────────────

describe('update', () => {
  it('with no manifest reports no installation', async () => {
    const sandbox = createSandbox()
    const { stdout, exitCode } = await runCLI(
      ['update', '--dry-run'],
      { HOME: sandbox },
    )
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/no.*installation found|no manifest/i)
  })
})

// ── Uninstall ──────────────────────────────────────────────────────────

describe('uninstall', () => {
  it('with no manifest reports nothing to uninstall', async () => {
    const sandbox = createSandbox()
    const { stdout, exitCode } = await runCLI(
      ['uninstall'],
      { HOME: sandbox },
    )
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/no.*installation found|nothing to uninstall/i)
  })
})
