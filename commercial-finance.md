# Commercial Finance

Pricing, rate cards, scopes, contract economics, margin defense.

**Written for people-based services businesses** — agencies, law firms, consultancies, engineering and design firms, staffing, managed services. The common structure: revenue is a function of people's time, capacity is the constraint, and margin is defended at the point of pricing rather than recovered later. Where a mechanic differs by sector it is noted.

## The core question every model must answer

**At what price does this engagement clear our margin threshold, and what has to be true for that to hold?**

Everything below serves that. A pricing model that produces a number without exposing the assumptions that drive it is not usable in a negotiation.

## Rate cards

**Structure**

A rate card is effective-dated reference data, not a constant. Model it as:

```
rate_card(id, client_id | segment, currency, effective_from, effective_to, status)
rate_card_line(rate_card_id, role_id, level, rate, unit, min_hours?)
```

Rules that break naive implementations:

- **Effective dating is mandatory.** A scope signed in March under last year's card bills at last year's rates through its term. Never overwrite a rate. Insert a new version and close the prior one. Retrieval is always "the rate in effect on the service date," never "the current rate."
- **Client-specific overrides** sit above a standard card. Resolution order: client override, then segment or MSA card, then standard. Make the resolution explicit and logged, because "which rate applied" is the most common billing dispute.
- **Blended rates hide mix.** A blended rate quoted against an actual role mix that skews senior destroys margin silently. Always model at role level and derive the blend, never store the blend as the source of truth.
- **Rate escalators** (CPI-linked, fixed annual step) are contract terms with effective dates. Implement as scheduled rate versions, not as a runtime multiplier someone forgets.

**The margin math**

```
Gross margin per role = (bill rate - fully loaded cost rate) / bill rate
```

Fully loaded cost rate is where models go wrong. It must include salary, employer taxes, benefits, and an allocation of non-billable time. The last one is the killer:

```
Effective cost per billable hour = annual fully loaded cost / annual billable hours
```

### The billable-hours denominator

**Default: 1,800 billable hours per FTE per year.** This is the standard professional-services convention and the right starting point when the firm's own figure is not supplied.

**Always surface the assumption and invite a change.** State it plainly in the output, every time:

> Using 1,800 billable hours per FTE per year as the denominator. Tell me your firm's figure if it differs.

Never bury it in a formula. It belongs in the assumptions block as a single named input, so changing it re-runs the whole model.

**Never use 2,080.** That is 52 weeks × 40 hours, total paid hours with nothing removed for PTO, holidays, training, admin, or business development. Dividing by it understates cost by roughly the inverse of the utilization rate: at 1,800 billable hours the cost per hour is about 16% higher than the 2,080 figure suggests, and at genuinely low utilization the gap is far wider. **This single error is the most common cause of "profitable" scopes that lose money.**

Reasonable ranges, if the firm has no stated figure and cannot produce one from actuals:

| Context | Typical annual billable hours |
|---|---|
| Law firms (classic target) | 1,700 – 2,000 |
| Consulting and agency delivery roles | 1,500 – 1,800 |
| Senior and lead roles carrying BD time | 1,200 – 1,500 |
| Partner or principal level | 800 – 1,200 |

**Derive from actuals wherever possible.** A stated target is an aspiration; last year's realized billable hours per role is evidence. When you use the default rather than actuals, say which you used.

**Model it per role and level.** A single firm-wide number hides the fact that seniors bill materially fewer hours because they carry business development, management, and recruiting time. Applying one denominator across all roles overstates senior margin and understates junior margin at the same time.

## Scopes and pricing models

**Pricing structures, and what each one risks**

| Model | Revenue recognition posture | Primary risk |
|---|---|---|
| Time and materials | As delivered | Client caps hours; you absorb overage |
| Fixed fee / retainer | Over the service period | Scope creep. Margin erodes invisibly until fee burn is tracked |
| Deliverable-based | On satisfaction of each obligation | Disputes over what "done" means |
| Performance / incentive | Variable consideration, constrained | Estimate must be constrained under ASC 606; do not book optimistic |
| Cost-plus | Cost plus stated margin | Cost definition disputes; audit rights |
| Contingency / success fee | Constrained variable consideration | Common in legal and advisory. Do not book before the constraint clears |
| Commission on third-party spend | Usually net (agent) | Principal versus agent determination. See below |

**Fee burn is the central control for fixed fee work.** Track continuously, not at close:

```
Burn %       = hours delivered at cost / total contracted fee
Elapsed %    = elapsed service days / total service days
Burn variance = Burn % - Elapsed %
```

A positive burn variance means you are consuming the fee faster than the calendar. Alert on it. By the time it shows up in month-end margin, the quarter is already lost. Model it per scope and roll up per client.

**Over-servicing** is the accumulated gap between hours delivered and hours priced. Quantify it in dollars at cost, not hours, and report it per client. It is the single most useful number in an agency renewal conversation and almost nobody computes it cleanly.

## Principal versus agent (gross versus net revenue)

**This is the highest-stakes judgment in services finance and you must not decide it in code.**

It arises wherever an entity procures third-party goods or services on a client's behalf: media placements, subcontractors and freelancers, expert witnesses and court costs, print and production, cloud or licence resale, travel booked for a client, event and venue spend.

