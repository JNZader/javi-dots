#!/usr/bin/env sh

# javi.sh — unified bootstrap orchestrator for javi-dots
#
# Composes the atomic bootstrap scripts for workstation, AI, and forge flows.
# Atomic scripts are preserved unchanged; this script orchestrates them.
#
# Usage:
#   scripts/javi.sh --preset PRESET [options]
#   scripts/javi.sh --profile PROFILE [options]
#   scripts/javi.sh --module MODULE --home DIR
#   scripts/javi.sh --list-presets | --list-profiles | --list-modules

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

APPLY_BASE="$SCRIPT_DIR/bootstrap/apply.sh"
APPLY_AI="$SCRIPT_DIR/bootstrap/apply-ai.sh"
APPLY_FORGE="$SCRIPT_DIR/bootstrap/apply-forge.sh"
AI_INSTALL="$REPO_ROOT/../javi-ai/scripts/install-profiles.sh"

PRESET=""
PROFILE=""
MODULE=""
AI_CHOICE=""
TEMPLATE_CHOICE=""
GENERATOR_CHOICE=""
PROJECT_NAME=""
DESTINATION=""
HOME_DIR=${HOME:-}
DRY_RUN=0
LIST_PRESETS=0
LIST_PROFILES=0
LIST_MODULES=0

# ─── help ───────────────────────────────────────────────────────────────────

usage() {
    cat <<'EOF'
Usage: scripts/javi.sh --preset PRESET [options]
       scripts/javi.sh --profile PROFILE [options]
       scripts/javi.sh --module MODULE --home DIR
       scripts/javi.sh --list-presets | --list-profiles | --list-modules

Unified bootstrap orchestrator for javi-dots.
Composes base workstation, AI tools, and forge scaffolding via presets or profiles.

Presets:
  base          Workstation only (fish + ghostty + zed)
  ai-core       base + one AI provider profile
  ai-full       base + shared AI packages + one AI provider profile
  forge         base + forge project scaffolding capability
  full          base + AI + forge together

Profiles:
  minimal       base only, no AI or forge
  work          base + ai-core (one provider)
  personal      base + ai-full + forge (one provider + shared packages)
  ai-heavy      base + ai-full + all six AI providers

Options:
  --preset PRESET           Preset to apply
  --profile PROFILE         Named profile to apply (resolves to preset + options)
  --module MODULE           Install a single module (delegates to apply.sh --module)
  --ai-choice ID            AI provider choice (required for ai-core, ai-full, work, personal)
                            Run: scripts/bootstrap/apply-ai.sh --list-choices
  --template-choice ID      Forge template choice (optional for forge, full, personal)
                            Run: scripts/bootstrap/apply-forge.sh --list-choices
  --generator-choice ID     Forge generator choice
  --project-name NAME       Project name for forge output
  --destination PATH        Destination directory for forge output
  --home DIR                Target home directory (default: $HOME)
  --dry-run                 Print planned actions without executing
  --list-presets            Print all available presets
  --list-profiles           Print all available profiles
  --list-modules            Print all available modules
  -h, --help                Show this help text

Examples:
  # Preview base workstation setup
  scripts/javi.sh --preset base --dry-run --home "$HOME"

  # Apply base + Claude Code
  scripts/javi.sh --preset ai-core --ai-choice ai.claude.user --home "$HOME"

  # Apply ai-full (shared skills/hooks + Claude Code)
  scripts/javi.sh --preset ai-full --ai-choice ai.claude.user --home "$HOME"

  # Apply work profile (base + one AI provider)
  scripts/javi.sh --profile work --ai-choice ai.claude.user --home "$HOME"

  # Apply personal profile (base + ai-full + forge)
  scripts/javi.sh --profile personal --ai-choice ai.claude.user --home "$HOME"

  # Apply ai-heavy profile (all 6 providers)
  scripts/javi.sh --profile ai-heavy --home "$HOME"

  # Install only tmux config
  scripts/javi.sh --module tmux --home "$HOME"

  # Launch TUI installer
  scripts/tui.sh
EOF
}

# ─── list commands ──────────────────────────────────────────────────────────

list_presets() {
    cat <<'EOF'
available presets:

  base          Workstation slice: fish shell, ghostty terminal, zed editor.

  ai-core       base + one AI provider profile.
                Requires: --ai-choice

  ai-full       base + shared AI packages (skills, hooks, instructions) + one AI provider.
                Requires: --ai-choice
                Installs shared packages via javi-ai install contract.

  forge         base + forge project scaffolding capability.
                Optional: --template-choice, --generator-choice, --project-name

  full          base + AI + forge together.
                Requires: --ai-choice
                Optional: --template-choice, --generator-choice, --project-name
EOF
}

