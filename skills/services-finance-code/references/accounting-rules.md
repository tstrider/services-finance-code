# Accounting Rules

**This is not accounting advice.** It exists so code carries the right concepts and so you know when to stop and hand a decision to a person. Every judgment flagged here belongs to the controller or the auditor. Verify standards and effective dates against the source (FASB for US GAAP, the IFRS Foundation for IFRS) before relying on them.

US GAAP is the default. Short IFRS notes follow each topic where the answer differs. If you do not know which framework the firm uses, ask at Tier 1 and up.

## The rule over everything

**Code never decides an accounting treatment.** Treatments are attributes set by accounting, stored as dated data with a reason, and applied by code. Code that infers a treatment from the shape of the data will silently change the financials when the data changes.

```
# RIGHT
contract.revenue_presentation  # 'gross' | 'net', set by accounting, with date and reason
obligation.recognition_method  # 'point_in_time' | 'over_time_input' | 'over_time_output'

# WRONG
presentation = 'gross' if contract.has_pass_through_costs else 'net'
```

Flag any record missing a required treatment. Never default it.

## Revenue (ASC 606)

The five steps and what each means for a data model:

1. **Identify the contract.** Enforceable rights, collection probable. The contract term is the enforceable period, which can be shorter than the stated term when either side can cancel for convenience on short notice.
2. **Identify performance obligations.** One services contract often holds several (strategy, production, an ongoing retainer). The model needs an obligation grain, not only a contract grain.
3. **Set the transaction price.** Includes variable amounts (bonuses, success fees, penalties, rebates), which are **constrained** to what is not likely to reverse. Never book the optimistic case.
4. **Allocate the price** across obligations by relative standalone selling price. Use exhaustive allocation so the parts add back.
5. **Recognize** when or as each obligation is satisfied: at a point in time, or over time using an input measure (hours or cost incurred) or an output measure (milestones delivered).

```
contract(id, client_id, start_date, end_date, enforceable_term, revenue_presentation, currency)
performance_obligation(id, contract_id, description, standalone_price, method, start_date, end_date)
transaction_price(contract_id, component, amount, is_variable, constraint_applied, as_of)
allocation(obligation_id, allocated_amount, basis, as_of)
recognition(obligation_id, period, amount, method, progress_measure)
contract_balance(contract_id, period, unbilled_receivable, contract_asset, contract_liability)
```

- **Contract assets and liabilities** (earned but not billable yet; billed or paid ahead) are the balance between billing and recognition. A model without them will not tie to the balance sheet. See `billing-and-revenue.md`.
- **Contract modifications** are dated events. Accounting decides whether each is a new contract, a prospective change, or a catch-up adjustment.
- **Commissions paid to win a contract** may need to be capitalized and spread over the benefit period (ASC 340-40). A practical expedient lets firms expense them when that period is one year or less. Flag commission data to accounting.

**IFRS note:** IFRS 15 and ASC 606 are close to identical. The same five steps and the same principal-versus-agent model apply. Minor differences exist in some practical expedients and elections.

## Gross versus net (principal versus agent)

The highest-stakes judgment in services finance. It arises whenever the firm buys third-party goods or services for a client: media, subcontractors, freelancers, expert witnesses, printing and production, software resold to the client, travel, venues, events.

**The question:** does the firm control the specified good or service before it passes to the client? If yes, the firm is the principal and reports revenue gross (the full amount). If no, it is an agent and reports net (its fee or commission).

The standard's three indicators of control (ASC 606-10-55-39):

1. The firm is **primarily responsible for fulfilling** the promise, including whether the result is acceptable.
2. The firm has **inventory risk** before or after transfer (for example, it is stuck with prepaid capacity the client cancels).
3. The firm has **discretion in setting the price** the client pays.

Facts that often inform those indicators: who contracts with the vendor, and in whose name; who bears cancellation liability; whether the client can see and approve the vendor cost; whether the firm marks up the cost or earns a stated fee. These are evidence to present, not tests to apply in code.

**Why it matters:** identical economics can produce reported revenue that differs by the entire pass-through amount. That moves growth rates, margin percentages, revenue-based loan covenants, and revenue-based pay, with no change to profit or cash.

**What the code does:** carries `revenue_presentation` per contract (or per cost type within a contract), set and dated by accounting. Applies it the same way every period. Flags contracts that have none.

**What you do:** lay out the indicators and the evidence. Recommend the controller or auditor decide. Never let a model switch presentation because the data changed.

Related: **vendor rebates and volume incentives** may reduce cost or revenue rather than count as income. Same rule: flag, do not decide.

**IFRS note:** IFRS 15 uses the same control model and indicators.

## Credit losses (ASC 326)

Trade receivables and contract assets fall under the current expected credit loss model. Code computes the inputs: aging, historical loss rates by bucket, and any current information. The allowance itself is an estimate owned by accounting. ASU 2025-05 (annual periods beginning after December 15, 2025) lets firms assume conditions at the balance sheet date stay unchanged when estimating losses on current receivables and contract assets, and lets private companies also consider cash collected after the balance sheet date. Both are optional elections; ask whether the firm made them before building the calculation.

