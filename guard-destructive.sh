#!/usr/bin/env bash
# PreToolUse hook for Bash. Blocks destructive commands regardless of what Claude decides.
# Install at .claude/hooks/guard-destructive.sh and chmod +x.
#
# Hooks are enforcement. CLAUDE.md is guidance. Anything you cannot tolerate being
# skipped belongs here or in permissions.deny, not in prose.
#
# Exit 2 blocks the tool call and returns stderr to Claude.

set -uo pipefail

payload="$(cat)"
cmd="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)"

[ -z "$cmd" ] && exit 0

block() {
  echo "BLOCKED by guard-destructive hook: $1" >&2
  echo "If this is genuinely required, the user must run it themselves." >&2
  exit 2
}

# Recursive delete: allow project-relative paths, block anything absolute,
# home-relative, or containing a glob. `rm -rf ./build` is legitimate;
# `rm -rf /var/lib`, `rm -rf ~/projects` and `rm -rf dist/*` are not.
if [[ "$cmd" =~ rm[[:space:]]+-[rRf]*[rf][rRf]*[[:space:]]+(-[^[:space:]]+[[:space:]]+)*(/|~|\$HOME) ]] \
   || [[ "$cmd" =~ rm[[:space:]]+-[rRf]*[rf][rRf]*[[:space:]]+[^[:space:]]*\* ]]; then
  block "recursive delete of an absolute, home-relative, or wildcard path"
fi

case "$cmd" in
  *"git push --force"*|*"git push -f"*)      block "force push" ;;
  *"git reset --hard"*)                      block "hard reset discards uncommitted work" ;;
  *"git clean -"*[fdx]*)                     block "git clean deletes untracked files" ;;
  *"DROP TABLE"*|*"DROP DATABASE"*|*"TRUNCATE "*) block "destructive SQL" ;;
  *"DELETE FROM"*)
    case "$cmd" in *WHERE*|*where*) ;; *) block "DELETE without WHERE" ;; esac ;;
  *"chmod -R 777"*)                          block "world-writable permissions" ;;
  *"curl "*"| sh"*|*"curl "*"| bash"*|*"wget "*"| sh"*) block "piping a remote script to a shell" ;;
  *" --no-verify"*)                          block "bypassing git hooks" ;;
  *"npm publish"*|*"pypi upload"*|*"twine upload"*) block "publishing a package" ;;
esac

exit 0
