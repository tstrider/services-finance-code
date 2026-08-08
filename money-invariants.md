# Money Invariants

Mechanics, with code. Prefer `helpers/money.py` over reimplementing any of this.

## Decimal, never float

```python
from decimal import Decimal, ROUND_HALF_UP, getcontext

# WRONG - silent corruption
total = 0.1 + 0.2                      # 0.30000000000000004
rate  = 0.07

# RIGHT - construct from string or int, never from float
amount = Decimal("1234.56")
rate   = Decimal("0.07")

# WRONG - float contaminates the Decimal
bad = Decimal(0.1)                     # Decimal('0.1000000000000000055511151231257827')

# RIGHT
good = Decimal("0.1")
```

Set precision high enough for intermediate work; precision is not the same as scale.

```python
getcontext().prec = 28   # significant digits for intermediates, not display scale
```

**SQL**: `DECIMAL(18,4)` or `NUMERIC(18,4)` for amounts, wider scale for rates. Never `FLOAT`, `REAL`, or `DOUBLE PRECISION`. In warehouses, watch for implicit float casts in aggregate functions and in JSON extraction.

**Pandas**: `float64` is the default and it is wrong for money. Either use `Decimal` in an `object` column (slow but correct), or work in integer minor units, or accept float only for Tier 0 exploration with an explicit reconciliation to a Decimal control total. State which you did.

**JSON and APIs**: numbers in JSON are floats. Serialize money as a string, or as an integer count of minor units. Never as a JSON number.

## Rounding: declared, not defaulted

```python
from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN

amount = Decimal("2.675")

amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)    # 2.68  invoices, tax
amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)  # 2.68  statistical, Python default
```

