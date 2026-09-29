# Self-Review

Run before reporting. Read your own work as if someone else wrote it and you do not trust them. The code has to be clean and the number has to be right. Neither replaces the other.

## 1. The number

- [ ] Tier stated. Period, basis, entities, currency, and time-entry cut-off stated.
- [ ] Ties to an **independent** source, with the result shown. Not just recomputed.
- [ ] Any difference explained line by line. Nothing hidden in "other".
- [ ] Every filter's exclusions reported in rows and dollars.
- [ ] Row counts checked across every join. No inner join where rows could vanish. No fan-out. No `DISTINCT` hiding duplicates.
- [ ] Grain stated before summing.
- [ ] Decimal throughout. No float touched money, including CSV, Excel, and JSON input.
- [ ] Rounding mode explicit, rounding done once.
- [ ] Currency never mixed without a rate, rate type, and rate date.
- [ ] Allocations add back exactly.
- [ ] Rates looked up by service date.
- [ ] No 2,080 in a cost-per-hour calculation. The billable-hours figure is a named, stated assumption.
- [ ] Utilization definition and denominator stated.
- [ ] Fee burn compares like with like (value at price against fee).
- [ ] Right date field for each purpose.

## 2. Judgment

- [ ] No accounting treatment decided in code. Missing treatments flagged.
- [ ] Materiality and tolerances set by a person, not by the code.
- [ ] Nothing plugged to hit a target.
- [ ] Every default used is listed under "Assumed", with how to change it.
- [ ] At Tier 2 and 3, nothing was assumed that changes a number, posting, bill, or payment without asking.

## 3. Ledger and controls (Tier 2 and 3)

- [ ] Debits equal credits, checked before posting.
- [ ] No edits or deletes of posted records; corrections are reversals.
- [ ] Retries cannot duplicate (unique constraint).
- [ ] No transaction held open across a bank or accounting-system call.
- [ ] Lineage on every record: source, source ID, run ID, logic version.
- [ ] Segregation of duties enforced, or the overlap and its compensating review stated.
- [ ] Audit trail append-only, with before and after values (masked) and a reason.
- [ ] The user saw exactly what would be written and said yes.

## 4. The code

- [ ] Every changed line serves the task. No drive-by changes.
- [ ] No debug prints, commented-out code, or leftover scaffolding.
- [ ] No duplicated business logic (searched to confirm).
- [ ] No magic numbers; no hidden global state.
- [ ] No swallowed exceptions; nothing fails open.
- [ ] Names carry units and basis.
- [ ] Every API call and every number you typed was checked against a source.
- [ ] No new package without the dependency check.
- [ ] Tests would fail without the change, test behavior, and have no sleeps, real clocks, or network calls.

## 5. Security

- [ ] Security checklist run. Each section applied or marked n/a with a reason.
- [ ] No secrets anywhere in the change, including fixtures and notebooks.
- [ ] Sensitive data masked in every output, log, and fixture; nothing sent outside the user's setup.
- [ ] Data extracts not committed.
- [ ] Parameterized queries; no pasted-together SQL, shell, or paths.
- [ ] Exports escaped against formula injection.

## 6. The report

- [ ] Plain summary first: bottom line, what it ties to, what was assumed, what needs the user, what was not checked.
- [ ] Written for a finance pro who does not code. Technical terms explained in a few words.
- [ ] Every gate listed with the exact command and result. Skipped gates listed with the reason.
- [ ] No claim of "correct", "secure", or "ties" beyond what the checks showed.
- [ ] **Any number that differs from one reported before is called out first.**
- [ ] Problems noticed but not fixed are listed for the user to decide.
