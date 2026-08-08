# US GAAP Reference

**Scope note.** This exists so code encodes the right concepts and so you know when to stop and escalate. It is not accounting advice, and applying it is not a substitute for your controller or auditor. Every judgment flagged below belongs to a qualified human.

## The rule that governs everything here

**Never let code decide an accounting treatment.** Treatments are attributes on the contract or account, determined by accounting, stored as data, and applied by code. Code that infers treatment from data shape will silently change the financials when the data changes.

```
# RIGHT
contract.revenue_presentation  # 'gross' | 'net', set by accounting, dated, with rationale
contract.recognition_method    # 'point_in_time' | 'over_time_input' | 'over_time_output'

# WRONG
presentation = 'gross' if contract.has_media_spend else 'net'
```

Flag any record missing a required treatment attribute rather than defaulting it.

## ASC 606 — Revenue from contracts with customers

The five steps, and what each means for a data model:

1. **Identify the contract.** Enforceable rights, collectibility probable. Contract term is the enforceable period, which is not always the stated term. Termination for convenience with short notice can shorten it materially.
2. **Identify performance obligations.** Distinct goods or services. One contract commonly contains several. Your model needs a POB grain, not just a contract grain.
3. **Determine transaction price.** Includes variable consideration (bonuses, penalties, rebates, volume discounts), which must be **constrained** to the amount for which a significant reversal is not probable. Do not book optimistic estimates.
4. **Allocate to performance obligations** on relative standalone selling price. This is an allocation problem: use exhaustive allocation so the parts sum to the transaction price.
5. **Recognize when (or as) each obligation is satisfied.** Point in time versus over time, and if over time, by input method (cost or hours incurred) or output method (deliverables, milestones).

**Data model implications**

```
contract(id, customer, start, end, enforceable_term, presentation, currency)
performance_obligation(id, contract_id, description, ssp, method, start, end)
transaction_price(contract_id, component, amount, variable_flag, constraint_applied, as_of)
allocation(pob_id, allocated_amount, basis, as_of)
recognition(pob_id, period, amount, method, driver_value)
contract_asset / contract_liability(contract_id, period, balance)
```

- **Contract assets and contract liabilities** (unbilled receivable and deferred revenue) are the balancing mechanism between billing and recognition. If your model recognizes revenue without producing these, it is incomplete and will not tie to the balance sheet.
- **Contract modifications** are their own event: prospective, cumulative catch-up, or separate contract, depending on facts. Do not silently restate prior recognition. Model the modification as a dated event.
- **Costs to obtain a contract** (commissions) may require capitalization and amortization under ASC 340-40. Common miss.

### Principal versus agent (gross versus net)

The single highest-stakes judgment in agency and marketplace models. Covered in depth in `commercial-finance.md`.

Control is the criterion: does the entity control the specified good or service before transfer to the customer? Indicators toward principal are primary responsibility for fulfilment, inventory or cancellation risk, and pricing discretion. Where a firm procures third-party goods or services for a client (media, subcontractors, experts, production, licence resale), contracting in its own name, bearing cancellation liability, and setting the client price point toward principal (gross); running the purchase through the client's own accounts for a stated commission points toward agent (net).

Identical economics, and reported revenue differs by the entire media spend. **Present indicators, recommend controller and auditor review, never conclude in code.**

## ASC 830 — Foreign currency

- **Functional currency** determined per entity. Everything follows from it.
- **Transactions** recorded at the spot rate on the transaction date. Monetary balances remeasured at the closing rate, with gains and losses to P&L.
- **Translation** of a foreign entity for consolidation: assets and liabilities at closing rate, income statement at average rate, equity at historical, difference to **CTA** in other comprehensive income.
- The common bug: applying the average rate to a balance sheet account or the closing rate to a P&L account. Both produce a plausible number and a broken consolidation. If the balance sheet only ties because CTA absorbed an unexplained amount, look for this.

## ASC 842 — Leases

- Substantially all leases on the balance sheet: right-of-use asset and lease liability, measured at the present value of lease payments.
- Finance versus operating classification affects expense pattern, not balance sheet presence.
- Discount rate: rate implicit in the lease if determinable, otherwise incremental borrowing rate. Store the rate used and its date.
- Remeasurement events (modification, change in term or index-linked payments) are dated events, not retroactive edits.
- Short-term lease and low-value practical expedients are policy elections that must be recorded as such.

