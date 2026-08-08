---
name: clean-finance-code
description: Modern software engineering discipline enforced as gates — uv, ruff, mypy strict, pydantic, pytest, gitleaks, semgrep, pip-audit, SBOM/SLSA, dbt contracts, SQLFluff — plus finance-specific rules so the numbers are right. Risk-tiered so ad hoc analysis stays fast while anything posting to the GL, billing a client, moving cash, or feeding an audit gets full controls. Covers clean code, anti-patterns, architecture, testing, security (OWASP 2025), supply chain, CI, US GAAP, reconciliation, segregation of duties, ERP integration, Excel and Power Query discipline, FP&A, Commercial Finance, AP, AR/Billing, Treasury, Controllership, and building in-house finance tools.
when_to_use: Any work involving revenue, cost, margin, cash, invoices, journal entries, forecasts, budgets, variance, pricing, rate cards, close, reconciliation, payroll, or tax — and any code touching an ERP, EPM, billing, or banking system. Trigger phrases - build a forecast model, calculate margin, reconcile these accounts, pull the trial balance, price this scope, automate the close, sync from NetSuite, generate invoices, build a finance dashboard, why is this variance off, review this pipeline.
---

# Clean Finance Code

Clean books follow clean code. This skill governs both.

**The number being wrong is the primary failure mode.** Not ugly code, not thin tests. A well-structured, fully-tested pipeline that quietly drops 200 rows of accruals is a worse outcome than messy code that reconciles. Optimize for the number first, then the code.

## 0. Classify the tier, out loud, before anything else

Discipline scales with tier. Tier 2 ceremony on a Tier 0 pull wastes the user's time; Tier 0 informality on a Tier 2 change is how money goes missing.

| Tier | What it is | Required |
|---|---|---|
| **0 — Analysis** | One-off pull, pivot, scenario, ad hoc question | Reconcile to a control total. State period, basis, entity, currency, and every filter. Report row counts in and out. No ceremony. |
| **1 — Recurring** | Monthly pack, forecast refresh, dashboard, standing model | Tier 0 plus: reproducible from a pinned source, assumptions documented in the artifact, prior vintages preserved, refresh idempotent |
| **2 — System of record** | Posts to the GL, generates invoices, initiates payment, updates a production rate card, feeds a filing or audit | Tier 1 plus: full engineering discipline (§2), security review (§3), immutability, segregation of duties, audit trail, approval path, named human reviewer |
| **2P — Finance product** | In-house tool other people use to do finance work | Tier 2 plus: access control, concurrency, versioned calculation logic, documented data model, migration story |

**If you cannot tell, ask.** The test: does anyone act on this number without re-deriving it? If yes, it is at least Tier 1.

Escalation is one-way and worth saying aloud. A "quick analysis" that gets scheduled becomes Tier 1. A model that starts feeding invoices becomes Tier 2.

## 1. Money invariants (all tiers, no exceptions)

**Decimal, never float.** `Decimal` in Python, `DECIMAL`/`NUMERIC` in SQL. Never `FLOAT`/`REAL`/`DOUBLE` for money. Build from strings or ints: `Decimal("0.1")`, never `Decimal(0.1)`, which carries binary error into what looks exact. JSON numbers are floats, so serialize money as a string or integer minor units.

**Rounding is declared, not defaulted.** State mode and scale. ROUND_HALF_UP for invoices and tax; ROUND_HALF_EVEN for statistical aggregation. Python's `Decimal` default is ROUND_HALF_EVEN, usually not what an invoice needs. **Round once**, where the number becomes an obligation. Never round intermediates then sum.

**Currency travels with the amount.** Never sum across currencies without an explicit rate, rate date, and **rate type**: spot (transaction), average (P&L translation), closing (balance sheet translation), historical (equity). Average where closing belongs is a real and common defect.

**Minor units respected.** Do not hardcode 2 decimals. JPY and KRW have 0; BHD, KWD, JOD, TND have 3.

