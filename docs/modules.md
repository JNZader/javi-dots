# Modules

Each module is a self-contained set of config files for one tool. All modules are installed as **symlinks** to the canonical location in `javi-dots/modules/`.

---

## Install a single module

```bash
scripts/javi.sh --module tmux --home "$HOME"

# Or directly via apply.sh
scripts/bootstrap/apply.sh --module starship --home "$HOME"

# List all modules
scripts/javi.sh --list-modules
```

---

## Shell Modules

### `fish` — Fish shell

```bash
scripts/javi.sh --module fish --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/config.fish` | `~/.config/fish/config.fish` |
| `config/conf.d/nvm.fish` | `~/.config/fish/conf.d/nvm.fish` |
| `config/fish_plugins` | `~/.config/fish/fish_plugins` |

**Requires:** fish shell (`brew install fish` or `apt install fish`)

After installing, set fish as default shell:
```bash
echo "$(which fish)" | sudo tee -a /etc/shells
chsh -s "$(which fish)"
```

---

### `zsh` — Zsh with Oh-My-Zsh and Powerlevel10k

```bash
scripts/javi.sh --module zsh --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/.zshrc` | `~/.zshrc` |
| `config/.p10k.zsh` | `~/.p10k.zsh` |

**Requires:**
1. Oh-My-Zsh: `sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`
2. Powerlevel10k: `brew install powerlevel10k` or follow the [p10k install guide](https://github.com/romkatv/powerlevel10k#installation)
3. IosevkaTerm Nerd Font: download from [Nerd Fonts](https://www.nerdfonts.com/)

---

## Terminal Modules

### `ghostty` — Ghostty terminal emulator

```bash
scripts/javi.sh --module ghostty --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/config` | `~/.config/ghostty/config` |
| `config/shaders/cursor_smear_gentleman.glsl` | `~/.config/ghostty/shaders/` |

**Requires:** [Ghostty](https://ghostty.org)

---

### `wezterm` — WezTerm terminal emulator

```bash
scripts/javi.sh --module wezterm --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/.wezterm.lua` | `~/.wezterm.lua` |

**Requires:** [WezTerm](https://wezfurlong.org/wezterm/) and IosevkaTerm Nerd Font

The config includes:
- Gentleman color theme
- Neovim-optimized key handling
- Undercurl support for LSP diagnostics
- 240fps max FPS

---

## Multiplexer Modules

### `tmux` — Tmux with TPM plugins

```bash
scripts/javi.sh --module tmux --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/tmux.conf` | `~/.tmux.conf` |

**Requires:**
1. tmux: `brew install tmux`
2. TPM: `git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm`

After linking, install plugins:
```bash
tmux source ~/.tmux.conf
# Inside tmux: press prefix + I (capital i)
```

**Included plugins:** tmux-sensible · tmux-yank · vim-tmux-navigator · tmux-resurrect · tmux-which-key · tmux-kanagawa

**Keybindings:** prefix is `C-a` (not default `C-b`), split with `v` (vertical) and `d` (horizontal)

---

### `zellij` — Zellij with vim keybindings and layouts

```bash
scripts/javi.sh --module zellij --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/config.kdl` | `~/.config/zellij/config.kdl` |
| `config/layouts/*.kdl` | `~/.config/zellij/layouts/` |

**Requires:** [Zellij](https://zellij.dev) (`brew install zellij` or `cargo install zellij`)

**Included layouts:** work · work_kanagawa · work_everforest · work_sakura

> **Note:** Binary plugins (zjstatus, zellij_forgot) are not included. Download them from the [Zellij plugin registry](https://zellij.dev/plugins/).

---

## Prompt Modules

### `starship` — Starship cross-shell prompt

```bash
scripts/javi.sh --module starship --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/starship.toml` | `~/.config/starship.toml` |

**Requires:** `brew install starship` or the [official install script](https://starship.rs/)

After installing, add to your shell config:

```bash
# Fish
echo 'starship init fish | source' >> ~/.config/fish/config.fish

# Zsh
echo 'eval "$(starship init zsh)"' >> ~/.zshrc

# Bash
echo 'eval "$(starship init bash)"' >> ~/.bashrc
```

The config supports: Go · Rust · Node · Java · Python · C · Zig · Bun

---

## Editor Modules

### `zed` — Zed editor

```bash
scripts/javi.sh --module zed --home "$HOME"
```

| File | Install path |
|------|-------------|
| `config/settings.json` | `~/.config/zed/settings.json` |
| `config/keymap.json` | `~/.config/zed/keymap.json` |

**Requires:** [Zed](https://zed.dev)
