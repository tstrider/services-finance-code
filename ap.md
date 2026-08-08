# Accounts Payable

Vendor master, invoice processing, expense reports, corporate cards, payment runs.

## Vendor master is a control point, not reference data

Fictitious and altered vendors are the classic fraud vector. Treat the vendor table as controlled.

```
vendor(id, legal_name, dba, tax_id, tax_id_type,     -- EIN | SSN | foreign
       status, payment_terms, currency, w9_on_file, w9_date,
       created_by, approved_by, approved_at)
vendor_bank(vendor_id, account_ref_masked, verified_at, verified_by,
            verification_method, effective_from, effective_to)
```

Rules:

- **Bank detail changes require out-of-band verification.** The code path must force it, not suggest it. Business email compromise targeting remit-to changes is the most common finance fraud and it is almost entirely preventable at this control.
- **Segregation**: whoever creates or edits a vendor cannot approve payment to it. Enforce by identity, in code.
- **Duplicate detection on the master**, not just on invoices. Normalize name (case, punctuation, entity suffixes), match on tax ID first, then normalized name plus address. Never match on name alone.
- **Tax ID collected before first payment** (W-9 domestic, W-8 series foreign). Drives 1099 reporting. Missing W-9s become a January problem; block at onboarding instead.
- Sanctions and denied-party screening where applicable, at onboarding and periodically after.

## Invoice processing and three-way match

```
Match: purchase order  <->  goods receipt  <->  invoice
```

- **Two-way match** (PO to invoice) where no receipt exists, typically services.
- **Tolerances** are explicit, per-line and per-invoice, in both amount and percent, and set by policy. A tolerance hardcoded in a script is an uncontrolled policy.
- **Partial receipts and partial invoicing** are the normal case. Model quantities and amounts matched-to-date, not a boolean matched flag.
- Price variance and quantity variance are different exceptions with different owners. Route them differently.

**Duplicate invoice detection.** The single highest-value automated check in AP.

Match on a normalized composite: vendor ID plus invoice number plus invoice date plus amount. Then run fuzzy passes for the ways duplicates actually arrive:

- Invoice number with different punctuation or leading zeros (`INV-001` / `INV001` / `inv 1`)
- Same invoice submitted against two POs
- Same invoice entered by two people in different systems
- Credit memo applied twice
- Amount matching with a different invoice number and same date

Normalize aggressively for detection; never auto-delete. Flag for human review and record the disposition.

## Expense reports and corporate cards

- **Policy checks in code**: receipt threshold, per-diem caps, category restrictions, approval hierarchy, date limits on submission.
- **Card transactions reconcile to statements**, not just to submitted reports. Unreconciled card spend is unrecorded expense and an accrual gap at close.
- Personal expense on a corporate card is a receivable from the employee, not an expense. Model it that way.
- Duplicate detection across expense reports and AP invoices, because the same vendor invoice gets submitted through both channels.
- FX on foreign card spend: the card network rate at settlement, not a spot rate you looked up. Store what the statement says.

## Payment runs

**Idempotency is the whole game.** A retried payment batch that double-pays is the catastrophic failure of AP.

- Idempotency key per payment, enforced by a **unique constraint in the database**, not by application logic alone.
- Payment batch is a durable record with a state machine: `created -> approved -> submitted -> confirmed | failed | partially_settled`. Never infer state from the absence of an error.
- **Partial settlement is the normal failure mode.** Design for a batch where 47 of 50 payments cleared. Never blanket-retry a batch; retry at the payment level against confirmed status.
- Approval before submission, enforced server-side, at the amount and batch level.
- **Never hold a database transaction open across the bank call.** Use an outbox: record intent, submit, record result, reconcile.
- Positive pay file generation where the bank supports it.
- Void and reissue is a new payment linked to the void, never an edit.

## Working capital

- **DPO** = (AP balance / COGS or relevant purchases) x days in period. Define the denominator explicitly and hold it constant across periods, or the trend is meaningless.
- Early payment discount economics: a 2/10 net 30 discount is roughly a 36% annualized return on paying 20 days early. Usually worth taking. Compute it, do not assume.
- Payment timing optimization respects contractual terms. Stretching payables past terms is a supplier relationship decision, not a finance optimization, and the model should surface the term breach rather than quietly recommending it.
- Accrue for goods and services received but not invoiced at close. The receipt-not-invoiced report is the source. A missing accrual is the most common AP close error.

## Sub-ledger to GL

Reconcile the AP sub-ledger (aging) to the AP control account every period. Common breaks:

- Invoices entered but not posted
- Payments posted directly to the control account, bypassing the sub-ledger
- Manual journals to the control account (should be blocked entirely)
- FX revaluation on foreign-currency payables not reflected in the aging
- Timing between sub-ledger close and GL close

## Tier guidance

- Ad hoc AP analysis, spend review, duplicate hunt on an extract: **Tier 0**
- Recurring accrual calculation, AP aging pack: **Tier 1**
- Anything creating a payment, editing a vendor, or posting to AP: **Tier 2**

## Common defects to check for

- Duplicate detection on exact match only, missing punctuation and leading-zero variants
- Idempotency enforced in application code without a database constraint
- Blanket batch retry rather than payment-level retry against confirmed status
- Bank detail change with no out-of-band verification in the code path
- Vendor create and payment approve reachable by the same identity
- Tolerances hardcoded rather than configured as policy
- Personal card spend booked as expense rather than employee receivable
- Receipt-not-invoiced accrual omitted at close
- Sub-ledger to control account reconciliation not run per period