**IFRS note:** IFRS 9 uses a simplified approach for trade receivables (lifetime expected losses, often via a provision matrix). The inputs look much the same.

## Leases (ASC 842)

- Nearly all leases over 12 months go on the balance sheet: a right-of-use asset and a lease liability at the present value of payments.
- Finance versus operating classification changes the expense pattern (front-loaded interest and amortization versus a straight-line single cost), not whether the lease is on the balance sheet.
- Discount rate: the rate implicit in the lease if known, otherwise the incremental borrowing rate. Private companies may elect a risk-free rate by asset class. Store the rate used, its source, and its date.
- Changes to term, payments, or scope are dated remeasurement events, never edits to history.
- The short-term lease exemption (12 months or less) is a policy election. Record it as one.

**IFRS note:** IFRS 16 has one model for lessees: every lease on the balance sheet is treated like a finance lease, with depreciation plus interest, so expense is front-loaded. IFRS 16 also allows a low-value asset exemption that US GAAP does not have.

## Contingencies and provisions (ASC 450)

- Accrue a loss when it is **probable** (likely to occur) and **reasonably estimable**. Disclose when reasonably possible.
- If only a range can be estimated and no amount in it is better than another, accrue the **low end** of the range.
- Legal matters, restructuring, and onerous commitments land here. The probable-and-estimable call is a judgment. Flag it.

**IFRS note:** IAS 37 sets a lower bar. "Probable" means more likely than not. When outcomes in a range are equally likely, IFRS uses the **midpoint**, not the low end. The same facts can produce a provision under IFRS and none under US GAAP.

## Software built in-house (ASC 350-40)

Relevant when the firm builds its own finance tools (Tier 3).

- **ASU 2025-06** replaced the old project-stage model. Development costs are capitalized once management has authorized and committed to funding the project and it is probable the software will be completed and used as intended. Effective for annual periods beginning after December 15, 2027, with early adoption allowed. Firms may still be on the old stage-based model until then; ask which applies.
- Treatment of internal engineering time is often missed. Flag it to accounting when you see payroll spent on building tools.

**IFRS note:** IAS 38 expenses research and capitalizes development only when a set of criteria are all met (technical feasibility, intent and ability to complete, probable future benefit, and others).

## Impairment

- US GAAP: an impairment loss on assets held and used is never reversed.
- **IFRS note:** IAS 36 allows reversal of impairment losses (except on goodwill) when conditions improve.

Model impairment triggers as dated events. Never infer them.

## Foreign currency (ASC 830)

- **Functional currency** is set per entity. Everything follows from it.
- Transactions are recorded at the spot rate on the transaction date. Monetary balances are remeasured at the closing rate, with the difference in P&L.
- Consolidating a foreign entity: assets and liabilities at the closing rate, income statement at the average rate, equity at historical rates, and the difference to the cumulative translation adjustment in other comprehensive income.
- The common bug: average rate on a balance sheet account, or closing rate on a P&L account. If the balance sheet only balances because the translation adjustment absorbed an unexplained amount, look here.

**IFRS note:** IAS 21 follows the same broad model.

## Presentation changes worth knowing

- **US, ASU 2024-03 (expense disaggregation):** public business entities must break specified expenses (employee pay, depreciation, amortization, and others) out of income statement lines in a footnote. Annual periods beginning after December 15, 2026. Most privately held services firms are not in scope, but if the firm may go public or be acquired by a public company, carry the natural expense category (compensation, software, travel) as its own dimension alongside the functional line.
- **IFRS 18** replaces IAS 1 for annual periods beginning on or after January 1, 2027. It adds defined subtotals to the income statement (including operating profit) and disclosure of management-defined performance measures. Reporting code for IFRS firms will need the new categories.

Verify these dates at the source before building to them.

## Principles that show up in code

- **Accrual basis:** revenue when earned, cost when incurred, not when cash moves. Every output states its basis.
- **Matching:** costs land in the period of the related revenue. Drives accruals, deferrals, and prepaid amortization.
- **Materiality** is a threshold set by people, applied consistently, and stated. Code never decides that something is immaterial.
- **Consistency:** the same treatment period to period. A change in method is a disclosed event.
- **Cut-off:** the correctness of the period boundary. Most cut-off errors come from using the wrong date field.
- **Reclass versus correction:** a reclass moves between accounts in a period; a correction fixes an earlier error and may need restatement analysis. Label them differently.

## Always escalate

- Gross versus net, or any change to it
- Whether and when a performance obligation is satisfied
- Capitalize versus expense
- Allowances, reserves, and provisions
- Any tax position
- Contract modification accounting
- Anything that would change a closed period
- Anything where a reasonable person could argue for two answers
- Which framework applies, if unclear

Present the analysis and the indicators. Name the decision as the controller's or auditor's. Do not resolve it.
