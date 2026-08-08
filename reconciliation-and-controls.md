# Reconciliation and Controls

## Reconciliation is the deliverable

Any pipeline, model, or query touching money produces a reconciliation block. Not as documentation, as output.

```
Source:        NetSuite SuiteQL, extracted 2026-08-08 06:12 UTC
Filter:        posting_period in (2026-07), subsidiary in (1,2), posted=true
Rows in:       48,213     Control total in:  12,847,332.14 USD
Excluded:         412     Excluded total:       (94,220.00) USD  [intercompany, per policy]
Rows out:      47,801     Control total out: 12,753,112.14 USD
Delta:              0.00  ties exactly
Tie-out:       Agrees to NS Trial Balance report for 2026-07 (12,753,112.14)
Unmatched:          0
```

**An unexplained delta stops the work.** Do not round it away, do not call it immaterial unless a human set the threshold, do not proceed to analysis on top of a broken tie.

## Tie-out hierarchy

Reconcile to something independent. Strength, best first:

1. **The source system's own report** (ERP trial balance, AR aging, bank statement). Independent of your logic.
2. **A different extraction path** to the same data (saved search versus SuiteQL).
3. **A control account** in the GL (AP sub-ledger to AP control account).
4. **Prior period plus movement.** Opening balance, plus activity, equals closing balance.
5. **Your own recomputation.** Weakest. Proves arithmetic, not correctness.

A pipeline that reconciles only to itself proves nothing.

## Standard reconciliations

| Reconciliation | Ties | Catches |
|---|---|---|
| Bank to GL | Bank statement to cash account | Unrecorded transactions, timing, fraud |
| AP sub-ledger to GL | AP aging to AP control account | Posting errors, unposted invoices |
| AR sub-ledger to GL | AR aging to AR control account | Misapplied cash, unbilled |
| Revenue to billing | Recognized revenue to invoices plus deferrals | Recognition errors, missing contracts |
| Payroll to GL | Payroll register to salary and tax accounts | Accrual errors, misclassification |
| Intercompany | Due-to to due-from across entities | Elimination failures |
| Roll-forward | Opening + additions - disposals = closing | Missing activity, unauthorized changes |
| Headcount | Plan headcount to HCM actual | Phantom heads, unmodeled hires |

## Anti-patterns that destroy reconciliation

**Inner join.** The most common cause of silent loss in finance pipelines. An inner join that drops 300 unmatched invoices produces a total that looks fine and is wrong.

```sql
-- WRONG: silent loss
SELECT i.*, v.name
FROM invoices i
JOIN vendors v ON i.vendor_id = v.id;

-- RIGHT: loss is visible and assertable
SELECT i.*, v.name
FROM invoices i
LEFT JOIN vendors v ON i.vendor_id = v.id;
-- then: assert count(*) where v.id is null == 0, or explain each one
```

**`COALESCE(x, 0)` to make a total tie.** This converts a data problem into a wrong number. Find the missing record.

**Fan-out joins.** Joining to a table with multiple matching rows multiplies amounts. Always check row count before and after every join. A join that increases row count on a fact table is a bug until proven otherwise.

**`SELECT DISTINCT` to fix duplicates.** It hides the cause and will eventually deduplicate two legitimately identical transactions.

**Filtering before understanding.** Every `WHERE` clause excludes money. Report what it excluded, in rows and dollars.

**Aggregating across grain.** Summing a column that has already been allocated, or joining a header table to a line table then summing the header amount. Know your grain before you sum.

## Assertions to build in

```python
def assert_reconciles(rows_in, rows_out, excluded, total_in, total_out, excluded_total, tolerance=Decimal("0")):
    assert rows_out == rows_in - excluded, (
        f"row count broken: {rows_in} in, {excluded} excluded, {rows_out} out"
    )
    delta = total_in - excluded_total - total_out
    assert abs(delta) <= tolerance, f"control total delta {delta} exceeds tolerance {tolerance}"
```

Default tolerance is zero. A non-zero tolerance is a decision someone made, recorded with a reason.

