#!/usr/bin/env bash
# PostToolUse hook for Edit|Write. Catches the finance-specific defects that
# static analysis and normal linters do not: float money, hardcoded FX,
# mutation of posted ledger records, and hardcoded materiality thresholds.
#
# Install at .claude/hooks/guard-finance-numerics.sh and chmod +x.
# Scope it with the matcher, or let it self-scope on the path patterns below.
#
# Exit 2 returns stderr to Claude so it fixes the problem itself.
# This is advisory-strength by design: it warns loudly on likely defects rather
# than blocking every possible false positive. Tune the patterns to your repo.

set -uo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"

[ -z "$file" ] || [ ! -f "$file" ] && exit 0

# Only inspect code files.
case "$file" in
  *.py|*.sql|*.ts|*.js|*.tsx|*.java|*.go|*.rb|*.scala|*.kt) ;;
  *) exit 0 ;;
esac

findings=""
add() { findings="${findings}
  - $1"; }

MONEY='amount|amt|total|balance|revenue|cost|price|rate|fee|margin|invoice|payment|salary|budget|forecast|accrual|tax|discount|spend'

# 1. Float type declarations on money-named columns or fields.
if grep -nEi "(FLOAT|REAL|DOUBLE PRECISION)[^a-z]*" "$file" 2>/dev/null \
   | grep -Ei "$MONEY" >/dev/null 2>&1; then
  add "FLOAT/REAL/DOUBLE used on a money-named field. Use DECIMAL/NUMERIC. Floats cannot represent money exactly."
fi
if grep -nEi ":[[:space:]]*float|float\(" "$file" 2>/dev/null \
   | grep -Ei "$MONEY" >/dev/null 2>&1; then
  add "float type or float() cast on a money-named variable. Use Decimal."
fi

# 2. Decimal constructed from a float literal - silently carries binary error.
if grep -nE "Decimal\([0-9]+\.[0-9]+\)" "$file" >/dev/null 2>&1; then
  add "Decimal() built from a float literal. Quote it: Decimal(\"0.1\"), not Decimal(0.1)."
fi

# 3. Hardcoded FX rate.
if grep -nEi "(fx_rate|exchange_rate|conversion_rate|usd_per|eur_per)[[:space:]]*=[[:space:]]*[0-9]" "$file" >/dev/null 2>&1; then
  add "Hardcoded FX rate. Rates are effective-dated data with a rate type (spot/average/closing), not constants."
fi

# 4. Mutation of posted ledger records.
if grep -nEi "(UPDATE|DELETE[[:space:]]+FROM)[[:space:]]+[a-z_.\"]*(gl_|journal|ledger|posting|posted_)" "$file" >/dev/null 2>&1; then
  add "UPDATE/DELETE against a ledger table. Posted entries are immutable; corrections are reversing entries."
fi

# 5. COALESCE to zero on a money column - converts a data problem into a wrong number.
if grep -nEi "coalesce\([^)]*($MONEY)[^)]*,[[:space:]]*0[[:space:]]*\)" "$file" >/dev/null 2>&1; then
  add "COALESCE(money, 0) detected. A missing amount is not zero. Confirm this is intended and documented."
fi

# 6. Hardcoded materiality or tolerance threshold.
if grep -nEi "(materiality|tolerance|threshold)[[:space:]]*=[[:space:]]*[0-9]" "$file" >/dev/null 2>&1; then
  add "Hardcoded materiality/tolerance. This is a policy set by a human, not a constant in code."
fi

# 7. Rate or price lookup keyed on current date rather than service date.
if grep -nEi "(is_current|current_flag)[[:space:]]*=[[:space:]]*(true|1)" "$file" 2>/dev/null \
   | grep -Ei "rate|price|salary" >/dev/null 2>&1; then
  add "Rate lookup on is_current. Effective-dated rates must be resolved by service date, not current date."
fi

# 8. Billable-hours denominator errors.
# 8a. Division by 2080 in a cost context - the fully loaded cost error.
# Scoped to lines also mentioning cost, rate, salary, or hours, so unrelated
# arithmetic that happens to divide by 2080 does not trip it.
if grep -nE "/[[:space:]]*2,?080" "$file" 2>/dev/null \
   | grep -Ei "cost|rate|salary|comp|hour|burden|margin" >/dev/null 2>&1; then
  add "Division by 2080 in a cost context. 2080 is total PAID hours, not billable hours. Use annual billable hours (default 1800) as a named assumption, and state it in the output."
fi

# 8b. Any hardcoded hours divisor in a cost context, including the correct
# default. Even 1800 belongs in the assumptions block, not inside a formula.
if grep -nE "/[[:space:]]*(1,?[5-9][0-9]{2}|2,?0[0-9]{2})([^0-9]|$)" "$file" 2>/dev/null \
   | grep -Ei "cost|rate|salary|comp|billable|burden|margin" >/dev/null 2>&1; then
  add "Hardcoded annual-hours divisor in a cost calculation. Lift it to a single named assumption (e.g. ANNUAL_BILLABLE_HOURS = 1800) so it can be changed in one place and surfaced to the user."
fi

# 9. Sensitive data in a log or print.
if grep -nEi "(print|console\.log|logger?\.(info|debug|warn|error))\(.*(ssn|social_security|routing_number|account_number|iban|salary|tax_id|card_number)" "$file" >/dev/null 2>&1; then
  echo "BLOCKED: sensitive financial data appears in a log or print statement in $file." >&2
  echo "Bank details, tax IDs, salary, and SSNs must never be logged. Mask at the source." >&2
  exit 2
fi

if [ -n "$findings" ]; then
  echo "Finance review needed in $file:${findings}" >&2
  echo "" >&2
  echo "See clean-finance-code skill: references/money-invariants.md and references/reconciliation-and-controls.md" >&2
  exit 2
fi

exit 0
