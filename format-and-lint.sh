#!/usr/bin/env bash
# PostToolUse hook for Edit|Write. Formats and lints the file Claude just touched.
# Install at .claude/hooks/format-and-lint.sh and chmod +x.
#
# Why a hook and not a CLAUDE.md instruction: this runs as code at a fixed lifecycle
# event, so it happens whether or not Claude remembers. It also saves tokens - Claude
# does not have to spend a turn deciding to run the formatter.
#
# Exit 2 returns stderr to Claude so it can fix the problem itself.

set -uo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"

[ -z "$file" ] || [ ! -f "$file" ] && exit 0

fail=0
report=""

run() {  # run <tool> <args...>; skip silently if the tool is not installed
  command -v "$1" >/dev/null 2>&1 || return 0
  if ! out="$("$@" 2>&1)"; then
    report="${report}\n[$1] ${out}"
    fail=1
  fi
}

case "$file" in
  *.py)
    run ruff format "$file"
    run ruff check --fix "$file"
    ;;
  *.ts|*.tsx|*.js|*.jsx)
    run npx --no-install prettier --write "$file"
    run npx --no-install eslint --fix "$file"
    ;;
  *.go)
    run gofmt -w "$file"
    run go vet "$(dirname "$file")"
    ;;
  *.rs)
    run rustfmt "$file"
    ;;
  *.json|*.md|*.yaml|*.yml)
    run npx --no-install prettier --write "$file"
    ;;
esac

# Secret canary: cheap, catches the most common agent mistake.
if grep -nEi '(api[_-]?key|secret|password|token)[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9/_+=-]{16,}' "$file" >/dev/null 2>&1; then
  echo "Possible hardcoded secret in $file. Move it to an environment variable or secret manager." >&2
  exit 2
fi

if [ "$fail" -ne 0 ]; then
  printf 'Lint/format issues in %s:%b\n' "$file" "$report" >&2
  exit 2
fi

exit 0
