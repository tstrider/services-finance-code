# Tooling

The gates, how to install tools safely inside a project, starter config, and the spreadsheet layer. Tool versions and features move quickly; confirm current behavior before relying on a detail here.

## The gates

Nothing is reported done until every gate that applies has passed. If the repo already uses an equivalent tool, use it. Swapping a tool is fine; skipping the category is not. Report which tools ran.

| # | Gate | Python | SQL | Blocks on |
|---|---|---|---|---|
| 1 | Format and lint | `ruff format`, `ruff check` | `sqlfluff lint` | Lint errors |
| 2 | Types | `mypy --strict` on new and money code | `NUMERIC` column types, never float | Any error |
| 3 | Tests | `pytest` | tests on query results; `dbt test` if the project uses dbt | Any failure |
| 4 | Secrets | `gitleaks` if installed, else `detect-secrets` | same | Any finding |
| 5 | Known-vulnerable packages | `pip-audit` | n/a | High or critical |
| 6 | Security scan | `semgrep` | `semgrep` | High or critical |
| 7 | **Tie-out** | tie to the source system | tie to the source system | **Any unexplained difference** |

Gate 7 is the one no general toolkit includes and the one that matters most.

For an existing repo with its own settings, run mypy with the repo's config and add `--strict` only on the files you create or on money modules you touch.

## Installing missing tools

**Ask once.** Name the tools and why, in plain words:

> To run the standard checks I need ruff, mypy, pytest, pip-audit, detect-secrets, and semgrep. They'd install inside this project folder only, not system-wide. OK to install?

One yes covers these gate tools for this project. Ask again for anything else.

**On a yes, install inside the project only.**

```bash
# If uv is available (preferred: fast, and writes a lockfile)
uv init --bare              # only if there is no pyproject.toml yet
uv add --dev ruff mypy pytest pip-audit detect-secrets semgrep sqlfluff
uv run pytest -q

# Otherwise, a project virtual environment with pip
python3 -m venv .venv
.venv/bin/python -m pip install ruff mypy pytest pip-audit detect-secrets semgrep sqlfluff
.venv/bin/python -m pytest -q
```

- Never install globally, never use `sudo`, never change shell profiles or system settings.
- Add `.venv/` to `.gitignore`.
- Only install `sqlfluff` if the project has SQL. Only use `gitleaks` if it is already installed; it is not a Python package.
- If installing fails or is not allowed (no network, locked laptop, a chat sandbox), run the gates you can, and list every skipped gate under "Not checked" with the reason.

## Python

**uv** manages packages and environments and writes `uv.lock`. **Commit the lockfile.** A finance calculation that cannot be reproduced exactly cannot be audited. Pip with a pinned `requirements.txt` is an acceptable fallback.

Starter `pyproject.toml` sections:

```toml
[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "S", "N", "UP", "SIM", "RUF", "PD", "DTZ"]
ignore = ["E501"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]    # assert is how pytest tests work

[tool.mypy]
strict = true
warn_unreachable = true
```

Why these rule sets matter here:

- `S` (security rules) flags `eval`, `shell=True`, weak hashes, and hardcoded passwords.
- `DTZ` flags naive datetimes, which move transactions across period boundaries.
- `PD` flags risky pandas patterns.
- `B` flags common real bugs.

**Validation at the edge.** Parse outside input into typed shapes once.

**Pydantic trap:** strict mode rejects a Python float for a `Decimal` field, but when validating JSON (`model_validate_json`) it still accepts a JSON number and reads it through a float. `12345678901234.123456789` arrives as `12345678901234.123`. Require money as a string with a validator:

```python
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict


def money_from_text(value: object) -> Decimal:
    """Accept a Decimal or a decimal string. Refuse JSON numbers and floats."""
    if isinstance(value, Decimal) and value.is_finite():
        return value
    if isinstance(value, str):
        try:
            parsed = Decimal(value.strip())
        except InvalidOperation:
            raise ValueError(f"not a decimal string: {value!r}") from None
        if parsed.is_finite():
            return parsed
    raise ValueError("money must be a decimal string, never a JSON number or float")


Money = Annotated[Decimal, BeforeValidator(money_from_text)]


class TimeEntry(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)

    entry_id: str
    person_id: str
    scope_id: str
    service_date: date
    hours: Money
```

