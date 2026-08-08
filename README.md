# Clean Finance Code

### A Claude skill that makes AI-written finance code something you'd be comfortable showing an auditor.

Your team's already using AI to build forecast models, pull data, and automate parts of the close, probably faster than anyone's reviewing it. This makes sure what comes out is built properly: real engineering standards, current security practices, actual controls, plus finance rules on top so the numbers tie out, the audit trail holds up, and accounting calls go to a person instead of getting guessed at.

**You get the speed without quietly picking up a control deficiency you'll be explaining to your auditor next year.**

Built for FP&A, Commercial Finance, AP, AR and Billing, Treasury, and Controllership. Works whether you're doing a quick pull, a monthly pack, or something that posts to the general ledger.

```bash
bash install.sh
```

---

## What you actually get

Two things, and both halves matter.

**Modern engineering, enforced.** Not principles in a document. Named tooling that runs as gates before anything is called done: `uv` with a committed lockfile, `ruff` for lint and format, `mypy --strict`, `pydantic` for validation, `gitleaks` for secrets, `semgrep` for static analysis, `pip-audit` for known vulnerabilities, SBOM and Sigstore signing for supply chain, dbt contracts and unit tests for the warehouse. Plus the discipline behind them: read before writing, smallest correct change, one implementation of every business rule, explicit errors, no hidden state, no magic numbers.

**Correct numbers.** Reconcile before analyzing, `Decimal` never `float`, no silently dropped rows, rates looked up by service date, ledger entries that can't be edited after the fact, and accounting judgments handed to a human instead of inferred from whatever the data happens to look like.

They ship together for a reason: **in finance, sloppy code usually doesn't crash. It just hands you a wrong number.** Duplicated logic means the pricing tool and the reporting mart disagree by Q3. Hidden state means results depend on when the job ran. A hardcoded number in a formula is a tax rate nobody reviewed. Clean code isn't cosmetic here, it's how the number stays right.

---

## Why this exists

Five failure modes, all of which produce numbers that look fine:

| Failure | What it costs |
|---|---|
| A pipeline whose inner join silently drops 200 accrual rows | A month-end that ties to nothing, found in the review meeting |
| `float` arithmetic on money | Reconciliation breaks by pennies that compound and nobody can source |
| The same margin rule implemented in two places | They diverge within a quarter, and a client finds it before you do |
| A growth rate hardcoded inside a formula | Invisible, never reviewed, silently wrong at the next reforecast |
| An agent deciding an accounting treatment from data shape | Revenue presentation flips when the data changes, with no human in the loop |

The first two are data bugs. The middle two are **code quality** bugs that happen to cost money. The last is a governance failure. None are caught by linters, type checkers, or normal code review. All five are caught here.

---

## See the difference

Same request, same model. The difference is what Claude does before answering.

> **"Pull Q3 revenue by client and compare it to budget."**

**Without the skill**

Claude writes a clean, readable pandas script. It reads the extract, joins invoices to the client table, groups by client, merges the budget, and returns a tidy table with a variance column. It runs in four seconds and looks completely reasonable.

Three things went wrong and none of them are visible:

- The join was an inner join. Forty invoices had client IDs not present in the client table, so **$180K of revenue silently vanished**.
- Amounts are `float64`, the pandas default. The totals are off by fractions of a cent that will not tie to the general ledger.
- Nothing was checked against anything. The output is internally consistent and externally wrong.

You find out in the review meeting.

**With the skill**

```
Tier:       0 (analysis)
Period:     FY26 Q3 (fiscal), 2026-04-01 to 2026-06-30
Basis:      Accrual
Scope:      Entities 1, 2 · USD · intercompany excluded
Source:     NetSuite SuiteQL, extracted 2026-08-08 06:12 UTC

Rows in:    48,213    Control total in:   12,847,332.14 USD
Excluded:      412    Excluded total:        (94,220.00) USD  [intercompany, per policy]
Rows out:   47,801    Control total out:  12,753,112.14 USD
Delta:      ties exactly
Tie-out:    Agrees to NetSuite Trial Balance for FY26 Q3

⚠ 40 invoices (180,412.00 USD) have client IDs absent from the client master.
  Retained as "Unassigned" rather than dropped. These need mapping before
  this analysis is used — client-level figures are understated until resolved.
```

Then the table.

The second version took slightly longer and is the only one you can act on. That is the entire value proposition.

