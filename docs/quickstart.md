# Quickstart — javi-dots

Get your development machine set up in under 5 minutes.

## What You Get

| Flow | What it installs |
|---|---|
| **base** | fish shell, ghostty terminal, zed editor |
| **ai-core** | base + one AI coding assistant (Claude, OpenCode, Gemini, Qwen, Codex, or Copilot) |
| **forge** | base + project scaffolding via javi-forge templates |
| **full** | base + AI + forge together |

## Prerequisites

- git
- A POSIX-compatible shell (sh, bash, zsh, fish)
- The repos cloned as siblings:

  ```
  platform/
  ├── javi-dots/     ← you are here
  ├── javi-ai/       ← required for AI flows
  └── javi-forge/    ← required for forge flows
  ```

If you only want the workstation slice, only `javi-dots` is needed.

---

## Step 1 — Preview your setup (dry-run)

Always preview before applying. The dry-run flag prints every planned action without touching your filesystem.

```sh
# Clone the repo
git clone https://github.com/JNZader/javi-dots.git
cd javi-dots

# Preview base workstation
scripts/javi.sh --preset base --dry-run --home "$HOME"
```

---

## Step 2 — Apply the base workstation

```sh
scripts/javi.sh --preset base --home "$HOME"
```

This symlinks:

- `~/.config/fish/config.fish`
- `~/.config/fish/conf.d/nvm.fish`
- `~/.config/fish/fish_plugins`
- `~/.config/ghostty/config`
- `~/.config/ghostty/shaders/cursor_smear_gentleman.glsl`
- `~/.config/zed/settings.json`
- `~/.config/zed/keymap.json`

All links are non-destructive — existing files are skipped, not overwritten.

---

## Step 3 — Add an AI coding assistant (optional)

Choose your AI provider. Preview it first:

```sh
# See all supported AI provider choices
scripts/bootstrap/apply-ai.sh --list-choices

# Preview Claude Code setup
scripts/javi.sh --preset ai-core --ai-choice ai.claude.user --dry-run --home "$HOME"

# Apply base + Claude Code
scripts/javi.sh --preset ai-core --ai-choice ai.claude.user --home "$HOME"
```

**Supported AI choices:**

| Choice ID | Provider |
|---|---|
| `ai.claude.user` | Claude Code |
| `ai.opencode.user` | OpenCode |
| `ai.gemini.user` | Gemini CLI |
| `ai.qwen.user` | Qwen Code |
| `ai.codex.user` | Codex CLI |
| `ai.copilot.repo` | GitHub Copilot (repo-scoped) |

---

## Step 4 — Initialize a project (optional)

Use the forge integration to scaffold a new project:

```sh
# See all supported forge template and generator choices
scripts/bootstrap/apply-forge.sh --list-choices

# Preview a new web project
scripts/javi.sh --preset forge \
  --template-choice forge.template.web.base \
  --project-name my-app \
  --destination ~/projects \
  --dry-run --home "$HOME"

# Generate the project
scripts/javi.sh --preset forge \
  --template-choice forge.template.web.base \
  --project-name my-app \
  --destination ~/projects \
  --home "$HOME"
```

**Supported template choices:**

| Choice ID | What it generates |
|---|---|
| `forge.template.web.base` | Web/Node CI baseline |
| `forge.template.api.base` | API/backend CI (language-agnostic) |
| `forge.template.fullstack.base` | Parallel frontend + backend CI |
| `forge.template.docs.base` | Docs build + GitHub Pages deploy |

**Supported generator choices:**

| Choice ID | What it generates |
|---|---|
| `forge.generator.review.automation` | GHAGGA AI code review GitHub Action |

---

## Full setup in one command

```sh
scripts/javi.sh --preset full \
  --ai-choice ai.claude.user \
  --template-choice forge.template.web.base \
  --project-name my-app \
  --destination ~/projects \
  --home "$HOME"
```

This applies base workstation + Claude Code + web project scaffold.

---

## Individual scripts

The unified entrypoint composes these atomic scripts — they still work independently:

```sh
# Workstation only
scripts/bootstrap/apply.sh --home "$HOME"

# AI only
scripts/bootstrap/apply-ai.sh --choice ai.claude.user

# Forge project scaffold only
scripts/bootstrap/apply-forge.sh \
  --template-choice forge.template.web.base \
  --project-name my-app
```

---

## Next steps

- Read the canonical bootstrap docs:
  - `docs/bootstrap-entrypoint.md` — workstation slice details
  - `docs/ai-bootstrap-entrypoint.md` — AI bootstrap contract details
- Browse `modules/` to understand what each module owns
- Browse `profiles/base/profile.yaml` for the current profile composition
