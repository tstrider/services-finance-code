# Back Office: AP, Cash, and Close

Lighter coverage of accounts payable, cash and treasury, and controllership, focused on what services firms run into.

## Accounts payable

### Vendor master is a control point

Fake and altered vendors are the classic fraud path.

```
vendor(id, legal_name, tax_id_masked, tax_form_on_file, tax_form_date, status,
       payment_terms, currency, created_by, approved_by, approved_at)
vendor_bank(vendor_id, account_last4, verified_at, verified_by, verification_method,
            effective_from, effective_to)
```

- **Bank detail changes need verification through a separate channel** (a call to a known number, never the number in the email), forced by the code path. Fake "we changed banks" emails are the most common finance fraud.
- Whoever creates or edits a vendor cannot approve payments to it, or a compensating review is recorded.
- **Duplicate detection on the vendor list,** not just on bills: tax ID first, then normalized name plus address. Never name alone.
- **Collect tax forms before the first payment** (in the US, W-9 or W-8). Missing forms become a year-end reporting problem.

### Bills and payments

- **Duplicate bill detection** is the single most valuable automated AP check. Match vendor plus normalized invoice number plus date plus amount, then fuzzy passes: punctuation and leading zeros (`INV-001` vs `INV001`), the same bill entered twice, the same bill paid by card and by AP. Flag for a person; never auto-delete.
- **Subcontractor and freelancer bills** in a services firm often need matching to scopes and to client billing (pass-throughs). A pass-through cost with no matching client charge is lost margin; flag it.
- **Tolerances are policy,** set by a person and stored as data, never hardcoded.
- **Payment runs are safe to retry:** an idempotency key per payment, enforced by a unique constraint. A retried batch that pays twice is the classic AP disaster.
- **Payment state is a record** (created, approved, sent, confirmed, failed, partly settled), never inferred from the absence of an error. Retry item by item against confirmed status.
- **Personal spend on a company card** is money owed by the employee, not an expense.
- **Accrue work received but not yet billed** at month-end. Missing contractor accruals are a common services-firm close error.
- **Early payment discount math:** 2/10 net 30 is roughly a 37% annualized return for paying 20 days early. Compute it; do not assume.
- AP aging ties to the AP control account every period.

## Cash and treasury

- **Ledger balance, available balance, and bank balance are different numbers.** Use the right one for the decision, and timestamp it.
- **Never add cash across currencies** without a rate and rate date. Show native and converted views.
- **Reconcile bank to ledger** frequently. A cash break is either an unrecorded item or fraud, and both are urgent.
- **13-week cash forecast** (receipts and payments) for the short term. Model client payment timing from actual history, not terms: a net-30 client that pays in 52 days is modeled at 52. Payroll, tax, rent, and debt dates are fixed.
- **Restricted cash is not available cash.**
- **Loan covenants** use the credit agreement's own definitions (for example its defined "Adjusted EBITDA"), which often differ from management's. Implement the agreement's definition and cite the section.
- **Client funds are not firm funds.** Law firm trust accounts (IOLTA and similar) and any client money held for third-party spend are segregated and reconciled **per client**, not just in total. A total that ties while one client's balance is wrong is still a breach, and for law firms a bar-rule issue.
- **Client-funded third-party spend** (media, production, subcontractors paid on a client's behalf): the obligation to the vendor exists whether or not the client has paid. Track client-funded and firm-funded exposure separately.
- Anything that moves money is Tier 2: two approvals, and a person releases the payment.

## Close and controllership

- **Debits equal credits,** checked per entry and per batch before posting. Fail the whole batch; never post part of one.
- **Posted entries are never edited.** Corrections are reversing entries.
- **Every entry carries lineage:** source, source ID, run ID, logic version, preparer, approver.
- **Manual journals are the riskiest entries.** Preparer and approver separate (or a recorded review), a required reason, support attached, and the population reviewed for odd timing, unusual accounts, and round amounts.
- **Model the close as dependencies:** time and billing before revenue, sub-ledgers before the ledger, allocations after costs are complete, reporting last.
- **Cut-off errors come from the wrong date field.** Posting, service, invoice, and receipt dates are not interchangeable.
- **Accruals reverse.** Build them as reversing entries so a missing reversal is visible, and compare actual to accrued the next month.
- **Flux review** (period over period, actual versus expected) runs before the close is done, with thresholds a person set.
- **Post-close changes** go through an adjusting process with its own approval, never by quietly reopening a period.
- **Intercompany** is matched by entity and currency before elimination.
- **Payroll register ties to the ledger** every cycle.
- **Audit support is rerunnable.** A saved, versioned query beats an ad hoc one nobody can reproduce next year.
- **Never change a record to satisfy an audit request.** Correct it through the normal process, visibly.
- **Tax:** use the accounting system's tax setup or a tax engine for sales tax and VAT. Nexus, positions, and classifications are judgments; compute the inputs and escalate.

## Tiers

- Ad hoc AP, cash, or ledger question: Tier 0
- Recurring AP aging, cash report, close pack, reconciliation automation: Tier 1
- Anything that pays, changes a vendor, posts an entry, or closes a period: Tier 2

## Common defects

- Duplicate bill check on exact match only
- Retry protection in code with no database constraint
- Whole-batch retries instead of item-level retries
- Vendor bank change with no separate-channel verification
- Payment timing from terms instead of history
- Restricted or client cash counted as available
- Client funds reconciled only in total
- Journal posted without a balance check
- Correction by edit instead of reversal
- Accrual with no reversal
- Missing contractor accruals at month-end