---

## The core idea: risk tiers

Discipline scales with consequence. This is the design decision everything else rests on — without it, the skill would demand an architecture decision record to pivot a trial balance, and you would stop using it by Thursday.

| Tier | What it is | What's required |
|---|---|---|
| **0 — Analysis** | One-off pull, pivot, scenario | Reconcile to a control total. State period, basis, entity, currency, filters. No ceremony. |
| **1 — Recurring** | Monthly pack, forecast refresh, dashboard | Reproducible from a pinned source, assumptions documented, prior vintages preserved |
| **2 — System of record** | Posts to the GL, bills a client, moves cash, feeds an audit | Full engineering discipline, security review, immutability, segregation of duties, audit trail, named human reviewer |
| **2P — Finance product** | In-house tool others use to do finance work | Plus access control, concurrency, versioned calculation logic, migration story |

Claude states the tier before starting, and says so when work escalates between them. A "quick analysis" that gets scheduled has become Tier 1.

---

## Quick start

Download or clone the repo, then from inside the folder:

```bash
bash install.sh
```

That installs the skill into `.claude/skills/`, drops in the config and rules, wires up the hooks, and verifies they fire. It backs up anything it would overwrite, and it's safe to re-run.

| Command | What it does |
|---|---|
| `bash install.sh` | Skill + config into the current project (recommended) |
| `bash install.sh --user` | Skill only, into `~/.claude/skills/` for every project |
| `bash install.sh --skill-only` | Skill into this project, no config changes |

**Then do this**, because the installer can't: open `CLAUDE.md` and replace the `<bracketed>` placeholders with your real build and test commands, and adjust the `permissions` block in `.claude/settings.json` to your stack. A CLAUDE.md full of placeholders is worse than none, and the default permissions assume npm and pytest.

Optional check that the money helpers work:

```bash
cd skills/clean-finance-code/helpers && python3 -m pytest test_money.py -q
# expect: 37 passed
```

Manual setup and the reasoning behind the structure are in [`docs/INSTALL.md`](docs/INSTALL.md).

---

## What's inside

```
skills/clean-finance-code/
  SKILL.md                       always-loaded: risk tiers, money invariants, clean code,
                                 security, reconciliation, ledger integrity, controls, GAAP
  references/                    loaded on demand, only when the task needs them

    — engineering and tooling —
    modern-toolchain.md          named 2026 tools as gates: uv, ruff, mypy strict, pydantic,
                                 pytest, SQLFluff, dbt contracts + unit tests, Excel and
                                 Power Query discipline, gitleaks, semgrep, pip-audit,
                                 SBOM/SLSA/Sigstore, CI structure, AI-dev controls
    code-quality.md              anti-pattern catalogue with smallest-remediation guidance,
                                 including the query anti-patterns that produce wrong numbers
    architecture-and-dependencies.md  decision factors, ADR template, dependency scorecard,
                                 performance, reliability, observability
    self-review.md               pre-report checklist: code, numbers, security, honesty
    testing-finance-code.md      golden datasets, property tests, edge cases that occur
    security-review.md           OWASP Top 10:2025 checklist scoped to finance systems

    — finance correctness —
    money-invariants.md          decimal, rounding, allocation, FX, sign conventions
    reconciliation-and-controls.md  control totals, tie-outs, SOD, audit trail, ITGC
    gaap-reference.md            ASC 606/830/842/450, recent ASUs, escalation triggers
    data-modeling.md             chart of accounts, grain, effective dating, warehouse layers
    erp-and-systems.md           named systems and their integration hazards
    workflows.md                 runbooks for analysis, models, pipelines, close, review

    — by function —
    commercial-finance.md        pricing, rate cards, scopes, margin defense
    fpna.md                      driver models, vintages, variance bridges, headcount
    ap.md  ar-billing.md  treasury.md  controllership.md
    finance-products.md          building in-house finance tools

  helpers/money.py               tested Decimal helpers (37 passing tests)

config/
  CLAUDE.md                      project instruction template
  settings.json                  permissions and token-budget settings
  rules/                         path-scoped rules that load only for matching files
  hooks/                         enforcement that runs as code
```

---

## Three levels of enforcement

The distinction matters more than any individual rule, and most setups miss it.