**Allocation is exhaustive.** Parts sum to the whole. Use largest-remainder, distribute the remainder deterministically, assert the total. Splitting 100.00 three ways gives 33.33/33.33/33.34, never three 33.33s.

**Signs are conventional and stated.** Debit-positive or credit-positive; expense-positive or negative. Pick one, document it, convert once at the boundary. Contra accounts carry the opposite sign of their section.

**Rates are not amounts.** Store as decimals with adequate scale. A 0.1% fee on $10M is $10,000, so never round a rate to 2 places. Growth rates compound; never average them arithmetically.

**Nulls are not zeros.** A missing forecast is not a zero forecast. `COALESCE(amount, 0)` is a decision requiring justification, never a default.

**Five dates are distinct**: service, invoice, posting, due, payment. Never reuse one for another. Most close cut-off errors are exactly this.

### Stated defaults

When a calculation needs an assumption the user has not supplied, use the default below, **state it in the output, and invite a correction.** Never bury it in a formula: it goes in the assumptions block as one named input, so changing it re-runs the model.

| Assumption | Default | Why |
|---|---|---|
| **Annual billable hours per FTE** | **1,800** | **Never 2,080.** That is total paid hours with nothing removed for PTO, holidays, training, admin, or business development. Using it understates cost per hour and is the most common cause of scopes that price as profitable and deliver as losses. |

Say it plainly, every time:

> Using 1,800 billable hours per FTE per year. Tell me your firm's figure if it differs.

**Prefer actuals over the default** when the firm can produce them, and say which you used. **Model per role and level** where the data allows: seniors bill materially fewer hours than juniors because they carry business development and management time, so a single firm-wide denominator overstates senior margin and understates junior margin at the same time. Typical ranges by sector are in `references/commercial-finance.md`.

## 2. Clean code

Applies at every tier; enforcement rigor scales. In finance this is not cosmetic: a structural defect here usually surfaces as a wrong number rather than a crash, which is why duplicated business logic and hidden state are treated as correctness bugs, not style issues.

### Before writing

**Recon.** Read the file you will change in full, plus its callers and its tests. Grep for the symbol before changing a signature. Read the repo's conventions and match them over general best practice.

**State three things**: blast radius (what else can break), conventions found (how this repo already does it), and assumptions (anything inferred rather than confirmed). If recon contradicts the request, say so before implementing.

**Prefer, in order**: change nothing (the request may rest on a misunderstanding) → change one function → change one module → introduce an abstraction. Escalate only when the level below cannot work, and say why.

### While writing

**Smallest correct change.** No drive-by refactors, no reformatting untouched lines, no renaming you were not asked to do. List unrelated problems at the end instead of fixing them.

**Functions do one thing.** If the name needs "and," split it. A boolean parameter that selects behavior is two functions wearing a trenchcoat, and in finance one branch usually posts to the ledger.

**Nesting stops at three levels.** Guard clauses and early returns. Extract the innermost block into a named function.

**Errors are explicit.** No bare `except:` or `catch {}` that swallows, no `.catch(() => null)`, no ignoring a returned error. Failures must be visible at the boundary that can act on them. Never fail open on an auth, approval, or validation path.

**Validate at the trust boundary, once**, at the edge. Parse into a typed shape, then trust it inward. Do not scatter defensive checks through internals; that is the most common shape of AI-generated code and it hides where validation actually happens.

**No hidden global state.** Module-level mutables, singletons carrying request data, and an implicit "current period" or "current entity" read deep in the call stack all produce results whose meaning depends on when the job ran. Pass it as a parameter.

**One implementation of every business rule.** Duplicated logic is the most expensive defect in finance code: a margin calculation in the pricing tool and in the reporting mart will diverge, and the divergence is found by a client or an auditor. Grep for the concept before writing it.

**Names carry intent, and in finance they carry units and basis.** `apply_discount` not `process`. `revenue_usd_accrual` not `revenue`. `usd_per_eur` not `fx_rate`. `service_date` not `date`. Never a finance column named `date`, `amount`, `value`, or `type`.

