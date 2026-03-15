#!/usr/bin/env sh

# tui.sh — interactive bootstrap installer for javi-dots
#
# Uses whiptail for menus when available; falls back to plain read prompts.
# Builds a javi.sh command from user choices and executes it.
#
# Usage:
#   scripts/tui.sh           Launch interactive installer
#   scripts/tui.sh --dry-run Launch in dry-run mode (shows javi.sh command, doesn't execute)

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
JAVI_SH="$SCRIPT_DIR/javi.sh"

DRY_RUN=0
HOME_DIR=${HOME:-}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --home=*) HOME_DIR="${arg#--home=}" ;;
    esac
done

[ -z "$HOME_DIR" ] && HOME_DIR="${HOME:-}"

# ─── backend detection ────────────────────────────────────────────────────────

HAS_WHIPTAIL=0
if command -v whiptail >/dev/null 2>&1; then
    HAS_WHIPTAIL=1
fi

# ─── menu helpers ─────────────────────────────────────────────────────────────

# menu TITLE PROMPT ITEM1 LABEL1 ITEM2 LABEL2 ...
# Returns chosen item to stdout
menu() {
    title="$1"; shift
    prompt="$1"; shift

    if [ "$HAS_WHIPTAIL" -eq 1 ]; then
        # Build whiptail args
        items=""
        count=0
        for arg in "$@"; do
            count=$((count + 1))
            if [ $((count % 2)) -eq 1 ]; then
                item="$arg"
            else
                items="$items $item $arg"
            fi
        done
        # shellcheck disable=SC2086
        whiptail --title "$title" --menu "$prompt" 20 70 10 $items 3>&1 1>&2 2>&3
    else
        # Plain fallback
        printf '\n=== %s ===\n' "$title"
        printf '%s\n' "$prompt"
        printf '\n'
        idx=1
        count=0
        for arg in "$@"; do
            count=$((count + 1))
            if [ $((count % 2)) -eq 1 ]; then
                item="$arg"
            else
                printf '  %d) %s — %s\n' "$idx" "$item" "$arg"
                idx=$((idx + 1))
            fi
        done
        printf '\nChoice [1-%d]: ' "$((idx - 1))"
        read -r choice
        # Return the item at that position
        idx=1
        count=0
        for arg in "$@"; do
            count=$((count + 1))
            if [ $((count % 2)) -eq 1 ]; then
                item="$arg"
            else
                if [ "$idx" = "$choice" ]; then
                    printf '%s' "$item"
                    return
                fi
                idx=$((idx + 1))
            fi
        done
        printf '' # empty = cancelled
    fi
}

msgbox() {
    title="$1"; shift
    msg="$1"
    if [ "$HAS_WHIPTAIL" -eq 1 ]; then
        whiptail --title "$title" --msgbox "$msg" 15 70
    else
        printf '\n=== %s ===\n%s\n\nPress Enter to continue...' "$title" "$msg"
        read -r _
    fi
}

yesno() {
    title="$1"; shift
    msg="$1"
    if [ "$HAS_WHIPTAIL" -eq 1 ]; then
        if whiptail --title "$title" --yesno "$msg" 12 70; then
            return 0
        else
            return 1
        fi
    else
        printf '\n=== %s ===\n%s\n\n[y/N]: ' "$title" "$msg"
        read -r answer
        case "$answer" in
            [yY]*) return 0 ;;
            *) return 1 ;;
        esac
    fi
}

inputbox() {
    title="$1"; shift
    prompt="$1"
    if [ "$HAS_WHIPTAIL" -eq 1 ]; then
        whiptail --title "$title" --inputbox "$prompt" 10 70 3>&1 1>&2 2>&3
    else
        printf '\n=== %s ===\n%s: ' "$title" "$prompt"
        read -r value
        printf '%s' "$value"
    fi
}

# ─── data ─────────────────────────────────────────────────────────────────────

AI_CHOICES="ai.claude.user Claude\ Code ai.opencode.user OpenCode ai.gemini.user Gemini\ CLI ai.qwen.user Qwen\ Code ai.codex.user Codex\ CLI ai.copilot.repo Copilot\ (repo)"

# ─── provider selection ───────────────────────────────────────────────────────

choose_provider() {
    menu "AI Provider" "Choose your AI coding assistant:" \
        "ai.claude.user" "Claude Code (Anthropic)" \
        "ai.opencode.user" "OpenCode" \
        "ai.gemini.user" "Gemini CLI (Google)" \
        "ai.qwen.user" "Qwen Code (Alibaba)" \
        "ai.codex.user" "Codex CLI (OpenAI)" \
        "ai.copilot.repo" "GitHub Copilot (repo-scoped)"
}

# ─── preset flow ─────────────────────────────────────────────────────────────

