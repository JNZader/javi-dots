# AI Bootstrap Entrypoint

## Purpose

This document records the WI-026 cutover for migrated bootstrap AI flows.

For the migrated bootstrap slice in `javi-dots`, AI setup now starts here instead
of from legacy AI installer notes in `vault/Javi.Dots`.

## Canonical Flow

Use the local consumer wrapper:

```bash
scripts/bootstrap/apply-ai.sh --list-choices
scripts/bootstrap/apply-ai.sh --choice ai.claude.user --dry-run
```

What this flow does:

- resolves one published bootstrap choice from `modules/ai/module.yaml`
- forwards only published provider, package, and target IDs to the public
  `javi-ai/scripts/install-profiles.sh` entrypoint
- keeps bootstrap ownership in `javi-dots` without reading `javi-ai` internal
  provider or package directories

## Supported Bootstrap Choices

| Choice ID | Provider ID | Package ID | Target ID |
|---|---|---|---|
| `ai.claude.user` | `claude` | `provider.claude.core` | `target.claude.user` |
| `ai.opencode.user` | `opencode` | `provider.opencode.core` | `target.opencode.user` |
| `ai.gemini.user` | `gemini` | `provider.gemini.core` | `target.gemini.user` |
| `ai.qwen.user` | `qwen` | `provider.qwen.core` | `target.qwen.user` |
| `ai.codex.user` | `codex` | `provider.codex.core` | `target.codex.user` |
| `ai.copilot.repo` | `copilot` | `provider.copilot.core` | `target.copilot.repo` |

Each choice is part of the `ai-minimal` bootstrap preset and routes through the
published `javi-ai` install contract.

## Boundary Rules

- `javi-dots` owns the bootstrap-side wrapper and the user-facing flow.
- `javi-ai` owns provider/package/target contracts plus the public install
  entrypoint.
- migrated bootstrap flows do not fallback to legacy AI installer docs, scripts,
  or path-coupled behavior in `vault/Javi.Dots`.
- any future AI bootstrap choice must be added through `modules/ai/module.yaml`
  and the public `javi-ai` contract surfaces, not through legacy notes.

## Legacy Status

For this migrated flow, legacy AI setup docs in `vault/Javi.Dots` are now
reference-only. They may still exist for historical context, but they are not the
supported bootstrap authority for migrated `javi-dots` AI flows.

## Verification Notes

This cutover satisfies the bootstrap authority checks for WI-026 by making all of
these explicit:

- `javi-dots` provides the local bootstrap AI entrypoint
- the flow delegates only to `javi-ai/scripts/install-profiles.sh`
- provider/package/target selection stays on published IDs
- the migrated bootstrap flow no longer needs legacy AI validation behavior

Governance references:

- `../javi-platform/openspec/changes/ecosystem-restructure/verification.md`
- `../javi-platform/openspec/changes/ecosystem-restructure/coexistence.md`
- `../javi-platform/docs/checklists/AUTHORITY-CUTOVER-CHECKLIST.md`
