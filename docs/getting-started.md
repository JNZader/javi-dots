# Getting Started

## Prerequisites

- A POSIX-compatible shell (bash, zsh, fish)
- `git`
- The repos you want to use cloned as siblings:

```
platform/
├── javi-dots/       ← required
├── javi-ai/         ← required for AI presets
└── javi-forge/      ← required for forge presets
```

For the `base` preset, only `javi-dots` is needed.

---

## Installation

### Step 1 — Clone javi-dots

```bash
git clone https://github.com/JNZader/javi-dots.git
cd javi-dots
```

### Step 2 — Clone sibling repos (optional, for full setup)

```bash
# For AI tools
git clone https://github.com/JNZader/javi-ai.git ../javi-ai

# For project scaffolding
git clone https://github.com/JNZader/javi-forge.git ../javi-forge
```

### Step 3 — Choose your setup method

<!-- tabs:start -->

#### **TUI (easiest)**

```bash
scripts/tui.sh
```

The interactive installer guides you through preset selection, provider choice, and confirmation.

#### **Preset**

```bash
# Base workstation only
scripts/javi.sh --preset base --home "$HOME"

# Base + Claude Code
scripts/javi.sh --preset ai-core --ai-choice ai.claude.user --home "$HOME"

# Base + shared AI packages + Claude Code
scripts/javi.sh --preset ai-full --ai-choice ai.claude.user --home "$HOME"
```

#### **Profile**

```bash
# Work machine (base + one AI provider)
scripts/javi.sh --profile work --ai-choice ai.claude.user --home "$HOME"

# Personal machine (base + ai-full + forge)
scripts/javi.sh --profile personal --ai-choice ai.claude.user --home "$HOME"

# AI-heavy (base + all 6 providers)
scripts/javi.sh --profile ai-heavy --home "$HOME"
```

<!-- tabs:end -->

---

## Dry-run first

Always preview before applying:

```bash
scripts/javi.sh --preset base --dry-run --home "$HOME"
```

The dry-run prints every planned symlink operation without touching your filesystem.

---

## What gets installed

### Base workstation (every preset)

All files are installed as **symlinks**. Your actual config files live in the javi-dots repo and are symlinked to the standard locations.

| Config file | Install path |
|------------|-------------|
| `modules/shell/fish/config/config.fish` | `~/.config/fish/config.fish` |
| `modules/terminal/ghostty/config/config` | `~/.config/ghostty/config` |
| `modules/editor/zed/config/settings.json` | `~/.config/zed/settings.json` |

### Skip existing files

If a file already exists at the target path, javi-dots **skips it** rather than overwriting. You'll see `skip: ~/.config/fish/config.fish already exists` in the output.

To replace an existing file:

```bash
rm ~/.config/fish/config.fish
scripts/javi.sh --preset base --home "$HOME"
```

---

## Updating

```bash
cd javi-dots
git pull

# Re-run to pick up new config files
scripts/javi.sh --preset base --home "$HOME"
```

Because configs are symlinks, any changes you pull are immediately available — no re-run needed for existing links.

---

## Uninstalling

Remove the symlinks you no longer want:

```bash
rm ~/.config/fish/config.fish
rm ~/.config/ghostty/config
rm ~/.config/zed/settings.json
# etc.
```

---

## Next steps

- [Modules](/modules) — see all available modules and install individual ones
- [Profiles](/profiles) — understand the named profiles
- [AI Integration](/ai-integration) — set up AI coding assistants
- [Forge Integration](/forge-integration) — scaffold new projects
