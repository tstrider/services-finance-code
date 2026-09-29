# FP&A

Budgets, rolling forecasts, headcount and capacity, variance, and scenarios for a services firm.

## Build on drivers, not on last year plus 4%

A model that grows last year by a percentage cannot answer any question worth asking. Build every forecast as:

```
Output = Driver x Rate
```

| Output | Driver | Rate |
|---|---|---|
| Fee revenue | Billable hours by role | Bill rate by role, by date |
| Delivery cost | Headcount by role | Fully loaded cost per person |
| Commission revenue | Third-party spend managed | Commission % or fee |
| Payroll | Headcount, start dates, raise dates | Salary, employer tax and benefit rates |
| Travel | Headcount, travel policy | Trips per person, cost per trip |
| Software | Seats | Cost per seat |

Rules:

- **Every number is a driver, a rate, or derived.** No typed-in outputs. If you cannot classify a cell, the model is wrong.
- **Drivers are shared.** Headcount appears once and feeds payroll, benefits, travel, software, and space. Two copies of headcount will disagree within one cycle.
- **Rates are dated.** Raises, promotions, benefit renewals, and rate card changes land on specific dates. Never spread them evenly across the year.
- **Separate volume from rate** in every output. You will be asked which one moved.

## Never overwrite a forecast

Overwriting forecasts is the most common FP&A tooling mistake, and it destroys the ability to learn.

```
forecast(id, vintage_date, scenario, version, entity, period, account, <dims>, amount, currency)
```

- **Every forecast run is a new vintage,** frozen once published. The February forecast of Q4 must still exist in December.
- **Forecast accuracy** comes from comparing vintages to actuals. Overwrite, and the same bias repeats forever.
- **The budget is a locked vintage** with its own label and approval. Reforecasts never change it.
- **Scenario is a column** (base, upside, downside, a named event), never a filename suffix.
- **Keep the assumptions with the vintage,** not just the outputs.

## Headcount and capacity

Headcount drives most of a services firm's cost, and its timing rules are not intuitive.

```
headcount_plan(person_or_req_id, role_id, level, entity, department,
               start_date, end_date?, fte, status,        -- filled | open | planned | backfill
               salary, effective_from, billable_flag, target_utilization)
```

- **Model by person or open role, not by total FTE.** Totals cannot express start dates, and start dates are where the cost variance lives.
- **Partial periods are the default.** A May 15 start is not a full month. Annual salary divided by 12 is wrong for the start month and for the year.
- **Filled, open, planned, and backfill are different statuses** with different odds. A hiring-lag assumption applies to planned roles, never to filled ones.
- **Employer tax is not a flat rate across the year.** Wage-base caps (for example US Social Security and unemployment taxes) make the effective rate fall as the year goes on. A flat annual percentage overstates Q4 and understates Q1.
- **Raise and promotion dates** are modeled on the date.
- **Attrition,** when material, has a stated rate and a replacement lag.

### Capacity limits revenue

```
Capacity hours         = FTE x annual billable hours per FTE
Deliverable fee revenue = min(demand hours, capacity hours) x effective rate
```

**Annual billable hours per FTE defaults to 1,800, never 2,080.** State it and invite a correction. Prefer actual billable hours by role; seniors bill fewer hours than juniors.

If forecast revenue needs more hours than the team has, say so. A forecast where revenue grows without the people to deliver it is a wish, not a plan.

## Variance: bridge it, don't just report it

"Revenue was $2.1M under budget" is not analysis. Break it down:

```
Variance = Volume + Rate + Mix + Timing + FX + One-offs
```

For fee revenue:

```
Volume effect = (Actual hours - Budget hours) x Budget rate
Rate effect   = (Actual rate  - Budget rate)  x Actual hours
Mix effect    = shown on its own when the role or client mix shifted
```

Where the interaction term goes is a convention. State which you used; the only wrong answer is an unstated one.

- **The bridge ties exactly** to the total variance. Anything left over is shown as unexplained, never hidden in "other".
- **Timing versus permanent.** A slipped project is not a lost project.
- **Materiality thresholds** (dollar and percent) are set by the user, not by the model.
- **Name the comparison:** actual vs budget, actual vs latest forecast, or actual vs prior year. They answer different questions.
- **Isolate FX.** Constant-currency and reported variance are different numbers.

## Rolling forecasts

- A fixed horizon (often 12 or 18 months), re-cut on a schedule.
- **Actuals replace forecast as periods close,** and every row is clearly actual, forecast, or budget.
- Reforecast the drivers, not the outputs.
- **Track accuracy by horizon** (1 month out, 3 months out). Most forecasts are optimistic at 3 months, and it is measurable.

## Model rules

- **One number, one place.**
- **Inputs, calculations, and outputs kept apart.** In code: a typed assumptions object and separate modules. In a spreadsheet: separate tabs.
- **No values typed into formulas.** Ever.
- **Rerunnable.** Rerunning from the saved inputs reproduces the published output, or it is not a model.
- **Circular logic** (bonus on profit that includes bonus) is solved on purpose with a documented iteration, a convergence check, and a maximum number of passes.
- **Three-statement models must tie.** Net income flows to equity, cash flow matches the balance sheet change, the balance sheet balances. Assert it.
- **Sanity checks are assertions:** balance sheet balances, cash never negative without a credit line, no fractional heads where there should not be, margins in a believable band.

## Scenarios

- Scenarios differ by driver values only, never by structure.
- Name and date every scenario.
- Show the bridge between scenarios, not just the endpoints.
- Keep the scenario set behind any decision, with the decision date.

## Tiers

- One-off what-if or variance question: Tier 0. Tie actuals to the ledger, state the drivers and period.
- Monthly pack or standing rolling forecast: Tier 1.
- A planning tool others enter data into: Tier 3.

## Common defects

- Forecast overwritten instead of versioned
- Growth applied to outputs instead of drivers
- Headcount as total FTE, hiding start dates
- Annual salary divided by 12 with no partial periods
- Flat employer tax rate ignoring wage-base caps
- Capacity figured on 2,080 hours
- Revenue forecast larger than delivery capacity, with nothing flagged
- Variance reported as a single delta
- A bridge that does not tie, with the rest hidden in "other"
- Actual, forecast, and budget rows mixed with no flag
- Constant-currency and reported variance mixed up
