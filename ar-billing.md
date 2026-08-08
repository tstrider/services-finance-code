# Accounts Receivable and Billing

Billing setups, invoicing, fee burn, cash application, collections.

## Billing setup is where revenue leaks

Most revenue leakage is a billing configuration problem, not a collection problem. The invoice that was never raised is invisible.

```
billing_schedule(contract_id, pob_id?, type, frequency, amount | formula,
                 start, end, next_bill_date, status, currency,
                 effective_from, effective_to)
```

Types to support: fixed recurring (retainer), milestone, time and materials, usage or volume, percent complete, pass-through cost plus markup.

Rules:

- **Billing and revenue recognition are separate schedules.** They coincide only by accident. The difference is contract asset (unbilled) or contract liability (deferred). If your model cannot produce both, it is incomplete.
- **Unbilled is an asset that ages.** Track it. Old unbilled is either a billing failure or a revenue recognition error, and both matter.
- **Missed billing cycle detection** is a required control: any active schedule whose `next_bill_date` has passed without an invoice is an exception. Run it daily. This single check catches most revenue leakage.
- Contract changes propagate to the billing schedule as a dated event, never as an overwrite.

## Invoice generation

- **Idempotent per period per schedule.** A rerun must not produce a second invoice. Unique constraint on (schedule, period, version).
- **Invoice numbers are gapless and sequential** where jurisdiction requires it. Never reuse, never renumber. Allocate from a controlled sequence, not from a row count.
- **Immutable once issued.** Corrections are credit memos plus a reissue, never an edit. This is a legal and audit requirement in most jurisdictions.
- Tax calculated at the correct jurisdiction and rate for the service date, using a tax engine where complexity warrants. Do not hand-roll sales tax or VAT logic.
- Supporting detail attached where the contract requires it (timesheets, third-party invoices). A disputed invoice without backup ages.
- PO number on the invoice where the client requires it. A missing PO reference is a guaranteed payment delay and is trivially preventable.

## Time-based billing (agencies, law firms, consultancies, any people-based services firm)

- **Time entry is the revenue driver and it is late, incomplete, and revised.** State the cut-off for any calculation. Late entries restate a prior view; they must not silently change a published number.
- **Billable, non-billable, and write-off are three states**, not two. Write-off is a decision with an owner and a reason, and it must be captured, because aggregate write-off by client is a pricing signal.
- **Realization** = billed value / standard rate value of hours delivered. Trend it per client. A declining realization rate predicts a margin problem a quarter early.
- Rate lookup by **service date**, not current date. See `commercial-finance.md`.

**Fee burn** for fixed fee and retainer work:

```
Burn %        = hours delivered at cost / contracted fee
Elapsed %     = elapsed service days / total service days
Burn variance = Burn % - Elapsed %
```

Alert on positive variance continuously. By month-end close the quarter is already lost.

## Cash application

- **Match on remittance advice first**, then amount plus customer, then fuzzy. Never auto-apply on amount alone; two invoices for the same amount is common.
- **Partial payments, short payments, and overpayments** are all normal. Model applied-to-date per invoice, never a boolean paid flag.
- **Short payment reasons matter**: dispute, deduction, early payment discount taken, or error. Each routes differently. An unclassified short payment becomes a stale receivable.
- Unapplied cash is a liability, not revenue, and it ages. Report it.
- **Never auto-write-off a small residual** without a policy threshold set by a human and an audit record for each one.

## Collections and aging

- Standard buckets: current, 1-30, 31-60, 61-90, 90+. **Age from due date, not invoice date.** Aging from invoice date misstates severity on long-term contracts.
- **DSO** = (AR / revenue) x days in period. State whether it is on gross or net revenue; a firm reporting gross is not comparable to one reporting net. Countback DSO is more accurate for lumpy revenue.
- Disputed invoices are excluded from collections workflow and tracked separately, with the dispute reason. A disputed invoice in a dunning queue damages the client relationship.
- **Allowance for doubtful accounts** is an estimate (CECL for financial assets under ASC 326). The estimate is a judgment. Compute the inputs; escalate the adequacy conclusion.
- Credit limits and credit holds enforced server-side at order or scope acceptance, not at invoicing, when the exposure is already incurred.

## Sub-ledger to GL

Reconcile AR aging to the AR control account each period. Common breaks: cash applied directly to the control account, manual journals, unposted invoices, FX revaluation on foreign-currency receivables, and credit memos posted to a different account than the original invoice.

## Tier guidance

- Ad hoc aging analysis or DSO question: **Tier 0**
- Recurring AR pack, fee burn dashboard, unbilled reporting: **Tier 1**
- Anything generating an invoice, applying cash, or posting to AR: **Tier 2**

## Common defects to check for

- Billing schedule and revenue schedule conflated, so unbilled and deferred cannot be produced
- No missed-billing-cycle exception report
- Invoice numbers derived from a row count rather than a controlled sequence
- Invoice edited in place instead of credit memo plus reissue
- Aging from invoice date rather than due date
- Cash auto-applied on amount alone
- Paid modeled as a boolean rather than applied-to-date
- Short payment reasons not captured
- Unapplied cash treated as revenue
- Rate looked up by current date rather than service date
- Fee burn calculated only at month-end
- Write-offs not captured per client, so the pricing signal is lost
- DSO reported without stating gross or net basis