Others worth standing up:

```python
assert_balanced(entries)                          # debits == credits, per entry and per batch
assert_no_duplicate_keys(rows, key=("vendor","invoice_no","invoice_date"))
assert_single_currency(rows)                      # or explicit conversion applied
assert_period_bounds(rows, start, end)            # nothing outside the stated period
assert_no_future_postings(rows, as_of)
assert_signs(rows, account_class)                 # contra accounts handled
```

## Segregation of duties

Encode it, do not trust convention.

| Function | Must not also | Why |
|---|---|---|
| Create or edit vendor | Approve payment | Fictitious vendor fraud |
| Enter invoice | Approve invoice | Unauthorized spend |
| Approve payment | Execute payment release | Payment diversion |
| Post journal entry | Approve journal entry | Concealment |
| Reconcile an account | Post to that account | Self-review |
| Administer system access | Perform transactions | Unchecked privilege |

In code: the acting user ID on each step is recorded, and the system rejects a second step by the same identity. Service accounts need particular care, because "the integration did it" collapses accountability. Attribute automated actions to the human who authorized the run.

## Audit trail

Separate from application logs, append-only, retained per policy.

```
audit_log(
  id, occurred_at, actor_id, actor_type,      -- human | service, and on whose authority
  entity_type, entity_id, action,             -- create | update | delete | approve | post | reverse
  before_value, after_value,                  -- the actual changed fields
  reason, source_system, run_id, request_id
)
```

- **Append-only.** No updates, no deletes. Enforce at the database with permissions, not just in application code.
- **Before and after values**, not just "record changed."
- **Reason captured** for approvals, overrides, and manual adjustments. "Why" is the field auditors ask for and the field nobody stores.
- **Run ID and logic version** so a number can be traced to the exact code that produced it.
- Retention aligned to your audit and statutory requirements.

## Approvals

- Thresholds enforced **server-side**. A UI limit is decoration.
- Approval state is a record, not a flag: who, when, what version of the thing they approved. Approving version 3 does not approve version 4.
- Any change after approval invalidates the approval. Enforce it.
- Delegation and out-of-office chains are where controls quietly break. Model them explicitly with an expiry.

## Sensitive data

Financial systems concentrate regulated data. Treat all of the following as sensitive by default:

- Bank account and routing numbers, IBANs
- Vendor tax IDs, W-9 and W-8 content
- Payroll: salary, SSN, garnishments, benefit elections
- Cardholder data (PCI DSS scope; avoid touching it at all where possible)
- Customer PII on invoices
- Pre-release financial results (material non-public information, with insider-trading implications)

Rules:

- Encrypted at rest and in transit.
- **Never in a log line, an error message, a notebook output, or a screenshot.** Mask at the source.
- Access on a need-to-know basis with periodic review. Analysis notebooks are not exempt.
- Bank detail changes are a fraud target. Change of remit-to requires out-of-band verification, and the code path should force it.
- Do not copy production financial data into a development environment without masking. This is a routine and serious lapse.

## ITGC and AI-generated changes

For systems in scope for financial reporting:

- **Change management**: request, review, approve, test, deploy, with evidence retained. AI-generated changes are program changes and get the same treatment.
- **Named human reviewer**, evidenced in the PR or commit record, with segregation between whoever prompted the change and whoever approved it. Do not let agent output reach a SOX-relevant system without that trail.
- **Access review**: periodic, documented, with prompt deprovisioning.
- **Report completeness and accuracy**: any report relied on by a control needs evidenced logic. An ad hoc query is not evidence.
- The regulatory picture here is moving; PCAOB AS 2201/2101 amendments take effect for periods beginning after December 15, 2026 and COSO issued GenAI guidance in February 2026. **Confirm current requirements with your audit team.** Do not treat this file as authoritative on scope.

## Never claim controls are effective

The same rule as security in the base skill. Reconciling and passing assertions is evidence, not assurance. Say what you tied out, to what, and what remains unverified. Control effectiveness is a conclusion internal audit and your external auditor own.
