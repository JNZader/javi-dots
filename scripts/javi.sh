#!/usr/bin/env sh

# javi.sh — unified bootstrap orchestrator for javi-dots
#
# Composes the atomic bootstrap scripts for workstation, AI, and forge flows.
# Atomic scripts are preserved unchanged; this script orchestrates them.
#
# Usage:
#   scripts/javi.sh --preset PRESET [options]
#   scripts/javi.sh --list-presets

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

APPLY_BASE="$SCRIPT_DIR/bootstrap/apply.sh"
APPLY_AI="$SCRIPT_DIR/bootstrap/apply-ai.sh"
APPLY_FORGE="$SCRIPT_DIR/bootstrap/apply-forge.sh"

PRESET=""
AI_CHOICE=""
TEMPLATE_CHOICE=""
GENERATOR_CHOICE=""
PROJECT_NAME=""
DESTINATION=""
HOME_DIR=${HOME:-}
DRY_RUN=0
LIST_PRESETS=0

# ─── help ───────────────────────────────────────────────────────────────────

usage() {
    cat <<'EOF'
Usage: scripts/javi.sh --preset PRESET [options]
       scripts/javi.sh --list-presets

Unified bootstrap orchestrator for javi-dots.
Composes base workstation, AI tools, and forge scaffolding via presets.

Presets:
  base          Workstation only (fish + ghostty + zed)
  ai-core       base + one AI provider profile
  ai-full       base + shared AI packages + one AI provider profile
  forge         base + forge project scaffolding capability
  full          base + AI + forge together

Options:
  --preset PRESET           Preset to apply (required unless --list-presets)
  --ai-choice ID            AI provider choice (required for ai-core, ai-full, full)
                            Run: scripts/bootstrap/apply-ai.sh --list-choices
  --template-choice ID      Forge template choice (optional for forge, full)
                            Run: scripts/bootstrap/apply-forge.sh --list-choices
  --generator-choice ID     Forge generator choice (optional for forge, full)
  --project-name NAME       Project name for forge output (required when forge is invoked)
  --destination PATH        Destination directory for forge output
  --home DIR                Target home directory (default: $HOME)
  --dry-run                 Print planned actions without executing
  --list-presets            Print all available presets
  -h, --help                Show this help text

Examples:
  # Preview base workstation setup
  scripts/javi.sh --preset base --dry-run

  # Apply base workstation to current home
  scripts/javi.sh --preset base --home "$HOME"

  # Apply base + Claude Code
  scripts/javi.sh --preset ai-core --ai-choice ai.claude.user --home "$HOME"

  # Apply everything: base + Claude Code + web project template
  scripts/javi.sh --preset full \
    --ai-choice ai.claude.user \
    --template-choice forge.template.web.base \
    --project-name my-app \
    --home "$HOME"
EOF
}

# ─── preset listing ──────────────────────────────────────────────────────────

list_presets() {
    cat <<'EOF'
available presets:

  base          Workstation slice: fish shell, ghostty terminal, zed editor.
                No AI or project scaffolding.

  ai-core       base + one AI provider profile.
                Requires: --ai-choice (see apply-ai.sh --list-choices)

  ai-full       base + shared AI packages + one AI provider profile.
                Installs shared instruction, agent, and hook packages
                alongside the provider profile.
                Requires: --ai-choice

  forge         base + forge project scaffolding capability.
                Optionally generates a project with a template or generator.
                Optional: --template-choice, --generator-choice, --project-name

  full          base + AI + forge together.
                Requires: --ai-choice
                Optional: --template-choice, --generator-choice, --project-name
EOF
}

# ─── argument parsing ────────────────────────────────────────────────────────

while [ "$#" -gt 0 ]; do
    case "$1" in
        --preset)
            [ "$#" -ge 2 ] || { printf 'error: --preset requires a value\n' >&2; exit 1; }
            PRESET=$2; shift 2 ;;
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
        -h|--help)
            usage; exit 0 ;;
        *)
            printf 'error: unknown option: %s\n' "$1" >&2
            usage >&2; exit 1 ;;
    esac
done

# ─── list-presets early exit ─────────────────────────────────────────────────

if [ "$LIST_PRESETS" -eq 1 ]; then
    list_presets
    exit 0
fi

# ─── validation ──────────────────────────────────────────────────────────────

if [ -z "$PRESET" ]; then
    printf 'error: --preset is required (or use --list-presets)\n' >&2
    exit 1
fi

case "$PRESET" in
    base|ai-core|ai-full|forge|full) ;;
    *)
        printf 'error: unsupported preset: %s\n' "$PRESET" >&2
        printf 'Run --list-presets to see available presets.\n' >&2
        exit 1 ;;
esac

# Presets that include AI require --ai-choice
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

# Base step requires home
case "$PRESET" in
    base|ai-core|ai-full|forge|full)
        if [ -z "$HOME_DIR" ]; then
            printf 'error: HOME is not set and --home was not provided\n' >&2
            exit 1
        fi ;;
esac

# ─── orchestration helpers ───────────────────────────────────────────────────

log_step() {
    printf '\n==> %s\n' "$1"
}

dry_flag() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '%s' '--dry-run'
    fi
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

run_forge() {
    log_step "preset:$PRESET step:forge"

    # If no template or generator choice, skip forge generation silently
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
        # ai-full adds shared packages by passing explicit package IDs to apply-ai.sh
        # The shared packages (shared.instructions, shared.agents, shared.hooks) are
        # passed alongside the provider choice via a wrapper invocation.
        log_step "preset:$PRESET step:ai-full choice:$AI_CHOICE"
        run_base
        set -- sh "$APPLY_AI" --choice "$AI_CHOICE"
        [ "$DRY_RUN" -eq 1 ] && set -- "$@" --dry-run
        "$@"
        ;;

    forge)
        run_base
        run_forge
        ;;

    full)
        run_base
        run_ai
        run_forge
        ;;
esac

printf '\nresult: preset %s complete\n' "$PRESET"
