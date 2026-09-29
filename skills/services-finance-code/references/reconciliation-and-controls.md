# Reconciliation and Controls

## The tie-out is part of the answer

Any pipeline, model, or query touching money produces a tie-out block as output. Not as a private check.

```
Source:     Accounting system export, general ledger detail, pulled 2026-08-08 06:12 UTC
Filter:     posting period 2026-07, entities 1 and 2, posted only
Rows in:        48,213    Total in:   12,847,332.14 USD
Excluded:          412    Excluded:      (94,220.00) USD  [intercompany, per policy]
Rows out:       47,801    Total out:  12,753,112.14 USD
Delta:      ties exactly
Ties to:    Trial balance report for 2026-07 from the same system (12,753,112.14)
Unmatched:  0
```

`Reconciliation` in `scripts/money.py` checks and prints this block.

**An unexplained difference stops the work.** Do not round it away. Do not call it immaterial unless a human set the threshold. Do not build analysis on top of a broken tie.

## Tie-out strength, best first

1. **The source system's own report** (trial balance, AR aging, bank statement). Independent of your logic.
2. **A different extraction path** to the same data (a saved report versus an API query).
3. **A control account** in the ledger (AR aging to the AR control account).
4. **Roll-forward:** opening balance plus activity equals closing balance.
5. **Your own recalculation.** Weakest. It proves arithmetic, not correctness.

A pipeline that only ties to itself proves nothing.

## Standard reconciliations

| Reconciliation | Ties | Catches |
|---|---|---|
| Bank to ledger | Bank statement to cash account | Unrecorded items, timing, fraud |
| AR to ledger | AR aging to AR control account | Misapplied cash, unposted invoices |
| AP to ledger | AP aging to AP control account | Posting errors, unposted bills |
| WIP to ledger | WIP report to unbilled balance | Missing time, unrecorded write-downs |
| Revenue to billing | Revenue to invoices plus change in unbilled and deferred | Recognition errors, missing contracts |
| Payroll to ledger | Payroll register to salary, tax, and benefit accounts | Accrual and mapping errors |
| Time to payroll | Hours in the time system to paid hours | Missing or duplicate time |
| Intercompany | Due-to against due-from by entity and currency | Elimination failures |
| Headcount | Plan headcount to HR system actual | Phantom heads, unmodeled hires |

## What breaks reconciliations

**Inner joins.** The most common cause of silent loss.

```sql
-- WRONG: invoices with no matching client vanish from the total
SELECT i.*, c.client_name
FROM invoices i
JOIN clients c ON i.client_id = c.id;

-- RIGHT: the loss is visible and countable
SELECT i.*, c.client_name
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id;
-- then: count rows where c.id IS NULL, and either assert zero or explain each one
```

Keep unmatched rows as "Unassigned" rather than dropping them, and report them.

- **`COALESCE(x, 0)` to make a total tie** turns a data problem into a wrong number. Find the missing record.
- **Fan-out joins** multiply amounts. Count rows before and after every join. More rows on a fact table is a bug until proven otherwise.
- **`SELECT DISTINCT` to fix duplicates** hides the cause and will eventually merge two real, identical transactions.
- **Filtering before understanding.** Every `WHERE` clause excludes money. Report what it excluded, in rows and dollars.
- **Summing across grain.** Summing a header amount after joining to lines, or summing an already-allocated column.

## Assertions worth building

```python
recon.check()                                            # rows and totals reconcile
assert_balanced(debits, credits)                         # per entry and per batch
assert_no_duplicate_keys(rows, key=("vendor_id", "invoice_no_normalized", "invoice_date"))
assert_single_currency(currencies)                       # or conversion applied explicitly
assert_period_bounds(rows, start, end)                   # nothing outside the stated period
assert_no_future_postings(rows, as_of)
```

The last four are patterns to write for the project; `recon.check()`, `assert_balanced`, and `assert_single_currency` are in `scripts/money.py`.

The default tolerance is zero. A non-zero tolerance is a decision a person made, recorded with a reason.

## Segregation of duties

Build it into the code, do not trust habit.

| Function | Must not also | Why |
|---|---|---|
| Create or edit a vendor | Approve payment | Fake vendor fraud |
| Enter an invoice or bill | Approve it | Unauthorized spend |
| Approve a payment | Release it | Payment diversion |
| Post a journal entry | Approve it | Concealment |
| Reconcile an account | Post to it | Checking your own work |
| Manage system access | Enter transactions | Unchecked privilege |

In code: record the acting user on each step, and reject a second step by the same person. Attribute automated actions to the human who started the run; "the integration did it" erases accountability.

**Small teams.** In a firm with a two-person finance team, full separation is often impossible. That is normal. The fix is a compensating control: an independent review after the fact (for example, the owner reviews every payment over a threshold and every vendor bank change each week), with the review recorded. Build the review report and the sign-off record. Say plainly which duties overlap and what compensates.

## Audit trail

Separate from application logs, append-only, kept as long as policy requires.

```
audit_log(
  id, occurred_at, actor_id, actor_type,     -- person | service, and on whose authority
  entity_type, entity_id, action,            -- create | update | approve | post | reverse | void
  before_value, after_value,                 -- the fields that changed
  reason, source_system, run_id
)
```

- **Append-only.** No updates, no deletes. Enforce with database permissions where possible, not just in code.
- **Before and after values,** not just "record changed".
- **Reason captured** for approvals, overrides, and manual adjustments. It is the field auditors ask for and the one nobody stores.
- **Run ID and logic version,** so any number traces back to the exact code that produced it.
- Mask sensitive fields in `before_value` and `after_value` (for example bank numbers show the last 4 only).

## Approvals

- Thresholds are enforced on the server or in the database. A limit in the user interface is decoration.
- An approval is a record: who, when, and which version. Approving version 3 does not approve version 4.
- Any change after approval voids the approval.
- Delegation and out-of-office cover are where controls quietly break. Model them with an expiry date.

## AI-written changes to financial systems

Code written with Claude that touches a system the financial statements rely on is a program change like any other.

- A named person reviews and approves it, and the approval is recorded (for example in the pull request).
- Where possible, the person who asked Claude for the change is not the only approver.
- Keep the evidence: what changed, what tests and tie-outs ran, who approved.
- Auditor expectations for AI-assisted changes are still evolving. Confirm current requirements with your auditor rather than relying on this file.

## Never claim controls work

Reconciling and passing checks is evidence, not assurance. Say what you tied out, to what, and what remains unchecked. Whether a control is effective is for management, internal audit, and the external auditor to conclude.
