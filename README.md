# javi-dots

Bootstrap opinionado para preparar una maquina de desarrollo desde cero.

## Role

`javi-dots` es el entrypoint de workstation/bootstrap del ecosistema. Define perfiles, modulos y scripts de setup sin absorber la capa avanzada de IA ni el scaffolding de proyectos.

Para el slice ya extraido en Wave 4, este repo tambien es el entrypoint canonico de bootstrap: la forma soportada de aplicar `fish`, `ghostty` y `zed` para el perfil base vive aca, no en `vault/Javi.Dots`.

## Quick Start

```sh
# Interactive TUI installer (easiest)
scripts/tui.sh

# Or use the unified orchestrator directly:

# Preview what will change before touching anything
scripts/javi.sh --preset base --dry-run --home "$HOME"

# Apply base workstation (fish + ghostty + zed)
scripts/javi.sh --preset base --home "$HOME"

# Apply work profile (base + Claude Code)
scripts/javi.sh --profile work --ai-choice ai.claude.user --home "$HOME"

# Apply personal profile (base + ai-full + forge)
scripts/javi.sh --profile personal --ai-choice ai.claude.user --home "$HOME"

# Apply ai-heavy profile (base + all 6 providers)
scripts/javi.sh --profile ai-heavy --home "$HOME"

# Install a single module (e.g. tmux)
scripts/javi.sh --module tmux --home "$HOME"

# Discover everything
scripts/javi.sh --list-presets
scripts/javi.sh --list-profiles
scripts/javi.sh --list-modules
```

See `docs/quickstart.md` for a step-by-step first-time setup guide.

## Starter Layout

```text
javi-dots/
├── README.md
├── .gitignore
├── profiles/
│   ├── base/          # base workstation
│   ├── minimal/       # base only (no AI/forge)
│   ├── work/          # base + one AI provider
│   ├── personal/      # base + ai-full + forge
│   └── ai-heavy/      # base + all 6 AI providers
├── modules/
│   ├── ai/            # AI consumer mapping
│   ├── bootstrap/     # module registry
│   ├── editor/zed/    # Zed editor
│   ├── forge/         # forge consumer mapping
│   ├── multiplexer/
│   │   ├── tmux/      # Tmux + TPM
│   │   └── zellij/    # Zellij + layouts
│   ├── prompt/
│   │   └── starship/  # Starship prompt
│   ├── shell/
│   │   ├── fish/      # Fish + nvm
│   │   └── zsh/       # Zsh + Oh-My-Zsh + P10k
│   └── terminal/
│       ├── ghostty/   # Ghostty terminal
│       └── wezterm/   # WezTerm terminal
├── scripts/
│   ├── javi.sh        # unified orchestrator (presets, profiles, modules)
│   ├── tui.sh         # interactive whiptail installer
│   └── bootstrap/
│       ├── apply.sh   # workstation module linker
│       ├── apply-ai.sh    # AI consumer wrapper
│       └── apply-forge.sh # forge consumer wrapper
└── docs/
    ├── quickstart.md
    ├── bootstrap-entrypoint.md
    └── ai-bootstrap-entrypoint.md
```

## Directory Intent

- `profiles/`: composiciones por contexto o tipo de maquina (`personal`, `work`, `minimal`, `ai-heavy`).
- `modules/`: unidades reutilizables de bootstrap para shell, terminal, editor, prompt y tooling base.
- `scripts/`: entrypoints de instalacion, sync y helpers livianos del bootstrap.
- `modules/bootstrap/`: registro del slice inicial de extraccion para installer, shell, terminal y editor.
- `modules/shell/`, `modules/terminal/`, `modules/editor/`: slots canonicos donde se alojan los primeros modulos extraidos.
- `scripts/bootstrap/`: skeleton de entrypoints locales de bootstrap sin acoplarse a internals de IA.

## Boundaries

Este repo debe concentrarse en:

- bootstrap de sistema y entorno de desarrollo
- perfiles por contexto o tipo de maquina
- modulos reutilizables de setup
- defaults razonables para dejar la maquina lista para trabajar

Este repo no deberia ser el hogar principal de:

