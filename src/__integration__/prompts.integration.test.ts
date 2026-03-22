import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

const { FIXED_ROOT, CONFIG_PROMPTS_DIR } = vi.hoisted(() => {
  const p = require('path')
  const o = require('os')
  const root = p.join(o.tmpdir(), `javi-dots-prompts-test-${Date.now()}`)
  const home = p.join(root, 'home')
  const md = p.join(home, '.javidots')
  return {
    FIXED_ROOT: root as string,
    CONFIG_PROMPTS_DIR: p.join(md, 'config', 'prompts') as string,
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
    CONFIG_REPO_DIR: p.join(md, 'config'),
    CONFIG_SKILLS_DIR: p.join(md, 'config', 'skills'),
    CONFIG_HOOKS_DIR: p.join(md, 'config', 'hooks'),
    CONFIG_PROMPTS_DIR,
    PROFILES_DIR: p.join(md, 'profiles'),
    PROFILES_STATE_PATH: p.join(md, 'profiles-state.json'),
  }
})

import { initPromptRegistry, listPrompts, addPrompt, showPrompt } from '../orchestrator/prompts.js'
import { collectSteps } from './helpers.js'

describe('prompts — integration', () => {
  beforeEach(() => {
    fs.mkdirSync(path.dirname(CONFIG_PROMPTS_DIR), { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(FIXED_ROOT, { recursive: true, force: true })
  })

  it('initPromptRegistry creates domain directories', () => {
    const created = initPromptRegistry()
    expect(created).toBe(true)
    for (const domain of ['debug', 'review', 'planning', 'research', 'personas']) {
      expect(fs.existsSync(path.join(CONFIG_PROMPTS_DIR, domain))).toBe(true)
    }
    expect(fs.existsSync(path.join(CONFIG_PROMPTS_DIR, 'README.md'))).toBe(true)
  })

  it('initPromptRegistry returns false if already exists', () => {
    initPromptRegistry()
    expect(initPromptRegistry()).toBe(false)
  })

  it('listPrompts shows all domains', async () => {
    const { steps, onStep } = collectSteps()
    await listPrompts(undefined, onStep)
    expect(steps.length).toBeGreaterThanOrEqual(5)
  })

  it('listPrompts errors on unknown domain', async () => {
    const { steps, onStep } = collectSteps()
    await listPrompts('fake', onStep)
    expect(steps.find(s => s.status === 'error')?.detail).toContain('unknown domain')
  })

  it('addPrompt creates a prompt file', async () => {
    const { steps, onStep } = collectSteps()
    await addPrompt('debug', 'trace-issue', undefined, false, onStep)
    expect(steps.find(s => s.id === 'prompt-add')?.status).toBe('done')
    expect(fs.existsSync(path.join(CONFIG_PROMPTS_DIR, 'debug', 'trace-issue.md'))).toBe(true)
  })

  it('addPrompt rejects non-kebab-case', async () => {
    const { steps, onStep } = collectSteps()
    await addPrompt('debug', 'Bad Name', undefined, false, onStep)
    expect(steps.find(s => s.id === 'prompt-add')?.status).toBe('error')
  })

  it('addPrompt rejects unknown domain', async () => {
    const { steps, onStep } = collectSteps()
    await addPrompt('fake', 'test', undefined, false, onStep)
    expect(steps.find(s => s.id === 'prompt-add')?.status).toBe('error')
  })

  it('addPrompt dry-run does not create file', async () => {
    await addPrompt('debug', 'dry', undefined, true, () => {})
    expect(fs.existsSync(path.join(CONFIG_PROMPTS_DIR, 'debug', 'dry.md'))).toBe(false)
  })

  it('showPrompt finds existing prompt', async () => {
    await addPrompt('review', 'code-review', undefined, false, () => {})
    const { steps, onStep } = collectSteps()
    await showPrompt('code-review', onStep)
    expect(steps.find(s => s.id === 'prompt-show')?.status).toBe('done')
  })

  it('showPrompt errors on nonexistent', async () => {
    initPromptRegistry()
    const { steps, onStep } = collectSteps()
    await showPrompt('nope', onStep)
    expect(steps.find(s => s.id === 'prompt-show')?.status).toBe('error')
  })
})
