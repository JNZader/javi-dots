#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
AI_ENTRYPOINT="$REPO_ROOT/../javi-ai/scripts/install-profiles.sh"
CONTRACT_VERSION="0.1.0"
CHOICE_ID=""
DRY_RUN=0
LIST_CHOICES=0

usage() {
    printf '%s\n' 'Usage: scripts/bootstrap/apply-ai.sh [--choice ID] [--dry-run]'
    printf '%s\n' ''
    printf '%s\n' 'Bootstrap AI via the published javi-ai install contract.'
    printf '%s\n' ''
    printf '%s\n' 'Options:'
    printf '%s\n' '  --choice ID            Bootstrap AI choice from modules/ai/module.yaml'
    printf '%s\n' '  --contract-version VER Override the negotiated contract version'
    printf '%s\n' '  --list-choices         Print the supported bootstrap AI choices'
    printf '%s\n' '  --dry-run              Forward a dry-run request to javi-ai'
    printf '%s\n' '  -h, --help             Show this help text'
}

list_choices() {
    cat <<'EOF'
ai.claude.user -> provider=claude package=provider.claude.core target=target.claude.user
ai.opencode.user -> provider=opencode package=provider.opencode.core target=target.opencode.user
ai.gemini.user -> provider=gemini package=provider.gemini.core target=target.gemini.user
ai.qwen.user -> provider=qwen package=provider.qwen.core target=target.qwen.user
ai.codex.user -> provider=codex package=provider.codex.core target=target.codex.user
ai.copilot.repo -> provider=copilot package=provider.copilot.core target=target.copilot.repo
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --choice)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --choice requires a value' >&2
                exit 1
            fi
            CHOICE_ID=$2
            shift 2
            ;;
        --contract-version)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --contract-version requires a value' >&2
                exit 1
            fi
            CONTRACT_VERSION=$2
            shift 2
            ;;
        --list-choices)
            LIST_CHOICES=1
            shift
            ;;
        --dry-run)
            DRY_RUN=1
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

if [ "$LIST_CHOICES" -eq 1 ]; then
    list_choices
    exit 0
fi

if [ -z "$CHOICE_ID" ]; then
    printf '%s\n' 'error: --choice is required unless --list-choices is used' >&2
    exit 1
fi

if [ ! -f "$AI_ENTRYPOINT" ]; then
    printf 'error: missing javi-ai install entrypoint: %s\n' "$AI_ENTRYPOINT" >&2
    exit 1
fi

case "$CHOICE_ID" in
    ai.claude.user)
        PROVIDER_ID=claude
        PACKAGE_ID=provider.claude.core
        TARGET_ID=target.claude.user
        ;;
    ai.opencode.user)
        PROVIDER_ID=opencode
        PACKAGE_ID=provider.opencode.core
        TARGET_ID=target.opencode.user
        ;;
    ai.gemini.user)
        PROVIDER_ID=gemini
        PACKAGE_ID=provider.gemini.core
        TARGET_ID=target.gemini.user
        ;;
    ai.qwen.user)
        PROVIDER_ID=qwen
        PACKAGE_ID=provider.qwen.core
        TARGET_ID=target.qwen.user
        ;;
    ai.codex.user)
        PROVIDER_ID=codex
        PACKAGE_ID=provider.codex.core
        TARGET_ID=target.codex.user
        ;;
    ai.copilot.repo)
        PROVIDER_ID=copilot
        PACKAGE_ID=provider.copilot.core
        TARGET_ID=target.copilot.repo
        ;;
    *)
        printf 'error: unsupported bootstrap AI choice: %s\n' "$CHOICE_ID" >&2
        printf '%s\n' 'Use --list-choices to see supported published choices.' >&2
        exit 1
        ;;
esac

printf 'bootstrap_choice: %s\n' "$CHOICE_ID"
printf 'entrypoint: %s\n' 'javi-dots/scripts/bootstrap/apply-ai.sh'
printf 'delegates_to: %s\n' 'javi-ai/scripts/install-profiles.sh'

set -- bash "$AI_ENTRYPOINT" \
    --provider "$PROVIDER_ID" \
    --package "$PACKAGE_ID" \
    --preset ai-minimal \
    --target "$TARGET_ID" \
    --contract-version "$CONTRACT_VERSION"

if [ "$DRY_RUN" -eq 1 ]; then
    set -- "$@" --dry-run
fi

"$@"