**No magic values.** Named constants with a comment on provenance ("federal rate per IRC §11, effective 2018"). If the value changes over time it is not a constant at all: move it to effective-dated data. **Never hardcode a rate, assumption, or threshold inside a formula** — invisible, never reviewed, silently wrong at the next reforecast.

**Comments explain why, never what.** Delete comments that restate the code.

### Anti-patterns to refuse to add

God objects, files past ~500 lines with mixed responsibilities, duplicated business logic, abstraction with one implementation, leaky abstractions, deep nesting, hidden global state, circular imports, magic values, inconsistent error handling, silent failures, speculative features, dependency bloat, copy-paste blocks, dead code, misleading names.

When you find one in existing code: name the risk, propose the **smallest** remediation, and do not perform it uninvited. Exception: fail-open authorization is worth fixing on sight — flag it as security.

Full catalogue with remediations, including the data-and-query anti-patterns that produce wrong numbers rather than crashes, is in `references/code-quality.md`.

### Testing

**Risk-based, not count-based.** Test behavior and boundaries, not implementation; a test that breaks on every refactor is a liability. Every bug fix gets a test that fails before the fix, for the right reason. Deterministic: inject the clock and the random source, no sleeps, no live network, no order dependence. Do not mock what you own into meaninglessness — if the test only proves the mock works, delete it.

Do not chase coverage percentage. In finance the test that matters most is the automatic per-period tie-out to the source system's own report; no unit test compensates for its absence. See `references/testing-finance-code.md`.

### Verification gates

Nothing is reported complete until every applicable gate passes. Use the repo's existing equivalent if it has one, but never skip a category — and say which tools you actually ran.

| # | Gate | Python | SQL / dbt |
|---|---|---|---|
| 1 | Format | `ruff format` | `sqlfluff fix` |
| 2 | Lint | `ruff check` | `sqlfluff lint` |
| 3 | Types / contracts | `mypy --strict` | dbt model contracts |
| 4 | Secrets | `gitleaks` | `gitleaks` |
| 5 | Tests | `pytest` | `dbt test` + unit tests |
| 6 | Dependency CVEs | `pip-audit` | n/a |
| 7 | SAST | `semgrep --config auto` | `semgrep` |
| 8 | **Reconciliation** | tie-out to the source system | tie-out to the source system |

**Gate 8 is the one no general toolchain includes and the one that matters most here.** Code that passes 1 through 7 and does not tie out is not done.

Then **read your own diff as a reviewer**, and run `references/self-review.md` before reporting.

Tool detail, configuration, Excel and Power Query discipline, supply-chain practice, CI structure, and the adoption order are in `references/modern-toolchain.md`.

### Dependencies and architecture

Before adding a dependency: confirm the stdlib or existing code does not already do it, then check maintenance activity, license, CVEs, transitive weight, provenance, and removal cost. Fashionable is not a reason. Commit lockfiles. **A dependency that computes money can be wrong** — tax engines, FX providers, date and holiday calendars all encode decisions, so verify against known answers and pin the version.

Prefer the simplest architecture that meets demonstrated requirements. Monolith until there is a named, present-tense reason. Record expensive-to-reverse decisions as ADRs. Detail, including the finance-specific architectural constraints, is in `references/architecture-and-dependencies.md`.

### Do not

Rewrite working code to modernize it. Improve code outside your scope. Add abstraction for a second case that does not exist. Delete code you do not understand — find its callers first, including dynamic references. Run destructive commands without confirmation. Commit or push unless asked. **Trust AI-generated code, including your own from earlier in the session** — re-read it, and verify every numeric literal and every external API call, because agents fill gaps with reasonable-sounding numbers that are confidently wrong.

## 3. Security (mandatory on Tier 2, and on any listed surface at any tier)

Finance systems are high-value targets holding regulated data. Run a security review when the change touches: authentication, authorization, sessions or tokens, payments, secrets or key material, personal or sensitive data, file paths or uploads, parsing of external input, deserialization, subprocess or shell execution, SQL or query construction, CORS or security headers, crypto, infrastructure or CI permissions, or new dependencies.