## ASC 450 — Contingencies and accruals

- Accrue when a loss is **probable** and **reasonably estimable**. Disclose when reasonably possible.
- Applies to legal matters, restructuring, and warranty. The probable/estimable determination is a judgment. Flag it.
- Accrual reversals are dated events with a reason, never a quiet adjustment.

## ASC 340-40, ASC 350, ASC 360

- Contract acquisition costs (commissions) capitalized and amortized over the benefit period, including anticipated renewals.
- Internal-use software: capitalize development-stage costs, expense preliminary-project and post-implementation. Relevant when building proprietary finance tools, and a treatment that often gets missed on internal engineering spend.
- Impairment triggers are events. Model the trigger, do not infer it.

## Recent standards worth knowing

| Standard | What it does | Effective |
|---|---|---|
| **ASU 2024-03 (DISE)** | Requires public business entities to disaggregate specified expenses (employee compensation, depreciation, amortization, inventory purchases) within income statement captions, in a tabular footnote | Annual periods beginning after Dec 15, 2026; interim within annuals beginning after Dec 15, 2027. Early adoption permitted |
| **ASU 2023-09** | Expanded income tax rate reconciliation and income-taxes-paid disaggregation | Public entities, annual periods beginning after Dec 15, 2024 |
| **ASU 2023-07** | Segment reporting: significant segment expenses and CODM measures | Annual periods beginning after Dec 15, 2023 |

**DISE has a direct engineering consequence and it is worth acting on early.** It requires expense detail by natural category *within* functional captions. Most charts of accounts and most data warehouses cannot produce that split without a rebuild, because they carry either functional or natural classification but not both cleanly. If you are designing a chart of accounts or a reporting model now and the entity is or may become a public business entity, build the natural-category dimension in from the start. Retrofitting it later is a multi-quarter project.

Verify effective dates against FASB directly before relying on them; deferrals and clarifications happen.

## Foundational principles that show up in code

- **Accrual basis**: recognize when earned or incurred, not when cash moves. Any output must state its basis.
- **Matching**: costs recognized in the period of the related revenue. Drives accruals, deferrals, and prepaid amortization.
- **Materiality**: a threshold set by humans, applied consistently, and stated. Code must never decide something is immaterial on its own.
- **Consistency**: same treatment period to period. A change in method is a disclosed event.
- **Conservatism**: where genuine uncertainty exists, do not overstate assets or income. Not a licence to create reserves at will.
- **Going concern**: assumed unless there is substantial doubt.

## Close-adjacent concepts

- **Accruals** for goods or services received but not invoiced. Reversed in the following period, then replaced by the actual. Model as a reversing entry, so a missing reversal is detectable.
- **Deferrals / prepaid**: cash out before expense. Amortize on a schedule; store the schedule, do not recompute it from a rate each period.
- **Cut-off**: the correctness of the period boundary. Most close errors are cut-off errors, and most cut-off errors come from using the wrong date field. See the five dates in `money-invariants.md`.
- **Reclassification** versus **correction**: a reclass moves between accounts within a period; a correction fixes a prior error and may require restatement analysis. Different events, labeled differently.

## SOX and ITGC (if the entity is public or preparing to be)

Relevant to any code touching financially significant systems:

- **Change management**: changes are requested, reviewed, approved, tested, and deployed by a documented process with evidence retained. AI-generated changes are program changes and carry the same requirement.
- **Segregation of duties**: developer and approver are different people. Whoever prompted an agent to write a change cannot be the sole approver of it.
- **Access control**: least privilege, periodic review, prompt deprovisioning, and privileged access monitored.
- **Completeness and accuracy of reports** used in controls: if a control relies on a report, the report's logic must be evidenced. A query someone wrote ad hoc is not evidence.
- Auditor expectations in this area are actively evolving, with PCAOB AS 2201/2101 amendments effective for periods beginning after December 15, 2026 and COSO GenAI guidance issued February 2026. Confirm current requirements with your audit team; do not treat this file as authoritative on scope.

## When to escalate, always

- Revenue presentation (gross versus net), or any change to it
- Whether and when a performance obligation is satisfied
- Capitalize versus expense
- Reserve or allowance adequacy
- Any tax position
- Contract modification accounting
- Anything that would restate a closed period
- Any treatment where you can construct a reasonable argument for two answers

Present the analysis and the indicators. Name the decision as one for the controller or auditor. Do not resolve it.
