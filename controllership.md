# Controllership

General ledger, close, audit, tax, payroll.

## General ledger integrity

The non-negotiables, restated because this is where they bind hardest:

- **Debits equal credits**, asserted per entry and per batch, before posting. Fail the batch; never post a partial.
- **Posted entries are immutable.** Corrections are reversing entries. No `UPDATE`, no `DELETE`.
- **Every entry carries lineage**: source system, source ID, run ID, logic version, preparer, approver, timestamp.
- **Never write directly to ERP GL tables.** Use the documented API or import path.
- Manual journal entries are the highest-risk transaction class. They need preparer/approver separation, a required reason, and supporting documentation. Auto-posted entries from an integration still need an owner.

## Close

Model the close as a dependency graph, not a checklist.

```
close_task(id, period_id, name, owner, depends_on[], due_offset_days,
           status, started_at, completed_at, reviewed_by, reviewed_at, evidence_ref)
```

- **Sequence matters**: sub-ledgers close before the GL, allocations run after cost is complete, consolidation after all entities, reporting last. Encode the dependencies so a task cannot complete out of order.
- **Cut-off is where most close errors originate**, and most cut-off errors come from using the wrong date field. Posting date, service date, document date, and receipt date are not interchangeable.
- **Accruals reverse.** Model as a reversing entry so a missing reversal is detectable, and reconcile actual-to-accrual the following period. A persistent gap means the accrual method is wrong, not that the estimate was unlucky.
- **Flux analysis** (period over period, actual versus expectation) with a stated threshold, run before close completes rather than after. Explaining a variance in the review meeting is too late.
- **Materiality threshold set by humans**, applied consistently, documented. Code never decides something is immaterial.
- **Period lock is enforced**, and any post-close adjustment goes to an adjusting period with its own approval, never by reopening.

Metrics worth tracking: days to close, number of post-close adjustments, manual journal count and value, unreconciled items aging.

## Consolidation

- **Intercompany elimination** requires matched pairs. Unmatched intercompany is the most common consolidation break. Reconcile due-to against due-from by counterparty and currency every period, and investigate before eliminating.
- **Translation** per ASC 830: assets and liabilities at closing rate, income statement at average, equity at historical, plug to CTA in OCI. If CTA is absorbing an unexplained amount, the translation is wrong.
- **Minority interest and equity method** investments follow their own rules. Ownership percentages are effective-dated.
- Consolidated and subsidiary-level figures both exist and differ. Always label which you pulled.

## Audit

- **Prepared-by-client (PBC) lists** are predictable. Automate the recurring extracts and version them, so the auditor gets the same query every year and you get it back in an hour instead of a week.
- **Evidence must be reproducible.** A report given to an auditor needs its logic evidenced. An ad hoc query someone wrote and did not save is not evidence, and it is exactly what gets asked about in the following year's walkthrough.
- **Sampling support**: auditors select samples and request support. Fast retrieval by transaction ID with full lineage turns a painful request into a quick one. Build for it.
- **Never alter a record to satisfy an audit request.** If a record is wrong, correct it through the normal process with the correction visible.
- Management representations and estimates are human conclusions. Provide the analysis, never the conclusion.

## Tax

- **Book to tax differences**: permanent versus temporary. Temporary differences drive deferred tax. Maintain the schedule as data, not as a spreadsheet that gets rebuilt annually.
- **Sales tax and VAT**: use a tax engine (Avalara, Vertex, or equivalent) rather than hand-rolling rate logic. Rates, nexus, and taxability rules change constantly and jurisdiction counts run into the thousands.
- **Nexus** determination is a legal judgment. Track the inputs (revenue and transaction counts by jurisdiction, physical presence, employee locations); escalate the conclusion.
- **1099 reporting** depends on vendor classification and W-9 data collected at onboarding. Missing W-9s become a January crisis; enforce collection before first payment. See `ap.md`.
- **Transfer pricing** on intercompany transactions must follow the documented policy. Implement the policy as configured data with its effective dates, not as embedded logic.
- Tax positions are judgments. Compute the inputs and escalate every conclusion.

## Payroll

The most sensitive data in the company and one of the largest expense lines.

- **Access control is strict.** Salary, SSN, garnishments, and benefit elections are on a need-to-know basis. Never in a shared notebook, never in a log line, never in a development environment unmasked.
- **Payroll register reconciles to the GL** every cycle: gross pay, each tax type, each deduction, employer burden, net pay to the cash disbursement. A break here is either a mapping error or something worse.
- **Employer tax burden is not linear across the year.** Wage-base caps (Social Security, FUTA, SUTA) mean the effective burden rate falls as the year progresses. A flat annual burden percentage misstates Q1 against Q4. This is a routine error in headcount cost models. See `fpna.md`.
- **Accrue for earned-but-unpaid** at period end, including the partial pay period, PTO liability, and bonus accrual. Bonus accrual is an estimate; state the assumption.
- **Multi-state and multi-country** payroll each carry their own withholding, reporting, and statutory requirements. Do not generalize logic across jurisdictions.
- Headcount reconciliation: payroll headcount, HCM headcount, and plan headcount will diverge. Reconcile monthly and investigate rather than picking whichever is convenient.

## Internal controls

See `reconciliation-and-controls.md` for segregation of duties, audit trail, approvals, and ITGC including the treatment of AI-generated changes.

Controllership-specific:

- Manual journal entries: preparer and approver separated, reason required, supporting documentation attached, and the population reviewed for entries posted outside normal hours or to unusual accounts.
- Account reconciliations completed, reviewed, and evidenced within a stated deadline. Reconciliations with aged unexplained items are a control finding.
- Access to post to the GL restricted and reviewed periodically.

## Tier guidance

- Ad hoc GL query or flux investigation: **Tier 0**
- Recurring close pack, reconciliation automation, PBC extract: **Tier 1**
- Anything posting entries, closing a period, or producing a filed number: **Tier 2**

## Common defects to check for

- Journal entry posted without a balance assertion
- Correction by update or delete rather than reversal
- Accrual with no reversal, so the gap is undetectable
- Cut-off using the wrong date field
- Intercompany eliminated without matching first
- CTA absorbing an unexplained plug
- Flat burden rate ignoring wage-base caps
- Payroll data in a notebook, a log, or an unmasked development environment
- Audit evidence that cannot be reproduced from saved logic
- Tax rate logic hand-rolled instead of using a tax engine
- Manual journal population never reviewed for anomalies
- Materiality decided by code rather than by a human
