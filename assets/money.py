"""Decimal money helpers for services-firm finance code.

Prefer these over rewriting them. Every function raises rather than returning a
silently wrong number, because a wrong number that looks fine is the main
failure in finance code.

Safe to approve for locked-down machines:
- Python standard library only. No third-party packages.
- No network access, no file reads or writes, no subprocesses, no environment
  variables. Pure functions over the values you pass in.
- Python 3.10 or later.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal, InvalidOperation

__all__ = [
    "FeeBurn",
    "MoneyError",
    "Reconciliation",
    "allocate",
    "assert_balanced",
    "assert_single_currency",
    "convert_fx",
    "cost_per_billable_hour",
    "fee_burn",
    "mask",
    "minor_unit_exponent",
    "quantize_money",
    "to_decimal",
]


class MoneyError(ValueError):
    """Raised when a money operation cannot be performed correctly."""


# ISO 4217 minor units that are not 2. Everything unlisted defaults to 2.
# Not exhaustive; extend from an ISO 4217 source for production use.
_NON_STANDARD_EXPONENTS: dict[str, int] = {
    "JPY": 0, "KRW": 0, "VND": 0, "CLP": 0, "ISK": 0, "PYG": 0,
    "RWF": 0, "UGX": 0, "VUV": 0, "XAF": 0, "XOF": 0, "XPF": 0,
    "BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3,
}

_FX_RATE_TYPES = frozenset({"spot", "average", "closing", "historical"})

MoneyInput = Decimal | str | int


def to_decimal(value: object, field: str = "amount") -> Decimal:
    """Coerce to a finite Decimal, refusing float, bool, NaN, and infinity.

    Floats are rejected rather than converted because Decimal(0.1) carries the
    binary representation error into what looks like an exact value.
    """
    if isinstance(value, bool):
        raise MoneyError(f"{field}: refusing a bool {value!r} as a number")
    if isinstance(value, float):
        raise MoneyError(
            f"{field}: refusing to build a Decimal from float {value!r}. "
            "Pass a string or int. Floats cannot represent money exactly."
        )
    if isinstance(value, Decimal):
        result = value
    elif isinstance(value, int):
        result = Decimal(value)
    elif isinstance(value, str):
        try:
            result = Decimal(value.strip())
        except InvalidOperation as exc:
            # Thousands separators are refused, not stripped: "1.234,56" and
            # "1,234.56" mean the same amount in different locales.
            raise MoneyError(
                f"{field}: cannot parse {value!r} as a decimal. "
                "Remove thousands separators and currency symbols first, knowing the locale."
            ) from exc
    else:
        raise MoneyError(f"{field}: unsupported type {type(value).__name__}")
    if not result.is_finite():
        raise MoneyError(f"{field}: {value!r} is not a finite number")
    return result


def _currency_code(currency: str) -> str:
    code = currency.strip().upper() if isinstance(currency, str) else ""
    if len(code) != 3 or not code.isalpha():
        raise MoneyError(f"currency must be a 3-letter ISO 4217 code, got {currency!r}")
    return code


def minor_unit_exponent(currency: str) -> Decimal:
    """Return the rounding unit for a currency, e.g. Decimal('0.01').

    Do not hardcode 2 decimals. JPY has 0, KWD has 3.
    """
    digits = _NON_STANDARD_EXPONENTS.get(_currency_code(currency), 2)
    return Decimal(1).scaleb(-digits)


def quantize_money(
    amount: MoneyInput,
    currency: str,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """Round to the currency's minor unit with an explicit rounding mode.

    ROUND_HALF_UP is the default because it matches what invoices generally
    expect. Pass ROUND_HALF_EVEN explicitly for statistical aggregation where
    cumulative bias matters. Round once, where the number becomes an obligation.
    """
    return to_decimal(amount).quantize(minor_unit_exponent(currency), rounding=rounding)


def allocate(
    total: MoneyInput,
    weights: Sequence[MoneyInput],
    currency: str,
) -> list[Decimal]:
    """Split total across weights so the parts sum exactly to total.

    Largest-remainder method: the leftover cents go to the entries with the
    largest fractional parts, ties broken by position, so results are the same
    on every run. Handles negative totals (credit memos, refunds).

    The total must already be rounded to the currency's minor unit, otherwise
    no set of rounded parts can add back to it.
    """
    total_d = to_decimal(total, "total")
    if not weights:
        raise MoneyError("allocate: weights must not be empty")

    unit = minor_unit_exponent(currency)
    if total_d != total_d.quantize(unit):
        raise MoneyError(
            f"allocate: total {total_d} has more decimals than {currency.upper()} allows. "
            "Round the total first, on purpose, then allocate."
        )

    parsed = [to_decimal(w, f"weights[{i}]") for i, w in enumerate(weights)]
    if any(w < 0 for w in parsed):
        raise MoneyError("allocate: weights must be non-negative")
    weight_total = sum(parsed, Decimal(0))
    if weight_total == 0:
        raise MoneyError("allocate: weights sum to zero, cannot allocate")

    raw = [total_d * w / weight_total for w in parsed]
    # ROUND_DOWN truncates toward zero, so the leftover has the same sign as the total.
    parts = [r.quantize(unit, rounding=ROUND_DOWN) for r in raw]
    leftover_units = int((total_d - sum(parts, Decimal(0))) / unit)

    step = unit if leftover_units >= 0 else -unit
    order = sorted(range(len(raw)), key=lambda i: (-abs(raw[i] - parts[i]), i))
    for i in order[: abs(leftover_units)]:
        parts[i] += step

    if sum(parts, Decimal(0)) != total_d:
        raise MoneyError(
            f"allocate: parts sum to {sum(parts, Decimal(0))}, expected {total_d}. "
            "This is a bug in allocate(), not in your inputs."
        )
    return parts


def convert_fx(
    amount: MoneyInput,
    from_currency: str,
    to_currency: str,
    rate: MoneyInput,
    rate_type: str,
    rate_date: str,
) -> Decimal:
    """Convert an amount with an explicitly directional rate. Rounds once.

    rate is units of to_currency per one unit of from_currency, for example
    USD per EUR when converting EUR to USD. rate_type and rate_date are
    required because a converted amount without them cannot be audited.
    Store all three alongside the result.
    """
    source = _currency_code(from_currency)
    target = _currency_code(to_currency)
    if source == target:
        raise MoneyError(f"convert_fx: from and to are both {source}; nothing to convert")
    if rate_type not in _FX_RATE_TYPES:
        raise MoneyError(f"rate_type must be one of {sorted(_FX_RATE_TYPES)}, got {rate_type!r}")
    try:
        date.fromisoformat(rate_date)
    except (TypeError, ValueError) as exc:
        raise MoneyError(
            f"rate_date must be an ISO date like 2026-07-31, got {rate_date!r}"
        ) from exc

    rate_d = to_decimal(rate, "rate")
    if rate_d <= 0:
        raise MoneyError(f"rate must be positive, got {rate_d}")
    return quantize_money(to_decimal(amount) * rate_d, target)


def cost_per_billable_hour(
    annual_loaded_cost: MoneyInput,
    annual_billable_hours: MoneyInput,
) -> Decimal:
    """Fully loaded cost per billable hour, unrounded.

    annual_loaded_cost is salary plus employer taxes, benefits, and bonus.
    annual_billable_hours has no default on purpose: the caller must pass a
    named, stated assumption (the skill's default is 1,800, never 2,080).
    Round only when the result becomes a price or a reported figure.
    """
    cost = to_decimal(annual_loaded_cost, "annual_loaded_cost")
    hours = to_decimal(annual_billable_hours, "annual_billable_hours")
    if cost < 0:
        raise MoneyError(f"annual_loaded_cost must not be negative, got {cost}")
    if hours <= 0:
        raise MoneyError(f"annual_billable_hours must be positive, got {hours}")
    if hours > 8784:
        raise MoneyError(f"annual_billable_hours {hours} exceeds the hours in a year")
    return cost / hours


@dataclass(frozen=True)
class FeeBurn:
    """Fee burn for a fixed-fee or retainer scope. Ratios, not percentages."""

    burn: Decimal
    elapsed: Decimal
    variance: Decimal

    @property
    def is_ahead_of_calendar(self) -> bool:
        """True when the fee is being used up faster than time is passing."""
        return self.variance > 0


def fee_burn(
    delivered_value: MoneyInput,
    contracted_fee: MoneyInput,
    elapsed_days: int,
    total_days: int,
) -> FeeBurn:
    """Compare how much of a fixed fee is used up against how much time has passed.

    delivered_value is the hours delivered so far, valued at the same rates the
    scope was priced at. Use the same basis as the fee, never cost against fee.
    Burn = delivered_value / contracted_fee. Elapsed = elapsed_days / total_days.
    A positive variance means the fee is burning faster than the calendar.
    """
    delivered = to_decimal(delivered_value, "delivered_value")
    fee = to_decimal(contracted_fee, "contracted_fee")
    if fee <= 0:
        raise MoneyError(f"contracted_fee must be positive, got {fee}")
    if delivered < 0:
        raise MoneyError(f"delivered_value must not be negative, got {delivered}")
    if isinstance(elapsed_days, bool) or isinstance(total_days, bool):
        raise MoneyError("elapsed_days and total_days must be whole numbers of days")
    if total_days <= 0 or not 0 <= elapsed_days <= total_days:
        raise MoneyError(
            f"need 0 <= elapsed_days <= total_days and total_days > 0, "
            f"got {elapsed_days} of {total_days}"
        )
    burn = delivered / fee
    elapsed = Decimal(elapsed_days) / Decimal(total_days)
    return FeeBurn(burn=burn, elapsed=elapsed, variance=burn - elapsed)


def assert_balanced(
    debits: Iterable[MoneyInput],
    credits: Iterable[MoneyInput],
    label: str = "entry",
) -> None:
    """Assert debits equal credits. Call before posting, per entry and per batch."""
    d = sum((to_decimal(x, "debit") for x in debits), Decimal(0))
    c = sum((to_decimal(x, "credit") for x in credits), Decimal(0))
    if d != c:
        raise MoneyError(f"{label} does not balance: debits {d}, credits {c}, delta {d - c}")


def assert_single_currency(currencies: Iterable[str], label: str = "amounts") -> str:
    """Assert a set of amounts share one currency, and return it.

    Guards the most common silent error in multi-entity reporting: adding
    across currencies without converting first. A missing currency is an error.
    """
    codes = list(currencies)
    if not codes:
        raise MoneyError(f"{label}: no currency present")
    if any(not c for c in codes):
        raise MoneyError(f"{label}: at least one amount has no currency")
    distinct = {_currency_code(c) for c in codes}
    if len(distinct) > 1:
        raise MoneyError(
            f"{label}: mixed currencies {sorted(distinct)}. "
            "Convert with an explicit rate, rate type, and rate date before adding."
        )
    return distinct.pop()


def mask(value: object, keep_last: int = 4) -> str:
    """Mask a sensitive identifier for logs, samples, and reports.

    mask("021000021") -> "*****0021". Keeps at most keep_last characters and
    never more than half the value, so short values are not fully revealed.
    """
    text = "" if value is None else str(value).strip()
    if not text:
        return ""
    if keep_last < 0:
        raise MoneyError("keep_last must not be negative")
    shown = min(keep_last, len(text) // 2)
    return "*" * (len(text) - shown) + (text[-shown:] if shown else "")


@dataclass(frozen=True)
class Reconciliation:
    """Control-total tie-out, produced as output by any money transform.

    An unexplained delta is a failure, not a note. The default tolerance is
    zero; a non-zero tolerance is a decision a human made, with a reason.
    """

    source: str
    rows_in: int
    rows_out: int
    rows_excluded: int
    total_in: Decimal
    total_out: Decimal
    total_excluded: Decimal
    currency: str
    tolerance: Decimal = Decimal(0)
    notes: str = ""

    def __post_init__(self) -> None:
        for name in ("rows_in", "rows_out", "rows_excluded"):
            count = getattr(self, name)
            if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                raise MoneyError(f"{name} must be a non-negative whole number, got {count!r}")
        for name in ("total_in", "total_out", "total_excluded", "tolerance"):
            object.__setattr__(self, name, to_decimal(getattr(self, name), name))
        object.__setattr__(self, "currency", _currency_code(self.currency))
        if self.tolerance < 0:
            raise MoneyError(f"tolerance must not be negative, got {self.tolerance}")
        if self.tolerance != 0 and not self.notes.strip():
            raise MoneyError("a non-zero tolerance needs a note saying who approved it and why")

    @property
    def delta(self) -> Decimal:
        return self.total_in - self.total_excluded - self.total_out

    @property
    def row_gap(self) -> int:
        return self.rows_in - self.rows_excluded - self.rows_out

    def check(self) -> None:
        """Raise if rows or control totals do not reconcile."""
        if self.row_gap != 0:
            raise MoneyError(
                f"row count broken: {self.rows_in} in, {self.rows_excluded} excluded, "
                f"{self.rows_out} out. {self.row_gap} rows are unaccounted for."
            )
        if abs(self.delta) > self.tolerance:
            raise MoneyError(
                f"control total delta {self.delta} {self.currency} "
                f"exceeds tolerance {self.tolerance}. Do not proceed until explained."
            )

    def report(self) -> str:
        """The tie-out block, formatted for the report."""
        if self.row_gap != 0:
            status = f"ROWS UNACCOUNTED FOR: {self.row_gap}. Explain before proceeding"
        elif self.delta == 0:
            status = "ties exactly"
        elif abs(self.delta) <= self.tolerance:
            status = f"{self.delta} {self.currency}, within approved tolerance"
        else:
            status = f"DELTA {self.delta} {self.currency}. Explain before proceeding"
        lines = [
            f"Source:     {self.source}",
            f"Rows in:    {self.rows_in:>12,}    Total in:   {self.total_in:>18,} {self.currency}",
            f"Excluded:   {self.rows_excluded:>12,}    Excluded:   {self.total_excluded:>18,} {self.currency}",
            f"Rows out:   {self.rows_out:>12,}    Total out:  {self.total_out:>18,} {self.currency}",
            f"Delta:      {status}",
        ]
        if self.notes:
            lines.append(f"Notes:      {self.notes}")
        return "\n".join(lines) + "\n"