- **ROUND_HALF_UP** is what most people mean by "round," and what invoices and tax generally expect.
- **ROUND_HALF_EVEN** (banker's rounding) is Python's `Decimal` default and reduces cumulative bias across many roundings. It is often correct for large-population aggregation, and often wrong for a single invoice line.
- The mode must be a stated decision, not an accident of the language default.

**Round once.** Compute at full precision, round at the point the number becomes an obligation or a display value.

```python
# WRONG - rounds each line then sums, drifting from the true total
total = sum(round2(qty * rate) for qty, rate in lines)

# RIGHT - sum at precision, round the result, then allocate back if line detail is needed
total = round2(sum(qty * rate for qty, rate in lines))
```

If both the lines and the total must be presented and must agree, allocate (below) rather than rounding twice.

## Minor units

Do not hardcode 2 decimals.

| Currency | Minor units |
|---|---|
| USD, EUR, GBP, CAD, AUD | 2 |
| JPY, KRW | 0 |
| BHD, KWD, JOD, TND | 3 |

Use a currency table (ISO 4217 exponent) rather than an assumption. If storing integer minor units, the currency must travel with the integer or the value is meaningless.

## Allocation: parts must sum to the whole

The naive approach leaks pennies.

```python
# WRONG - rounded parts do not sum to the total
def split_bad(total, weights):
    s = sum(weights)
    return [round2(total * w / s) for w in weights]

split_bad(Decimal("100.00"), [1, 1, 1])   # [33.33, 33.33, 33.33] -> 99.99, one cent lost
```

Largest-remainder method, which is exhaustive by construction:

```python
def allocate(total: Decimal, weights: list[Decimal], exponent: str = "0.01") -> list[Decimal]:
    """Split total across weights so the parts sum exactly to total.

    Rounding remainder goes to the largest fractional parts first, which is
    the conventional and defensible treatment. Deterministic for equal
    remainders (earlier index wins), so results are reproducible.
    """
    if not weights:
        raise ValueError("weights must not be empty")
    q = Decimal(exponent)
    weight_total = sum(weights)
    if weight_total <= 0:
        raise ValueError("weights must sum to a positive value")

    raw = [total * w / weight_total for w in weights]
    floored = [r.quantize(q, rounding=ROUND_DOWN) for r in raw]
    remainder = total - sum(floored)

    steps = int((remainder / q).to_integral_value(rounding=ROUND_HALF_UP))
    order = sorted(range(len(raw)), key=lambda i: (-(raw[i] - floored[i]), i))
    for i in order[:steps]:
        floored[i] += q

    assert sum(floored) == total, f"allocation lost {total - sum(floored)}"
    return floored
```

Use this for cost allocation, revenue allocation across performance obligations, discount spreading, intercompany splits, and tax apportionment. **Always assert the sum.**

## FX

```
Rate type      Used for                            ASC 830 posture
spot           a specific transaction              at transaction date
average        P&L / income statement translation  period average
closing         balance sheet translation           period-end rate
historical     equity, some non-monetary items     rate at original transaction
```

Rules:

- **Store the rate used**, not just the converted amount. Reconstruction is impossible otherwise.
- **Rate date and rate type are part of the record.** `amount_usd` alone is unauditable.
- **Direction is explicit.** Is the rate USD-per-EUR or EUR-per-USD? Name the column so it cannot be misread: `usd_per_eur`, not `fx_rate`.
- **Never average an average.** Reaggregating monthly average rates into a quarter requires weighting by the underlying flows, not a simple mean.
- **Translation versus remeasurement** are different operations with different P&L consequences. Do not conflate.
- **CTA (cumulative translation adjustment)** is a real balance and a common plug when someone gets this wrong. If your balance sheet only balances because of an unexplained CTA movement, you have a bug.

```python
def convert(amount: Decimal, rate: Decimal, exponent: str = "0.01") -> Decimal:
    """Convert using an explicitly directional rate. Round once, at the end."""
    return (amount * rate).quantize(Decimal(exponent), rounding=ROUND_HALF_UP)
```

## Sign conventions

Pick one, state it, convert at the boundary.

- **Ledger convention**: debits positive, credits negative (or the reverse). Whatever the ERP does, match it in the staging layer and convert once.
- **Reporting convention**: expenses positive in a P&L pack, negative in a cash flow bridge. Both are common and they meet in the middle of every consolidation.
- **Contra accounts** (accumulated depreciation, allowance for doubtful accounts, sales returns) carry the opposite sign of their section. Handle explicitly.

Assert on load: if an account class should never be negative in your convention, check it.

## Percentages and rates

- Store as decimals with adequate scale: `Decimal("0.0725")`, not `7.25`.
- Do not round rates to 2 places. A 0.1% fee on $10M is $10,000.
- Basis points where the domain uses them, and label the unit in the column name (`fee_bps`, `margin_pct`).
- Growth rates compound; do not average them arithmetically across periods. Use the geometric mean or derive from endpoints.

## Nulls

- A missing forecast is not zero. A vendor with no invoices is not $0.
- `COALESCE(x, 0)` in a finance query is a decision, not a default. Justify it or find the missing record.
- `SUM()` ignores NULL, `+` propagates it. In SQL, `100 + NULL` is NULL but `SUM` over a column containing NULL returns the sum of the non-nulls. Know which behavior you are relying on.
- Left joins introduce NULLs. Assert on unmatched counts rather than coalescing them away.

## Dates

- Store dates as dates, not strings, and not timestamps unless the time matters.
- Timezone: financial dates are usually date-only business facts. A `TIMESTAMP` with a timezone conversion can shift a transaction into the prior period. This is a real month-end bug.
- Service date, invoice date, posting date, due date, and payment date are five different dates. Name them precisely and never reuse one for another.

## Quick assertion set to include in any money pipeline

```python
assert_balanced(entries)                       # debits == credits
assert sum(allocated) == total                 # allocation is exhaustive
assert rows_out == rows_in - rows_excluded     # no silent drops
assert control_total_out == control_total_in - excluded_total
assert all(isinstance(a, Decimal) for a in amounts)
assert currencies == {expected}                # no accidental mixed-currency sum
```
