# javi-dots

Bootstrap opinionado para preparar una maquina de desarrollo desde cero.

## Role

`javi-dots` es el entrypoint de workstation/bootstrap del ecosistema. Define perfiles, modulos y scripts de setup sin absorber la capa avanzada de IA ni el scaffolding de proyectos.

## Starter Layout

```text
javi-dots/
├── README.md
├── .gitignore
├── profiles/
├── modules/
└── scripts/
```

## Directory Intent

- `profiles/`: composiciones por contexto o tipo de maquina (`personal`, `work`, `minimal`, `ai-heavy`).
- `modules/`: unidades reutilizables de bootstrap para shell, terminal, editor, prompt y tooling base.
- `scripts/`: entrypoints de instalacion, sync y helpers livianos del bootstrap.

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
- `modules/forge/module.yaml` mapea exposiciones opcionales de project bootstrap a template IDs publicados por `javi-forge`.
- `javi-dots` puede leer manifests y entrypoints declarados por esos repos, pero no debe inferir comportamiento desde `packages/`, `templates/`, `scripts/` u otros directorios internos hermanos.
- Mientras dure esta etapa, la documentacion y los modulos consumidores deben preservar ese boundary y evitar reintroducir acoplamiento al layout legacy o al layout interno de `javi-ai` y `javi-forge`.

Referencias de gobierno para esta regla:

- `../javi-platform/docs/contracts/CONTRACT-INDEX.md`
- `../javi-platform/docs/ecosystem/ECOSYSTEM-MAP.md`
- `../javi-platform/docs/migration/CANONICAL-VS-MIRROR-GUIDE.md`

## Current State

Skeleton minimo creado para el split del ecosistema. No migra codigo legacy todavia.
