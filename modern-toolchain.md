# Modern Toolchain

Named tools and protocols, current as of August 2026. **These are gates, not suggestions.** Code is not "done" until they pass.

**Escape hatch**: if the repo already uses an equivalent tool in the same category, use theirs. Consistency with the codebase beats matching this list. Substituting is fine; *skipping the category* is not. Say which you used.

Verify versions and current status before adopting — this landscape moves fast, and a stale recommendation is worse than none.

---

## The gates

Nothing is reported complete until every applicable gate passes. Run in this order; stop at the first real failure.

| # | Gate | Python | SQL / dbt | Blocks on |
|---|---|---|---|---|
| 1 | Format | `ruff format` | `sqlfluff fix` | Never (auto-fix) |
| 2 | Lint | `ruff check` | `sqlfluff lint` | Errors |
| 3 | Types / contracts | `mypy --strict` | dbt model contracts | Any error |
| 4 | Secrets | `gitleaks` | `gitleaks` | Any finding |
| 5 | Tests | `pytest` | `dbt test` + `dbt build --select` unit tests | Any failure |
| 6 | Dependency CVEs | `pip-audit` / `uv pip audit` | n/a | High or critical |
| 7 | SAST | `semgrep --config auto` | `semgrep` | High or critical |
| 8 | **Reconciliation** | tie-out to source system | tie-out to source system | **Any unexplained delta** |

Gate 8 is the one no general-purpose toolchain includes and the one that matters most here. A finance change that passes 1 through 7 and does not tie out is not done.

---

## Python

The 2026 stack consolidated hard. The old `pip` + `virtualenv` + `black` + `flake8` + `isort` combination is superseded.

### uv — packages and environments

Replaces pip, venv, virtualenv, pip-tools, and poetry in one Rust binary. Substantially faster, and it produces a real lockfile.

```bash
uv init                      # new project with pyproject.toml
uv add pandas                # add a dependency, updates uv.lock
uv add --dev pytest ruff mypy
uv sync                      # reproduce the exact locked environment
uv run pytest                # run inside the project env
```

**Commit `uv.lock`.** A finance calculation that cannot be reproduced exactly is not auditable. This is not a style preference; it is the difference between "we can re-run March" and "we think it was about this."

### Ruff — lint and format

Replaces black, flake8, isort, pyupgrade, and much of pylint in one binary.

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
  "E", "F", "W",   # pycodestyle, pyflakes
  "I",             # import sorting
  "B",             # bugbear — real bug patterns
  "S",             # bandit security rules
  "N",             # naming conventions
  "UP",            # pyupgrade
  "SIM",           # simplification
  "RUF",           # ruff-specific
  "PD",            # pandas-vet — relevant for finance analytics
  "NPY",           # numpy
  "DTZ",           # flake8-datetimez — naive datetimes, a real finance bug source
  "PL",            # pylint subset
]
ignore = ["E501"]  # line length handled by the formatter
```

Two selections earn their place in finance code specifically:

- **`S` (bandit rules)** folds security linting into the same pass: flags `eval`, `exec`, weak hashes, `subprocess` with `shell=True`, hardcoded password strings.
- **`DTZ`** flags naive datetimes. A timezone-naive timestamp is how a transaction lands in the wrong period.

### Type checking

**`mypy --strict` is the production baseline.** It is what FastAPI, SQLAlchemy, and Pydantic themselves use, and strict mode catches the class of bug that partial annotations miss.

```toml
[tool.mypy]
strict = true
warn_unreachable = true
disallow_any_explicit = true      # in finance code, Any on a money path is a defect
```

Faster alternatives exist and are worth watching, but be accurate about their status:

- **ty** (Astral) is dramatically faster but was in **beta** with a 1.0 targeted for 2026. It has no plugin system and no plans for one, so it cannot replace mypy where you depend on plugins for SQLAlchemy or Pydantic v1. It also checks unannotated function bodies mypy skips, so a codebase passing mypy will surface new errors on first run.
- **Pyrefly** is a reasonable option for new projects; its typing-spec conformance has been ahead of ty's during ty's beta.
- **Pyright via Pylance** in the editor plus mypy in CI is a common and sane split: fast feedback locally, authoritative gate in the pipeline.

**Recommendation**: mypy --strict as the CI gate today. Re-evaluate ty when 1.0 ships.

**Type money explicitly.** `Decimal`, never a bare `float`, and never `Any` on anything that becomes a number someone books.

### Boundary validation — Pydantic

Validate untrusted input **once, at the edge**, into a typed shape. Pydantic v2 is the standard.

```python
from decimal import Decimal
from datetime import date
from pydantic import BaseModel, ConfigDict, Field

