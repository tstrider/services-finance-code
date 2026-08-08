# FP&A

Budgets, rolling forecasts, variance, headcount planning, scenario modeling.

## Build driver-based, not line-extrapolated

A model that grows last year by 4% cannot answer any question worth asking. Structure every forecast as:

```
Output = Driver x Rate
```

Examples that generalize:

| Output | Driver | Rate |
|---|---|---|
| Fee revenue | Billable hours by role | Bill rate by role |
| Delivery cost | Headcount by role | Fully loaded cost per head |
| Media revenue | Media spend under management | Commission % (or fee, if net) |
| Payroll | Headcount, timing, merit date | Salary, burden % |
| T&E | Headcount, travel policy | Cost per trip, trips per head |
| Software | Seats | Cost per seat |

Rules:

- **Every number is either a driver, a rate, or derived.** No hardcoded outputs. If you cannot classify a cell, the model is wrong.
- **Drivers are shared.** Headcount appears once and feeds payroll, benefits, T&E, software, and facilities. Duplicated headcount assumptions diverge within one cycle, guaranteed.
- **Rates are effective-dated.** Merit increases, promotions, benefit renewals, and rate card changes all land on specific dates and must not be smeared across the year.
- **Separate volume effect from rate effect** in every output. You will be asked which one moved.

## Forecast vintages: never overwrite

This is the most commonly violated rule in FP&A tooling and it destroys the ability to learn.

```
forecast(id, vintage_date, scenario, version, entity, period, account, dimension..., amount, currency)
```

- **Every forecast run is a new vintage**, immutable once published. The February forecast for Q4 must still be retrievable in December.
- **Forecast accuracy** is measured by comparing vintages to actuals. If you overwrite, you cannot measure, and you will repeat the same bias forever.
- **Budget is a locked vintage** with a distinct label, approved and frozen. Reforecasts do not modify the budget.
- **Label the scenario** (base, upside, downside, named event) as a first-class column, never a filename suffix.
- **Preserve the assumptions with the vintage**, not just the outputs. A forecast without its driver set cannot be diagnosed later.

## Variance analysis

**Bridge, do not report deltas.** "Revenue was $2.1M under" is not analysis. Decompose:

```
Variance = Volume effect + Rate effect + Mix effect + Timing + FX + One-offs
```

Standard decomposition for a price/volume business:

```
Volume effect = (Actual qty  - Budget qty)  x Budget rate
Rate effect   = (Actual rate - Budget rate) x Actual qty
Mix effect    = residual, isolated explicitly when the portfolio composition shifted
```

Assign the interaction term consistently and state which convention you used. Different conventions produce different splits; the only wrong answer is an unstated one.

Discipline:

- **Bridge must tie exactly** to the total variance. If it does not, you have an unexplained bucket, and it must be shown as such rather than absorbed into "other."
- **Timing versus permanent.** A slipped project is not a lost project. Separating these is most of the value of the analysis.
- **Materiality threshold stated**, both dollar and percent, and set by the user, not chosen by the model.
- **Explain against the right comparator.** Actual vs budget, actual vs latest forecast, and actual vs prior year answer different questions. Label which.
- **FX isolated.** Constant-currency variance and reported variance are different numbers. Show both for multi-currency entities.

## Rolling forecasts

- Fixed horizon (typically 12 or 18 months), re-cut on a cadence, so the planning window never shortens toward year-end.
- **Actuals replace forecast as periods close**, and the boundary is explicit in the data. A row is actual, forecast, or budget; never ambiguous.
- Re-forecast the drivers, not the outputs. If the model requires re-keying outputs, it is not driver-based.
- **Forecast accuracy tracked as a metric.** Mean absolute percentage error by vintage horizon (1-month-out, 3-month-out) reveals systematic bias. Most forecasts are optimistic at 3 months and it is measurable.

## Headcount planning

Headcount deserves its own model because it drives 60 to 80% of cost in a services business and because the timing rules are unintuitive.

```
headcount_plan(role_id, level, entity, department,
               start_date, end_date?, fte, status,     -- filled | open | planned | backfill
               salary, burden_pct, effective_from,
               billable_flag, target_utilization)
```

