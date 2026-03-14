#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
FORGE_ENTRYPOINT="$REPO_ROOT/../javi-forge/scripts/forge-init.sh"
CONTRACT_VERSION="0.1.0"
TEMPLATE_CHOICE=""
GENERATOR_CHOICE=""
PROJECT_NAME=""
DESTINATION=""
DRY_RUN=0
LIST_CHOICES=0

usage() {
    printf '%s\n' 'Usage: scripts/bootstrap/apply-forge.sh [options]'
    printf '%s\n' ''
    printf '%s\n' 'Bootstrap forge project scaffolding via the published javi-forge contract.'
    printf '%s\n' ''
    printf '%s\n' 'Options:'
    printf '%s\n' '  --template-choice ID     Template bootstrap choice from modules/forge/module.yaml'
    printf '%s\n' '  --generator-choice ID    Generator bootstrap choice from modules/forge/module.yaml'
    printf '%s\n' '  --project-name NAME      Project name for the generated scaffold'
    printf '%s\n' '  --destination PATH       Output directory for the generated project'
    printf '%s\n' '  --contract-version VER   Override the negotiated contract version'
    printf '%s\n' '  --list-choices           Print supported bootstrap forge choices'
    printf '%s\n' '  --dry-run                Forward a dry-run request to javi-forge'
    printf '%s\n' '  -h, --help               Show this help text'
}

list_choices() {
    printf '%s\n' 'template choices:'
    printf '%s\n' '  forge.template.web.base      -> template=template.web.base stack=web'
    printf '%s\n' '  forge.template.api.base      -> template=template.api.base stack=api'
    printf '%s\n' '  forge.template.fullstack.base -> template=template.fullstack.base stack=fullstack'
    printf '%s\n' '  forge.template.docs.base     -> template=template.docs.base stack=docs'
    printf '%s\n' ''
    printf '%s\n' 'generator choices:'
    printf '%s\n' '  forge.generator.review.automation -> generator=generator.review.automation'
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --template-choice)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --template-choice requires a value' >&2
                exit 1
            fi
            TEMPLATE_CHOICE=$2
            shift 2
            ;;
        --generator-choice)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --generator-choice requires a value' >&2
                exit 1
            fi
            GENERATOR_CHOICE=$2
            shift 2
            ;;
        --project-name)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --project-name requires a value' >&2
                exit 1
            fi
            PROJECT_NAME=$2
            shift 2
            ;;
        --destination)
            if [ "$#" -lt 2 ]; then
                printf '%s\n' 'error: --destination requires a value' >&2
                exit 1
            fi
            DESTINATION=$2
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

if [ -z "$TEMPLATE_CHOICE" ] && [ -z "$GENERATOR_CHOICE" ]; then
    printf '%s\n' 'error: --template-choice or --generator-choice is required unless --list-choices is used' >&2
    exit 1
fi

if [ -z "$PROJECT_NAME" ]; then
    printf '%s\n' 'error: --project-name is required' >&2
    exit 1
fi

if [ ! -f "$FORGE_ENTRYPOINT" ]; then
    printf 'error: missing javi-forge entrypoint: %s\n' "$FORGE_ENTRYPOINT" >&2
    exit 1
fi

# Resolve template choice to published template ID
TEMPLATE_ID=""
STACK_ID=""
if [ -n "$TEMPLATE_CHOICE" ]; then
    case "$TEMPLATE_CHOICE" in
        forge.template.web.base)
            TEMPLATE_ID=template.web.base
            STACK_ID=web
            ;;
        forge.template.api.base)
            TEMPLATE_ID=template.api.base
            STACK_ID=api
            ;;
        forge.template.fullstack.base)
            TEMPLATE_ID=template.fullstack.base
            STACK_ID=fullstack
            ;;
        forge.template.docs.base)
            TEMPLATE_ID=template.docs.base
            STACK_ID=docs
            ;;
        *)
            printf 'error: unsupported bootstrap forge template choice: %s\n' "$TEMPLATE_CHOICE" >&2
            printf '%s\n' 'Use --list-choices to see supported choices.' >&2
            exit 1
            ;;
    esac
fi

# Resolve generator choice to published generator ID
GENERATOR_ID=""
if [ -n "$GENERATOR_CHOICE" ]; then
    case "$GENERATOR_CHOICE" in
        forge.generator.review.automation)
            GENERATOR_ID=generator.review.automation
            ;;
        *)
            printf 'error: unsupported bootstrap forge generator choice: %s\n' "$GENERATOR_CHOICE" >&2
            printf '%s\n' 'Use --list-choices to see supported choices.' >&2
            exit 1
            ;;
    esac
fi

printf 'bootstrap_choice_template: %s\n' "${TEMPLATE_CHOICE:-none}"
printf 'bootstrap_choice_generator: %s\n' "${GENERATOR_CHOICE:-none}"
printf 'entrypoint: %s\n' 'javi-dots/scripts/bootstrap/apply-forge.sh'
printf 'delegates_to: %s\n' 'javi-forge/scripts/forge-init.sh'

# Build the forge-init.sh invocation
set -- sh "$FORGE_ENTRYPOINT" \
    --project-name "$PROJECT_NAME" \
    --contract-version "$CONTRACT_VERSION"

if [ -n "$TEMPLATE_ID" ]; then
    set -- "$@" --template "$TEMPLATE_ID"
fi

if [ -n "$STACK_ID" ]; then
    set -- "$@" --stack "$STACK_ID"
fi

if [ -n "$GENERATOR_ID" ]; then
    set -- "$@" --generator "$GENERATOR_ID"
fi

if [ -n "$DESTINATION" ]; then
    set -- "$@" --destination "$DESTINATION"
fi

if [ "$DRY_RUN" -eq 1 ]; then
    set -- "$@" --dry-run
fi

"$@"