class InvoiceLine(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)  # no coercion, immutable

    invoice_id: str
    service_date: date                    # not "date"; not a datetime
    amount: Decimal = Field(max_digits=18, decimal_places=4)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
```

`strict=True` matters: without it Pydantic will happily coerce a float into a Decimal and reintroduce the exact problem you were avoiding. `frozen=True` prevents mutation after validation.

### Testing — pytest

```bash
uv run pytest -q                      # fast feedback
uv run pytest --cov --cov-report=term # coverage as information, never as a target
```

Add **Hypothesis** for property-based tests on money invariants — allocation exhaustiveness, debits equal credits, roll-forward ties. See `testing-finance-code.md`.

**Do not chase a coverage number.** In finance the single highest-value test is the per-period tie-out to the source system's own report.

### Data libraries

- **Polars** is materially faster than pandas and has better null semantics, which matters when a missing forecast must not become a zero. Its `Decimal` support has been maturing; verify current status before relying on it for money.
- **pandas** remains ubiquitous. Its `float64` default is wrong for money — either carry `Decimal` in an object column, work in integer minor units, or restrict float use to Tier 0 exploration with an explicit reconciliation to a Decimal control total. Say which you did.

---

## SQL, dbt, and the warehouse

### SQLFluff — SQL linting

The de facto standard. Enforces consistent style and catches structural problems. Needs database access for Jinja compilation in dbt projects.

```ini
# .sqlfluff
[sqlfluff]
dialect = snowflake
templater = dbt
max_line_length = 120

[sqlfluff:rules:capitalisation.keywords]
capitalisation_policy = upper
```

### dbt — three distinct mechanisms, often confused

| Mechanism | When it runs | What it catches |
|---|---|---|
| **Model contracts** | **Before** the model builds | Schema drift, wrong type, constraint violation. **Prevents** the build |
| **Unit tests** | Before materialization, on mock inputs | Wrong SQL *logic* |
| **Data tests** | After the model builds | Bad *data*: nulls, duplicates, broken relationships |

Contracts are enforcement; data tests are detection. Use all three.

```yaml
models:
  - name: fct_revenue
    config:
      contract: {enforced: true}
    columns:
      - name: period_id
        data_type: date
        constraints: [{type: not_null}]
      - name: amount_usd
        data_type: decimal(18,4)      # never float
        constraints: [{type: not_null}]
      - name: currency
        data_type: varchar(3)
        constraints: [{type: not_null}]
    tests:
      - dbt_utils.expression_is_true:
          expression: "amount_usd = round(amount_usd, 4)"
```

**Unit tests** (dbt 1.8+) validate logic against mock inputs before touching data. Use them for allocation, FX conversion, tiering, and any calculation with branches — exactly the places a data test cannot tell you *why* the number is wrong.

**The finance-specific dbt tests worth standing up on every fact model:**

- `unique` on `(source_system, source_id)`
- `not_null` on period, entity, account, amount, currency
- `accepted_values` on currency (ISO 4217) and scenario
- `relationships` on every dimension key
- A custom **balance test**: `sum(debit) = sum(credit)` per entity per period
- A custom **tie-out test**: period total equals the source system's own reported total
- `dbt_utils.expression_is_true` for sign conventions and non-overlapping effective-date ranges

The tie-out test is the one most projects lack and the one that would have caught the incident.

### Elementary — observability

Open source, sits on dbt artifacts. Anomaly detection, test-result dashboards, and alert routing. Its value here: **alert on control-total movement, not only on test failure.** A model that builds successfully with a total 15% off is the dangerous case.

### Warehouse-level

- Column types: `DECIMAL`/`NUMERIC` for money. Never `FLOAT`, `REAL`, or `DOUBLE`.
- Watch for implicit float casts in aggregates and JSON extraction.
- Snowflake, BigQuery, and Databricks all support column-level lineage; turn it on. "Where did this number come from" should be answerable from the platform.

---

## Excel, Power Query, and spreadsheet models

Most finance modeling still lives here, and that is not a failure state. It is where finance is fluent. Engineering respect for it means applying real discipline rather than pretending the work happens elsewhere.

**Structure**
- **Inputs, calculations, and outputs on separate tabs**, with a consistent colour convention (blue for hardcoded inputs, black for formulas, green for cross-sheet references is the common one).
- **One number, one place.** Any figure appearing twice will eventually disagree with itself.
- **No hardcoded values inside formulas.** Ever. A growth rate typed into a formula is invisible and will be missed at reforecast. This is the single highest-value find when auditing an inherited model.
- Named ranges for key assumptions, so a formula reads `=Revenue * Tax_Rate_Federal` rather than `=B14*0.21`.

**Controls**
- **Formula auditing**: Trace Precedents and Dependents, and Show Formulas (`Ctrl + ` `) before trusting an inherited model.
- **Data validation** on input cells: type, range, list. Cheap, and it stops the entry error at the source.
- **Sheet and workbook protection** on calculation tabs so formulas cannot be overtyped. Overtyping a formula with a hardcode is the most common way a working model silently breaks.
- **Sanity assertions as visible cells**, not mental checks: balance sheet balances, allocation sums to the pool, cash never negative without a facility. Conditional-format them red.
- **Version the file properly.** `Model_v3_FINAL_v2_Bob.xlsx` is not version control. Use SharePoint or OneDrive version history at minimum, and name every published version with its date and purpose.

