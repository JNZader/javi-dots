# Workstation Replication

`javi-dots` owns the portable workstation replication profile because it is the single bootstrap entry point for a new machine.

## Export a Profile

```bash
npx javi-dots replication export
# or choose a path
npx javi-dots replication export --output ./javi-workstation-profile.json
```

The default output is:

```text
~/.javidots/replication-profile.json
```

To preview without writing:

```bash
npx javi-dots replication export --dry-run
```

To print the profile JSON:

```bash
npx javi-dots replication show
```

## Portable Fields

The profile is allowlist-based and contains only portable setup intent:

- selected AI CLIs (`claude`, `opencode`, `gemini`, `qwen`, `codex`, `copilot`)
- selected preset (`minimal`, `full`, or `custom`)
- Javi-managed features (`skills`, `configs`, `hooks`, `plugins`, `orchestrators`)
- mandatory tools (`engram`, `gentle-ai`) and selected optional tools (`ghagga`, `kiteguard`, `rtk`)
- default MCP server names such as `engram`
- an explicit list of excluded local state categories

## Never Portable

The replication profile never copies live home-directory trees wholesale. These categories are local-only:

- `.env*`
- credentials, secrets, auth files, tokens, OAuth files
- session histories and JSONL logs
- caches and generated images
- runtime SQLite databases and WAL/SHM files
- shell snapshots and paste caches
- debug logs

## Apply Strategy

A future apply flow should read this profile and call the normal setup path, e.g.:

```bash
npx javi-dots setup --cli claude,opencode,codex --ghagga --kiteguard
```

Then `javi-ai` installs the actual managed assets from its published package. The profile records choices; it does not embed secrets or runtime files.