run_preset_flow() {
    preset=$(menu "Select Preset" "Choose a preset to apply:" \
        "base"    "Workstation only (fish + ghostty + zed)" \
        "ai-core" "base + one AI provider" \
        "ai-full" "base + shared AI packages + one AI provider" \
        "forge"   "base + forge project scaffolding" \
        "full"    "base + AI + forge")

    [ -z "$preset" ] && return 0

    ai_choice=""
    case "$preset" in
        ai-core|ai-full|full)
            ai_choice=$(choose_provider)
            [ -z "$ai_choice" ] && return 0
            ;;
    esac

    build_and_confirm_preset "$preset" "$ai_choice" ""
}

# ─── profile flow ─────────────────────────────────────────────────────────────

run_profile_flow() {
    profile=$(menu "Select Profile" "Choose a named profile to apply:" \
        "minimal"  "Base workstation only — no AI or forge" \
        "work"     "base + one AI provider (work machines)" \
        "personal" "base + ai-full + forge (personal machines)" \
        "ai-heavy" "base + all six AI providers")

    [ -z "$profile" ] && return 0

    ai_choice=""
    case "$profile" in
        work|personal)
            ai_choice=$(choose_provider)
            [ -z "$ai_choice" ] && return 0
            ;;
    esac

    build_and_confirm_profile "$profile" "$ai_choice"
}

# ─── module flow ─────────────────────────────────────────────────────────────

run_module_flow() {
    mod=$(menu "Install Module" "Choose a single module to install:" \
        "fish"     "Fish shell config" \
        "ghostty"  "Ghostty terminal config" \
        "zed"      "Zed editor settings and keymap" \
        "wezterm"  "WezTerm terminal config" \
        "tmux"     "Tmux config with TPM plugins" \
        "zellij"   "Zellij config and layouts" \
        "starship" "Starship cross-shell prompt" \
        "zsh"      "Zsh config with Oh-My-Zsh and P10k")

    [ -z "$mod" ] && return 0

    cmd="$JAVI_SH --module $mod --home $HOME_DIR"
    [ "$DRY_RUN" -eq 1 ] && cmd="$cmd --dry-run"

    confirm_and_run "Install module: $mod" "Command to execute:\n\n  $cmd" "$cmd"
}

# ─── build and confirm ────────────────────────────────────────────────────────

build_and_confirm_preset() {
    preset="$1"
    ai_choice="$2"
    extra="$3"

    cmd="$JAVI_SH --preset $preset --home $HOME_DIR"
    [ -n "$ai_choice" ] && cmd="$cmd --ai-choice $ai_choice"
    [ -n "$extra" ] && cmd="$cmd $extra"
    [ "$DRY_RUN" -eq 1 ] && cmd="$cmd --dry-run"

    confirm_and_run "Apply preset: $preset" "Command to execute:\n\n  $cmd" "$cmd"
}

build_and_confirm_profile() {
    profile="$1"
    ai_choice="$2"

    cmd="$JAVI_SH --profile $profile --home $HOME_DIR"
    [ -n "$ai_choice" ] && cmd="$cmd --ai-choice $ai_choice"
    [ "$DRY_RUN" -eq 1 ] && cmd="$cmd --dry-run"

    confirm_and_run "Apply profile: $profile" "Command to execute:\n\n  $cmd" "$cmd"
}

confirm_and_run() {
    title="$1"
    msg="$2"
    cmd="$3"

    if yesno "$title" "$msg\n\nProceed?"; then
        printf '\n==> Running: %s\n\n' "$cmd"
        # shellcheck disable=SC2086
        eval $cmd
        msgbox "Done" "Bootstrap complete!\n\nPreset applied successfully."
    else
        msgbox "Cancelled" "No changes were made."
    fi
}

# ─── main menu ────────────────────────────────────────────────────────────────

welcome_msg="Welcome to javi-dots interactive installer!

This tool helps you set up your development machine.
Your home directory: $HOME_DIR"

[ "$DRY_RUN" -eq 1 ] && welcome_msg="$welcome_msg

DRY-RUN MODE: No changes will be made."

msgbox "javi-dots Setup" "$welcome_msg"

while true; do
    choice=$(menu "Main Menu" "What would you like to do?" \
        "preset"  "Apply a preset (base, ai-core, ai-full, forge, full)" \
        "profile" "Apply a named profile (minimal, work, personal, ai-heavy)" \
        "module"  "Install a single module (tmux, zsh, starship, etc.)" \
        "exit"    "Exit without making changes")

    case "$choice" in
        preset)  run_preset_flow ;;
        profile) run_profile_flow ;;
        module)  run_module_flow ;;
        exit|"") break ;;
    esac
done

printf '\njavi-dots installer exited.\n'
