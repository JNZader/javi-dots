#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { PassThrough } from 'node:stream'
import meow from 'meow'
import App from './ui/App.js'
import Doctor from './ui/Doctor.js'
import Health from './ui/Health.js'
import Esp from './ui/Esp.js'
import Update from './ui/Update.js'
import Uninstall from './ui/Uninstall.js'
import Sync from './ui/Sync.js'
import Profile from './ui/Profile.js'
import Prompt from './ui/Prompt.js'
import Mcp from './ui/Mcp.js'
import Stats from './ui/Stats.js'
import Tokens from './ui/Tokens.js'
import TokenHooks from './ui/TokenHooks.js'
import Nano from './ui/Nano.js'
import Security from './ui/Security.js'
import Telemetry from './ui/Telemetry.js'
import { CIProvider } from './ui/CIContext.js'
import type { AI_CLI, TelemetryMode } from './types/index.js'
import type { EfficiencyProfileId } from './constants.js'

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
    mcp              Bootstrap default MCP servers for Claude
    tokens           Show current session token usage breakdown
    tokens hooks install  Install token lifecycle guard hook
    tokens hooks remove   Remove token lifecycle guard hook
    tokens hooks status   Show token hook installation status
    tokens hooks report   Anatomy map + waste analysis from ledger
    nano <desc>      SDD-lite: challenge, plan, build, review (inline)
    security         Install Claude Code runtime security hooks
    security audit   Show current security hook coverage
    telemetry        Persistent session telemetry with caching
    telemetry sessions  List recent sessions with details
    telemetry daily     Daily aggregation view
    telemetry weekly    Weekly aggregation view
    stats            Show session analytics (tokens, cost, tools)
    versions         Show installed agent versions
    efficiency on    Activate an efficiency profile (concise, automation, exploratory)
    efficiency off   Deactivate current efficiency profile
    efficiency list  List available efficiency profiles
    efficiency status Show current efficiency profile
    doctor           Show health report of current installation
    health           Audit AI agent configuration quality
    esp              Set up Claude ESP tmux integration
    update           Re-run setup for previously configured CLIs
    replication export  Export portable workstation replication profile
    replication show    Print portable workstation replication profile
    uninstall        Remove javidots managed files

  Options
    --dry-run       Preview without making changes
    --cli           Comma-separated list of CLIs (claude,opencode,gemini,qwen,codex,copilot)
    --ghagga        Enable ghagga code review
    --no-ghagga     Disable ghagga code review
    --kiteguard     Enable kiteguard runtime security
    --no-kiteguard  Disable kiteguard runtime security
    --preset        Preset: full, minimal, custom (default: custom)
    --output        Output path for replication export
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
    $ javidots nano "add retry logic to fetch helper"
    $ javidots security
    $ javidots security audit
    $ javidots efficiency on concise
    $ javidots efficiency off
    $ javidots efficiency list
    $ javidots doctor
    $ javidots esp
    $ javidots replication export
    $ javidots update
    $ javidots uninstall
