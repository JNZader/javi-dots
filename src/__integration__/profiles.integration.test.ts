import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

const { FIXED_ROOT, CONFIG_SKILLS_DIR, CONFIG_HOOKS_DIR, PROFILES_DIR } = vi.hoisted(() => {
  const p = require('path')
  const o = require('os')
  const root = p.join(o.tmpdir(), `javi-dots-profiles-test-${Date.now()}`)
  const home = p.join(root, 'home')
  const md = p.join(home, '.javidots')
  return {
    FIXED_ROOT: root as string,
    CONFIG_SKILLS_DIR: p.join(md, 'config', 'skills') as string,
    CONFIG_HOOKS_DIR: p.join(md, 'config', 'hooks') as string,
    PROFILES_DIR: p.join(md, 'profiles') as string,
    _home: home, _md: md,
  }
})

vi.mock('../constants.js', () => {
  const p = require('path')
  const root = FIXED_ROOT
  const home = p.join(root, 'home')
  const md = p.join(home, '.javidots')
  return {
    HOME: home,
    MANIFEST_DIR: md,
    MANIFEST_PATH: p.join(md, 'manifest.json'),
    CONFIG_REPO_DIR: p.join(md, 'config'),
    CONFIG_SKILLS_DIR, CONFIG_HOOKS_DIR,
    CONFIG_PROMPTS_DIR: p.join(md, 'config', 'prompts'),
    SYNC_STATE_PATH: p.join(md, 'sync-state.json'),
    PROFILES_DIR, PROFILES_STATE_PATH: p.join(md, 'profiles-state.json'),
    CLI_OPTIONS: [{ id: 'claude', label: 'Claude Code' }],
    EDITOR_CONFIGS: [],
  }
})

import { createProfile, switchProfile, listProfiles, deleteProfile } from '../orchestrator/profiles.js'
import { collectSteps } from './helpers.js'

describe('profiles — integration', () => {
  beforeEach(() => {
    fs.mkdirSync(CONFIG_SKILLS_DIR, { recursive: true })
    fs.mkdirSync(CONFIG_HOOKS_DIR, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(FIXED_ROOT, { recursive: true, force: true })
  })

  it('createProfile creates profile directory with skills snapshot', async () => {
    const skillDir = path.join(CONFIG_SKILLS_DIR, 'react-19')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# React 19')

    const { steps, onStep } = collectSteps()
    await createProfile('frontend', 'Frontend skills', false, onStep)

    expect(steps.find(s => s.id === 'profile-create')?.status).toBe('done')
    expect(fs.existsSync(path.join(PROFILES_DIR, 'frontend', 'skills', 'react-19', 'SKILL.md'))).toBe(true)
  })

  it('createProfile rejects non-kebab-case names', async () => {
    const { steps, onStep } = collectSteps()
    await createProfile('My Profile', 'desc', false, onStep)
    expect(steps.find(s => s.id === 'profile-create')?.status).toBe('error')
  })

  it('createProfile rejects duplicate names', async () => {
    await createProfile('work', 'First', false, () => {})
    const { steps, onStep } = collectSteps()
    await createProfile('work', 'Duplicate', false, onStep)
    expect(steps.find(s => s.id === 'profile-create')?.status).toBe('error')
  })

  it('switchProfile loads profile into central config', async () => {
    const skillDir = path.join(CONFIG_SKILLS_DIR, 'typescript')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# TS')

    await createProfile('ts-only', 'TypeScript', false, () => {})
    fs.rmSync(skillDir, { recursive: true })

    const { steps, onStep } = collectSteps()
    await switchProfile('ts-only', false, onStep)
    expect(steps.find(s => s.id === 'profile-switch')?.status).toBe('done')
    expect(fs.existsSync(path.join(CONFIG_SKILLS_DIR, 'typescript', 'SKILL.md'))).toBe(true)
  })

  it('switchProfile errors on nonexistent profile', async () => {
    const { steps, onStep } = collectSteps()
    await switchProfile('nope', false, onStep)
    expect(steps.find(s => s.id === 'profile-switch')?.status).toBe('error')
  })

  it('listProfiles shows created profiles', async () => {
    await createProfile('alpha', 'First', false, () => {})
    await createProfile('beta', 'Second', false, () => {})
    const { steps, onStep } = collectSteps()
    await listProfiles(onStep)
    const profileSteps = steps.filter(s => s.label.includes('alpha') || s.label.includes('beta'))
    expect(profileSteps.length).toBe(2)
  })

  it('deleteProfile removes profile', async () => {
    await createProfile('temp', 'Temporary', false, () => {})
    expect(fs.existsSync(path.join(PROFILES_DIR, 'temp'))).toBe(true)
    const { steps, onStep } = collectSteps()
    await deleteProfile('temp', false, onStep)
    expect(steps.find(s => s.id === 'profile-delete')?.status).toBe('done')
    expect(fs.existsSync(path.join(PROFILES_DIR, 'temp'))).toBe(false)
  })

  it('dry-run does not create files', async () => {
    await createProfile('dry', 'Dry run', true, () => {})
    expect(fs.existsSync(path.join(PROFILES_DIR, 'dry'))).toBe(false)
  })
})