**Power Query**
- Do transformations in Power Query, not in hand-edited sheets. It is reproducible and inspectable; a manually pasted range is neither.
- Name each applied step meaningfully. The step list is the documentation.
- Set data types explicitly, especially for currency and dates. Leaving a money column as a general or double type reintroduces the float problem.
- **Never merge on a text key without trimming and case-normalizing.** Silent join misses are the Excel equivalent of the inner-join row drop.

**When to leave Excel.** When the model feeds an invoice, a journal entry, or a filing, it has become Tier 2 and a spreadsheet cannot provide access control, an audit trail, or referential integrity. Say so and propose a path off it rather than hardening the workbook further.

---

## Security scanning

### Secrets

Two tools, different jobs. Run both.

- **Gitleaks** — fast enough for a pre-commit hook, MIT licensed, 150+ built-in patterns covering cloud keys, tokens, and database connection strings. This is your local gate.
- **TruffleHog** — verifies whether a found credential is actually *live* by making safe read-only API calls against 700+ secret types. Slower; run in CI with `--results=verified` so you triage real leaks rather than every string that looks like a key.
- **detect-secrets** — use to establish a baseline on a legacy repo so you can adopt scanning without drowning in historical findings.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks: [{id: ruff, args: [--fix]}, {id: ruff-format}]
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks: [{id: gitleaks}]
```

**A committed secret is compromised.** Rotate it. Removing it from the repo does not un-leak it, and git history keeps it.

### SAST

**Semgrep** (`semgrep --config auto`) is the practical default: fast, low false-positive rate, and you can write custom rules in a readable DSL. **CodeQL** is deeper and free for public repos on GitHub, but slower.

Write **custom Semgrep rules for your own finance invariants.** This is where it earns its keep, because no off-the-shelf ruleset knows your domain:

```yaml
rules:
  - id: no-float-for-money
    patterns:
      - pattern-regex: '(amount|total|price|revenue|cost|balance)\s*:\s*float'
    message: Use Decimal for monetary values, never float.
    languages: [python]
    severity: ERROR

  - id: no-update-on-ledger
    patterns:
      - pattern-regex: '(?i)(UPDATE|DELETE\s+FROM)\s+\w*(gl_|journal|ledger|posting)'
    message: Posted entries are immutable. Corrections are reversing entries.
    languages: [generic]
    severity: ERROR
