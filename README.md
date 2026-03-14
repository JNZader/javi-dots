# javi-dots

Bootstrap opinionado para preparar una maquina de desarrollo desde cero.

## Role

`javi-dots` es el entrypoint de workstation/bootstrap del ecosistema. Define perfiles, modulos y scripts de setup sin absorber la capa avanzada de IA ni el scaffolding de proyectos.

Para el slice ya extraido en Wave 4, este repo tambien es el entrypoint canonico de bootstrap: la forma soportada de aplicar `fish`, `ghostty` y `zed` para el perfil base vive aca, no en `vault/Javi.Dots`.

## Quick Start

```sh
# Preview what will change before touching anything
scripts/javi.sh --preset base --dry-run --home "$HOME"

# Apply base workstation (fish + ghostty + zed)
scripts/javi.sh --preset base --home "$HOME"

# Apply base + Claude Code
scripts/javi.sh --preset ai-core --ai-choice ai.claude.user --home "$HOME"

# Apply everything: base + AI + web project scaffold
scripts/javi.sh --preset full \
  --ai-choice ai.claude.user \
  --template-choice forge.template.web.base \
  --project-name my-app \
  --home "$HOME"

# See all presets, AI choices, and forge choices
scripts/javi.sh --list-presets
scripts/bootstrap/apply-ai.sh --list-choices
scripts/bootstrap/apply-forge.sh --list-choices
```

See `docs/quickstart.md` for a step-by-step first-time setup guide.

## Starter Layout

```text
javi-dots/
├── README.md
├── .gitignore
├── profiles/
│   └── base/
├── modules/
│   ├── ai/
│   ├── bootstrap/
│   ├── editor/
│   ├── forge/
│   ├── shell/
│   └── terminal/
├── scripts/
│   ├── javi.sh               ← unified bootstrap orchestrator
│   └── bootstrap/
│       ├── apply.sh           ← workstation slice
│       ├── apply-ai.sh        ← AI consumer wrapper
│       └── apply-forge.sh     ← forge consumer wrapper
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

El milestone `dots-bootstrap-orchestration` convierte `javi-dots` en la capa de orquestacion limpia sobre los contratos estables de `javi-ai` y `javi-forge`.

- `scripts/javi.sh` — entrypoint unificado con presets (`base`, `ai-core`, `ai-full`, `forge`, `full`)
- `scripts/bootstrap/apply-forge.sh` — wrapper consumidor de forge (analogous to apply-ai.sh)
- `modules/forge/module.yaml` — estado cutover-complete con bindings de generadores
- `docs/quickstart.md` — guia de primera vez

Los assets del slice ya migrado (fish, ghostty, zed) permanecen canonicos en `javi-dots`.
Las docs legacy en `vault/Javi.Dots` quedan como referencia/mirror solamente.
