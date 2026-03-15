# Profiles

Named profiles are predefined combinations of presets and options. They make it easy to reproduce a consistent machine setup without remembering all the flags.

---

## Available profiles

```bash
scripts/javi.sh --list-profiles
```

| Profile | Preset equivalent | AI required | Description |
|---------|------------------|-------------|-------------|
| `minimal` | `base` | — | Base workstation only |
| `work` | `ai-core` | `--ai-choice` | Base + one AI provider |
| `personal` | `full` | `--ai-choice` | Base + ai-full + forge |
| `ai-heavy` | custom | — | Base + all 6 providers |

---

## `minimal`

**For:** servers, VMs, clean baseline, or environments where AI tools are not needed.

```bash
scripts/javi.sh --profile minimal --home "$HOME"
```

**Installs:**
- fish shell config
- ghostty terminal config
- zed editor settings

**Does not install:** AI tools, forge project scaffolding

---

## `work`

**For:** work laptops and managed machines — one AI provider alongside the base workstation.

```bash
# See available AI provider choices
scripts/bootstrap/apply-ai.sh --list-choices

# Apply work profile
scripts/javi.sh --profile work --ai-choice ai.claude.user --home "$HOME"
```

**Installs:**
- Everything in `minimal`
- One AI provider profile (e.g. Claude Code settings, statusline, theme)

**AI choices:** `ai.claude.user` · `ai.opencode.user` · `ai.gemini.user` · `ai.qwen.user` · `ai.codex.user` · `ai.copilot.repo`

---

## `personal`

**For:** personal development machines — full AI setup with shared packages, plus forge for project scaffolding.

```bash
scripts/javi.sh --profile personal \
  --ai-choice ai.claude.user \
  --home "$HOME"

# With a project to scaffold
scripts/javi.sh --profile personal \
  --ai-choice ai.claude.user \
  --template-choice forge.template.api.go \
  --project-name my-api \
  --home "$HOME"
```

**Installs:**
- Everything in `work`
- **Shared AI packages:** skills (16+), agents (9), hooks (comment-check, todo-tracker)
- Optional: forge project template

**Shared packages give you:**
- SDD workflow skills in your AI assistant
- Domain orchestrators (development, quality, infrastructure, data-ai, business)
- Automated code review hooks
- Engram memory integration

---

## `ai-heavy`

**For:** AI research, multi-provider experimentation, or power users who want every tool available simultaneously.

```bash
scripts/javi.sh --profile ai-heavy --home "$HOME"
```

**Installs:**
- Everything in `minimal`
- Shared AI packages (once, for Claude)
- All 6 provider profiles: Claude, OpenCode, Gemini, Qwen, Codex
- **Note:** GitHub Copilot (`ai.copilot.repo`) is repo-scoped and must be installed separately with `--destination`

Each provider installs into its own config directory — there are no conflicts:
- Claude → `~/.claude/`
- OpenCode → `~/.config/opencode/`
- Gemini → `~/.gemini/`
- Qwen → `~/.config/qwen/`
- Codex → `~/.codex/`

---

## Custom profiles

Profiles are just YAML files in `profiles/`. To create your own:

```yaml
# profiles/myprofile/profile.yaml
kind: bootstrap-profile
profile:
  id: myprofile
  preset_equivalent: ai-core
  required_inputs:
    - ai-choice
```

Then add a dispatch case in `scripts/javi.sh` for your new profile.

See [Advanced Usage](/advanced) for details.

---

## Combining profiles with extra modules

Apply a profile, then add individual modules on top:

```bash
# Apply work profile
scripts/javi.sh --profile work --ai-choice ai.claude.user --home "$HOME"

# Then add tmux and starship separately
scripts/javi.sh --module tmux --home "$HOME"
scripts/javi.sh --module starship --home "$HOME"
```
