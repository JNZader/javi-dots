# Bootstrap Entrypoint

## Purpose

This document makes the first Wave 4 bootstrap slice canonical in `javi-dots`.
For the extracted slice below, contributors and users should start here instead of the legacy
bootstrap docs in `vault/Javi.Dots`.

## Canonical Scope

The current canonical bootstrap slice is:

- installer entrypoint: `scripts/bootstrap/apply.sh`
- profile: `profiles/base/profile.yaml`
- shell module: `modules/shell/fish/module.yaml`
- terminal module: `modules/terminal/ghostty/module.yaml`
- editor module: `modules/editor/zed/module.yaml`

These files are the source of truth for the extracted `fish`, `ghostty`, and `zed` assets.
New edits for this slice land in `javi-dots`.

## How To Apply The Slice

Preview the planned links:

```bash
scripts/bootstrap/apply.sh --dry-run
```

Apply the slice to the current home directory:

```bash
scripts/bootstrap/apply.sh --home "$HOME"
```

What the script manages today:

- `~/.config/fish/config.fish`
- `~/.config/fish/conf.d/nvm.fish`
- `~/.config/fish/fish_plugins`
- `~/.config/ghostty/config`
- `~/.config/ghostty/shaders/cursor_smear_gentleman.glsl`
- `~/.config/zed/settings.json`
- `~/.config/zed/keymap.json`

The script is intentionally non-destructive for this slice: existing files are skipped rather than overwritten.

## Boundary Rules

- `javi-dots` owns workstation/bootstrap behavior for this extracted slice.
- `javi-ai` integration stays behind `modules/ai/module.yaml` plus the published `javi-ai` manifests and install entrypoint.
- `javi-dots` must not recover behavior by reading `javi-ai` internal package or provider directories.
- `javi-forge` remains outside this slice except for the optional consumer mapping in `modules/forge/module.yaml`.

## Canonical Vs Reference During Migration

| Slice | Canonical owner | Reference-only legacy location | Status | Retirement condition |
|---|---|---|---|---|
| `installer.cli` | `javi-dots` | `vault/Javi.Dots/installer/` | canonical in target repo for extracted slice | later waves replace or retire remaining installer-only legacy flows |
| `shell.fish` | `javi-dots` | `vault/Javi.Dots/GentlemanFish/` | canonical in target repo for extracted slice | remaining fish assets are migrated or intentionally dropped |
| `terminal.ghostty` | `javi-dots` | `vault/Javi.Dots/GentlemanGhostty/` | canonical in target repo for extracted slice | remaining themes and extra shaders are migrated or retired |
| `editor.zed` | `javi-dots` | `vault/Javi.Dots/GentlemanZed/` | canonical in target repo for extracted slice | remaining zed assets are migrated or retired |
| bootstrap docs for this slice | `javi-dots` | `vault/Javi.Dots/docs/manual-installation.md`, `vault/Javi.Dots/docs/tui-installer.md` | canonical in target repo for extracted slice | legacy docs are updated, mirrored, or retired once broader bootstrap cutover lands |

Rule of thumb: if a change affects the extracted slice above, edit `javi-dots` first and treat the
legacy paths as reference-only migration input.

## Verification Notes

This doc follows the Wave 4 verification approach by making all of these explicit:

- the extracted slice lives in the owning repo
- `javi-dots` is the documented canonical bootstrap entrypoint for the slice
- remaining legacy copies are reference-only, not canonical
- AI integration remains contract-only and does not depend on `javi-ai` internals

Governance references:

- `../javi-platform/openspec/changes/ecosystem-restructure/verification.md`
- `../javi-platform/docs/checklists/AUTHORITY-CUTOVER-CHECKLIST.md`
- `../javi-platform/docs/migration/CANONICAL-VS-MIRROR-GUIDE.md`
