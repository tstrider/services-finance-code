# Self-Review Checklist

Run before reporting. Read your own diff as if someone else wrote it and you do not trust them.

Two halves: the code has to be clean, and the number has to be right. Both are required. Neither substitutes for the other.

---

## Part 1 — Code quality

### Scope
- [ ] Every changed line serves the stated goal. Nothing incidental.
- [ ] No reformatting of untouched code. No unrelated renames.
- [ ] No debug prints, commented-out code, `TODO` without an owner, or leftover scaffolding.
- [ ] No new dependency added without the scorecard.

### Correctness
- [ ] Boundary cases: empty, one, many, null, negative, max.
- [ ] Error paths return or raise something a caller can act on.
- [ ] No swallowed exceptions. No fail-open on an auth, approval, or validation path.
- [ ] Concurrency: is anything here shared mutable state?

### Clarity
- [ ] A reviewer who has not seen the ticket can follow the diff.
- [ ] Names say what things are and do, and carry units where relevant.
- [ ] Non-obvious decisions have a why-comment. No comments restating code.
- [ ] Public interfaces documented where the repo does so.

### Structure
- [ ] Did I add an abstraction with one implementation?
- [ ] Did I duplicate logic that already exists? (Grep to confirm.)
- [ ] Did I add nesting past three levels?
- [ ] Did I add a boolean parameter that selects behavior?
- [ ] Did I introduce hidden global state, or an implicit "current period" or "current entity"?

### Tests
- [ ] The test would fail without this change.
- [ ] Tests assert behavior, not implementation.
- [ ] No new flakiness: no sleeps, no real clock, no network.

---

## Part 2 — Finance correctness

### Numbers
- [ ] `Decimal` throughout. No float touches money. No `Decimal(0.1)` from a literal.
- [ ] Rounding mode explicit; rounding happens once, at the obligation point.
- [ ] Minor units correct for the currency. Not hardcoded to 2.
- [ ] Allocation asserted exhaustive: parts sum to the whole.
- [ ] Currency never mixed without an explicit rate, rate type, and rate date.
- [ ] Rates stored at adequate scale, not rounded to 2 places.
- [ ] Sign convention stated and converted once at the boundary.

### Data integrity
- [ ] Row counts and control totals asserted across every join and filter.
- [ ] No inner join where a left join plus an assertion belongs.
- [ ] No `COALESCE(money, 0)` used to make a total tie.
- [ ] No `SELECT DISTINCT` masking a fan-out.
- [ ] Grain stated, and nothing summed across grains.
- [ ] Effective-dated lookups resolve by **service date**, not current date or `is_current`.
- [ ] Period boundaries from a period table, not date arithmetic.
- [ ] Correct date field used for the purpose (service / invoice / posting / due / payment).

### Ledger and controls (Tier 2)
- [ ] Debits equal credits, asserted before posting.
- [ ] Reversals modeled as rows. No `UPDATE` or `DELETE` of posted records.
- [ ] Idempotency enforced by a database constraint on anything money-moving.
- [ ] No database transaction held open across a bank or ERP call.
- [ ] Lineage present: source system, source ID, run ID, logic version.
- [ ] Segregation of duties enforced by identity, including for service accounts.
- [ ] Audit log entries append-only, with before and after values and a reason.

### Reconciliation
- [ ] Ties to an **independent** source, asserted in a test, not just recomputed internally.
- [ ] Reconciliation block produced as output, not only checked internally.
- [ ] Any delta explained line by line. No unexplained residual absorbed into "other."
- [ ] Every filter's exclusion reported in rows and dollars.

### Judgment
- [ ] No accounting treatment decided in code. Treatments carried as dated data attributes.
- [ ] Records missing a required treatment attribute are flagged, not defaulted.
- [ ] Materiality thresholds set by a human, not chosen by the code.
- [ ] Nothing plugged to hit a target number.

---

## Part 3 — Security

- [ ] Does this touch any trigger surface in SKILL.md §3? If yes, `security-review.md` was run.
- [ ] No secrets, keys, tokens, or credentials in the diff, including test fixtures.
- [ ] No string-concatenated query, shell command, or path join from user input.
- [ ] Nothing sensitive added to a log line: bank details, tax IDs, salary, SSNs, PII.
- [ ] User-supplied text in generated CSV or XLSX escaped against formula injection.
- [ ] Authorization checked server-side; entity scoping enforced in the query.

---

## Part 4 — The report

- [ ] I can name every command I ran and its result.
- [ ] I have listed what I could not verify or could not tie out, and why.
- [ ] I have not claimed anything is "secure," "correct," "production ready," or "ties" when what I mean is "the checks I ran passed."
- [ ] Tier stated. Period, basis, entity, and currency stated.
- [ ] Assumptions stated, including every accounting judgment.
- [ ] Problems found but not fixed are listed for the user to decide on.
- [ ] **If a number changed from what was previously reported, I said so explicitly.** Someone may have acted on the old one.
