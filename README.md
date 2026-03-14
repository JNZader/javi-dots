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

## Current State

Skeleton minimo creado para el split del ecosistema. No migra codigo legacy todavia.
