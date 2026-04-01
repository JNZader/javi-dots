# Architecture

## Ecosystem Overview

`javi-dots` is one of three npm packages that form the developer platform:

```mermaid
flowchart TB
    subgraph "Workstation Setup"
        DOTS["javi-dots<br/>Workstation orchestrator"]
    end

    subgraph "AI Layer"
        AI["javi-ai<br/>Skills, configs, orchestrators"]
    end

    subgraph "Project Bootstrap"
        FORGE["javi-forge<br/>Scaffolding, CI, templates"]
    end

    subgraph "External Dependencies"
        ATL["agent-teams-lite<br/>SDD framework"]
        ENG["engram<br/>Persistent memory"]
        GHA["ghagga<br/>Code review"]
    end

    DOTS --> AI
    DOTS --> ATL
    DOTS --> ENG
    DOTS -.-> GHA
    FORGE --> AI
    FORGE -.-> GHA

    style DOTS fill:#06b6d4,color:#fff
    style AI fill:#f97316,color:#fff
    style FORGE fill:#f97316,color:#fff
```

## Setup Flow

The setup command runs four sequential steps. Each step reports its status in real-time through the Ink TUI.

```mermaid
sequenceDiagram
    participant CLI as User Terminal
    participant App as javi-dots
    participant JAI as javi-ai
    participant Git as git
    participant Brew as brew
    participant Eng as engram
    participant Gha as ghagga

    CLI->>App: npx javi-dots setup
    App->>App: Parse flags / preset
    App->>App: Show TUI (if custom)

    rect rgb(6, 182, 212, 0.1)
        Note over App,JAI: Step 1: AI Framework
        App->>JAI: npx javi-ai install --cli claude,opencode,...
        JAI-->>App: done / error
    end

    rect rgb(6, 182, 212, 0.1)
        Note over App,Git: Step 2: SDD Framework
        App->>Git: git clone agent-teams-lite
        Git-->>App: cloned
        App->>App: Run setup.sh per CLI (mapped names)
    end

    rect rgb(6, 182, 212, 0.1)
        Note over App,Eng: Step 3: Persistent Memory
        App->>Brew: brew install engram
        Brew-->>App: installed
        App->>Eng: engram setup <cli> (per CLI)
        Eng-->>App: configured
    end

    rect rgb(6, 182, 212, 0.1)
        Note over App,Gha: Step 4: Code Review (optional)
        App->>Gha: ghagga init
        Gha-->>App: configured
    end

    App->>App: Write manifest.json
    App-->>CLI: Setup complete
```

## Component Relationships

```mermaid
graph LR
    subgraph "~/.javidots/"
        MF["manifest.json"]
        ATL["agent-teams-lite/"]
        ESP["esp-toggle.sh"]
    end

    subgraph "~/.claude/ (or other CLI config)"
        SK["skills/"]
        AG["agents/"]
        CF["config files"]
        HK["hooks/"]
    end

    subgraph "~/.wolf/"
        WS["sessions/*.jsonl"]
    end

    subgraph "System"
        ENG["engram binary"]
        GHA["ghagga binary"]
    end

    DOTS["javi-dots"] --> MF
    DOTS --> ATL
    DOTS -->|"delegates to"| AI["javi-ai"]
    AI --> SK
    AI --> AG
    AI --> CF
    AI --> HK
    DOTS -->|"brew install"| ENG
    DOTS -->|"optional"| GHA
    DOTS -->|"health audit"| SK
    DOTS -->|"health audit"| HK
    DOTS -->|"esp toggle"| ESP
    DOTS -->|"token ledger"| WS
```

## Orchestrator Modules

The `src/orchestrator/` directory contains the implementation for each command:

| Module | Command | Description |
|--------|---------|-------------|
| `index.ts` | `setup` | Main setup orchestrator |
| `doctor.ts` | `doctor` | Installation health check |
| `update.ts` | `update` | Re-run setup from manifest |
| `uninstall.ts` | `uninstall` | Clean removal |
| `health.ts` | `health` | AI config quality audit |
| `esp.ts` | `esp` | ESP tmux integration |
| `mcp.ts` | `mcp` | MCP server auto-setup |
| `tokens.ts` | `tokens` | Token tracking and reporting |
| `nano.ts` | `nano` | SDD-lite inline workflow |
| `utils.ts` | — | Shared utilities (`which`, `readFileIfExists`, `tokenEstimate`) |

## Manifest Format

The manifest at `~/.javidots/manifest.json` tracks the installation state:

```json
{
  "version": "0.1.0",
  "installedAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "clis": ["claude", "opencode"],
  "engram": true,
  "sdd": true,
  "ghagga": false
}
```

The `update` command re-reads this manifest and runs setup with the same configuration. The `uninstall` command reads it to know what to clean up.

## Tech Stack

| Component | Technology |
|-----------|------------|
| CLI framework | [meow](https://github.com/sindresorhus/meow) |
| TUI rendering | [Ink](https://github.com/vadimdemedes/ink) (React for CLI) |
| Language | TypeScript (strict) |
| Runtime | Node.js 18+ |
| Testing | Vitest + Stryker mutation testing |