list_profiles() {
    cat <<'EOF'
available profiles:

  minimal       Base workstation only (fish + ghostty + zed). No AI or forge.
                Use: --profile minimal --home "$HOME"

  work          base + one AI provider profile.
                Requires: --ai-choice
                Use: --profile work --ai-choice ai.claude.user --home "$HOME"

  personal      base + ai-full (shared packages + provider) + optional forge.
                Requires: --ai-choice
                Use: --profile personal --ai-choice ai.claude.user --home "$HOME"

  ai-heavy      base + shared AI packages + all six provider profiles.
                No --ai-choice required; all six are installed.
                Use: --profile ai-heavy --home "$HOME"
EOF
}

list_modules() {
    sh "$APPLY_BASE" --list-modules
}

# ─── argument parsing ────────────────────────────────────────────────────────

while [ "$#" -gt 0 ]; do
    case "$1" in
        --preset)
            [ "$#" -ge 2 ] || { printf 'error: --preset requires a value\n' >&2; exit 1; }
            PRESET=$2; shift 2 ;;
        --profile)
            [ "$#" -ge 2 ] || { printf 'error: --profile requires a value\n' >&2; exit 1; }
            PROFILE=$2; shift 2 ;;
        --module)
            [ "$#" -ge 2 ] || { printf 'error: --module requires a value\n' >&2; exit 1; }
            MODULE=$2; shift 2 ;;
        --ai-choice)
            [ "$#" -ge 2 ] || { printf 'error: --ai-choice requires a value\n' >&2; exit 1; }
            AI_CHOICE=$2; shift 2 ;;
        --template-choice)
            [ "$#" -ge 2 ] || { printf 'error: --template-choice requires a value\n' >&2; exit 1; }
            TEMPLATE_CHOICE=$2; shift 2 ;;
        --generator-choice)
            [ "$#" -ge 2 ] || { printf 'error: --generator-choice requires a value\n' >&2; exit 1; }
            GENERATOR_CHOICE=$2; shift 2 ;;
        --project-name)
            [ "$#" -ge 2 ] || { printf 'error: --project-name requires a value\n' >&2; exit 1; }
            PROJECT_NAME=$2; shift 2 ;;
        --destination)
            [ "$#" -ge 2 ] || { printf 'error: --destination requires a value\n' >&2; exit 1; }
            DESTINATION=$2; shift 2 ;;
        --home)
            [ "$#" -ge 2 ] || { printf 'error: --home requires a value\n' >&2; exit 1; }
            HOME_DIR=$2; shift 2 ;;
        --dry-run)
            DRY_RUN=1; shift ;;
        --list-presets)
            LIST_PRESETS=1; shift ;;
        --list-profiles)
            LIST_PROFILES=1; shift ;;
        --list-modules)
            LIST_MODULES=1; shift ;;
        -h|--help)
            usage; exit 0 ;;
        *)
            printf 'error: unknown option: %s\n' "$1" >&2
            usage >&2; exit 1 ;;
    esac
done

# ─── early exits ─────────────────────────────────────────────────────────────

if [ "$LIST_PRESETS" -eq 1 ]; then list_presets; exit 0; fi
if [ "$LIST_PROFILES" -eq 1 ]; then list_profiles; exit 0; fi
if [ "$LIST_MODULES" -eq 1 ]; then list_modules; exit 0; fi

# ─── module-only dispatch ────────────────────────────────────────────────────

if [ -n "$MODULE" ]; then
    if [ -z "$HOME_DIR" ]; then
        printf 'error: --home is required for --module\n' >&2; exit 1
    fi
    printf 'javi-dots bootstrap orchestrator\n'
    printf 'mode: module\n'
    printf 'module: %s\n' "$MODULE"
    [ "$DRY_RUN" -eq 1 ] && printf 'dry-run: true\n'
    set -- sh "$APPLY_BASE" --module "$MODULE" --home "$HOME_DIR"
    [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
    "$@"
    printf '\nresult: module %s applied\n' "$MODULE"
    exit 0
fi

# ─── profile → preset resolution ─────────────────────────────────────────────

if [ -n "$PROFILE" ]; then
    case "$PROFILE" in
        minimal)  PRESET=base ;;
        work)     PRESET=ai-core ;;
        personal) PRESET=full ;;
        ai-heavy) PRESET=ai-heavy ;;  # handled specially below
        *)
            printf 'error: unsupported profile: %s\n' "$PROFILE" >&2
            printf 'Run --list-profiles to see available profiles.\n' >&2
            exit 1 ;;
    esac
fi

# ─── validation ──────────────────────────────────────────────────────────────

if [ -z "$PRESET" ] && [ -z "$PROFILE" ]; then
    printf 'error: --preset, --profile, or --module is required\n' >&2
    exit 1
fi

# Validate preset (after profile resolution, PRESET may be set)
case "$PRESET" in
    base|ai-core|ai-full|forge|full|ai-heavy) ;;
    *)
        printf 'error: unsupported preset: %s\n' "$PRESET" >&2
        printf 'Run --list-presets to see available presets.\n' >&2
        exit 1 ;;
esac

