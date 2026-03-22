import fs from 'fs'
import os from 'os'
import path from 'path'

export function createTempDir(prefix = 'javi-dots-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

export function collectSteps() {
  const steps: Array<{ id: string; label: string; status: string; detail?: string }> = []
  const onStep = (step: { id: string; label: string; status: string; detail?: string }) => {
    const idx = steps.findIndex(s => s.id === step.id)
    if (idx >= 0) steps[idx] = step
    else steps.push(step)
  }
  return { steps, onStep }
}