- colecciones grandes de agentes, skills, hooks o MCPs
- personalizacion avanzada de Claude, OpenCode, Gemini, Codex o similares
- templates de proyectos, scaffolding o CI reusable por stack

## Ecosystem Fit

- `../javi-ai`: capa avanzada de IA y comportamiento de asistentes, consumida luego por contratos estables.
- `../javi-forge`: templates, generadores y estandares de arranque de proyectos.
- `../vault/Javi.Dots`: referencia legacy para rescatar decisiones, no origen activo.
- `../docs/adr/ADR-0001-repo-boundaries.md`: boundary source of truth.

## Consumer Contract Guidance

Durante la migracion, `javi-dots` consume a los repos hermanos por contratos publicados, no por paths internos.

- `modules/ai/module.yaml` mapea elecciones de bootstrap a provider IDs, package IDs y target IDs publicados por `javi-ai`.
- `scripts/bootstrap/apply-ai.sh` es el wrapper consumidor para el flujo AI del bootstrap y delega solo al entrypoint publico `javi-ai/scripts/install-profiles.sh`.
- `modules/forge/module.yaml` mapea exposiciones opcionales de project bootstrap a template IDs publicados por `javi-forge`.
- `javi-dots` puede leer manifests y entrypoints declarados por esos repos, pero no debe inferir comportamiento desde `packages/`, `templates/`, `scripts/` u otros directorios internos hermanos.
- Mientras dure esta etapa, la documentacion y los modulos consumidores deben preservar ese boundary y evitar reintroducir acoplamiento al layout legacy o al layout interno de `javi-ai` y `javi-forge`.

Referencias de gobierno para esta regla:

- `../javi-platform/docs/contracts/CONTRACT-INDEX.md`
- `../javi-platform/docs/ecosystem/ECOSYSTEM-MAP.md`
- `../javi-platform/docs/migration/CANONICAL-VS-MIRROR-GUIDE.md`

## Canonical Bootstrap Slice

El slice bootstrap extraido se orquesta desde `scripts/javi.sh` y compone:

- `profiles/base/profile.yaml`
- `modules/shell/fish/module.yaml`
- `modules/terminal/ghostty/module.yaml`
- `modules/editor/zed/module.yaml`

Los scripts atomicos tambien siguen disponibles de forma independiente:

```bash
# Entrypoint unificado (recomendado)
scripts/javi.sh --preset base --home "$HOME"

# Scripts atomicos (uso directo)
scripts/bootstrap/apply.sh --home "$HOME"
scripts/bootstrap/apply-ai.sh --choice ai.claude.user
scripts/bootstrap/apply-forge.sh --template-choice forge.template.web.base --project-name my-app
```

Documentacion canonica:

- `docs/quickstart.md` — guia de primera vez (recomendada)
- `docs/bootstrap-entrypoint.md` — detalles del slice workstation
- `docs/ai-bootstrap-entrypoint.md` — contrato AI bootstrap

## Current State

El milestone `javi-dots-completion` trae `javi-dots` a 100% practico.

Scripts:

- `scripts/javi.sh` — orchestrator con presets, profiles, module flags, y genuine ai-full
- `scripts/tui.sh` — interactive whiptail installer
- `scripts/bootstrap/apply.sh` — workstation linker con soporte de modulos individuales
- `scripts/bootstrap/apply-ai.sh` — AI consumer wrapper
- `scripts/bootstrap/apply-forge.sh` — forge consumer wrapper

Modulos implementados (10):

- `shell.fish` — Fish shell + nvm
- `shell.zsh` — Zsh + Oh-My-Zsh + Powerlevel10k
- `terminal.ghostty` — Ghostty terminal + shader
- `terminal.wezterm` — WezTerm terminal + Gentleman theme
- `multiplexer.tmux` — Tmux + TPM plugins + Kanagawa theme
- `multiplexer.zellij` — Zellij + vim keybindings + work layouts
- `prompt.starship` — Starship cross-shell prompt
- `editor.zed` — Zed editor settings + keymap

Perfiles disponibles (5):

- `base`, `minimal`, `work`, `personal`, `ai-heavy`

Las docs legacy en `vault/Javi.Dots` quedan como referencia/mirror solamente.
