# Pricing and Margin

Rate cards, cost per hour, utilization, realization, fee burn, scope pricing, and margin defense for people-based services firms. This is the deepest file in the skill because it is where services firms win or lose money.

## The question every pricing model answers

**At what price does this work clear our margin target, and what has to be true for that to hold?**

A model that gives a price without showing the assumptions behind it cannot be used in a negotiation. Every answer shows its drivers.

## Rate cards

A rate card is dated reference data, never a constant.

```
rate_card(id, client_id | segment, currency, effective_from, effective_to, status, approved_by)
rate_card_line(rate_card_id, role_id, level, bill_rate, unit, effective_from, effective_to)
```

- **Look up the rate in effect on the service date.** A scope signed in March under last year's card bills at last year's rates for its term. Never "the current rate" and never an `is_current` join.
- **Never overwrite a rate.** Insert a new version and close the old one. "Which rate applied" is the most common billing dispute, and the history is the answer.
- **Resolution order is explicit and logged:** client override, then contract or MSA card, then standard card. Record which one applied on every priced line.
- **Model at role level and derive the blend.** A blended rate quoted against a role mix that skews senior loses money quietly. Never store the blend as the source of truth.
- **Escalators are scheduled rate versions.** A 3% annual step or an index-linked increase is a contract term with a date. Never a runtime multiplier someone forgets.
- **Changing a live rate card is Tier 2.** Show the before and after, get approval, keep the audit trail.

## Cost per billable hour

```
Fully loaded annual cost = salary + employer taxes + benefits + bonus + other direct people cost
Cost per billable hour   = fully loaded annual cost / annual billable hours
Gross margin per role    = (bill rate - cost per billable hour) / bill rate
```

Use `cost_per_billable_hour()` in `scripts/money.py`. It has no default for hours on purpose, so the caller must pass a named assumption.

### The billable-hours denominator

**Default: 1,800 billable hours per person per year.** State it and invite a correction every time:

> Using 1,800 billable hours per person per year. Tell me your firm's number if it's different.

**Never use 2,080** in a cost-per-billable-hour calculation. 2,080 is 52 weeks times 40 hours: every paid hour, with nothing removed for PTO, holidays, training, admin, or business development. Dividing by it makes each hour look about 13% cheaper than it really is at 1,800, and far cheaper at lower utilization. This one error is the most common reason scopes price as profitable and deliver as losses.

2,080 is fine as a **capacity** figure, for example as the denominator of utilization. It is wrong as the denominator of cost per billable hour. Say which you are doing.

Typical ranges if the firm has no figure and cannot produce one from actuals:

| Role or setting | Typical annual billable hours |
|---|---|
| Law firm associates (classic target) | 1,700 to 2,000 |
| Consulting and agency delivery roles | 1,500 to 1,800 |
| Senior and lead roles carrying sales and management time | 1,200 to 1,500 |
| Partners and principals | 800 to 1,200 |

These are rough ranges, not facts about any firm. **Prefer actuals:** last year's realized billable hours by role are evidence; a target is an aspiration. Say which you used.

**Model it per role and level.** Seniors bill fewer hours because they carry sales, management, and hiring time. One firm-wide number overstates senior margin and understates junior margin at the same time.

## Utilization

Firms define utilization differently. **State the definition every time.**

```
Billable utilization = billable hours / available hours
```

The disagreement is always the denominator:

- **Capacity basis:** standard hours (for example 2,080 per year, or 40 per week). Simple and comparable across people.
- **Available basis:** capacity minus PTO and holidays. Higher percentages, fairer to people who took leave.

Neither is wrong. Mixing them across people, teams, or periods is wrong. Put the basis in the column name (`utilization_capacity_basis`) and in the report.

Other rules:

- Derive utilization from time-entry actuals, never assume it.
- Target utilization times available hours gives target billable hours. Keep that link explicit so a change to one flows to the other.
- Part-time and mid-period starters need prorated capacity. A May 15 start does not have a full year of available hours.

## Realization

```
Billing realization    = billed value / standard value of hours worked
Collection realization = collected value / billed value
Effective rate         = revenue / billable hours worked
```

Standard value means hours valued at the rate-card rate for the service date.

- Realization captures discounts, write-downs, and unbilled time in one ratio. Track it per client and per scope over time. **A falling realization rate predicts a margin problem about a quarter before margin shows it.**
- Write-downs and write-offs are decisions with an owner and a reason. Capture both, per client. Aggregate write-offs by client are a pricing signal.
- Law firms often report both billing and collection realization. State which one you mean.

## Fee burn (fixed fee and retainer work)

Fee burn is the main control on fixed-fee work. Track it continuously, not at month-end.

