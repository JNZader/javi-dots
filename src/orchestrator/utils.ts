import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'

const execFileAsync = promisify(execFile)

export async function which(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [bin])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Rough token estimate via whitespace splitting.
 * ~90% accurate for size warnings — no external deps needed.
 */
export function tokenEstimate(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
