import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { SetupStep } from '../types/index.js'

let tmpDir: string
let origHome: string

function collectSteps(): { steps: SetupStep[]; onStep: (s: SetupStep) => void } {
  const steps: SetupStep[] = []
  return { steps, onStep: (s: SetupStep) => steps.push(s) }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'javi-dots-prompts-'))
  origHome = process.env['HOME'] ?? ''
  process.env['HOME'] = tmpDir
})

afterEach(() => {
  process.env['HOME'] = origHome
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.resetModules()
})

async function loadModule() {
  return import('./prompts.js')
}

describe('listPrompts', () => {
  it('initializes registry and lists empty domains', async () => {
    const { listPrompts } = await loadModule()
    const { steps, onStep } = collectSteps()

    await listPrompts(undefined, onStep)

    expect(steps.length).toBeGreaterThan(0)
    expect(steps.some(s => s.id.startsWith('domain-'))).toBe(true)
  })

  it('reports error for unknown domain', async () => {
    const { listPrompts } = await loadModule()
    const { steps, onStep } = collectSteps()

    await listPrompts('nonexistent', onStep)

    expect(steps.some(s => s.status === 'error')).toBe(true)
  })
})

describe('addPrompt', () => {
  it('rejects non-kebab-case names', async () => {
    const { addPrompt } = await loadModule()
    const { steps, onStep } = collectSteps()

    await addPrompt('debug', 'Bad Name', undefined, false, onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('kebab-case'))).toBe(true)
  })

  it('rejects unknown domain', async () => {
    const { addPrompt } = await loadModule()
    const { steps, onStep } = collectSteps()

    await addPrompt('nonexistent', 'test', undefined, false, onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('unknown domain'))).toBe(true)
  })

  it('reports dry-run success', async () => {
    const { addPrompt } = await loadModule()
    const { steps, onStep } = collectSteps()

    await addPrompt('debug', 'test-prompt', undefined, true, onStep)

    expect(steps.some(s => s.status === 'done' && s.detail?.includes('dry-run'))).toBe(true)
  })
})

describe('showPrompt', () => {
  it('reports error when prompt not found', async () => {
    const { showPrompt } = await loadModule()
    const { steps, onStep } = collectSteps()

    await showPrompt('nonexistent', onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('not found'))).toBe(true)
  })
})