The determining question under ASC 606 is control: does the entity control the specified good or service *before* it transfers to the customer? Principal recognizes gross (full amount). Agent recognizes net (fee or commission only).

Indicators pointing toward **principal**:

- The entity contracts directly with the third-party vendor in its own name
- The entity bears cancellation liability if the purchased service goes unused
- The entity has pricing discretion, setting the client price rather than passing cost through
- The entity bears inventory or credit risk, including the risk the client does not pay
- The entity is primarily responsible for fulfilment and for the acceptability of the deliverable

Indicators pointing toward **agent**: the purchase runs through the client's own accounts, the entity collects a stated commission or management fee, the client is contractually the counterparty to the vendor, and the entity's compensation does not vary with the underlying price.

**Why it matters**: identical economics, and reported revenue can differ by the entire pass-through amount. On a large account that is tens of millions of dollars of reported revenue with no change to profit. It moves reported growth rates, margin percentages, revenue-based covenants, and revenue-based compensation, all without any change to cash.

**What the code should do**: carry a `revenue_presentation` attribute (gross/net) determined per contract by accounting, applied consistently, never inferred at runtime from data shape. Store the determination and the date it was made. Flag any contract without one rather than defaulting.

**What you should do**: present the indicators and their evidence. Recommend the analysis go to the controller or external auditor. Never let a model silently switch presentation because the data changed.

Related traps: **pass-through costs and rebates.** Vendor rebates, volume incentives, and credits have their own treatment and can require reduction of revenue rather than recognition as income. Same rule: flag, do not decide.

## Contract terms that belong in the model

Most margin leakage is contractual, not operational. Extract and model these:

- **Payment terms** (net 30/60/90). Terms drive working capital, not P&L, but a 90-day term on a business with 45-day payables is a financing decision. Quantify the cost.
- **Volume or spend tiers** with retroactive versus prospective application. Retroactive tiers create a liability the moment the threshold becomes probable.
- **Most-favored-nation clauses.** One MFN client caps pricing across the book. Model the blast radius before agreeing.
- **Termination for convenience** and notice periods. Determines how much of a contract is actually contracted revenue versus cancellable. This distinction matters for both forecasting and ASC 606 contract term.
- **Caps and collars** on fees, overages, and escalators.
- **Audit rights and cost definitions** in cost-plus arrangements.
- **Indexation** basis and lag (which CPI series, which month, applied when).

Model contracted revenue as **committed** versus **cancellable** versus **pipeline**. Reporting them as one number is how forecasts blow up.

## Margin defense: what to compute

Standard set, per client and per scope, monthly:

```
Revenue (gross and net, labeled)
Direct cost (fully loaded delivery hours at cost)
Pass-through cost (with presentation noted)
Gross margin $ and %
Over/under-servicing $ (delivered hours at cost minus priced hours at cost)
Realization rate (billed / standard rate value of hours delivered)
Effective blended rate (revenue / billable hours delivered)
Fee burn % vs elapsed %
Contribution after directly attributable non-delivery cost
```

**Realization** is the quiet one. It captures discounting, write-offs, and unbilled time in a single ratio. Track its trend per client; a declining realization rate predicts a margin problem a quarter before the margin shows it.

## Pricing model construction rules

- **Drivers separated from outputs.** Every assumption is a named input in one place, never buried in a formula. Someone will ask "what if utilization is 65%," and the answer must take ten seconds.
- **Sensitivity is table stakes.** Produce the margin surface across the two or three drivers that matter (usually rate, utilization, and mix), not a single point estimate.
- **Show the walk.** From list price to net price: discount, mix effect, escalator, pass-through. A single delta with no bridge is not defensible in a negotiation.
- **Floor price is explicit.** Compute the price at which the engagement hits the minimum acceptable margin and surface it. That is the number the deal team actually needs.
- **Scenarios preserved, not overwritten.** Every version of a pricing scenario is retained with its assumptions. You will be asked what you showed the client in the March meeting.
- **Never reverse-engineer to a target margin** without labeling it. If someone wants the model to produce 35%, show what utilization or rate that requires and whether it is achievable.

## Tier guidance

- Ad hoc deal pricing: **Tier 0 or 1**. Reconcile the cost basis to actuals, state utilization and mix assumptions, preserve the scenario.
- Rate card stored in a system others price against: **Tier 2**. Effective-dated, versioned, approval-gated, audit-logged.
- A pricing tool the deal team uses: **Tier 2P**. See `finance-products.md`.

## Common defects to check for

- Cost per hour divided by 2,080 instead of annual billable hours (default 1,800)
- Billable-hours denominator buried in a formula instead of stated as a named assumption
- One firm-wide denominator applied across all roles, hiding lower senior billable hours
- Blended rate stored as source of truth, hiding an adverse mix shift
- Rate lookup by current date instead of service date
- Utilization assumed rather than derived from actuals
- Revenue presentation (gross/net) inferred at runtime
- Committed and cancellable revenue summed into one forecast line
- Over-servicing reported in hours, not dollars, so nobody acts on it
- Escalators implemented as runtime multipliers that drift from the contract
- Fee burn measured only at month-end close
