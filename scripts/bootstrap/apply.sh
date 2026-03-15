#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
HOME_DIR=${HOME:-}
DRY_RUN=0
MODULE=""

SUPPORTED_MODULES="fish ghostty zed wezterm tmux zellij starship zsh"

usage() {
    printf '%s\n' 'Usage: scripts/bootstrap/apply.sh [--module MODULE] [--dry-run] [--home DIR]'
    printf '%s\n' ''
    printf '%s\n' 'Apply javi-dots workstation bootstrap modules.'
    printf '%s\n' ''
    printf '%s\n' 'Options:'
    printf '%s\n' '  --module MODULE  Apply only the specified module'
    printf '%s\n' '  --dry-run        Print planned links without changing the target home'
    printf '%s\n' '  --home DIR       Override the target home directory'
    printf '%s\n' '  --list-modules   List available module IDs'
    printf '%s\n' '  -h, --help       Show this help text'
    printf '%s\n' ''
    printf '%s\n' "Available modules: $SUPPORTED_MODULES"
}

log() {
    printf '%s\n' "$1"
}

ensure_dir() {
    dir_path=$1
    if [ "$DRY_RUN" -eq 1 ]; then
        log "mkdir -p $dir_path"
    else
        mkdir -p "$dir_path"
    fi
}

link_asset() {
    source_path=$1
    target_path=$2
    target_dir=$(dirname "$target_path")

    ensure_dir "$target_dir"

    if [ -L "$target_path" ]; then
        current_target=$(readlink "$target_path")
        if [ "$current_target" = "$source_path" ]; then
            log "ok: $target_path"
            return 0
        fi
    fi

    if [ -e "$target_path" ] || [ -L "$target_path" ]; then
        log "skip: $target_path already exists"
        return 0
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        log "ln -s $source_path $target_path"
    else
        ln -s "$source_path" "$target_path"
        log "linked: $target_path"
    fi
}

link_dir_contents() {
    src_dir=$1
    dest_dir=$2

    if [ ! -d "$src_dir" ]; then
        log "skip: missing source dir: $src_dir"
        return 0
    fi

    ensure_dir "$dest_dir"

    for item in "$src_dir"/*.kdl "$src_dir"/*.toml "$src_dir"/*.lua "$src_dir"/*.conf; do
        [ -e "$item" ] || continue
        base=$(basename "$item")
        link_asset "$item" "$dest_dir/$base"
    done
}

# ─── per-module link functions ────────────────────────────────────────────────

link_fish() {
    log "module: shell.fish"
    link_asset "$REPO_ROOT/modules/shell/fish/config/config.fish" "$HOME_DIR/.config/fish/config.fish"
    link_asset "$REPO_ROOT/modules/shell/fish/config/conf.d/nvm.fish" "$HOME_DIR/.config/fish/conf.d/nvm.fish"
    link_asset "$REPO_ROOT/modules/shell/fish/config/fish_plugins" "$HOME_DIR/.config/fish/fish_plugins"
}

link_ghostty() {
    log "module: terminal.ghostty"
    link_asset "$REPO_ROOT/modules/terminal/ghostty/config/config" "$HOME_DIR/.config/ghostty/config"
    link_asset "$REPO_ROOT/modules/terminal/ghostty/config/shaders/cursor_smear_gentleman.glsl" "$HOME_DIR/.config/ghostty/shaders/cursor_smear_gentleman.glsl"
}

link_zed() {
    log "module: editor.zed"
    link_asset "$REPO_ROOT/modules/editor/zed/config/settings.json" "$HOME_DIR/.config/zed/settings.json"
    link_asset "$REPO_ROOT/modules/editor/zed/config/keymap.json" "$HOME_DIR/.config/zed/keymap.json"
}

link_wezterm() {
    log "module: terminal.wezterm"
    link_asset "$REPO_ROOT/modules/terminal/wezterm/config/.wezterm.lua" "$HOME_DIR/.wezterm.lua"
}

link_tmux() {
    log "module: multiplexer.tmux"
    link_asset "$REPO_ROOT/modules/multiplexer/tmux/config/tmux.conf" "$HOME_DIR/.tmux.conf"
}

link_zellij() {
    log "module: multiplexer.zellij"
    link_asset "$REPO_ROOT/modules/multiplexer/zellij/config/config.kdl" "$HOME_DIR/.config/zellij/config.kdl"
    link_dir_contents "$REPO_ROOT/modules/multiplexer/zellij/config/layouts" "$HOME_DIR/.config/zellij/layouts"
}

link_starship() {
    log "module: prompt.starship"
    link_asset "$REPO_ROOT/modules/prompt/starship/config/starship.toml" "$HOME_DIR/.config/starship.toml"
}

link_zsh() {
    log "module: shell.zsh"
    link_asset "$REPO_ROOT/modules/shell/zsh/config/.zshrc" "$HOME_DIR/.zshrc"
    link_asset "$REPO_ROOT/modules/shell/zsh/config/.p10k.zsh" "$HOME_DIR/.p10k.zsh"
}

link_module() {
    mod=$1
    case "$mod" in
        fish)     link_fish ;;
        ghostty)  link_ghostty ;;
        zed)      link_zed ;;
        wezterm)  link_wezterm ;;
        tmux)     link_tmux ;;
        zellij)   link_zellij ;;
        starship) link_starship ;;
        zsh)      link_zsh ;;
        *)
            printf 'error: unknown module: %s\n' "$mod" >&2
            printf 'available: %s\n' "$SUPPORTED_MODULES" >&2
            exit 1 ;;
    esac
}

# ─── argument parsing ─────────────────────────────────────────────────────────

LIST_MODULES=0

while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --home)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --home requires a value' >&2
                exit 1
            fi
            HOME_DIR=$2
            shift 2
            ;;
        --module)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --module requires a value' >&2
                exit 1
            fi
            MODULE=$2
            shift 2
            ;;
        --list-modules)
            LIST_MODULES=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'error: unknown option: %s\n' "$1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

if [ "$LIST_MODULES" -eq 1 ]; then
    printf 'available modules:\n'
    for m in $SUPPORTED_MODULES; do
        printf '  %s\n' "$m"
    done
    exit 0
fi

if [ -z "$HOME_DIR" ]; then
    printf '%s\n' 'error: HOME is not set and --home was not provided' >&2
    exit 1
fi

# ─── dispatch ─────────────────────────────────────────────────────────────────

if [ -n "$MODULE" ]; then
    # Single module mode
    link_module "$MODULE"
else
    # Default: apply all base modules (backward compatible)
    log 'profile: profiles/base/profile.yaml'
    log 'slice: installer.cli + shell.fish + terminal.ghostty + editor.zed'
    link_fish
    link_ghostty
    link_zed
    log 'ai-boundary: use modules/ai/module.yaml and javi-ai public contracts for AI integration'
fi