Aligned to **OWASP Top 10:2025** (supersedes 2021; Broken Access Control remains A01, Security Misconfiguration is now A02, and **Mishandling of Exceptional Conditions is new at A10** — the category agent-written code fails most).

**Standing rules**
- **Parameterized queries only.** String-concatenated SQL is a defect, no exceptions.
- **Established crypto libraries.** Never hand-roll crypto, token formats, or password hashing. argon2id or bcrypt for passwords, never SHA/MD5. CSPRNG, never `Math.random`.
- **Authorization server-side on every privileged operation**, not once at the router. Object-level checks (can user A pass user B's ID?) and function-level checks. Never derive privilege from a client-supplied field.
- **Default deny. Fail closed.** An exception on an authorization path denies; it never falls through.
- **Secrets from environment or a secret manager.** Never committed, never a default argument, never in a fixture.
- **Never log secrets, tokens, credentials, or PII.** Mask at the source.
- **Validate at the edge with a schema**, allowlist not blocklist, with size limits.
- **Shell**: argument arrays, never string interpolation. No `eval`, `exec`, `pickle.loads`, or unsafe deserialization on untrusted input.
- **Path traversal**: resolve and confirm the final path sits inside the intended root.
- **SSRF**: allowlist destinations for server-side fetches; block internal ranges and cloud metadata endpoints.
- **Supply chain**: CVE-check new dependencies (`pip-audit`, Trivy), verify the package name exactly (typosquats), commit lockfiles, least-privilege CI tokens, never run untrusted PR code with production secrets. Generate an SBOM (`syft`) and use Sigstore keyless signing where the pipeline supports it — if a compromised dependency alters a calculation, an SBOM tells you in minutes which reported periods were affected instead of weeks under audit scrutiny.
- **Scan, do not assume**: `gitleaks` in pre-commit, `semgrep --config auto` in CI, with custom rules for your own finance invariants (no float on money, no `UPDATE` against ledger tables). **A committed secret is compromised** — rotate it. Deleting it from the repo does not un-leak it, and git history keeps it.

**Never write "this is secure."** Reconciling and passing scanners is evidence, not assurance. State what you ran and what remains unverified. Escalate to a specialist for: new cryptographic design, multi-tenant isolation, payment/PCI scope, authentication implementation, regulated data, or any finding you can describe but cannot bound.

## 4. Reconciliation is an output, not a step

Every transformation touching money reports:

```
Source:     <system, extraction timestamp, filter criteria>
Rows in:    <n>    Control total in:  <amount, currency>
Excluded:   <n>    Excluded total:    <amount>  [reason]
Rows out:   <n>    Control total out: <amount, currency>
Delta:      <amount, explained line by line>  or  "ties exactly"
Tie-out:    <independent source and result>
Unmatched:  <n>
```

**An unexplained delta stops the work.** Do not round it away. Do not call it immaterial unless a human set the threshold.

Tie-out strength, best first: the source system's own report (ERP trial balance, bank statement, AR aging) → a different extraction path to the same data → a GL control account → opening plus movement equals closing → your own recomputation (weakest, proves arithmetic only). **A pipeline that reconciles only to itself proves nothing.**

- **Never silently drop rows.** Inner joins are the most common cause of quiet loss in finance pipelines. Prefer a left join plus an assertion on unmatched.
- **Check row counts across every join.** A join that increases fact-table row count is a fan-out bug until proven otherwise.
- **Never `COALESCE` to zero to make a total tie.** Find the missing record.
- **Never `SELECT DISTINCT` to fix duplicates.** It hides the cause and will eventually deduplicate two legitimate identical transactions.
- **Report what every filter excluded**, in rows and dollars.
- **State the grain in one sentence before you sum.** Most finance data bugs are grain bugs: summing a header amount after joining to lines, or aggregating an already-allocated column.

## 5. Period, calendar, close

- **State the period always**: fiscal or calendar, exact boundaries. Fiscal years not starting in January, 4-4-5 and 4-5-4 calendars, and 53-week years all break naive date logic. Use a period table, never date arithmetic.
- **Accrual or cash basis, stated.** Never mixed without labeling.
- **Respect the close.** A closed period is immutable. Code writing to an ERP handles period-lock rejection as an expected condition, not a crash. Month-end is exactly when your job runs and exactly when the period locks.
- **"As of" versus "for the period."** Balance sheet accounts are point-in-time, P&L accounts are period-flow. Mixing them produces plausible wrong numbers.
- **Snapshot every extraction.** A prior period re-pulled today may differ from last week's pull, and unexplained variance movement is usually this.
- **Restatements are visible and labeled**, never silent overwrites.

## 6. Ledger integrity (Tier 2)

- **Debits equal credits**, asserted per entry and per batch before posting. Fail the batch; never post a partial.
- **Posted entries are immutable.** Corrections are reversing entries. No `UPDATE`, no `DELETE`. Audit requirement, not preference.
- **Idempotency on every money-moving operation**, enforced by a database unique constraint, not application logic alone. A retried payment batch that double-pays is the classic catastrophe.
- **Never hold a database transaction open across a network call** to a bank or ERP. Use an outbox: record intent, submit, record result, reconcile.
- **Every posting carries lineage**: source system, source record ID, run ID, timestamp, logic version.
- **Never write directly to an ERP's GL tables.** Use the documented API or import path.
- **Never hard-delete anything** in a finance system.

## 7. Controls and segregation of duties

| Function | Must not also | Risk |
|---|---|---|
| Create or edit vendor | Approve payment | Fictitious vendor fraud |
| Enter invoice | Approve invoice | Unauthorized spend |
| Approve payment | Execute release | Payment diversion |
| Post journal | Approve journal | Concealment |
| Reconcile an account | Post to it | Self-review |

- Enforce by identity in code, not convention. Attribute automated actions to the human who authorized the run; "the integration did it" collapses accountability.
- Approval thresholds server-side. A UI limit is decoration. Approval is a record (who, when, which version), not a flag — approving version 3 does not approve version 4.
- **Audit log append-only**: actor, action, entity, before, after, reason, run ID. Separate from application logs, enforced at the database with permissions.
- **Bank detail changes require out-of-band verification**, forced by the code path. Business email compromise targeting remit-to changes is the most common finance fraud and is preventable at this control.
- **Sensitive by default**: bank details and IBANs, tax IDs, W-9/W-8 content, salary, SSNs, garnishments, cardholder data, customer PII, and pre-release results (material non-public information). Never in a log, error message, notebook output, or unmasked development environment.
- **AI-generated changes to SOX-relevant systems are program changes.** Current auditor expectation is a named human reviewer evidenced in the PR or commit record, with segregation between whoever prompted the change and whoever approved it. PCAOB AS 2201/2101 amendments take effect for periods beginning after December 15, 2026, and COSO issued GenAI guidance in February 2026 — confirm current expectations with the audit team rather than relying on this line.

## 8. Accounting judgments belong to humans

**Never let code decide a treatment.** Treatments are attributes on the contract or account, set by accounting, stored as dated data with rationale, applied by code. Code that infers treatment from data shape will silently change the financials when the data changes.

```
# RIGHT
contract.revenue_presentation   # 'gross' | 'net' — set by accounting, dated, with rationale
contract.recognition_method     # 'point_in_time' | 'over_time_input' | 'over_time_output'

# WRONG
presentation = 'gross' if contract.has_pass_through_spend else 'net'
```

Flag records missing a required treatment attribute rather than defaulting.

**Escalate always**: revenue presentation (gross vs net) and any change to it; whether and when a performance obligation is satisfied; capitalize vs expense; reserve or allowance adequacy; any tax position; contract modification accounting; anything restating a closed period; any treatment where a reasonable argument exists for two answers.

**The highest-stakes one: principal versus agent (ASC 606).** Control is the criterion — does the entity control the specified good or service before transfer to the customer? Principal recognizes gross; agent recognizes net. Indicators toward principal: contracts with the vendor in its own name, bears cancellation or inventory risk, has pricing discretion, primary fulfilment responsibility. Toward agent: work runs through the client's accounts for a stated commission or management fee. Where an entity procures third-party goods or services on a client's behalf — media, subcontractors, vendor pass-throughs — identical economics can differ in reported revenue by the entire pass-through amount. Related traps: pass-through costs and volume rebates, which may require reduction of revenue rather than income recognition. **Present indicators and evidence, recommend controller and auditor review, never conclude in code.**

## 9. Reporting

```
Tier:         0 / 1 / 2 / 2P
Changed:      <files or artifacts>
Period:       <fiscal or calendar, exact boundaries>
Basis:        accrual / cash
Entity/scope: <entities, currencies, exclusions>
Source:       <system, extraction timestamp>
Reconciled:   <to what independent source, with the result>
Delta:        <amount and explanation, or "ties exactly">
Verified:     <exact commands run and their results>
NOT verified: <what you could not run or tie out, and why>
Assumptions:  <every judgment, including accounting treatment>
Risks:        <what you noticed but did not fix>
```

**Never claim a command, test, or scanner was run if it was not.** Never say "this is secure," "this is correct," or "this ties" when what you mean is "the checks I ran passed."

## 10. When to stop and escalate

- The number does not tie and you cannot explain the delta.
- The work requires an accounting judgment (§8).
- You are about to write to a production financial system for the first time.
- A control total moved and you cannot attribute it.
- The request implies changing a posted period.
- **Someone asks you to make the model match a target rather than derive it.** State the derived number, what assumption would have to change to reach the target, and whether that assumption is defensible. Do not quietly plug.

## Reference files

Load only what the task needs.

**Code quality and tooling**
- `references/modern-toolchain.md` — named 2026 tools and protocols as gates: uv, Ruff, mypy strict, Pydantic, pytest, SQLFluff, dbt contracts and unit tests, Excel and Power Query discipline, Gitleaks, Semgrep, pip-audit, SBOM/SLSA/Sigstore, CI structure, AI-assisted development controls, and the adoption order
- `references/code-quality.md` — full anti-pattern catalogue with smallest-remediation guidance, including the data and query anti-patterns that produce wrong numbers rather than crashes, and AI-generated code smells
- `references/architecture-and-dependencies.md` — architecture decision factors, ADR template, dependency scorecard, performance, reliability, observability, and the constraints finance adds to each
- `references/self-review.md` — pre-report checklist: code quality, finance correctness, security, honest reporting
- `references/testing-finance-code.md` — golden datasets, property tests for money invariants, edge cases that actually occur
- `references/security-review.md` — OWASP Top 10:2025 checklist scoped to finance systems

**Finance correctness**
- `references/money-invariants.md` — decimal, rounding, allocation, FX, signs, with working code
- `references/reconciliation-and-controls.md` — control totals, tie-outs, SOD, audit trail, ITGC, sensitive data
- `references/gaap-reference.md` — ASC 606/830/842/450, recent ASUs, escalation triggers
- `references/data-modeling.md` — chart of accounts, dimensions, grain, effective dating, warehouse layering
- `references/erp-and-systems.md` — named systems and their integration hazards
- `references/workflows.md` — runbooks: analysis, model build, pipeline, close automation, integration, review, cleanup

**By function** (Commercial Finance and FP&A are deepest)
- `references/commercial-finance.md` — pricing, rate cards, scopes, margin defense, contract terms
- `references/fpna.md` — driver models, vintages, variance bridges, headcount planning
- `references/ap.md` · `references/ar-billing.md` · `references/treasury.md` · `references/controllership.md`

**Building tools**
- `references/finance-products.md` — in-house tools: calculation versioning, approvals, concurrency, migration
- `helpers/money.py` — tested Decimal helpers for allocation, rounding, FX, balance assertions, and reconciliation. Prefer these over rewriting them.
