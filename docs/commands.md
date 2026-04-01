# Commands

## setup

Set up the developer workstation. This is the default command — running `npx javi-dots` with no arguments is equivalent to `npx javi-dots setup`.

```bash
npx javi-dots setup [options]
```

### What it does

1. Installs `javi-ai` for the selected CLIs (skills, configs, orchestrators)
2. Clones `agent-teams-lite` to `~/.javidots/agent-teams-lite/` and runs its setup per CLI using mapped names (`claude` → `claude-code`, `gemini` → `gemini-cli`)
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

---

## health

Audit AI agent configuration quality. Checks CLAUDE.md signal-to-noise, skills structure, MCP server validation, and hook safety patterns.

```bash
npx javi-dots health
```

### What it checks

| Category | Checks |
|----------|--------|
| **claude-md** | Token count vs limit (5000), dead file references, duplicate rules |
| **skills** | Missing `SKILL.md` files, missing YAML frontmatter (`name`, `description`) |
| **mcp** | Invalid JSON in config files, missing command binaries, duplicate tool names across servers |
| **hooks** | Dangerous commands (`rm -rf`, `git push --force`, etc.), missing script references |

### Severity levels

| Severity | Meaning |
|----------|---------|
| `critical` | Broken references or dangerous patterns — fix immediately |
| `structural` | Missing structure that degrades agent performance |
| `incremental` | Minor improvements for better config hygiene |

Findings are sorted by severity (critical first).

### Config paths scanned

- `~/.claude/CLAUDE.md` — main instruction file
- `~/.claude/skills/` — skill directories
- `~/.claude.json` and `~/.config/Claude/claude_desktop_config.json` — MCP configs
- `~/.claude/settings.json` — hooks

---

## esp

Install Claude ESP tmux integration. Creates a toggle script and adds a tmux keybinding (`Ctrl-e`) that opens/closes a split pane running `claude-esp watch`.

```bash
npx javi-dots esp
```

### Prerequisites

- **tmux** — must be installed and available in PATH
- **claude-esp** — must be installed and available in PATH

### What it does

1. Writes a toggle script to `~/.javidots/esp-toggle.sh`
2. Appends a `bind-key C-e` line to `~/.tmux.conf` (idempotent — skips if already present)

### Usage in tmux

Press `Ctrl-e` inside a tmux session to toggle the ESP watcher pane (30% width right split).

---

## mcp

Auto-setup default MCP servers. Detects which servers are already configured and only adds missing ones to `~/.claude.json`.

```bash
npx javi-dots mcp [--dry-run]
```

### Default servers

| Server | Command | Description |
|--------|---------|-------------|
| `engram` | `engram mcp` | Persistent AI memory |
| `filesystem` | `npx -y @anthropic/filesystem-mcp` | File system access |
| `glance` | `npx -y @anthropic/glance-mcp` | Quick file previews |

### What it does

1. Reads all MCP config files to detect already-configured servers
2. Skips servers that are already present
3. Adds missing server entries to `~/.claude.json`
4. Validates that each server's command binary exists in PATH

### Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview which servers would be added without writing |

---

## tokens

Show token usage report from the `.wolf/` ledger. Tracks file reads, token consumption, and detects repeated reads that waste context.

```bash
npx javi-dots tokens
```

### What it reports

| Metric | Description |
|--------|-------------|
| Sessions | Total recorded sessions in `~/.wolf/sessions/` |
| Events | Total events in the latest session |
| Event breakdown | Count by type (file-read, etc.) |
| Estimated tokens | Total token consumption |
| Top read files | Most frequently read files (top 5) |
| Repeated reads | Files read 3+ times (indicates wasted context) |

### Ledger format

Sessions are stored as JSONL files in `~/.wolf/sessions/`. Each line is a `TokenEvent` with timestamp, type, optional file path, and token count.

---

## nano

SDD-lite inline workflow for small changes. Runs four phases — challenge, plan, build, review — without creating spec files. Escalates to full SDD (`/sdd-new`) if risk is high or scope exceeds 7 steps.

```bash
npx javi-dots nano "<description>"
```

### Phases

| Phase | What happens |
|-------|-------------|
| **Challenge** | Validates the description, detects high-risk keywords |
| **Plan** | Breaks the change into steps (max 7) |
| **Build** | Implements the change |
| **Review** | Verifies the result |

### Escalation

The command auto-escalates to full SDD when:

- Risk is assessed as **High**
- Plan exceeds **7 steps**
- Description contains keywords: `breaking`, `migration`, `architecture`, `redesign`

### Skill resolution

Looks for `nano-mode/SKILL.md` in these paths (first match wins):

1. `~/.claude/skills/nano-mode/SKILL.md`
2. `~/.opencode/skills/nano-mode/SKILL.md`
3. `~/.gemini/skills/nano-mode/SKILL.md`
4. `~/.javidots/skills/nano-mode/SKILL.md`

### Examples

```bash
npx javi-dots nano "add error boundary to dashboard"
npx javi-dots nano "extract validation into shared util"
```
