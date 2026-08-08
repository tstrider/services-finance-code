# Finance Data Modeling

## Grain first

Before writing any query or table, state the grain in one sentence: "one row per invoice line per period per currency."

Most finance data bugs are grain bugs. Summing a header amount after joining to lines, aggregating an already-allocated column, or joining two fact tables at different grains all produce numbers that look plausible and are wrong.

**Rule**: a join that changes the row count of a fact table is a bug until proven otherwise. Assert row counts across every join.

## Chart of accounts and dimensions

Modern ERPs are dimensional, not segment-string based. Model it that way even if the source concatenates.

```
account(id, code, name, type, class, normal_balance, is_contra, parent_id, active_from, active_to)
-- type:  asset | liability | equity | revenue | expense
-- class: natural category (compensation, media, software, travel, depreciation...)
```

**Carry natural category as a dimension, separately from functional caption.** This matters now for management reporting and it matters more for ASU 2024-03 (DISE), which requires expense disaggregation by natural category within functional captions. A chart of accounts that encodes only one of the two cannot produce the disclosure without a rebuild. If the entity is or may become a public business entity, build both in from the start.

Standard dimensions to carry as columns, never as a parsed string at query time:

```
entity / subsidiary / company code
department / cost center
location
project / job / scope
client / customer
vendor
employee
product / service line
channel
intercompany partner
```

**Never parse a concatenated account string in the reporting layer.** Split it once in staging and carry columns. Concatenations change format, and every downstream query then breaks silently.

## Hierarchies

- **Store hierarchies as edges with effective dates**, not as fixed levels. `parent_id` with `effective_from`/`effective_to`, not `level_1`, `level_2`, `level_3`.
- Fixed-level columns break the first time someone adds a management layer, and reorganizations happen every year.
- **Reorganizations are the hard case.** Prior-period reporting under the current hierarchy and under the then-current hierarchy are both legitimate and different. Support both, and label which you used. This is the single most common source of "the numbers changed" complaints after a reorg.
- Roll-ups computed from the edge table, with a cycle check.

## Effective dating and slowly-changing dimensions

Any reference data that changes over time and affects historical calculations needs versioning:

- Rate cards and bill rates
- Salary and burden rates
- FX rates
- Org hierarchy and cost center mapping
- Account mappings
- Allocation rules and drivers
- Tax rates
- Vendor and customer master attributes

**Type 2 pattern:**

```
rate(entity_key, attribute..., value,
     effective_from, effective_to,      -- effective_to null or 9999-12-31 for current
     is_current, version, changed_by, changed_at, reason)
```

Retrieval is **always by service date**, never by current date:

```sql
-- WRONG: bills historical work at today's rate
JOIN rate r ON r.role_id = t.role_id AND r.is_current

-- RIGHT
JOIN rate r ON r.role_id = t.role_id
           AND t.service_date >= r.effective_from
           AND t.service_date <  COALESCE(r.effective_to, DATE '9999-12-31')
```

Enforce non-overlapping, gapless ranges with a constraint or a test. Overlapping versions produce duplicate rows and inflated totals; gaps produce silent NULLs.

## Period and calendar

```
period(id, fiscal_year, fiscal_quarter, fiscal_period,
       start_date, end_date, weeks,             -- 4-4-5 support
       status,                                  -- open | closed | locked | adjusting
       closed_at, closed_by)
```

- Fiscal years that do not start in January, 4-4-5 / 4-5-4 retail calendars, and 53-week years all break naive date logic. Use a period table, never date arithmetic.
- **Adjusting periods** (period 13) exist in many ERPs and are excluded or included depending on the question. Be explicit.
- Period status is checked before any write.

## Fact table conventions

```
gl_transaction(
  id, source_system, source_id,            -- lineage
  posting_date, service_date, document_date,
  period_id, entity_id, account_id,
  <dimension columns>,
  amount_txn, currency_txn,                -- transaction currency
  amount_func, currency_func, fx_rate_func, fx_rate_type, fx_rate_date,
  amount_rept, currency_rept, fx_rate_rept,
  debit_credit, is_reversal, reverses_id,
  run_id, logic_version, loaded_at
)
```

- **Three currency layers**: transaction, functional (entity), reporting (group). Store all three plus the rates used. Reconstructing a conversion later without the stored rate is impossible.
- **Lineage columns are mandatory**: source system, source ID, run ID, logic version, load timestamp. When someone asks where a number came from eighteen months later, the answer must be in the data.
- **Reversals are rows**, linked to what they reverse. Never an update, never a delete.
- Separate the five dates. Do not reuse one for another.

## Actual, budget, forecast

One table with a scenario dimension, or separate tables, but **never mixed rows without a distinguishing flag.**

```
financial_fact(period_id, entity_id, account_id, <dims>,
               scenario,        -- actual | budget | forecast
               vintage_date,    -- null for actual; the forecast run date otherwise
               version,
               amount, currency)
```

- Actuals have no vintage. Forecasts always do.
- **Never overwrite a forecast vintage.** See `fpna.md`.
- Budget is a locked vintage with its own label and approval record.

## Allocations

Allocated data is derived. Keep it separate from source.

```
allocation_rule(id, name, basis, driver, effective_from, effective_to, version)
allocation_result(rule_id, run_id, period_id, from_dim..., to_dim..., amount, driver_value)
```

- Store the rule version and driver values with the result. "Why did overhead allocation change" is unanswerable otherwise.
- Allocations must be exhaustive: allocated amounts sum to the source pool. Assert it.
- Never allocate allocated amounts without an explicit, documented cascade order. Circular allocations need an iterative solve with a convergence check.

## Warehouse layering

```
raw / landing    exact source copy, immutable, timestamped, never transformed
staging          typed, deduplicated, conformed, dimensions split out
core             modeled facts and dimensions, business logic applied once
marts            function-specific views (FP&A, AP, Commercial)
```

- **Business logic lives in core, once.** If margin is calculated in three marts, the three will disagree within a quarter.
- Raw is never modified. Reprocessing history means replaying from raw.
- Every layer carries lineage forward.

## Naming

- Amount columns carry currency and basis: `revenue_usd_accrual`, not `revenue`.
- Rates carry direction and unit: `usd_per_eur`, `fee_bps`, `margin_pct`.
- Dates carry meaning: `service_date`, `posting_date`, `invoice_date`, `due_date`, `paid_date`.
- Flags read as questions: `is_reversal`, `is_intercompany`, `is_billable`.
- Never a column named `date`, `amount`, `value`, or `type` in a finance model.

## Data quality tests to stand up

```
unique:        (source_system, source_id) on every fact
not_null:      period, entity, account, amount, currency
accepted:      currency in ISO 4217; account_type in enum; scenario in enum
relationships: every dimension key resolves
balanced:      sum(debit) == sum(credit) per entity per period
non_overlap:   effective-dated ranges do not overlap or gap
recon:         core totals tie to the source system's own report per period
freshness:     loaded_at within expected SLA
row_count:     no unexplained period-over-period swing beyond a threshold
```

Run these on every load. A pipeline without a period-level tie-out to the source system is not finished.