```

### Dependencies

- **`pip-audit`** (or `uv pip audit`) against the Python Packaging Advisory Database.
- **Trivy** for container images and filesystems.
- **Dependabot** or **Renovate** for automated update PRs. Renovate gives finer control over grouping and scheduling; Dependabot is zero-setup on GitHub.

**Update deliberately on a cadence.** Not reflexively on every alert, and not never. In a SOX-relevant path, a dependency upgrade is a program change and needs the evidence trail, so batching to a schedule is both safer and cheaper.

---

## Supply chain

Moved from optional to expected, driven by US Executive Order 14028 and the EU Cyber Resilience Act. Three layers that answer different questions:

| Layer | Question it answers | Tools |
|---|---|---|
| **SBOM** | What is *in* this software? | `syft`, CycloneDX, SPDX |
| **SLSA** | *How* was it built? Can I trust the pipeline? | `slsa-github-generator`, GitHub attestations |
| **Sigstore** | Was it *tampered with* after the build? | `cosign`, Fulcio, Rekor |

```bash
syft . -o cyclonedx-json > sbom.json     # generate an SBOM
grype sbom:sbom.json                     # scan it for known vulnerabilities
cosign sign-blob --yes artifact.tar.gz   # keyless signing via workflow OIDC
```

**Sigstore keyless signing** is the practical win: the artifact is signed using your CI workflow's OIDC identity, so there are no long-lived signing keys to manage, rotate, or steal, and anyone can verify.

**SLSA roadmap**: Level 1 establishes provenance, Level 2 adds signed attestations, Level 3 is for your most critical artifacts. With GitHub's built-in attestation support, Level 2 is genuinely achievable in an afternoon for most artifact types. Start there.

**Why a finance team should care**: if a compromised dependency alters a calculation, an SBOM tells you within minutes whether you are exposed and which reported periods were affected. Without one, that becomes a multi-week forensic exercise conducted under audit scrutiny.

---

## CI/CD

**Required checks before merge**, enforced by branch protection, not by convention:

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --frozen          # fails if the lockfile is stale
      - run: uv run ruff format --check .
      - run: uv run ruff check .
      - run: uv run mypy --strict .
      - run: uv run pytest -q
      - run: uv run pip-audit
      - uses: gitleaks/gitleaks-action@v2
      - uses: returntocorp/semgrep-action@v1
```

Non-negotiables:

- **Branch protection on the default branch**: no direct pushes, required status checks, required review.
- **`CODEOWNERS`** on finance-critical paths so the right person is pulled into any change touching the ledger, pricing, or billing.
- **Least-privilege workflow tokens.** `permissions: contents: read` by default; grant more only where needed.
- **Never run untrusted PR code with production secrets.** Use `pull_request` rather than `pull_request_target` unless you fully understand the difference.
- **`--frozen` on install** so CI fails on a stale lockfile rather than silently resolving something different from what you tested.
- **Reproducible builds.** Pinned versions, committed lockfiles, no network fetches at build time.

For SOX-relevant systems, CI **is** your change-management evidence. Configure it so the artifacts an auditor asks for — who approved, what ran, what passed — are produced automatically rather than reconstructed later.

---

## AI-assisted development controls

Current expectations for agent-written code, and the practices world-class teams adopted through 2026.

**Treat an agent run as a production change request, not a generated diff.** The controls that hold up are the ones preserving enough context to answer "why was this allowed to happen?" after the fact.

- **Named human reviewer, evidenced in the PR record.** Segregation between whoever prompted the change and whoever approved it. For SOX-relevant systems this is not optional.
- **Feedforward controls** constrain before generation: skills like this one, spec-driven workflows (spec → plan → implement rather than chat-to-code), structured context, and pinned conventions.
- **Feedback controls** trigger self-correction before human review: the gates above, plus **mutation testing** (`mutmut`, `cosmic-ray`) where the test suite guards something expensive. Mutation testing answers "would our tests actually catch a wrong number," which coverage cannot.
- **Verify every numeric literal and every external API call in agent output.** Agents fill gaps with reasonable-sounding numbers and plausible-looking method names. A confidently wrong tax rate or a hallucinated SDK method is the characteristic failure.
- **Watch for cognitive debt.** As agents generate more code, the gap widens between the system and the humans nominally accountable for it. If nobody on the team can explain how a calculation works, you have a control problem regardless of whether the tests pass.

---

## Adoption order

Do not attempt all of it at once. In order of value per hour spent:

1. **Ruff + format/lint gate** — hours to adopt, immediate consistency
2. **Gitleaks pre-commit** — minutes, prevents the worst single mistake
3. **`uv` + committed lockfile** — reproducibility, which is an audit requirement
4. **mypy --strict on new and money-touching code first**, then expand
5. **pip-audit and Dependabot** — low effort, closes the easy CVE window
6. **The reconciliation gate** — highest value of anything on this page, and the only one no off-the-shelf toolchain gives you
7. **dbt contracts and unit tests** on fact models
8. **Semgrep with custom finance rules**
9. **SBOM and SLSA L2**

Steps 1 through 5 are a week of work and cover most of the risk.
