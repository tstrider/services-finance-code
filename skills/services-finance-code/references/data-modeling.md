# Finance Data Modeling

## Grain first

Before any query or table, state the grain in one sentence: "one row per time entry per person per service date."

Most finance data bugs are grain bugs: summing an invoice header amount after joining to its lines, summing an already-allocated column, or joining two fact tables at different grains. All of them produce believable wrong numbers.

**A join that changes the row count of a fact table is a bug until proven otherwise.** Count rows before and after every join.

## Core tables for a services firm

```
client(id, name, segment, currency, status, effective_from, effective_to)
scope(id, client_id, name, pricing_structure, fee, currency,     -- time_and_materials | fixed_fee | retainer | ...
      start_date, end_date, rate_card_id, revenue_presentation, status)
person(id, role_id, level, department, entity_id, fte, start_date, end_date, billable_flag)
time_entry(id, person_id, scope_id, service_date, entered_at, hours,
           billable_status, note_masked?)                         -- billable | non_billable | written_off
rate_card_line(rate_card_id, role_id, level, bill_rate, effective_from, effective_to)
cost_rate(person_id | role_id, loaded_annual_cost, annual_billable_hours, effective_from, effective_to)
```

- `entered_at` is kept alongside `service_date` so late time is visible and cut-offs can be applied.
- Pay by person is sensitive. Keep `cost_rate` at role level where the analysis allows, and restrict access where it must be by person.

## Chart of accounts and dimensions

Model dimensions as columns, even if the source packs them into one account string.

```
account(id, code, name, type, natural_category, normal_balance, is_contra, parent_id,
        active_from, active_to)
-- type:             asset | liability | equity | revenue | expense
-- natural_category: compensation, contractors, software, travel, rent, depreciation, ...
```

Carry the **natural category** (what was bought) separately from the **function** (delivery, sales, admin). Management reporting needs both, and public-company rules increasingly require the split.

Dimensions to carry as columns, never parsed at query time:

```
entity | department or cost center | office | client | scope or project
person | vendor | service line | intercompany partner
```

**Never parse a combined account string in the reporting layer.** Split it once in staging. String formats change, and every downstream query then breaks quietly.

Small-firm note: QuickBooks and Xero have few built-in dimensions (classes and locations, or tracking categories). Firms often encode client or service line in account names or memo text. Map these to real columns once, in staging, with a mapping table a human maintains, and report unmapped rows.

## Hierarchies

- **Store hierarchies as parent links with effective dates,** not as fixed level columns (`level_1`, `level_2`). Fixed levels break the first time a layer is added.
- **Reorganizations are the hard case.** Prior periods under today's hierarchy and under the hierarchy of the time are both valid and different. Support both, and label which you used. This is the usual source of "the numbers changed" after a reorg.
- Build roll-ups from the parent links, with a cycle check.

## Effective dating

Reference data that changes over time and affects past calculations needs versions:

- Rate cards and bill rates
- Cost rates, salaries, and benefit rates
- FX rates
- Department, office, and cost center mappings
- Account mappings
- Allocation rules
- Tax rates
- Client and vendor attributes (including revenue presentation)

```
versioned_rate(key..., value,
               effective_from, effective_to,     -- effective_to NULL for the current version
               version, changed_by, changed_at, reason)
```

Look up **by service date**, never by today's date or an `is_current` flag:

```sql
-- WRONG: bills last year's work at today's rate
JOIN rate_card_line r ON r.role_id = t.role_id AND r.is_current

-- RIGHT
JOIN rate_card_line r
  ON r.role_id = t.role_id
 AND t.service_date >= r.effective_from
 AND t.service_date <  COALESCE(r.effective_to, DATE '9999-12-31')
```

Enforce no overlaps and no gaps between versions, with a constraint or a test. Overlaps create duplicate rows and inflated totals. Gaps create silent NULLs.

## Periods and calendars

```
period(id, fiscal_year, fiscal_quarter, fiscal_period, start_date, end_date,
       status, closed_at, closed_by)        -- status: open | closed | locked | adjusting
```

- Fiscal years that do not start in January, 4-4-5 calendars, and 53-week years all break date arithmetic. Use a period table.
- Adjusting periods (period 13) exist in some systems. Say whether you included them.
- Check period status before any write.

## Transactions

```
ledger_line(
  id, source_system, source_id,                   -- lineage
  posting_date, service_date, document_date,
  period_id, entity_id, account_id, <dimension columns>,
  amount_txn, currency_txn,                       -- transaction currency
  amount_func, currency_func, fx_rate_func, fx_rate_type, fx_rate_date,
  debit_credit, is_reversal, reverses_id,
  run_id, logic_version, loaded_at
)
```

- **Store every currency layer you use and the rates behind it.** A conversion cannot be rebuilt later without the stored rate.
- **Lineage columns are mandatory:** source system, source ID, run ID, logic version, load time. "Where did this number come from?" must be answerable from the data 18 months later.
- **Reversals are rows,** linked to what they reverse. Never an update or delete.
- Keep the five dates separate.

## Actual, budget, forecast

One table with a scenario column, or separate tables, but **never mixed rows without a flag.**

```
financial_fact(period_id, entity_id, account_id, <dims>,
               scenario,         -- actual | budget | forecast
               vintage_date,     -- NULL for actuals; the forecast run date otherwise
               version, amount, currency)
```

Never overwrite a forecast vintage. See `fpna.md`.

## Allocations

Allocated data is derived. Keep it apart from source data.

```
allocation_rule(id, name, basis, driver, effective_from, effective_to, version)
allocation_result(rule_id, run_id, period_id, from_dims..., to_dims..., amount, driver_value)
```

- Store the rule version and driver values with every result.
- Allocations add back to the pool exactly. Assert it.
- Never allocate allocated amounts without a documented order. Circular allocations need an iterative solve with a convergence check.

## Layers

```
raw        exact copy of the source, timestamped, never changed
staging    typed, deduplicated, dimensions split into columns
core       facts and dimensions with business logic applied once
reports    views for each audience (margin, WIP, FP&A)
```

For a small firm this can be four folders of files, or four schemas in one database. The idea matters more than the tooling.

- **Business logic lives in one place.** If margin is calculated in three reports, they will disagree within a quarter.
- Raw never changes. Reprocessing history means replaying from raw.

## Naming

- Amounts carry currency and basis: `revenue_usd_accrual`, not `revenue`.
- Rates carry direction and unit: `usd_per_eur`, `fee_bps`, `margin_pct`.
- Dates carry meaning: `service_date`, `posting_date`, `invoice_date`, `due_date`, `paid_date`.
- Flags read as questions: `is_reversal`, `is_intercompany`, `is_billable`.
- Never a column named `date`, `amount`, `value`, or `type`.

## Data tests to run on every load

```
unique:        (source_system, source_id) on every fact
not_null:      period, entity, account, amount, currency
accepted:      currency is ISO 4217; scenario and status in their lists
relationships: every dimension key resolves (or is counted as unmapped)
balanced:      debits equal credits per entity per period
non_overlap:   effective-dated ranges have no overlaps or gaps
tie_out:       core totals tie to the source system's own report per period
freshness:     loaded_at within the expected window
row_count:     no unexplained swing versus the prior period
```
