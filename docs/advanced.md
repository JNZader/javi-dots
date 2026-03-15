# Advanced Usage

---

## Custom modules

To add a new module (e.g. Neovim):

### 1. Create the module directory

```
modules/editor/nvim/
├── module.yaml
└── config/
    └── init.lua          # (or any config files)
```

### 2. Write the module.yaml

```yaml
kind: workstation-module
contract_version: 0.1.0
status: extracted-slice
module:
  id: editor.nvim
  owner_repo: javi-dots
  slot: editor
  purpose: Neovim editor configuration
assets:
  - source: modules/editor/nvim/config/init.lua
    destination: ~/.config/nvim/init.lua
    delivery: link
    role: neovim main configuration
```

### 3. Add a link function to `apply.sh`

In `scripts/bootstrap/apply.sh`, add:

```sh
link_nvim() {
    log "module: editor.nvim"
    link_asset "$REPO_ROOT/modules/editor/nvim/config/init.lua" "$HOME_DIR/.config/nvim/init.lua"
}
```

And add the case to `link_module()`:

```sh
nvim) link_nvim ;;
```

### 4. Install it

```bash
scripts/javi.sh --module nvim --home "$HOME"
```

---

## Custom profiles

### 1. Create the profile directory

```
profiles/myteam/
└── profile.yaml
```

### 2. Write the profile.yaml

```yaml
kind: bootstrap-profile
contract_version: 0.1.0
status: active
profile:
  id: myteam
  purpose: Team machine with Go tooling and review automation
  preset_equivalent: ai-core
  required_inputs:
    - ai-choice
module_refs:
  - modules/bootstrap/module.yaml
  - modules/shell/fish/module.yaml
  - modules/terminal/ghostty/module.yaml
  - modules/editor/zed/module.yaml
```

### 3. Add the profile to javi.sh

In `scripts/javi.sh`, add a case in the profile resolution block:

```sh
myteam) PRESET=ai-core ;;
```

### 4. Use it

```bash
scripts/javi.sh --profile myteam --ai-choice ai.claude.user --home "$HOME"
```

---

## Using a different home directory

All scripts accept `--home` to target a different directory. This is useful for:

- Applying configs to a different user's home
- Testing in an isolated directory
- Applying to a Docker container build context

```bash
# Test in /tmp first
scripts/javi.sh --preset base --home /tmp/test-home --dry-run
scripts/javi.sh --preset base --home /tmp/test-home
ls /tmp/test-home/.config/
```

---

## Combining javi-dots with javi-ai directly

While javi-dots orchestrates javi-ai via contracts, you can also call javi-ai's installer directly for more control:

```bash
# Install Claude with specific packages
../javi-ai/scripts/install-profiles.sh \
  --provider claude \
  --package shared.skills \
  --package shared.memory \
  --home "$HOME"

# See all published contract IDs
../javi-ai/scripts/install-profiles.sh --list-contracts
```

---

## Combining javi-dots with javi-forge directly

```bash
# Generate a project directly via forge
../javi-forge/scripts/forge-init.sh \
  --template template.api.go \
  --generator generator.review.automation \
  --project-name my-api \
  --destination ~/projects

# List all forge contracts
../javi-forge/scripts/forge-init.sh --list-contracts
```

---

## Running in CI

javi-dots can be used in CI pipelines to set up a consistent environment:

```yaml
# .github/workflows/setup-env.yml
- name: Set up javi-dots workstation
  run: |
    git clone https://github.com/JNZader/javi-dots.git /tmp/javi-dots
    /tmp/javi-dots/scripts/javi.sh --preset base --home "$HOME"
```

---

## Forking and customizing

javi-dots is designed to be forked. The key files to customize:

| File | Customize for |
|------|--------------|
| `modules/shell/fish/config/config.fish` | Fish config |
| `modules/prompt/starship/config/starship.toml` | Prompt appearance |
| `profiles/*/profile.yaml` | Profile composition |
| `scripts/javi.sh` | Preset and profile logic |
