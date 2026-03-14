#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
HOME_DIR=${HOME:-}
DRY_RUN=0

usage() {
    printf '%s\n' 'Usage: scripts/bootstrap/apply.sh [--dry-run] [--home DIR]'
    printf '%s\n' ''
    printf '%s\n' 'Apply the first extracted javi-dots bootstrap slice.'
    printf '%s\n' ''
    printf '%s\n' 'Options:'
    printf '%s\n' '  --dry-run   Print planned links without changing the target home'
    printf '%s\n' '  --home DIR  Override the target home directory'
    printf '%s\n' '  -h, --help  Show this help text'
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

if [ -z "$HOME_DIR" ]; then
    printf '%s\n' 'error: HOME is not set and --home was not provided' >&2
    exit 1
fi

log 'profile: profiles/base/profile.yaml'
log 'slice: installer.cli + shell.fish + terminal.ghostty + editor.zed'

link_asset "$REPO_ROOT/modules/shell/fish/config/config.fish" "$HOME_DIR/.config/fish/config.fish"
link_asset "$REPO_ROOT/modules/shell/fish/config/conf.d/nvm.fish" "$HOME_DIR/.config/fish/conf.d/nvm.fish"
link_asset "$REPO_ROOT/modules/shell/fish/config/fish_plugins" "$HOME_DIR/.config/fish/fish_plugins"
link_asset "$REPO_ROOT/modules/terminal/ghostty/config/config" "$HOME_DIR/.config/ghostty/config"
link_asset "$REPO_ROOT/modules/terminal/ghostty/config/shaders/cursor_smear_gentleman.glsl" "$HOME_DIR/.config/ghostty/shaders/cursor_smear_gentleman.glsl"
link_asset "$REPO_ROOT/modules/editor/zed/config/settings.json" "$HOME_DIR/.config/zed/settings.json"
link_asset "$REPO_ROOT/modules/editor/zed/config/keymap.json" "$HOME_DIR/.config/zed/keymap.json"

log 'ai-boundary: use modules/ai/module.yaml and javi-ai public contracts for AI integration'
