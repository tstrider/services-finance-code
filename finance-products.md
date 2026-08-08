# Building Proprietary Finance Tools (Tier 2P)

In-house pricing calculators, allocation engines, close managers, forecasting apps, commission systems, margin dashboards. Anything other people use to do finance work.

**The distinguishing fact**: your calculation becomes someone's decision, and eventually someone's filed number. The bar is a product bar, not a script bar.

## Before you build

Answer honestly:

1. **Does a system we already own do this?** Most in-house finance tools reimplement an ERP or EPM module badly. Check first.
2. **Is this a tool or a report?** If nobody inputs anything, it is a report. Build it in the BI layer and stop.
3. **Who owns it when you leave?** An unowned internal tool that finance depends on is a liability with a fuse on it.
4. **What happens when it is wrong?** If the answer involves a restatement, a client credit, or a payroll error, this is Tier 2P and needs the full treatment.
5. **Is it going into scope for SOX?** If it produces or supports a financially significant number, assume yes and design for auditability from the start. Retrofitting audit trails is far more expensive than building them.

Building nothing is frequently the right answer. Say so when it is.

## Calculation logic must be versioned

The defining requirement of a finance tool, and the one most often missed.

```
calculation_version(id, name, effective_from, effective_to,
                    logic_ref,          -- commit SHA or module version
                    approved_by, approved_at, change_reason)

calculation_result(id, version_id, run_id, inputs_hash, computed_at,
                   <dimensions>, amount, currency)
```

- **Every stored result records the logic version that produced it.** Without this, "why did this number change" is unanswerable, and it will be asked.
- **Changing the logic does not retroactively change history.** Prior results stand as computed. If a restatement is genuinely required, it is an explicit, approved, labeled event.
- **Store the inputs, or a hash of them, with the result.** Reproducibility means rerunning version 7 with the March inputs and getting the March answer.
- Logic changes are approved before they take effect. In SOX scope, this is a program change with a named reviewer separate from whoever wrote it.

## Data model

Start from `data-modeling.md`. Additions specific to a product:

```
-- who can see what
user(id, email, status, created_at, deactivated_at)
role(id, name)
user_role(user_id, role_id, granted_by, granted_at, expires_at)
data_scope(role_id, dimension, allowed_values)   -- entity, department, client

-- what happened
audit_log(...)              -- append-only, per reconciliation-and-controls.md
approval(entity_type, entity_id, version, approver_id, approved_at, decision, comment)

-- inputs people supply
input_submission(id, period_id, submitter_id, submitted_at, status, version)
input_value(submission_id, dimension..., value, currency, note)
```

- **Data scoping is not optional.** A department head sees their department. A client lead sees their clients. Payroll-derived cost is visible to a narrow group. Enforce server-side, on every query, not in the UI.
- **User inputs are versioned submissions**, not mutable cells. "The number changed and nobody knows who changed it" is the failure mode that destroys trust in an internal tool permanently.
- Soft delete only. Nothing in a finance tool is hard-deleted.

## Concurrency

Finance tools are used hardest at exactly the moment concurrency breaks them: close week, budget submission deadline, quarter end.

- **Optimistic locking on every editable record.** Version column, checked on write, conflict surfaced to the user. Last-write-wins silently destroys someone's work.
- **Period-level locking**: when a period closes or a submission window shuts, writes are rejected with a clear message, not a stack trace.
- **Long-running calculations run as jobs**, not in a request. Idempotent, resumable, with visible status. A recalculation that times out mid-allocation and leaves partial results is a data corruption event.
- **Recalculation is atomic per scope.** Either the whole allocation run commits or none of it does. Partial allocation results do not sum to the pool and will be discovered at the worst time.

## Interfaces

- **Excel export is a requirement, not a nice-to-have.** Finance will export. Make it clean, labeled, with the assumptions and the run metadata included, so the exported file is self-describing.
- **Excel import needs validation at the boundary**: schema, types, totals, and a preview of what will change before it commits. Never trust an uploaded file.
- Where the recipient must audit the math, **preserve formulas in generated workbooks** rather than pasting values. A workbook of hardcoded values cannot be audited.
- **Show the derivation.** Any displayed number should be traceable to its inputs in one click. A finance tool that shows a number without a drill-down will not be trusted, and correctly so.
- Do not force finance out of Excel for work Excel does well. Build the data layer properly and expose it cleanly.

## Testing

See `testing-finance-code.md`. Product-specific additions:

- **Golden scenario suite**: a set of complete worked examples with expected outputs, agreed with the finance owner. These are the regression tests that matter and they are the acceptance criteria.
- **Parallel run before cutover.** Run the new tool alongside the existing process for at least one full cycle and reconcile every difference to zero, or explain each one. Never cut over on a passing test suite alone.
- **Permission tests**: assert that a user in scope A cannot retrieve scope B data, by direct API call, not just through the UI.
- **Concurrency tests**: two simultaneous edits, a write against a locked period, a job interrupted mid-run.

## Operations

- **Reconciliation runs automatically**, not on demand. Tie to the source system on a schedule and alert on break.
- **Alert on control totals, not just on errors.** A job that completes successfully with a total that moved 15% is the dangerous case, not the one that crashes.
- **Runbook exists** and names a human. What to do when the ERP sync fails during close, who to call, how to reprocess.
- **Backups and a tested restore.** Untested restore is not backup. Test it before you need it.
- Retention aligned to audit and statutory requirements, which are usually longer than your default database retention.

## Documentation that actually gets used

- **A calculation specification** in plain language that a controller can review and sign off. Not code comments. This is what makes the tool auditable and it is what an auditor will ask for.
- Data dictionary: every field, its grain, its source, its units.
- Assumptions register: every judgment embedded in the logic, with its owner.
- Change log tied to calculation versions.

## Common defects to check for

- Calculation logic not versioned, so history cannot be explained
- Results stored without the inputs or the version that produced them
- Logic change silently restating prior periods
- Data scoping enforced in the UI only
- User inputs as mutable cells rather than versioned submissions
- Last-write-wins on concurrent edits
- Long calculations in a request path, leaving partial results on timeout
- No parallel run before cutover
- Alerting on errors but not on control-total movement
- No drill-down from a displayed number to its inputs
- Generated workbooks with hardcoded values where formulas belong
- No named owner
