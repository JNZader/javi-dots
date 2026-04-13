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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'javi-dots-efficiency-'))
  origHome = process.env['HOME'] ?? ''
  process.env['HOME'] = tmpDir

  // Create mock editor dirs so the module finds them
  fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(tmpDir, '.opencode'), { recursive: true })
})

afterEach(() => {
  process.env['HOME'] = origHome
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.resetModules()
})

async function loadModule() {
  return import('./efficiency.js')
}

describe('activateEfficiency', () => {
  it('rejects unknown profile id', async () => {
    const { activateEfficiency } = await loadModule()
    const { steps, onStep } = collectSteps()

    await activateEfficiency('nonexistent' as any, false, onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('unknown'))).toBe(true)
  })

  it('dry-run does not write files', async () => {
    const { activateEfficiency } = await loadModule()
    const { steps, onStep } = collectSteps()

    await activateEfficiency('concise', true, onStep)

    expect(steps.some(s => s.status === 'done' && s.detail?.includes('dry-run'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.efficiency.md'))).toBe(false)
  })

  it('writes efficiency file to existing editor dirs', async () => {
    const { activateEfficiency } = await loadModule()
    const { steps, onStep } = collectSteps()

    await activateEfficiency('concise', false, onStep)

    expect(steps.some(s => s.status === 'done')).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.efficiency.md'))).toBe(true)
    const content = fs.readFileSync(path.join(tmpDir, '.claude', 'CLAUDE.efficiency.md'), 'utf-8')
    expect(content).toContain('sycophantic')
  })

  it('writes state file with active profile', async () => {
    const { activateEfficiency } = await loadModule()
    const { onStep } = collectSteps()

    await activateEfficiency('automation', false, onStep)

    const statePath = path.join(tmpDir, '.javidots', 'efficiency', 'state.json')
    expect(fs.existsSync(statePath)).toBe(true)
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    expect(state.active).toBe('automation')
    expect(state.installedEditors).toContain('claude')
  })
})

describe('deactivateEfficiency', () => {
  it('does nothing when no active profile', async () => {
    const { deactivateEfficiency } = await loadModule()
    const { steps, onStep } = collectSteps()

    await deactivateEfficiency(false, onStep)

    expect(steps.some(s => s.status === 'done' && s.detail?.includes('no active'))).toBe(true)
  })

  it('removes efficiency file after activation', async () => {
    const { activateEfficiency, deactivateEfficiency } = await loadModule()
    const { onStep: onStep1 } = collectSteps()
    await activateEfficiency('concise', false, onStep1)

    expect(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.efficiency.md'))).toBe(true)

    const { steps, onStep } = collectSteps()
    await deactivateEfficiency(false, onStep)

    expect(steps.some(s => s.status === 'done')).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.efficiency.md'))).toBe(false)
  })

  it('dry-run does not remove files', async () => {
    const { activateEfficiency, deactivateEfficiency } = await loadModule()
    const { onStep: onStep1 } = collectSteps()
    await activateEfficiency('concise', false, onStep1)

    const { steps, onStep } = collectSteps()
    await deactivateEfficiency(true, onStep)

    expect(steps.some(s => s.status === 'done' && s.detail?.includes('dry-run'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.efficiency.md'))).toBe(true)
  })
})

describe('efficiencyStatus', () => {
  it('reports no active profile', async () => {
    const { efficiencyStatus } = await loadModule()
    const { steps, onStep } = collectSteps()

    await efficiencyStatus(onStep)

    expect(steps.some(s => s.detail?.includes('none active'))).toBe(true)
  })

  it('reports active profile after activation', async () => {
    const { activateEfficiency, efficiencyStatus } = await loadModule()
    await activateEfficiency('concise', false, () => {})

    const { steps, onStep } = collectSteps()
    await efficiencyStatus(onStep)

    expect(steps.some(s => s.label?.includes('Concise'))).toBe(true)
  })
})

describe('listEfficiencyProfiles', () => {
  it('lists all 3 built-in profiles', async () => {
    const { listEfficiencyProfiles } = await loadModule()
    const { steps, onStep } = collectSteps()

    await listEfficiencyProfiles(onStep)

    expect(steps.length).toBe(3)
    expect(steps.some(s => s.label?.includes('Concise'))).toBe(true)
    expect(steps.some(s => s.label?.includes('Automation'))).toBe(true)
    expect(steps.some(s => s.label?.includes('Exploratory'))).toBe(true)
  })
})
