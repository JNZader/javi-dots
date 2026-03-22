import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

const { FIXED_ROOT, FIXED_HOME, MANIFEST_DIR, MANIFEST_PATH, CONFIG_REPO_DIR, CONFIG_SKILLS_DIR, CONFIG_HOOKS_DIR } = vi.hoisted(() => {
  const p = require('path')
  const o = require('os')
  const root = p.join(o.tmpdir(), `javi-dots-sync-test-${Date.now()}`)
  const home = p.join(root, 'home')
  const manifestDir = p.join(home, '.javidots')
  return {
    FIXED_ROOT: root as string,
    FIXED_HOME: home as string,
    MANIFEST_DIR: manifestDir as string,
    MANIFEST_PATH: p.join(manifestDir, 'manifest.json') as string,
    CONFIG_REPO_DIR: p.join(manifestDir, 'config') as string,
    CONFIG_SKILLS_DIR: p.join(manifestDir, 'config', 'skills') as string,
    CONFIG_HOOKS_DIR: p.join(manifestDir, 'config', 'hooks') as string,
  }
})

vi.mock('../constants.js', () => {
  const p = require('path')
  return {
    HOME: FIXED_HOME,
    MANIFEST_DIR, MANIFEST_PATH,
    CONFIG_REPO_DIR, CONFIG_SKILLS_DIR, CONFIG_HOOKS_DIR,
    CONFIG_PROMPTS_DIR: p.join(CONFIG_REPO_DIR, 'prompts'),
    SYNC_STATE_PATH: p.join(MANIFEST_DIR, 'sync-state.json'),
    PROFILES_DIR: p.join(MANIFEST_DIR, 'profiles'),
    PROFILES_STATE_PATH: p.join(MANIFEST_DIR, 'profiles-state.json'),
    CLI_OPTIONS: [{ id: 'claude', label: 'Claude Code' }],
    EDITOR_CONFIGS: [{
      id: 'claude', label: 'Claude Code',
      globalDir: p.join(FIXED_HOME, '.claude'),
      skillsDir: p.join(FIXED_HOME, '.claude', 'skills'),
      hooksDir: p.join(FIXED_HOME, '.claude', 'hooks'),
      instructionFile: 'CLAUDE.md',
    }],
  }
})

import { initConfigRepo, runSync, runStatus } from '../orchestrator/sync.js'
import { collectSteps } from './helpers.js'

describe('sync — integration', () => {
  beforeEach(() => {
    fs.mkdirSync(FIXED_HOME, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(FIXED_ROOT, { recursive: true, force: true })
  })

  it('initConfigRepo creates skills/, hooks/, and README', () => {
    const created = initConfigRepo()
    expect(created).toBe(true)
    expect(fs.existsSync(CONFIG_SKILLS_DIR)).toBe(true)
    expect(fs.existsSync(CONFIG_HOOKS_DIR)).toBe(true)
    expect(fs.existsSync(path.join(CONFIG_REPO_DIR, 'README.md'))).toBe(true)
  })

  it('initConfigRepo returns false if already exists', () => {
    initConfigRepo()
    expect(initConfigRepo()).toBe(false)
  })

  it('runSync without manifest still initializes config repo', async () => {
    const { steps, onStep } = collectSteps()
    await runSync(false, onStep)
    // Config repo should be created even without manifest
    expect(fs.existsSync(CONFIG_SKILLS_DIR)).toBe(true)
  })

  it('runSync distributes skills to editor when manifest exists', async () => {
    // Create manifest
    fs.mkdirSync(MANIFEST_DIR, { recursive: true })
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
      version: '1.0.0', clis: ['claude'], engram: true, sdd: true, ghagga: false,
      installedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }))

    // Create central skill
    fs.mkdirSync(CONFIG_SKILLS_DIR, { recursive: true })
    const skillDir = path.join(CONFIG_SKILLS_DIR, 'test-skill')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill')

    // Create editor dir
    const editorSkills = path.join(FIXED_HOME, '.claude', 'skills')
    fs.mkdirSync(editorSkills, { recursive: true })

    const { steps, onStep } = collectSteps()
    await runSync(false, onStep)

    const destSkill = path.join(editorSkills, 'test-skill', 'SKILL.md')
    expect(fs.existsSync(destSkill)).toBe(true)
    expect(fs.readFileSync(destSkill, 'utf-8')).toBe('# Test Skill')
  })

  it('runSync dry-run does not copy files', async () => {
    fs.mkdirSync(MANIFEST_DIR, { recursive: true })
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
      version: '1.0.0', clis: ['claude'], engram: true, sdd: true, ghagga: false,
      installedAt: '', updatedAt: '',
    }))

    fs.mkdirSync(CONFIG_SKILLS_DIR, { recursive: true })
    const skillDir = path.join(CONFIG_SKILLS_DIR, 'dry-skill')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Dry')

    const editorSkills = path.join(FIXED_HOME, '.claude', 'skills')
    fs.mkdirSync(editorSkills, { recursive: true })

    await runSync(true, () => {})
    expect(fs.existsSync(path.join(editorSkills, 'dry-skill'))).toBe(false)
  })

  it('runStatus reports state', async () => {
    const { steps, onStep } = collectSteps()
    await runStatus(onStep)
    expect(steps.length).toBeGreaterThan(0)
  })
})
