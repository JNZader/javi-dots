# Commands

## setup

Set up the developer workstation. This is the default command — running `npx javi-dots` with no arguments is equivalent to `npx javi-dots setup`.

```bash
npx javi-dots setup [options]
```

### What it does

1. Installs `javi-ai` for the selected CLIs (skills, configs, orchestrators)
2. Clones `agent-teams-lite` to `~/.javidots/agent-teams-lite/` and runs its setup per CLI
3. Installs `engram` via Homebrew and configures it for each selected CLI
4. Optionally initializes `ghagga` for code review
5. Writes a manifest to `~/.javidots/manifest.json`

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--dry-run` | boolean | `false` | Preview changes without writing files |
| `--preset` | string | `custom` | Preset: `full`, `minimal`, `custom` |
| `--cli` | string | — | Comma-separated CLIs |
| `--ghagga` | boolean | — | Enable ghagga |
| `--no-ghagga` | boolean | — | Disable ghagga |

### Examples

```bash
npx javi-dots setup
npx javi-dots setup --preset full
npx javi-dots setup --cli claude,opencode --ghagga
npx javi-dots setup --dry-run --preset minimal
```

---

## doctor

Show a health report of the current installation.

```bash
npx javi-dots doctor
```

### What it checks

| Check | Status if missing |
|-------|-------------------|
| `~/.javidots/manifest.json` | fail |
| `javi-ai` binary | fail |
| `engram` binary | fail |
| `git` binary | fail |
| `~/.javidots/agent-teams-lite/` | fail |
| `ghagga` binary | skip (optional) |
| Each configured CLI binary | fail |

The doctor reads the manifest to know which CLIs were configured and checks each one.

---

## update

Re-run setup using the previously saved configuration.

```bash
npx javi-dots update [--dry-run]
```

### What it does

Reads `~/.javidots/manifest.json` and re-runs the full setup flow with the same CLIs and ghagga preference. Use this after updating javi-ai or agent-teams-lite to pick up new skills and configs.

### Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview without writing files |

---

## uninstall

Remove all javi-dots managed files.

```bash
npx javi-dots uninstall
```

### What it removes

1. Runs `javi-ai uninstall` to remove AI configs
2. Deletes `~/.javidots/agent-teams-lite/` directory
3. Removes `~/.javidots/manifest.json`

> **Note**: This does not uninstall engram or ghagga binaries — those are managed by their own package managers.
