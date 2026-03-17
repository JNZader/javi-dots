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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'javi-dots-profiles-'))
  origHome = process.env['HOME'] ?? ''
  process.env['HOME'] = tmpDir
})

afterEach(() => {
  process.env['HOME'] = origHome
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.resetModules()
})

async function loadModule() {
  return import('./profiles.js')
}

describe('createProfile', () => {
  it('rejects non-kebab-case names', async () => {
    const { createProfile } = await loadModule()
    const { steps, onStep } = collectSteps()

    await createProfile('Bad Name', 'test', false, onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('kebab-case'))).toBe(true)
  })

  it('reports dry-run success', async () => {
    const { createProfile } = await loadModule()
    const { steps, onStep } = collectSteps()

    await createProfile('test-profile', 'A test profile', true, onStep)

    expect(steps.some(s => s.status === 'done' && s.detail?.includes('dry-run'))).toBe(true)
  })
})

describe('switchProfile', () => {
  it('reports error when profile not found', async () => {
    const { switchProfile } = await loadModule()
    const { steps, onStep } = collectSteps()

    await switchProfile('nonexistent', false, onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('not found'))).toBe(true)
  })
})

describe('listProfiles', () => {
  it('reports no profiles when empty', async () => {
    const { listProfiles } = await loadModule()
    const { steps, onStep } = collectSteps()

    await listProfiles(onStep)

    expect(steps.some(s => s.detail?.includes('create one'))).toBe(true)
  })
})

describe('deleteProfile', () => {
  it('reports error when profile not found', async () => {
    const { deleteProfile } = await loadModule()
    const { steps, onStep } = collectSteps()

    await deleteProfile('nonexistent', false, onStep)

    expect(steps.some(s => s.status === 'error' && s.detail?.includes('not found'))).toBe(true)
  })
})