# Presets that include AI require --ai-choice (except ai-heavy which does all)
case "$PRESET" in
    ai-core|ai-full|full)
        if [ -z "$AI_CHOICE" ]; then
            printf 'error: --ai-choice is required for preset: %s\n' "$PRESET" >&2
            printf 'Run: scripts/bootstrap/apply-ai.sh --list-choices\n' >&2
            exit 1
        fi ;;
esac

# Presets that include forge output require --project-name when a choice is given
case "$PRESET" in
    forge|full)
        if { [ -n "$TEMPLATE_CHOICE" ] || [ -n "$GENERATOR_CHOICE" ]; } && [ -z "$PROJECT_NAME" ]; then
            printf 'error: --project-name is required when --template-choice or --generator-choice is provided\n' >&2
            exit 1
        fi ;;
esac

# home is required
if [ -z "$HOME_DIR" ]; then
    printf 'error: HOME is not set and --home was not provided\n' >&2
    exit 1
fi

# ─── orchestration helpers ───────────────────────────────────────────────────

log_step() {
    printf '\n==> %s\n' "$1"
}

run_base() {
    log_step "preset:$PRESET step:base"
    set -- sh "$APPLY_BASE" --home "$HOME_DIR"
    [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
    "$@"
}

run_ai() {
    log_step "preset:$PRESET step:ai choice:$AI_CHOICE"
    set -- sh "$APPLY_AI" --choice "$AI_CHOICE"
    [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
    "$@"
}

run_ai_full() {
    log_step "preset:$PRESET step:ai-full choice:$AI_CHOICE"
    # First: install provider profile
    set -- sh "$APPLY_AI" --choice "$AI_CHOICE"
    [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
    "$@"
    # Second: install shared packages via javi-ai if available
    if [ -f "$AI_INSTALL" ]; then
        log_step "preset:$PRESET step:shared-packages"
        # Resolve provider from choice
        case "$AI_CHOICE" in
            ai.claude.user)   prov="claude" ;;
            ai.opencode.user) prov="opencode" ;;
            ai.gemini.user)   prov="gemini" ;;
            ai.qwen.user)     prov="qwen" ;;
            ai.codex.user)    prov="codex" ;;
            ai.copilot.repo)  prov="copilot" ;;
            *) prov="" ;;
        esac
        if [ -n "$prov" ]; then
            set -- bash "$AI_INSTALL" \
                --provider "$prov" \
                --package shared.instructions \
                --package shared.skills \
                --package shared.hooks \
                --home "$HOME_DIR"
            [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
            "$@"
        fi
    else
        printf 'note: javi-ai install entrypoint not found; shared packages skipped\n'
        printf 'note: clone javi-ai as a sibling repo to enable shared package installation\n'
    fi
}

run_forge() {
    log_step "preset:$PRESET step:forge"

    if [ -z "$TEMPLATE_CHOICE" ] && [ -z "$GENERATOR_CHOICE" ]; then
        printf 'forge: no --template-choice or --generator-choice provided, skipping generation\n'
        return 0
    fi

    set -- sh "$APPLY_FORGE" --project-name "$PROJECT_NAME"

    [ -n "$TEMPLATE_CHOICE" ] && set -- "$@" --template-choice "$TEMPLATE_CHOICE"
    [ -n "$GENERATOR_CHOICE" ] && set -- "$@" --generator-choice "$GENERATOR_CHOICE"
    [ -n "$DESTINATION" ] && set -- "$@" --destination "$DESTINATION"
    [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run

    "$@"
}

# ─── header ──────────────────────────────────────────────────────────────────

printf 'javi-dots bootstrap orchestrator\n'
[ -n "$PROFILE" ] && printf 'profile: %s\n' "$PROFILE"
printf 'preset: %s\n' "$PRESET"
[ "$DRY_RUN" -eq 1 ] && printf 'mode: dry-run\n'

# ─── preset dispatch ─────────────────────────────────────────────────────────

case "$PRESET" in
    base)
        run_base
        ;;

    ai-core)
        run_base
        run_ai
        ;;

    ai-full)
        run_base
        run_ai_full
        ;;

    forge)
        run_base
        run_forge
        ;;

    full)
        run_base
        run_ai_full
        run_forge
        ;;

    ai-heavy)
        # Install base once, then all six providers + shared packages
        run_base
        log_step "profile:ai-heavy step:shared-packages"
        if [ -f "$AI_INSTALL" ]; then
            set -- bash "$AI_INSTALL" \
                --provider claude \
                --package shared.instructions \
                --package shared.skills \
                --package shared.hooks \
                --home "$HOME_DIR"
            [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
            "$@"
        else
            printf 'note: javi-ai not found; shared packages skipped\n'
        fi
        for choice in ai.claude.user ai.opencode.user ai.gemini.user ai.qwen.user ai.codex.user; do
            log_step "profile:ai-heavy step:ai choice:$choice"
            set -- sh "$APPLY_AI" --choice "$choice"
            [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
            "$@"
        done
        printf '\nnote: ai.copilot.repo is repo-scoped; run separately with --destination <repo>\n'
        ;;
esac

printf '\nresult: preset %s complete\n' "$PRESET"
