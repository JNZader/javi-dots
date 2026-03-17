import fs from 'fs'
import path from 'path'
import type { SetupStep } from '../types/index.js'
import { CONFIG_PROMPTS_DIR } from '../constants.js'

type StepCallback = (step: SetupStep) => void

function report(onStep: StepCallback, id: string, label: string, status: SetupStep['status'], detail?: string) {
  onStep({ id, label, status, detail })
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function listDirEntries(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(e => !e.startsWith('.'))
}

const DOMAIN_DIRS = ['debug', 'review', 'planning', 'research', 'personas'] as const

/**
 * Initialize the prompt registry with domain directories.
 */
export function initPromptRegistry(): boolean {
  if (fs.existsSync(CONFIG_PROMPTS_DIR)) return false

  ensureDir(CONFIG_PROMPTS_DIR)
  for (const domain of DOMAIN_DIRS) {
    ensureDir(path.join(CONFIG_PROMPTS_DIR, domain))
  }

  fs.writeFileSync(
    path.join(CONFIG_PROMPTS_DIR, 'README.md'),
    `# Prompt Registry

Reusable prompt templates organized by domain.

## Structure

- \`debug/\`     — Debugging prompts and investigation templates
- \`review/\`    — Code review prompts and checklists
- \`planning/\`  — Feature planning and architecture prompts
- \`research/\`  — Research and analysis prompts
- \`personas/\`  — AI persona definitions (domain-specific behavior)

## Usage

\`\`\`
javi-dots prompt list              # List all prompts
javi-dots prompt list debug        # List prompts in debug domain
javi-dots prompt show <name>       # Display a prompt
javi-dots prompt add <domain> <name>  # Create a new prompt
\`\`\`

Each prompt is a markdown file with optional YAML frontmatter.
`,
    'utf-8'
  )

  return true
}

/**
 * List all prompts, optionally filtered by domain.
 */
export async function listPrompts(
  domain: string | undefined,
  onStep: StepCallback
): Promise<void> {
  initPromptRegistry()

  if (domain) {
    const domainDir = path.join(CONFIG_PROMPTS_DIR, domain)
    if (!fs.existsSync(domainDir)) {
      report(onStep, 'prompt-list', `Domain: ${domain}`, 'error',
        `unknown domain. Available: ${DOMAIN_DIRS.join(', ')}`)
      return
    }
    const entries = listDirEntries(domainDir).filter(e => e.endsWith('.md'))
    if (entries.length === 0) {
      report(onStep, 'prompt-list', `Domain: ${domain}`, 'done', 'no prompts yet')
    } else {
      for (const entry of entries) {
        const name = entry.replace('.md', '')
        report(onStep, `prompt-${name}`, name, 'done', `${domain}/${entry}`)
      }
    }
    return
  }

  // List all domains
  let total = 0
  for (const d of DOMAIN_DIRS) {
    const domainDir = path.join(CONFIG_PROMPTS_DIR, d)
    const entries = listDirEntries(domainDir).filter(e => e.endsWith('.md'))
    total += entries.length
    const detail = entries.length > 0
      ? entries.map(e => e.replace('.md', '')).join(', ')
      : '(empty)'
    report(onStep, `domain-${d}`, d, 'done', `${entries.length} prompts — ${detail}`)
  }

  if (total === 0) {
    report(onStep, 'prompt-hint', 'Hint', 'done',
      'add prompts with: javi-dots prompt add <domain> <name>')
  }
}

/**
 * Show a prompt's content.
 */
export async function showPrompt(
  name: string,
  onStep: StepCallback
): Promise<void> {
  initPromptRegistry()

  // Search across all domains
  for (const domain of DOMAIN_DIRS) {
    const filePath = path.join(CONFIG_PROMPTS_DIR, domain, `${name}.md`)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      report(onStep, 'prompt-show', `${domain}/${name}`, 'done', `\n${content}`)
      return
    }
  }

  report(onStep, 'prompt-show', `Prompt: ${name}`, 'error', 'not found in any domain')
}

/**
 * Add a new prompt to a domain.
 */
export async function addPrompt(
  domain: string,
  name: string,
  content: string | undefined,
  dryRun: boolean,
  onStep: StepCallback
): Promise<void> {
  initPromptRegistry()

  if (!DOMAIN_DIRS.includes(domain as typeof DOMAIN_DIRS[number])) {
    report(onStep, 'prompt-add', `Add prompt: ${name}`, 'error',
      `unknown domain "${domain}". Available: ${DOMAIN_DIRS.join(', ')}`)
    return
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    report(onStep, 'prompt-add', `Add prompt: ${name}`, 'error', 'name must be kebab-case')
    return
  }

  const filePath = path.join(CONFIG_PROMPTS_DIR, domain, `${name}.md`)

  if (fs.existsSync(filePath)) {
    report(onStep, 'prompt-add', `Add prompt: ${name}`, 'error', 'prompt already exists')
    return
  }

  const template = content ?? `---
name: ${name}
domain: ${domain}
description: TODO — describe this prompt
---

# ${name}

TODO — write your prompt here.
`

  if (!dryRun) {
    fs.writeFileSync(filePath, template, 'utf-8')
  }

  report(onStep, 'prompt-add', `Add prompt: ${name}`, 'done',
    dryRun ? `dry-run: would create ${domain}/${name}.md` : `created ${domain}/${name}.md`)
}
