# Billing and Revenue

Billing schedules, WIP and unbilled time, invoices, revenue recognition for services, cash application, and collections.

## Billing and revenue are two schedules

They line up only by accident. The gap between them is a balance sheet item, and a model that cannot produce it is incomplete.

| Situation | Balance | Plain meaning |
|---|---|---|
| Revenue earned, invoice not yet sent, and the right to bill is unconditional | Unbilled receivable | We did the work and can bill it; we just have not |
| Revenue earned, but billing depends on something else first (a milestone, acceptance) | Contract asset | We did the work but cannot bill yet |
| Invoice sent or cash received before the work is done | Contract liability (deferred revenue) | We were paid ahead |

The line between an unbilled receivable and a contract asset is an accounting judgment. Compute both inputs; let accounting classify.

```
billing_schedule(contract_id, obligation_id?, type, frequency, amount | formula,
                 start_date, end_date, next_bill_date, status, currency,
                 effective_from, effective_to)
```

Billing types to support: fixed recurring (retainer), milestone, time and materials, percent complete, pass-through cost plus markup, and caps on any of these.

## Most revenue leakage is a billing setup problem

The invoice that never went out is invisible.

- **Missed billing cycle check.** Any active schedule whose `next_bill_date` has passed with no invoice is an exception. Run it daily. This one check catches most leakage.
- **Contract changes are dated events** on the schedule, never an overwrite.
- **Unbilled ages.** Report it by age. Old unbilled is either a billing failure or a revenue error, and both matter.

## WIP (work in progress)

In a services firm, WIP is time and expenses worked but not yet billed.

```
wip(entry_id, client_id, scope_id, person_id, role_id, service_date,
    hours, standard_rate, standard_value, status,      -- unbilled | billed | written_down | written_off
    billed_invoice_id?, written_down_value?, reason?, decided_by?, decided_at?)
```

- **Value WIP at the rate in effect on the service date.** Then separately estimate how much will actually be billed. The gap is a write-down risk, and its size is a judgment for accounting.
- **Write-downs and write-offs are decisions,** each with an owner, a reason, and a date. Never a silent adjustment.
- **Age WIP** from the service date. Old WIP rarely bills at full value.
- **State the time-entry cut-off.** WIP changes every time someone enters late time.
- WIP ties to the unbilled line on the balance sheet, or it does not tie. Reconcile it each period.

## Time-based billing

- **Time entry is the revenue driver, and it is late, incomplete, and revised.** State the cut-off on every calculation. Late entries restate an earlier view; they never silently change a published number.
- **Billable, non-billable, and written off are three states,** not two.
- **Rate lookup by service date.** See `pricing-and-margin.md`.
- **Caps and not-to-exceed amounts** are checked before the invoice, not discovered by the client.
- Hours that cross a period boundary belong to the period of the service date, not the entry date.

## Invoices

- **Safe to rerun.** A rerun must never create a second invoice. Use a unique constraint on (schedule, period, version).
- **Invoice numbers come from a controlled sequence,** gapless where the jurisdiction requires it. Never from a row count. Never reused or renumbered.
- **Issued invoices are never edited.** Corrections are a credit memo plus a new invoice. This is a legal and audit requirement in most places.
- **Sales tax and VAT** come from the correct rules for the service date and place. Use a tax engine or the accounting system's tax setup; never hand-roll rates.
- **Backup attached** where the contract requires it (timesheets, third-party invoices). An invoice without backup gets disputed and ages.
- **PO number on the invoice** when the client requires one. A missing PO is a guaranteed delay.
- Creating invoices is Tier 2. Show what will be created and get a yes before creating anything.

## Revenue recognition for services

This is how the concepts show up in code. The decisions belong to accounting. See `accounting-rules.md` for more.

- **Model at performance-obligation grain,** not just contract grain. One contract often has several obligations (strategy, production, ongoing retainer).
- **Over time or at a point in time** is set per obligation by accounting and stored as data.
- **Measure of progress** for over-time work (hours incurred, cost incurred, milestones) is also set by accounting and stored.
- **Variable fees** (bonuses, success fees, volume rebates) are constrained. Never book the optimistic case.
- **Allocate the contract price across obligations** by relative standalone selling price. Use exhaustive allocation (`allocate()` in `scripts/money.py`) so the parts add back.
- **Contract modifications are dated events.** Never silently restate prior recognition.
- **Pass-through costs raise the gross-versus-net question.** Never infer it from the data. See `accounting-rules.md`.

## Cash application

- **Match on remittance advice first,** then amount plus customer, then fuzzy matching. Never auto-apply on amount alone; two invoices for the same amount are common.
- **Partial, short, and over-payments are normal.** Track applied-to-date per invoice, never a paid yes/no flag.
- **Short payment reasons matter:** dispute, deduction, early payment discount taken, or error. Each routes differently. An unclassified short payment becomes a stale receivable.
- **Unapplied cash is a liability,** not revenue, and it ages.
- **Never auto-write-off a small balance** without a threshold a human set and an audit record for each one.

## Collections and aging

- Buckets: current, 1 to 30, 31 to 60, 61 to 90, over 90 days. **Age from the due date,** not the invoice date.
- **DSO = (AR / revenue) x days in period.** State whether revenue is gross or net; the two are not comparable. For lumpy revenue, the countback method is more accurate.
- **Disputed invoices** leave the collections queue and are tracked separately with the reason.
- **Allowance for doubtful accounts** is an estimate. Compute the inputs (aging, history); escalate the conclusion.
- **Credit holds** apply when a scope is accepted, not at invoicing, when the exposure already exists.

## Tie-outs

- AR aging ties to the AR control account every period. Common breaks: cash posted straight to the control account, manual journals, unposted invoices, currency revaluation, and credit memos posted to a different account.
- WIP ties to unbilled on the balance sheet.
- Revenue ties to invoices plus the change in unbilled, contract assets, and deferred revenue.

## Tiers

- Ad hoc aging, WIP, or DSO question: Tier 0
- Recurring AR pack, WIP report, fee burn dashboard: Tier 1
- Anything that creates an invoice, applies cash, writes off, or posts to AR: Tier 2

## Common defects

- Billing and revenue schedules treated as one, so unbilled and deferred cannot be produced
- No missed-billing-cycle report
- WIP valued at today's rates instead of service-date rates
- Write-downs made without an owner or reason
- Invoice numbers from a row count
- Invoices edited in place instead of credit memo plus reissue
- Aging from the invoice date
- Cash auto-applied on amount alone
- Paid tracked as a yes/no flag
- Unapplied cash counted as revenue
- DSO reported without saying gross or net
- No time-entry cut-off stated
