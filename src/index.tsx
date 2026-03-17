#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import meow from 'meow'
import App from './ui/App.js'
import Doctor from './ui/Doctor.js'
import Update from './ui/Update.js'
import Uninstall from './ui/Uninstall.js'
import Sync from './ui/Sync.js'
import Profile from './ui/Profile.js'
import Prompt from './ui/Prompt.js'
import Stats from './ui/Stats.js'
import { CIProvider } from './ui/CIContext.js'
import type { AI_CLI } from './types/index.js'

const cli = meow(`
  Usage
    $ javidots [command] [options]

  Commands
    setup            Set up developer workstation (default)
    sync             Sync central config to all configured editors
    status           Show sync status for all configured editors
    profile create   Create a profile from current config
    profile switch   Switch to a named profile
    profile list     List all profiles
    profile delete   Delete a profile
    prompt list      List all prompts (or by domain)
    prompt show      Display a prompt's content
    prompt add       Create a new prompt
    stats            Show session analytics (tokens, cost, tools)
    versions         Show installed agent versions
    doctor           Show health report of current installation
    update           Re-run setup for previously configured CLIs
    uninstall        Remove javidots managed files

  Options
    --dry-run       Preview without making changes
    --cli           Comma-separated list of CLIs (claude,opencode,gemini,qwen,codex,copilot)
    --ghagga        Enable ghagga code review
    --no-ghagga     Disable ghagga code review
    --preset        Preset: full, minimal, custom (default: custom)
    --version       Show version
    --help          Show this help

  Presets
    full        All 6 CLIs + ghagga
    minimal     Claude only, no ghagga
    custom      Interactive TUI (default)

  Examples
    $ javidots
    $ javidots setup --dry-run
    $ javidots setup --cli claude,opencode --ghagga
    $ javidots --preset minimal
    $ javidots --preset full --dry-run
    $ javidots sync
    $ javidots sync --dry-run
    $ javidots status
    $ javidots profile create work
    $ javidots profile switch frontend
    $ javidots profile list
    $ javidots profile delete old-profile
    $ javidots doctor
    $ javidots update
    $ javidots uninstall
`, {
  importMeta: import.meta,
  flags: {
    dryRun: { type: 'boolean', default: false },
    cli: { type: 'string', default: '' },
    ghagga: { type: 'boolean' },
    preset: { type: 'string', default: 'custom' },
  }
})

const subcommand = cli.input[0] ?? 'setup'

const ALL_CLIS: AI_CLI[] = ['claude', 'opencode', 'gemini', 'qwen', 'codex', 'copilot']
const isCI = process.env['CI'] === '1' || process.env['CI'] === 'true'

switch (subcommand) {
  case 'sync': {
    render(<CIProvider isCI={isCI}><Sync mode="sync" dryRun={cli.flags.dryRun} /></CIProvider>)
    break
  }

  case 'status': {
    render(<CIProvider isCI={isCI}><Sync mode="status" dryRun={false} /></CIProvider>)
    break
  }

  case 'profile': {
    const profileAction = cli.input[1] as 'create' | 'switch' | 'list' | 'delete' | undefined
    const VALID_PROFILE_ACTIONS = ['create', 'switch', 'list', 'delete']
    const action = profileAction && VALID_PROFILE_ACTIONS.includes(profileAction) ? profileAction : 'list'
    const target = cli.input[2]

    render(
      <CIProvider isCI={isCI}>
        <Profile
          action={action}
          target={target}
          description={cli.input.slice(3).join(' ') || undefined}
          dryRun={cli.flags.dryRun}
        />
      </CIProvider>
    )
    break
  }

  case 'prompt': {
    const promptAction = cli.input[1] as 'list' | 'show' | 'add' | undefined
    const VALID_PROMPT_ACTIONS = ['list', 'show', 'add']
    const action = promptAction && VALID_PROMPT_ACTIONS.includes(promptAction) ? promptAction : 'list'
    // For 'add': prompt add <domain> <name>; for others: prompt show/list <target>
    const promptTarget = action === 'add' ? cli.input[3] : cli.input[2]
    const promptDomain = action === 'add' ? cli.input[2] : undefined

    render(
      <CIProvider isCI={isCI}>
        <Prompt action={action} target={promptTarget} domain={promptDomain} dryRun={cli.flags.dryRun} />
      </CIProvider>
    )
    break
  }

  case 'stats': {
    render(<CIProvider isCI={isCI}><Stats mode="stats" /></CIProvider>)
    break
  }

  case 'versions': {
    render(<CIProvider isCI={isCI}><Stats mode="versions" /></CIProvider>)
    break
  }

  case 'doctor': {
    render(<CIProvider isCI={isCI}><Doctor /></CIProvider>)
    break
  }

  case 'update': {
    render(<CIProvider isCI={isCI}><Update dryRun={cli.flags.dryRun} /></CIProvider>)
    break
  }

  case 'uninstall': {
    render(<CIProvider isCI={isCI}><Uninstall /></CIProvider>)
    break
  }

  case 'setup':
  default: {
    // Determine CLIs from --cli flag or --preset
    let preselectedClis: AI_CLI[] | undefined
    let presetGhagga: boolean | undefined
    let skipTUI = false

    if (cli.flags.preset === 'full') {
      preselectedClis = ALL_CLIS
      presetGhagga = true
      skipTUI = true
    } else if (cli.flags.preset === 'minimal') {
      preselectedClis = ['claude']
      presetGhagga = false
      skipTUI = true
    } else if (cli.flags.cli) {
      preselectedClis = cli.flags.cli.split(',').map(s => s.trim()) as AI_CLI[]
    }

    // --ghagga / --no-ghagga override preset (only when explicitly passed)
    const ghaggaExplicit = process.argv.includes('--ghagga') || process.argv.includes('--no-ghagga')
    if (ghaggaExplicit) {
      presetGhagga = cli.flags.ghagga
    }

    // If both clis and ghagga are set via flags (non-preset), skip TUI
    if (preselectedClis && presetGhagga !== undefined && cli.flags.preset === 'custom') {
      skipTUI = true
    }

    render(
      <CIProvider isCI={isCI}>
        <App
          dryRun={cli.flags.dryRun}
          preselectedClis={preselectedClis}
          presetGhagga={presetGhagga}
          skipTUI={skipTUI}
        />
      </CIProvider>
    )
    break
  }
}