```
Burn %        = delivered value / contracted fee
Elapsed %     = elapsed service days / total service days
Burn variance = Burn % - Elapsed %
```

**Delivered value is the hours delivered so far, valued at the same rates the scope was priced at.** Keep the numerator and denominator on the same basis. Comparing hours at cost against a fee at price understates burn by the margin and hides the problem.

A positive burn variance means the fee is being used up faster than time is passing. Alert on it. By the time it shows up in month-end margin, the quarter is usually lost.

Use `fee_burn()` in `scripts/money.py`. Model it per scope and roll up per client.

Milestone-based scopes can burn on progress rather than on calendar days. If so, replace elapsed % with an agreed progress measure and say so.

## Over-servicing

```
Over-servicing $ = (hours delivered - hours priced) x cost per billable hour
```

Report it **in dollars at cost, per client**, not in hours. Hours do not get acted on; dollars do. It is the single most useful number in a renewal conversation and is rarely computed cleanly.

## Pricing structures and what each risks

| Structure | Revenue posture (confirm with accounting) | Main risk |
|---|---|---|
| Time and materials | As delivered | Client caps hours; you absorb overage |
| Fixed fee or retainer | Over the service period | Scope creep. Margin erodes quietly unless fee burn is tracked |
| Deliverable-based | As each deliverable is satisfied | Disputes over what "done" means |
| Performance or incentive fee | Variable consideration, constrained | Must not be booked optimistically |
| Cost-plus | Cost plus stated margin | Disputes over what counts as cost; client audit rights |
| Contingency or success fee | Constrained variable consideration | Common in legal and advisory. Not booked before the uncertainty clears |
| Commission on third-party spend | Often net, but a judgment | Gross versus net. See `accounting-rules.md` |

The revenue posture column is a starting point for the conversation with accounting, not a conclusion.

## Contract terms that belong in the model

Most margin leakage is contractual, not operational. Pull these out and model them:

- **Payment terms.** A 90-day term on a firm that pays its own bills in 45 days is a financing decision. Quantify the cost.
- **Volume or spend tiers,** retroactive or prospective. A retroactive tier creates a liability as soon as hitting the threshold becomes probable.
- **Most-favored-nation clauses.** One can cap pricing across the whole book. Model the reach before agreeing.
- **Termination for convenience and notice periods.** They decide how much of a contract is really committed.
- **Caps and collars** on fees, overages, and escalators.
- **Cost definitions and audit rights** in cost-plus deals.
- **Index basis and lag** for escalators: which index, which month, applied when.

Keep **committed, cancellable, and pipeline** revenue on separate lines. Reporting them as one number is how forecasts blow up.

## Margin defense: the standard set

Per client and per scope, monthly:

```
Revenue (gross and net, labeled)
Direct cost (delivery hours at cost per billable hour)
Pass-through cost (with the presentation decision noted)
Gross margin $ and %
Over-servicing $
Billing realization
Effective rate
Fee burn % vs elapsed % (fixed fee scopes)
Utilization (with basis stated)
Contribution after directly attributable non-delivery cost
```

State the time-entry cut-off on every one of these. Late time changes margin.

## Building a pricing model

- **Inputs separate from calculations.** Every assumption is a named input in one place. "What if utilization is 65%?" should take ten seconds to answer.
- **Show sensitivity, not a point estimate.** Show the margin across the two or three drivers that matter, usually rate, utilization, and role mix.
- **Show the walk** from list price to net price: discount, mix, escalator, pass-through. One delta with no bridge will not survive a negotiation.
- **Show the floor price:** the price at which the work just hits the minimum acceptable margin. That is the number the deal team needs.
- **Keep every scenario.** You will be asked what you showed the client in the March meeting.
- **Never reverse-engineer to a target margin** without labeling it. If someone wants 35%, show what rate or utilization that needs and whether it is achievable.

## Tiers

- Ad hoc deal pricing: Tier 0 or 1. Tie the cost basis to payroll actuals, state utilization and mix, keep the scenario.
- A rate card others price against: Tier 2. Dated, versioned, approved, logged.
- A pricing tool the deal team uses: Tier 3. See `finance-tools.md`.

## Common defects

- Cost per hour divided by 2,080 instead of billable hours
- The billable-hours number buried in a formula instead of named as an assumption
- One firm-wide billable-hours number applied to every role
- Utilization reported without its denominator, or with mixed denominators
- Blended rate stored as the source of truth
- Rate looked up by today's date instead of the service date
- Fee burn comparing cost to price
- Fee burn only measured at month-end
- Over-servicing reported in hours, not dollars
- Committed and cancellable revenue added into one line
- Escalators applied as runtime multipliers
- No time-entry cut-off stated on a margin number
