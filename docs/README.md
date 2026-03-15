# javi-dots

> **Opinionated development machine setup.** One command to go from a fresh machine to a fully configured workstation with AI coding tools, project scaffolding, and a beautiful terminal environment.

---

## Ecosystem Overview

```mermaid
graph TB
    subgraph DOTS["javi-dots · Workstation"]
        JS["scripts/javi.sh\n(orchestrator)"]
        TUI["scripts/tui.sh\n(interactive)"]
        MOD["8 modules\nfish · ghostty · zed\nwezterm · tmux · zellij\nstarship · zsh"]
        PROF["5 profiles\nminimal · base · work\npersonal · ai-heavy"]
    end

    subgraph AI["javi-ai · AI Layer"]
        PROV["6 Providers\nClaude · OpenCode · Gemini\nQwen · Codex · Copilot"]
        PKGS["7 Shared Packages\nskills · agents · hooks\ncommands · mcp · memory"]
        PPKG["4 Project Packages\nai.instructions · sdd.base\nmemory.engram · ai.review"]
    end

    subgraph FORGE["javi-forge · Scaffolding"]
        TMPL["7 Templates\nweb · api-base · api-go\napi-java · api-python\nfullstack · docs"]
        GEN["3 Generators\nci.bootstrap\nreview.automation\nproject.init"]
    end

    JS -->|"apply-ai.sh\n(published contracts)"| PROV
    JS -->|"apply-forge.sh\n(published contracts)"| TMPL & GEN
    JS --> MOD
    PROF --> JS
    TUI --> JS
    PKGS --> PROV
    PPKG --> TMPL
```

---

## Quick Start

```bash
git clone https://github.com/JNZader/javi-dots.git
cd javi-dots

# Interactive installer
scripts/tui.sh

# Or direct command
scripts/javi.sh --preset base --home "$HOME"
```

See [Getting Started](/getting-started) for a complete walkthrough.

---

## What's included

- **[Modules](/modules)** — 8 workstation modules: fish, ghostty, zed, wezterm, tmux, zellij, starship, zsh
- **[Profiles](/profiles)** — 5 named profiles: minimal, base, work, personal, ai-heavy
- **[AI Integration](/ai-integration)** — 6 AI providers via javi-ai contracts
- **[Forge Integration](/forge-integration)** — 7 templates + 3 generators via javi-forge contracts
- **[TUI Installer](/tui)** — Interactive whiptail-based setup wizard
- **[Architecture](/architecture)** — All Mermaid diagrams
