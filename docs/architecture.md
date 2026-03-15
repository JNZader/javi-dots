# Architecture

All Mermaid diagrams for the javi ecosystem in one place.

---

## Ecosystem Architecture

The four repos and their relationships:

```mermaid
graph TB
    subgraph PLATFORM["javi-platform · Governance"]
        ADR["ADRs"]
        SDD["SDD Change\nArtifacts"]
        CNTR["Contract\nRegistry"]
    end

    subgraph DOTS["javi-dots · Workstation Orchestration"]
        JS["scripts/javi.sh\nUnified Orchestrator"]
        TUI["scripts/tui.sh\nInteractive TUI"]
        MOD["8 Modules\nfish · ghostty · zed\nwezterm · tmux · zellij\nstarship · zsh"]
        PROF["5 Profiles\nminimal · base · work\npersonal · ai-heavy"]
        BS["Bootstrap Layer\napply.sh · apply-ai.sh\napply-forge.sh"]
    end

    subgraph AI["javi-ai · AI Layer"]
        PROV["6 Provider Profiles\nClaude Code · OpenCode\nGemini CLI · Qwen Code\nCodex CLI · Copilot"]
        PKGS["7 Shared Packages\ninstruct · agents · skills\nhooks · commands · mcp · memory"]
        PPKG["4 Project Packages\nai.instructions · sdd.base\nmemory.engram · ai.review"]
    end

    subgraph FORGE["javi-forge · Project Scaffolding"]
        TMPL["7 Templates\nweb.base · api.base · api.go\napi.java · api.python\nfullstack.base · docs.base"]
        GEN["3 Generators\nproject.init · ci.bootstrap\nreview.automation"]
        FI["scripts/forge-init.sh"]
    end

    TUI -->|delegates to| JS
    PROF -->|drives| JS
    JS --> BS
    BS -->|"published contract IDs"| AI
    BS -->|"published contract IDs"| FORGE
    BS --> MOD
    CNTR -->|governs| BS
    PKGS --> PROV
    PPKG --> TMPL
```

---

## javi-dots Orchestration Flow

How `javi.sh` routes work to the bootstrap layer:

```mermaid
flowchart TD
    A([scripts/javi.sh]) --> B{Mode}
    B -->|"--preset / --profile"| C[Resolve Preset]
    B -->|"--module"| D[Single Module\nInstall]
    B -->|"--interactive"| E[TUI Wizard\nscripts/tui.sh]
    C --> F["apply.sh\nSymlink Workstation Modules"]
    F --> G["fish · ghostty · zed\nwezterm · tmux · zellij\nstarship · zsh"]
    C --> H{AI preset?}
    H -->|yes| I["apply-ai.sh\n--choice ai.*.user"]
    I --> J["javi-ai\nscripts/install-profiles.sh"]
    J --> K["Claude · OpenCode\nGemini · Qwen\nCodex · Copilot"]
    C --> L{Forge preset?}
    L -->|yes| M["apply-forge.sh\n--template-choice"]
    M --> N["javi-forge\nscripts/forge-init.sh"]
    N --> O["Templates\nGenerators\nCI Workflows"]
```

---

## javi-ai Provider and Package Architecture

How shared packages compose into provider profiles and project packages:

```mermaid
graph TD
    subgraph SHARED["Shared Packages"]
        SI["shared.instructions"]
        SA["shared.agents"]
        SK["shared.skills"]
        SH["shared.hooks"]
        SC["shared.commands"]
        SM["shared.mcp"]
        SME["shared.memory"]
    end

    subgraph PROVIDERS["Provider Profiles"]
        PC["provider.claude.core\n→ ~/.claude/"]
        PO["provider.opencode.core\n→ ~/.config/opencode/"]
        PG["provider.gemini.core\n→ ~/.gemini/"]
        PQ["provider.qwen.core\n→ ~/.config/qwen/"]
        PX["provider.codex.core\n→ ~/.codex/"]
        PP["provider.copilot.core\n→ .github/copilot/"]
    end

    subgraph PROJECT["Project Packages"]
        PAI["project.ai.instructions"]
        PS["project.sdd.base"]
        PME["project.memory.engram"]
        PR["project.ai.review"]
    end

    SI --> PC & PO & PG & PQ & PX & PP
    SA --> PC & PO
    SK --> PC & PO
    SH --> PC
    SC --> PO
    SME --> PME

    SI --> PAI
    SI & SA --> PS
    SI & SME --> PME
    SH & SA & SI --> PR
```

