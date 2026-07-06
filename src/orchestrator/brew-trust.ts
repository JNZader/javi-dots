import { execFile } from 'child_process'
import { promisify } from 'util'
import { which } from './utils.js'

const execFileAsync = promisify(execFile)

export interface BrewTrustResult {
  formula: string
  ok: boolean
  detail: string
}

/**
 * Idempotent: trusts only the specific named formulae on Homebrew 6+.
 *
 * Behavior:
 * - If `brew` is not on PATH, returns [] (non-fatal — orchestrator decides what to do).
 * - For each `<org>/<tap>/<formula>` entry, runs `brew tap <org>/<tap>` first (idempotent
 *   — brew no-ops if already tapped) then `brew trust --formula <formula>`.
 * - Detects "Refusing to write insecure trust store" stderr (Homebrew 6 refuses to write
 *   when the trust store directory such as `~/.homebrew` is group or world writable)
 *   and emits an actionable message asking the user to `chmod 755` the directory.
 * - Already-trusted formulae return `ok: true, detail: 'already trusted'` — they are
 *   not treated as failures.
 * - Whole-tap trust is never invoked; only specific formulae.
 */
export async function ensureBrewTrust(
  formulae: string[],
): Promise<BrewTrustResult[]> {
  const brewPath = await which('brew')
  if (!brewPath) {
    return []
  }

  const results: BrewTrustResult[] = []

  for (const formula of formulae) {
    const tapResult = await runBrewTap(formula)
    if (!tapResult.ok) {
      results.push(tapResult)
      continue
    }

    const trustResult = await runBrewTrustFormula(formula)
    results.push(trustResult)
  }

  return results
}

/**
 * Parse a formula string like `gentleman-programming/tap/gentle-ai` into
 * its tap (`gentleman-programming/tap`) and formula name (`gentle-ai`).
 * Throws if the formula string is malformed.
 */
function parseFormula(formula: string): { tap: string; name: string } {
  const parts = formula.split('/')
  if (parts.length !== 3) {
    throw new Error(
      `Malformed formula '${formula}'. Expected '<org>/<tap>/<name>' (e.g. 'gentleman-programming/tap/gentle-ai').`,
    )
  }
  return {
    tap: `${parts[0]}/${parts[1]}`,
    name: parts[2],
  }
}

async function runBrewTap(formula: string): Promise<BrewTrustResult> {
  const { tap } = parseFormula(formula)
  try {
    await execFileAsync('brew', ['tap', tap], { timeout: 30_000 })
    return { formula, ok: true, detail: `tap ${tap} present` }
  } catch (e: unknown) {
    const stderr = e instanceof Error ? e.message : String(e)
    return {
      formula,
      ok: false,
      detail: `brew tap ${tap} failed: ${stderr}`,
    }
  }
}

async function runBrewTrustFormula(formula: string): Promise<BrewTrustResult> {
  try {
    await execFileAsync(
      'brew',
      ['trust', '--formula', formula],
      { timeout: 15_000 },
    )
    return { formula, ok: true, detail: 'trusted' }
  } catch (e: unknown) {
    const stderr = e instanceof Error ? e.message : String(e)

    // Homebrew already reports this formula as trusted — treat as success.
    if (/already trusted/i.test(stderr) || /already trusted/i.test(extractStdoutSafe(e))) {
      return { formula, ok: true, detail: 'already trusted' }
    }

    // Homebrew 6 refuses to write to a group/world-writable trust store dir.
    // The remediation is to chmod 755 the offending directory (typically
    // ~/.homebrew on Linux custom-prefix installs). Preserve brew's original
    // stderr so the user sees both the upstream phrasing and our chmod hint.
    if (/Refusing to write insecure trust store/i.test(stderr)) {
      return {
        formula,
        ok: false,
        detail:
          `Refusing to write insecure trust store: ${stderr.trim()}. ` +
          `Run: chmod 755 ~/.homebrew (or the trust store dir reported by brew), then retry.`,
      }
    }

    return {
      formula,
      ok: false,
      detail: `brew trust --formula ${formula} failed: ${stderr}`,
    }
  }
}

/**
 * Best-effort extraction of stdout from a promisified execFile error.
 * promisify wraps the underlying error message but does not surface stdout
 * directly; we accept the loss and rely on stderr in the message body.
 */
function extractStdoutSafe(e: unknown): string {
  if (e && typeof e === 'object' && 'stdout' in e) {
    const v = (e as { stdout?: unknown }).stdout
    return typeof v === 'string' ? v : ''
  }
  return ''
}