`, {
  importMeta: import.meta,
  flags: {
    dryRun: { type: 'boolean', default: false },
    cli: { type: 'string', default: '' },
    ghagga: { type: 'boolean' },
    kiteguard: { type: 'boolean' },
    preset: { type: 'string', default: 'custom' },
    mode: { type: 'string', default: 'warn' },
    output: { type: 'string', default: '' },
  }
})

const subcommand = cli.input[0] ?? 'setup'

const ALL_CLIS: AI_CLI[] = ['claude', 'opencode', 'gemini', 'qwen', 'codex', 'copilot']
// When stdin doesn't support raw mode (pipes, subprocesses, CI), provide a fake
// stdin stream so Ink doesn't crash trying to enable raw mode on a non-TTY pipe.
const isTTY = process.stdin.isTTY === true
const fakeStdin = new PassThrough() as unknown as NodeJS.ReadStream
Object.defineProperty(fakeStdin, 'isTTY', { value: false })
const inkStdin = isTTY ? process.stdin : fakeStdin
const isCI = process.env['CI'] === '1' || process.env['CI'] === 'true' || !isTTY

switch (subcommand) {
  case 'sync': {
    render(<CIProvider isCI={isCI}><Sync mode="sync" dryRun={cli.flags.dryRun} /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'status': {
    render(<CIProvider isCI={isCI}><Sync mode="status" dryRun={false} /></CIProvider>, { stdin: inkStdin })
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
      </CIProvider>,
      { stdin: inkStdin }
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
      </CIProvider>,
      { stdin: inkStdin }
    )
    break
  }

  case 'mcp': {
    render(<CIProvider isCI={isCI}><Mcp dryRun={cli.flags.dryRun} /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'tokens': {
    const tokensSubcmd = cli.input[1]
    if (tokensSubcmd === 'hooks') {
      const hooksAction = cli.input[2] as 'install' | 'remove' | 'status' | 'report' | undefined
      const VALID_HOOK_ACTIONS = ['install', 'remove', 'status', 'report']
      const hookAction = hooksAction && VALID_HOOK_ACTIONS.includes(hooksAction) ? hooksAction : 'status'
      const hookMode = (cli.flags.mode === 'block' ? 'block' : 'warn') as import('./types/index.js').TokenHookMode
      render(
        <CIProvider isCI={isCI}>
          <TokenHooks action={hookAction} mode={hookMode} dryRun={cli.flags.dryRun} />
        </CIProvider>,
        { stdin: inkStdin }
      )
    } else {
      render(<CIProvider isCI={isCI}><Tokens /></CIProvider>, { stdin: inkStdin })
    }
    break
  }

  case 'nano': {
    const nanoDesc = cli.input.slice(1).join(' ')
    render(
      <CIProvider isCI={isCI}>
        <Nano description={nanoDesc} />
      </CIProvider>,
      { stdin: inkStdin }
    )
    break
  }

  case 'security': {
    const securityAction = cli.input[1]
    const securityMode = securityAction === 'audit' ? 'audit' as const : 'install' as const
    render(
      <CIProvider isCI={isCI}>
        <Security mode={securityMode} dryRun={cli.flags.dryRun} />
      </CIProvider>,
      { stdin: inkStdin }
    )
    break
  }

  case 'telemetry': {
    const telemetryAction = cli.input[1] as string | undefined
    const VALID_TELEMETRY_MODES = ['summary', 'sessions', 'daily', 'weekly']
    const telemetryMode: TelemetryMode = telemetryAction && VALID_TELEMETRY_MODES.includes(telemetryAction)
      ? telemetryAction as TelemetryMode
      : 'summary'
    render(
      <CIProvider isCI={isCI}>
        <Telemetry mode={telemetryMode} />
      </CIProvider>,
      { stdin: inkStdin }
    )
    break
  }

  case 'efficiency': {
    const effAction = cli.input[1] as 'on' | 'off' | 'list' | 'status' | undefined
    const effProfileId = cli.input[2] as EfficiencyProfileId | undefined

    // Inline rendering for this simple command — no UI component needed
    const {
      activateEfficiency,
      deactivateEfficiency,
      efficiencyStatus: showEffStatus,
      listEfficiencyProfiles,
    } = await import('./orchestrator/efficiency.js')

    const printStep = (step: import('./types/index.js').SetupStep) => {
      const icon = step.status === 'done' ? '\u2713' : step.status === 'error' ? '\u2717' : '\u2022'
      console.log(`  ${icon} ${step.label}${step.detail ? ` — ${step.detail}` : ''}`)
    }

    switch (effAction) {
      case 'on': {
        if (!effProfileId) {
          console.log('Usage: javidots efficiency on <concise|automation|exploratory>')
          break
        }
        await activateEfficiency(effProfileId, cli.flags.dryRun, printStep)
        break
      }
      case 'off':
        await deactivateEfficiency(cli.flags.dryRun, printStep)
        break
      case 'list':
        await listEfficiencyProfiles(printStep)
        break
      case 'status':
      default:
        await showEffStatus(printStep)
        break
    }
    break
  }

  case 'replication': {
    const replicationAction = cli.input[1] as 'export' | 'show' | undefined
    const {
      createPortableReplicationProfile,
      writePortableReplicationProfile,
    } = await import('./orchestrator/replication.js')
    const profile = createPortableReplicationProfile()

    if (replicationAction === 'show') {
      console.log(JSON.stringify(profile, null, 2))
      break
    }

    const outputPath = cli.flags.output || undefined
    const writtenPath = cli.flags.dryRun
      ? (outputPath ?? '~/.javidots/replication-profile.json')
      : writePortableReplicationProfile(profile, outputPath)
    console.log(`${cli.flags.dryRun ? 'Would write' : 'Wrote'} portable replication profile: ${writtenPath}`)
    console.log(`CLIs: ${profile.clis.join(', ')}`)
    console.log(`Tools: ${profile.tools.join(', ')}`)
    break
  }

  case 'stats': {
    render(<CIProvider isCI={isCI}><Stats mode="stats" /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'versions': {
    render(<CIProvider isCI={isCI}><Stats mode="versions" /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'doctor': {
    render(<CIProvider isCI={isCI}><Doctor /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'health': {
    render(<CIProvider isCI={isCI}><Health /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'esp': {
    render(<CIProvider isCI={isCI}><Esp /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'update': {
    render(<CIProvider isCI={isCI}><Update dryRun={cli.flags.dryRun} /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'uninstall': {
    render(<CIProvider isCI={isCI}><Uninstall /></CIProvider>, { stdin: inkStdin })
    break
  }

  case 'setup':
  default: {
    // Determine CLIs from --cli flag or --preset
    let preselectedClis: AI_CLI[] | undefined
    let presetGhagga: boolean | undefined
    let presetKiteguard: boolean | undefined
    let skipTUI = false

    if (cli.flags.preset === 'full') {
      preselectedClis = ALL_CLIS
      presetGhagga = true
      presetKiteguard = true
      skipTUI = true
    } else if (cli.flags.preset === 'minimal') {
      preselectedClis = ['claude']
      presetGhagga = false
      presetKiteguard = false
      skipTUI = true
    } else if (cli.flags.cli) {
      preselectedClis = cli.flags.cli.split(',').map(s => s.trim()) as AI_CLI[]
    }

    // --ghagga / --no-ghagga override preset (only when explicitly passed)
    const ghaggaExplicit = process.argv.includes('--ghagga') || process.argv.includes('--no-ghagga')
    if (ghaggaExplicit) {
      presetGhagga = cli.flags.ghagga
    }

    // --kiteguard / --no-kiteguard override preset (only when explicitly passed)
    const kiteguardExplicit = process.argv.includes('--kiteguard') || process.argv.includes('--no-kiteguard')
    if (kiteguardExplicit) {
      presetKiteguard = cli.flags.kiteguard
    }

    // If both clis and ghagga+kiteguard are set via flags (non-preset), skip TUI
    if (preselectedClis && presetGhagga !== undefined && presetKiteguard !== undefined && cli.flags.preset === 'custom') {
      skipTUI = true
    }

    render(
      <CIProvider isCI={isCI}>
        <App
          dryRun={cli.flags.dryRun}
          preselectedClis={preselectedClis}
          presetGhagga={presetGhagga}
          presetKiteguard={presetKiteguard}
          skipTUI={skipTUI}
        />
      </CIProvider>,
      { stdin: inkStdin }
    )
    break
  }
}