---

## javi-forge Template and Generator Flow

How forge-init.sh routes templates and generators:

```mermaid
flowchart LR
    CLI(["forge-init.sh"])
    CLI --> TV["Validate request"]

    TV --> TP{"Template?"}
    TP -->|"web.base"| TW["Node.js CI"]
    TP -->|"api.base"| TA["Generic API"]
    TP -->|"api.go"| TG["Go + golangci-lint"]
    TP -->|"api.java"| TJ["Gradle + Spotless"]
    TP -->|"api.python"| TPY["ruff + pytest"]
    TP -->|"fullstack.base"| TFS["Parallel CI"]
    TP -->|"docs.base"| TD["MkDocs + Pages"]

    TV --> GP{"Generator?"}
    GP -->|"review.automation"| GRA["ghagga.yml\n(GitHub Action)"]
    GP -->|"review.automation\nself-hosted"| GRS["ghagga-selfhosted.yml"]
    GP -->|"ci.bootstrap"| GCI[".ci-local/ only"]

    TW & TA & TG & TJ & TPY & TFS & TD --> OUT[("Generated Project")]
    GRA & GRS & GCI --> OUT
```

---

## Bootstrap Sequence

End-to-end flow from TUI to installed workstation:

```mermaid
sequenceDiagram
    participant User
    participant tui.sh
    participant javi.sh
    participant apply.sh
    participant javi-ai
    participant javi-forge

    User->>tui.sh: scripts/tui.sh
    tui.sh->>tui.sh: show preset/profile menu
    tui.sh->>tui.sh: show provider menu (if AI)
    tui.sh->>tui.sh: show confirm screen
    tui.sh->>javi.sh: --preset full --ai-choice ai.claude.user --template-choice forge.template.api.go

    javi.sh->>apply.sh: install workstation modules
    apply.sh->>apply.sh: symlink fish · ghostty · zed · wezterm · tmux · zellij · starship · zsh
    apply.sh-->>User: linked: ~/.config/fish/config.fish ...

    javi.sh->>javi-ai: install-profiles.sh --provider claude --target target.claude.user
    javi-ai->>javi-ai: link settings.json · statusline.sh · tweakcc-theme.json
    javi-ai-->>User: linked: ~/.claude/settings.json

    javi.sh->>javi-forge: forge-init.sh --template template.api.go --project-name my-api
    javi-forge->>javi-forge: generate CI workflow · dependabot · ci-local · .gitignore
    javi-forge-->>User: result: forge slice generated in ~/my-api
```

---

## TUI Menu Flow

```mermaid
flowchart TD
    A([Start tui.sh]) --> B[Welcome Screen]
    B --> C{Main Menu}
    C -->|Preset| D["Select Preset\nbase · ai-core · ai-full\nforge · full"]
    C -->|Profile| E["Select Profile\nminimal · work · personal · ai-heavy"]
    C -->|Module| F["Select Module\nfish · ghostty · zed\nwezterm · tmux · zellij\nstarship · zsh"]
    C -->|Exit| Z([Exit])
    D --> G{Needs AI?}
    E --> G
    G -->|yes| H["Select Provider\nClaude · OpenCode · Gemini\nQwen · Codex · Copilot"]
    G -->|no| I["Confirm Screen\nshows javi.sh command"]
    H --> I
    F --> I
    I -->|Yes| J[Execute javi.sh]
    I -->|No| C
    J --> K([Done!])
```