| Mechanism | Nature | Good for |
|---|---|---|
| **Skill + CLAUDE.md** | Context Claude reads and tries to follow. **No guarantee.** | Judgment, standards, domain knowledge |
| **`permissions`** | Enforced by the client regardless of what Claude decides | Hard blocks |
| **Hooks** | Run as code at lifecycle events regardless of what Claude decides | Formatting, secret scanning, destructive-command guards |

**Anything you cannot tolerate being skipped belongs in a hook, not in prose.**

Three hooks ship here, all tested:

- **`guard-finance-numerics.sh`** — flags `FLOAT` on money columns, `Decimal(0.1)` built from a float literal, hardcoded FX rates, `UPDATE`/`DELETE` against ledger tables, `COALESCE(money, 0)`, hardcoded materiality thresholds, `is_current` rate lookups, and division by 2080 in a cost context (the billable-hours denominator should default to 1,800 and live in the assumptions block). Hard-blocks any log line containing routing numbers, tax IDs, SSNs, or salary.
- **`guard-destructive.sh`** — blocks force pushes, hard resets, `DELETE` without `WHERE`, absolute-path `rm -rf`, and piping remote scripts to a shell.
- **`format-and-lint.sh`** — formats and lints the edited file, with a hardcoded-secret canary.

---

## A few rules worth calling out

These are the ones that catch real money.

**Fully loaded cost divides by annual billable hours, defaulting to 1,800, not 2,080.** 2,080 is total paid hours with nothing removed for PTO, holidays, training, or business development. Using it understates cost and is the most common reason scopes price as profitable and deliver as losses. The skill states the assumption in its output and invites you to change it.

**Never overwrite a forecast vintage.** Every run is a new immutable version. Overwrite and you cannot measure forecast accuracy, so systematic bias repeats indefinitely.

**Posted entries are immutable.** Corrections are reversing entries. No `UPDATE`, no `DELETE`. Audit requirement, not preference.

**Allocation is exhaustive.** Splitting 100.00 three ways gives 33.33 / 33.33 / 33.34, never three 33.33s. The helpers enforce this and raise rather than leak.

**Idempotency on anything money-moving**, enforced by a database unique constraint rather than application logic. A retried payment batch that double-pays is the classic catastrophe.

**Accounting judgments escalate, never resolve.** Revenue presentation (gross vs net), capitalization, recognition timing, and reserve adequacy are controller and auditor decisions. The skill presents indicators and evidence, then stops. Treatments are carried as dated data attributes, never inferred at runtime — so presentation cannot silently flip when the data changes.

**Never plug to a target.** If asked to make a model match a number, it states the derived figure, what assumption would have to change, and whether that assumption is defensible.

---

## Who it's for

Written for **people-based services businesses** — agencies, law firms, consultancies, engineering and design firms, staffing, managed services. The shared structure: revenue is a function of people's time, capacity is the constraint, and margin is defended at pricing rather than recovered later.

Most of it (money invariants, reconciliation, ledger integrity, controls, GAAP, ERP integration) is industry-agnostic. The pricing and billing sections lean toward services.

Functions covered: FP&A, Commercial Finance, Accounts Payable, Accounts Receivable and Billing, Treasury, Controllership.

---

## Scope and limits

**This is not accounting advice.** The GAAP reference exists so code encodes the right concepts and so Claude knows when to stop and escalate. Verify effective dates against FASB directly — deferrals and clarifications happen.

**This is not a security guarantee.** The security checklist reduces risk; it does not prove absence of vulnerabilities. The skill is explicitly instructed never to claim code is secure, and to distinguish what it ran from what it concluded.

**This is not a controls opinion.** Reconciling and passing assertions is evidence, not assurance. Control effectiveness is a conclusion internal audit and your external auditor own.

**System coverage reflects the 2026 vendor landscape.** Capabilities and API versions move. Confirm before building an integration.

**Auditor expectations for AI-generated code are actively evolving.** PCAOB AS 2201/2101 amendments take effect for periods beginning after December 15, 2026, and COSO issued GenAI guidance in February 2026. Confirm current requirements with your audit team rather than relying on this repo.

---

## Requirements

- [Claude Code](https://code.claude.com/docs) or Claude Cowork
- Python 3.10+ to run the helper tests (the skill itself needs nothing)
- The hooks use `bash` and `python3`, both standard on macOS and Linux

---

## License

MIT. See [LICENSE](LICENSE).
