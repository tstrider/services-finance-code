# Finance Tools (Tier 3)

In-house pricing calculators, margin dashboards with inputs, allocation engines, commission calculators, forecasting apps, close trackers. Anything other people use to do finance work.

**The key fact:** your calculation becomes someone's decision, and eventually someone's reported number. The bar is a product bar, not a script bar.

## Before you build

Answer honestly, and share the answers with the user:

1. **Does something the firm already pays for do this?** Many in-house tools rebuild a module of the accounting system or PSA, badly. Check first.
2. **Is it a tool or a report?** If nobody enters anything, it is a report. Build it in the spreadsheet or BI layer and stop.
3. **Who owns it after you?** An unowned tool finance depends on is a liability waiting to fail. Name the owner.
4. **What happens when it is wrong?** If the answer involves a client credit, a payroll error, or a restatement, it needs the full treatment below.
5. **Does it touch audited numbers?** If so, design for audit from the start. Adding an audit trail later costs far more.

Building nothing is often the right answer. Say so when it is.

## Version the calculation logic

The defining requirement of a finance tool, and the one most often missed.

```
calculation_version(id, name, effective_from, effective_to,
                    logic_ref,             -- commit hash or release number
                    approved_by, approved_at, change_reason)

calculation_result(id, version_id, run_id, inputs_hash, computed_at,
                   <dimensions>, amount, currency)
```

- **Every stored result records the logic version that produced it.** "Why did this number change?" will be asked.
- **Changing the logic never rewrites history.** Old results stand. A restatement is an explicit, approved, labeled event.
- **Store the inputs, or a hash of them,** with the result. Rerunning version 7 on March's inputs must give March's answer.
- **Logic changes are approved** before they take effect, by someone other than the author where possible.

## Who can see and change what

```
app_user(id, email, status, created_at, deactivated_at)
role(id, name)
user_role(user_id, role_id, granted_by, granted_at, expires_at)
data_scope(role_id, dimension, allowed_values)       -- entity, department, client
audit_log(...)                                       -- see reconciliation-and-controls.md
approval(entity_type, entity_id, version, approver_id, approved_at, decision, comment)
input_submission(id, period_id, submitter_id, submitted_at, status, version)
input_value(submission_id, <dims>, value, currency, note)
```

- **Data scoping is enforced on the server,** on every query. A department head sees their department. Pay-derived cost is visible to a small group. Filtering in the interface is not security.
- **User inputs are versioned submissions,** not editable cells. "The number changed and nobody knows who changed it" destroys trust in a tool for good.
- **Soft delete only.** Nothing is hard-deleted.
- Use the firm's existing sign-in (Google or Microsoft accounts) rather than building logins.

## Concurrency

Finance tools get used hardest exactly when concurrency breaks them: close week, budget deadlines, quarter-end.

- **Optimistic locking** on every editable record: a version number checked on save, with the conflict shown to the user. Last-write-wins silently destroys someone's work.
- **Period locks:** once a period or submission window closes, writes are refused with a clear message.
- **Long calculations run as background jobs,** safe to rerun and resumable, with visible status.
- **Recalculation is all-or-nothing per scope.** A half-finished allocation does not add back to the pool and will be found at the worst time.

## Interfaces

- **Excel export is a requirement.** Finance will export. Make it labeled and self-describing, with assumptions and run details on their own tab, and formulas kept where the reader needs to audit the math.
- **Excel import is validated at the edge:** schema, types, totals, and a preview of what will change before anything is saved.
- **Show the derivation.** Every displayed number should trace back to its inputs in one click. A tool without drill-down will not be trusted, rightly.
- Escape exported text against formula injection.

## Testing

See `testing.md`, plus:

- **Golden scenarios** agreed with the finance owner. These are the acceptance criteria.
- **Parallel run** alongside the current process for at least one full cycle, with every difference explained.
- **Permission tests** that call the server directly: a user scoped to client A cannot read client B.
- **Concurrency tests:** two simultaneous edits, a write to a locked period, a job stopped halfway.

## Running it

- **Tie-outs run on a schedule** and alert when they break.
- **Alert on control-total movement,** not only on errors.
- **A runbook names a person:** what to do when the accounting-system sync fails during close, and how to reprocess.
- **Backups with a tested restore.** An untested restore is not a backup.
- Keep data as long as audit and legal rules require, which is usually longer than a database's default.

## Documentation people actually use

- **A calculation spec in plain language** that a controller can review and sign. Not code comments.
- A data dictionary: every field, its grain, its source, its units.
- An assumptions register: every judgment in the logic, with its owner.
- A change log tied to calculation versions.

## Accounting for the tool itself

Staff time spent building internal software may need to be capitalized rather than expensed. See the ASC 350-40 section in `accounting-rules.md` and flag it to accounting.

## Common defects

- Calculation logic not versioned
- Results stored without inputs or version
- A logic change that silently rewrites past periods
- Data scoping only in the interface
- User inputs as editable cells
- Last-write-wins
- Long calculations inside a web request
- No parallel run before go-live
- No drill-down from a number to its inputs
- No named owner