- **Model by person or requisition, not by aggregate FTE.** Aggregates cannot express start-date timing, and start-date timing is where the cost variance lives.
- **Partial-period cost is the default**, not a rounding detail. A May 15 start is not a full month, and a full-year salary divided by 12 is wrong for both the start month and the annual total.
- **Backfills, open reqs, and planned hires are distinct statuses** with different probabilities. Applying a hiring-lag or fill-rate assumption to planned roles is legitimate; applying it to filled roles is not.
- **Burden is a rate, effective-dated**, covering employer taxes (with wage-base caps that make the rate non-linear across the year), benefits, and any statutory costs. A flat annual burden percentage misstates Q1 versus Q4 in jurisdictions with wage caps.
- **Merit and promotion cycles** land on a date. Model the date.
- **Attrition** modeled explicitly if material, with a stated rate and replacement lag.
- **Billable headcount links to the revenue model** through utilization. Changing headcount must flow to capacity, and capacity must constrain revenue. A forecast where revenue grows without the heads to deliver it is a fiction that survives only until it does not.

## Capacity and revenue coupling

```
Capacity hours      = FTE x annual billable hours per FTE
Deliverable revenue = min(demand, capacity) x effective rate
```

**Annual billable hours per FTE defaults to 1,800**, never 2,080. State the figure you used and invite a correction. Prefer actuals per role over the default: seniors bill materially fewer hours than juniors, so a single firm-wide number both overstates senior capacity and understates the cost of senior time. See `commercial-finance.md` for ranges by sector.

Surface the constraint. If forecast revenue exceeds capacity, the model must say so rather than silently assuming infinite delivery. This is the check that separates a plan from a wish.

## Model construction rules

- **One number, one place.** Any figure appearing twice will eventually disagree with itself.
- **Inputs, calculations, and outputs physically separated.** In a spreadsheet, separate tabs and colour convention. In code, separate modules with a typed assumptions object.
- **No hardcoded values inside formulas.** Ever. A growth rate typed into a formula is invisible and will be missed at reforecast.
- **Every model is reproducible from its inputs.** If rerunning does not reproduce the published output, the model is not a model.
- **Circular references resolved explicitly** (interest on average debt, bonus on profit including bonus). Use a documented iteration with a convergence check and a maximum iteration count, never a spreadsheet's iterative calculation flag left on silently.
- **Three-statement models must articulate.** Net income flows to equity, cash flow reconciles to the balance sheet movement, and the balance sheet balances. Assert it. A model that does not tie is producing decorative numbers.
- **Sanity checks as assertions**, not as a review step: balance sheet balances, cash never negative without a facility, headcount never fractional where it should not be, margins within a plausible band, no period with zero revenue and full cost.

## Scenarios

- Scenarios differ by **driver values only**, never by structure. If a scenario needs different logic, it is a different model and should be named as one.
- Name and date every scenario. "Downside" with no date is unusable in three months.
- **Show the bridge between scenarios**, not just endpoints. Base to downside decomposed by driver is the deliverable.
- Retain the scenario set that supported any decision, with the decision date.

## Tier guidance

- One-off scenario or ad hoc variance question: **Tier 0**. Reconcile actuals to the GL, state drivers and period, keep the file.
- Monthly reporting pack or the standing rolling forecast: **Tier 1**. Reproducible, pinned source data, vintages preserved, refresh idempotent.
- A planning system others input to: **Tier 2P**.

## Common defects to check for

- Forecast overwritten instead of versioned, destroying accuracy measurement
- Growth applied to output lines rather than drivers
- Headcount modeled as aggregate FTE, hiding start-date timing
- Annual salary divided by 12 with no partial-period handling
- Flat burden rate ignoring wage-base caps
- Variance reported as a delta with no volume/rate/mix bridge
- Bridge that does not tie, with the residual hidden in "other"
- Actual, forecast, and budget rows mixed without a distinguishing flag
- Revenue forecast exceeding delivery capacity with no constraint surfaced
- Constant-currency and reported variance conflated
- Circular reference resolved by a spreadsheet iteration flag nobody documented
- Three-statement model that does not actually tie