Put range checks (hours between 0 and 24, amounts within sane bounds) in the same validator or a second one. A standard-library dataclass with a `__post_init__` check using `to_decimal()` from `scripts/money.py` is fine when Pydantic is not already in the project.

**Tests.** `pytest`, plus `hypothesis` for property tests on money rules (allocations add back, debits equal credits). Coverage is information, never a target.

**Data libraries.** pandas is everywhere; its float default is wrong for money (see `money-math.md`). Polars has better null handling and is faster; check its current decimal support before relying on it for money.

## SQL

- `sqlfluff lint` with the right dialect. In dbt projects it needs the dbt templater.
- Money columns are `NUMERIC` or `DECIMAL` with explicit precision and scale.
- If the project uses dbt: model contracts (enforced column types, checked before building), unit tests (logic on mock inputs), and data tests (after building) are three different tools. Use all three on money models. Add a custom test that each period's total ties to the source system's own report.

## Secrets and security scans

- `gitleaks detect` or `detect-secrets scan` on the changes before reporting.
- `pip-audit` for known-vulnerable packages.
- `semgrep scan --config auto` for common security bugs. Custom rules for your own finance rules are worth writing:

```yaml
rules:
  - id: no-float-for-money
    pattern-regex: '(amount|total|price|revenue|cost|balance|rate|fee)\w*\s*:\s*float'
    message: Use Decimal for money, never float.
    languages: [python]
    severity: ERROR
  - id: no-hours-literal-in-cost
    pattern-regex: '/\s*2,?080\b'
    message: 2,080 is paid hours, not billable hours. Use a named billable-hours assumption.
    languages: [python]
    severity: WARNING
```

## CI (only if the firm already uses it)

A small firm may not have continuous integration, and that is fine. If it does:

- Run the same gates on every pull request.
- Protect the main branch: required checks and a required reviewer.
- Least-privilege workflow tokens (`permissions: contents: read` by default).
- Install with the lockfile frozen so CI fails on a stale lock.
- For systems the financial statements rely on, the CI record is the change evidence. Keep it.

Heavier supply-chain tools (software bills of materials, signed builds, provenance levels) are worth it for larger firms and regulated systems. Mention them when the firm is growing into that; do not impose them on a small team.

## Excel and Power Query

Most finance modeling lives in spreadsheets, and that is fine. Apply real discipline:

- **Inputs, calculations, and outputs on separate tabs.** Mark inputs with a consistent color.
- **One number, one place.**
- **No values typed inside formulas.** Ever. The single highest-value find in an inherited model.
- **Named ranges** for key assumptions: `=Cost / Billable_Hours_Per_FTE`, not `=B14/1800`.
- **Data validation** on input cells.
- **Protect calculation tabs** so formulas cannot be overtyped.
- **Checks as visible cells,** colored red when they fail: the balance sheet balances, allocations add back, the tie-out cell shows zero.
- **Version properly** with the file platform's version history. `Model_v3_FINAL_v2.xlsx` is not version control.

Power Query:

- Do transformations in Power Query, not by hand-editing sheets.
- Name every step meaningfully.
- Set data types explicitly, especially currency and dates.
- Trim and normalize case before merging on a text key. Silent merge misses are Excel's version of the dropped-rows bug.

When generating workbooks from Python (`openpyxl`, `xlsxwriter`): keep formulas where the reader must audit the math, escape text cells against formula injection, and include a tab with assumptions and run details.

**When to leave the spreadsheet.** When a workbook feeds invoices, journal entries, or a filing, it is Tier 2, and a spreadsheet cannot give access control, an audit trail, or referential integrity. Say so and propose a path off it.
