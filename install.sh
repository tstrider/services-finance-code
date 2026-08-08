#!/usr/bin/env bash
#
# clean-finance-code installer
#
#   bash install.sh              install skill + config into the current project
#   bash install.sh --skill-only install the skill only (no project config)
#   bash install.sh --user       install the skill to ~/.claude/skills (all projects)
#
# Run it with `bash install.sh` so no chmod is needed. It sets the executable
# bit on the hooks for you, and the hooks are also invoked via `bash` in
# settings.json, so they work even if the bit never gets set.
#
# Safe to re-run. Existing files are backed up with a .bak-<timestamp> suffix
# rather than overwritten.

set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
MODE="project"

for arg in "$@"; do
  case "$arg" in
    --skill-only) MODE="skill-only" ;;
    --user)       MODE="user" ;;
    -h|--help)    sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg. Try --help." >&2; exit 1 ;;
  esac
done

say()  { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n  \033[31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

# Copy a file, backing up any existing version instead of clobbering it.
place() {
  local from="$1" to="$2"
  if [ -e "$to" ]; then
    if cmp -s "$from" "$to"; then
      say "unchanged: $to"
      return 0
    fi
    cp "$to" "$to.bak-$STAMP"
    warn "existing $to backed up to $(basename "$to").bak-$STAMP"
  fi
  cp "$from" "$to"
  ok "$to"
}

[ -d "$SRC/skills/clean-finance-code" ] || die "Run this from inside the clean-finance-code folder."

echo
echo "clean-finance-code installer"
echo

# ---------------------------------------------------------------- skill

if [ "$MODE" = "user" ]; then
  DEST="$HOME/.claude/skills"
  mkdir -p "$DEST" || die "Could not create $DEST"
  if [ -d "$DEST/clean-finance-code" ]; then
    mv "$DEST/clean-finance-code" "$DEST/clean-finance-code.bak-$STAMP"
    warn "previous install backed up to clean-finance-code.bak-$STAMP"
  fi
  cp -R "$SRC/skills/clean-finance-code" "$DEST/" || die "Copy failed"
  ok "skill installed to $DEST/clean-finance-code"
  echo
  echo "  Done. Type /clean-finance-code in Claude Code to invoke it."
  echo
  exit 0
fi

mkdir -p .claude/skills || die "Could not create .claude/skills — are you in a writable project directory?"
if [ -d ".claude/skills/clean-finance-code" ]; then
  mv ".claude/skills/clean-finance-code" ".claude/skills/clean-finance-code.bak-$STAMP"
  warn "previous install backed up"
fi
cp -R "$SRC/skills/clean-finance-code" .claude/skills/ || die "Copy failed"
ok ".claude/skills/clean-finance-code"

if [ "$MODE" = "skill-only" ]; then
  echo
  echo "  Skill installed. Skipped project config (--skill-only)."
  echo
  exit 0
fi

# ---------------------------------------------------------------- config

mkdir -p .claude/rules .claude/hooks

place "$SRC/config/CLAUDE.md"     "./CLAUDE.md"
place "$SRC/config/settings.json" ".claude/settings.json"

for f in "$SRC"/config/rules/*.md;  do place "$f" ".claude/rules/$(basename "$f")";  done
for f in "$SRC"/config/hooks/*.sh; do place "$f" ".claude/hooks/$(basename "$f")"; done

# Belt and braces: set the bit even though settings.json invokes via `bash`.
chmod +x .claude/hooks/*.sh 2>/dev/null && ok "hooks marked executable" \
  || warn "could not set executable bit — hooks still work, they run via bash"

# ---------------------------------------------------------------- gitignore

if [ -d .git ] || [ -f .gitignore ]; then
  touch .gitignore
  for line in ".claude/settings.local.json" "CLAUDE.local.md"; do
    grep -qxF "$line" .gitignore 2>/dev/null || { echo "$line" >> .gitignore; ok "added $line to .gitignore"; }
  done
fi

# ---------------------------------------------------------------- verify

echo
echo "  Verifying"

fail=0
if command -v python3 >/dev/null 2>&1; then
  python3 -c "import json,sys; json.load(open('.claude/settings.json'))" 2>/dev/null \
    && ok "settings.json is valid JSON" || { warn "settings.json failed to parse"; fail=1; }

  out=$(printf '{"tool_input":{"command":"git push --force"}}' | bash .claude/hooks/guard-destructive.sh 2>/dev/null; echo $?)
  [ "$out" = "2" ] && ok "destructive-command guard is working" || { warn "guard-destructive returned $out, expected 2"; fail=1; }

  tmp="${TMPDIR:-/tmp}/cfc-check-$$.sql"; printf 'CREATE TABLE i (total_amount FLOAT);' > "$tmp"
  out=$(printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash .claude/hooks/guard-finance-numerics.sh >/dev/null 2>&1; echo $?)
  rm -f "$tmp"
  [ "$out" = "2" ] && ok "finance-numerics guard is working" || { warn "guard-finance-numerics returned $out, expected 2"; fail=1; }
else
  warn "python3 not found — skipped hook verification (hooks need python3 to parse their input)"
  fail=1
fi

# ---------------------------------------------------------------- next steps

echo
if [ "$fail" -eq 0 ]; then
  echo "  Installed and verified."
else
  echo "  Installed, with warnings above."
fi
cat <<'EOF'

  Next, and this one matters:

    1. Open CLAUDE.md and replace every <bracketed> placeholder with your
       real build, test, and lint commands. A CLAUDE.md full of placeholders
       is worse than none.

    2. Open .claude/settings.json and adjust the "permissions" lists to your
       stack. They currently assume npm and pytest, so Claude will prompt on
       every command until you fix this.

    3. In Claude Code, run /context to confirm CLAUDE.md loaded, and /skills
       to confirm clean-finance-code is listed.

  Full setup notes: docs/INSTALL.md

EOF
