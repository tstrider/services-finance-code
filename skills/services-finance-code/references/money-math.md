# Money Math

How to keep arithmetic on money exact. Use `scripts/money.py` rather than rewriting any of this; it is tested and has no dependencies.

## Decimal, never float

```python
from decimal import Decimal

0.1 + 0.2                   # 0.30000000000000004  (float: wrong)
Decimal("0.1") + Decimal("0.2")   # Decimal('0.3')  (right)

Decimal(0.1)                # Decimal('0.1000000000000000055511151231257827')  (float leaked in)
Decimal("0.1")              # Decimal('0.1')  (right: build from a string)
```

`to_decimal()` in `scripts/money.py` refuses floats, bools, NaN, infinity, and text with thousands separators, so bad input fails loudly at the edge.

Precision and scale are different things. `getcontext().prec` (default 28 significant digits) controls intermediate math. The currency's minor unit controls the final rounding.

### Where floats sneak in

- **pandas:** `float64` is the default and it is wrong for money. Options, best first: keep integer minor units (cents) in an `Int64` column with the currency in another column; keep `Decimal` objects in an `object` column (slower, exact); or, at Tier 0 only, use float for exploration and tie the result to a Decimal control total. Say which you did.
- **`read_csv` and `read_excel`:** both parse amounts as floats. Pass `dtype={"amount": str}` (or `converters`) and convert with `to_decimal()`.
- **Excel files:** Excel stores numbers as binary floats. Round to the minor unit on the way in, on purpose, and tie to the file's own totals.
- **JSON and APIs:** JSON numbers are parsed as floats by most libraries. Send and receive money as strings, or as integer minor units. In Python, `json.loads(text, parse_float=Decimal)` keeps incoming numbers exact.
- **SQL:** `NUMERIC(18,4)` or `DECIMAL(18,4)` for amounts; wider scale for rates. Never `FLOAT`, `REAL`, or `DOUBLE PRECISION`. Watch for averages and JSON extraction quietly returning floats.
- **SQLite** has no true decimal type. Store integer minor units, or text, and convert in code.

## Rounding: declared, never defaulted

```python
from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN

Decimal("2.665").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)    # 2.67
Decimal("2.665").quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)  # 2.66
```

- **Half up** is what most people mean by "round" and what most invoices expect.
- **Half even** (banker's rounding) is Python's `Decimal` default and reduces bias across many roundings. Useful for large statistical totals, usually wrong for a single invoice line.
- Tax authorities and contracts sometimes set the rule (per line or per invoice, which mode). Follow them and cite them.

**Round once,** where the number becomes an obligation or a displayed figure.

```python
# WRONG: rounds each line, then adds. Three lines of 0.005 give 0.03; the truth is 0.02.
total = sum(quantize_money(q * r, "USD") for q, r in lines)

# RIGHT: add at full precision, round the result.
total = quantize_money(sum(q * r for q, r in lines), "USD")
```

If the lines and the total must both be shown and must agree, round the total, then `allocate()` it back to the lines.

## Minor units

| Currency | Decimals |
|---|---|
| USD, EUR, GBP, CAD, AUD | 2 |
| JPY, KRW | 0 |
| BHD, KWD, JOD, OMR, TND | 3 |

Use `minor_unit_exponent()`, never an assumed 2. If you store integer minor units, the currency must travel with the integer, or the number means nothing.

## Allocation: the parts add back to the whole

Naive splitting loses cents:

```python
# WRONG: 33.33 + 33.33 + 33.33 = 99.99. A cent vanished.
[round(Decimal("100.00") * w / 3, 2) for w in (1, 1, 1)]
```

Use `allocate(total, weights, currency)`. It uses the largest-remainder method: truncate each share, then hand the leftover cents to the shares with the largest remainders, ties broken by position so every run gives the same answer. It asserts the parts sum to the total and handles negative totals.

Use it for overhead allocation, splitting a contract price across obligations, spreading a discount across lines, intercompany splits, and splitting a retainer across months. **Always assert the sum.**

## FX

| Rate type | Used for |
|---|---|
| spot | A single transaction, on its date |
| average | Income statement translation for a period |
| closing | Balance sheet translation at period end |
| historical | Equity and some non-monetary items |

- **Store the rate, the rate type, and the rate date** next to every converted amount. `amount_usd` alone cannot be audited.
- **Name the direction:** `usd_per_eur`, never `fx_rate`. `convert_fx()` requires from and to currencies so direction cannot be misread.
- **Never average an average.** Turning monthly average rates into a quarterly rate needs weighting by the underlying flows.
- **Translation and remeasurement** are different operations with different P&L effects. Do not mix them up.
- If the balance sheet only balances because the translation adjustment (CTA) absorbed an unexplained amount, there is a bug.

## Signs

Pick one convention, write it down, and convert once at the edge.

- **Ledger:** debits positive and credits negative, or the reverse. Match the accounting system in staging and convert once.
- **Reporting:** expenses positive in a P&L pack, negative in a cash bridge. Both are common.
- **Contra accounts** (accumulated depreciation, allowance for doubtful accounts, discounts) carry the opposite sign of their section.

Assert on load: if an account class should never be negative in your convention, check it.

## Percentages and rates

- Store as decimals with enough scale: `Decimal("0.0725")`, not `7.25`.
- Never round a rate to 2 places. A 0.1% fee on $10M is $10,000.
- Put the unit in the name: `fee_bps`, `margin_pct`, `utilization_ratio`.
- Growth rates compound. Never average them arithmetically; use the geometric mean or the endpoints.

## Blank is not zero

- A missing forecast is not zero. A client with no invoices is not a $0 client; it may be a missing mapping.
- `COALESCE(x, 0)` is a decision. Justify it in a comment, or find the missing record.
- In SQL, `SUM` skips NULLs but `+` returns NULL. Know which you rely on.
- Left joins create NULLs. Count them and assert, rather than coalescing them away.

## Dates

- Store dates as dates, not text, and not timestamps unless time matters.
- A timestamp converted across time zones can move a transaction into the prior period. This is a real month-end bug.
- **Service, invoice, posting, due, and payment dates are five different fields.** Name them precisely. Never reuse one for another.

## Assertions for any money pipeline

```python
from money import Reconciliation, assert_balanced, assert_single_currency

assert_balanced(debits, credits, label="batch 2026-07")      # debits equal credits
assert sum(parts) == total                                   # allocations add back
assert_single_currency(currencies, label="revenue by client") # no silent mixing
recon = Reconciliation(source=..., rows_in=..., rows_out=..., rows_excluded=...,
                       total_in=..., total_out=..., total_excluded=..., currency="USD")
recon.check()                                                # no dropped rows, no unexplained delta
print(recon.report())                                        # the tie-out block for the report
```
