---
paths:
  - "**/finance/**"
  - "**/accounting/**"
  - "**/billing/**"
  - "**/invoic*/**"
  - "**/payment*/**"
  - "**/payroll/**"
  - "**/ledger/**"
  - "**/gl/**"
  - "**/revenue/**"
  - "**/pricing/**"
  - "**/forecast*/**"
  - "**/budget*/**"
  - "**/close/**"
  - "**/treasury/**"
  - "**/models/fin*/**"
  - "**/*rate_card*"
  - "**/*reconcil*"
---

# Finance code

Apply the `clean-finance-code` skill. Non-negotiables for any file on this path:

**Numbers**

- `Decimal` in Python, `DECIMAL`/`NUMERIC` in SQL. Never `float`, `FLOAT`, `REAL`, or `DOUBLE`.
- Build Decimals from strings or ints. `Decimal("0.1")`, never `Decimal(0.1)`.
- Rounding mode stated explicitly. Round once, at the point the number becomes an obligation.
- Currency travels with every amount. Never sum across currencies without an explicit rate, rate type (spot/average/closing), and rate date.
- Do not hardcode 2 decimal places. JPY has 0, KWD has 3.
- Allocations are exhaustive: parts sum to the whole, asserted.

**Stated defaults**

- Annual billable hours per FTE defaults to **1,800**, never 2,080. 2,080 is total paid hours with nothing removed for PTO, holidays, training, or business development.
- Put it in the assumptions block as one named input, never inside a formula.
- State it in the output and invite a correction: "Using 1,800 billable hours per FTE per year. Tell me your firm's figure if it differs."
- Prefer actuals over the default, and say which you used. Model per role where the data allows.

**Data integrity**

- No silent row loss. Prefer left joins with an assertion on unmatched over inner joins.
- `COALESCE(amount, 0)` is a decision requiring justification, not a default.
- Check row counts before and after every join. A join that changes fact-table row count is a bug until proven otherwise.
- Effective-dated lookups resolve by **service date**, never current date or `is_current`.
- Period boundaries come from a period table, never date arithmetic.

**Ledger**

- Debits equal credits, asserted before posting, per entry and per batch.
- Posted entries are immutable. Corrections are reversing entries. No `UPDATE`, no `DELETE`.
- Idempotency on anything money-moving, enforced by a database unique constraint.
- Never write directly to ERP GL tables.

**Output**

- Produce a reconciliation block: source, rows in/out/excluded, control totals, delta, tie-out target. An unexplained delta stops the work.
- State period, basis (accrual/cash), entity, and currency on every output.

**Judgment**

- Never decide an accounting treatment in code. Revenue presentation (gross/net), capitalization, recognition timing, and reserve adequacy are controller and auditor decisions. Carry them as data attributes; flag records missing one rather than defaulting.
- Never plug to a target number. State the derived figure and what assumption would have to change.

**Sensitive data**

- Bank details, tax IDs, salary, SSNs, and cardholder data never appear in logs, error messages, notebook output, or unmasked development environments.
