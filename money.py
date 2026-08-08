"""Decimal money helpers for finance code.

Prefer these over reimplementing. Every function raises rather than returning a
silently wrong number, because a wrong number that looks fine is the primary
failure mode in finance engineering.

No dependencies beyond the standard library.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_EVEN, ROUND_HALF_UP, InvalidOperation
from typing import Iterable, Sequence

__all__ = [
    "MoneyError",
    "to_decimal",
    "minor_unit_exponent",
    "quantize_money",
    "allocate",
    "convert_fx",
    "assert_balanced",
    "assert_single_currency",
    "Reconciliation",
]


class MoneyError(ValueError):
    """Raised when a money operation cannot be performed correctly."""


# ISO 4217 exponents that are not 2. Everything unlisted defaults to 2.
# Not exhaustive; extend from an ISO 4217 source for production use.
_NON_STANDARD_EXPONENTS: dict[str, int] = {
    "JPY": 0, "KRW": 0, "VND": 0, "CLP": 0, "ISK": 0, "PYG": 0,
    "RWF": 0, "UGX": 0, "VUV": 0, "XAF": 0, "XOF": 0, "XPF": 0,
    "BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3,
}


def to_decimal(value: object, field: str = "amount") -> Decimal:
    """Coerce to Decimal, refusing float input.

    Floats are rejected rather than converted because Decimal(0.1) carries the
    binary representation error into what looks like an exact value.
    """
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        raise MoneyError(
            f"{field}: refusing to build a Decimal from float {value!r}. "
            "Pass a string or int. Floats cannot represent money exactly."
        )
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, str):
        try:
            return Decimal(value.strip())
        except InvalidOperation as exc:
            raise MoneyError(f"{field}: cannot parse {value!r} as a decimal") from exc
    raise MoneyError(f"{field}: unsupported type {type(value).__name__}")


def minor_unit_exponent(currency: str) -> Decimal:
    """Return the quantization exponent for a currency, e.g. Decimal('0.01').

    Do not hardcode 2 decimals. JPY has 0, KWD has 3.
    """
    if not currency or len(currency) != 3:
        raise MoneyError(f"currency must be a 3-letter ISO 4217 code, got {currency!r}")
    digits = _NON_STANDARD_EXPONENTS.get(currency.upper(), 2)
    return Decimal(1).scaleb(-digits)


def quantize_money(
    amount: Decimal | str | int,
    currency: str = "USD",
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """Round to the currency's minor unit with an explicit rounding mode.

    ROUND_HALF_UP is the default because it matches what invoices and tax
    generally expect. Pass ROUND_HALF_EVEN explicitly for statistical
    aggregation where cumulative bias matters.
    """
    return to_decimal(amount).quantize(minor_unit_exponent(currency), rounding=rounding)


def allocate(
    total: Decimal | str | int,
    weights: Sequence[Decimal | str | int],
    currency: str = "USD",
) -> list[Decimal]:
    """Split total across weights so the parts sum exactly to total.

    Uses the largest-remainder method: the rounding remainder goes to the
    entries with the largest fractional parts, ties broken by index so results
    are deterministic and reproducible across runs.

    Raises rather than leaking pennies. Handles negative totals.
    """
    total = to_decimal(total, "total")
    if not weights:
        raise MoneyError("allocate: weights must not be empty")

    parsed = [to_decimal(w, f"weights[{i}]") for i, w in enumerate(weights)]
    if any(w < 0 for w in parsed):
        raise MoneyError("allocate: weights must be non-negative")

    weight_total = sum(parsed)
    if weight_total == 0:
        raise MoneyError("allocate: weights sum to zero, cannot allocate")

    q = minor_unit_exponent(currency)
    raw = [total * w / weight_total for w in parsed]

    # ROUND_DOWN truncates toward zero, so this works for negative totals too:
    # the remainder carries the same sign as the total.
    floored = [r.quantize(q, rounding=ROUND_DOWN) for r in raw]
    remainder = total - sum(floored)
    steps = int((remainder / q).to_integral_value(rounding=ROUND_HALF_UP))

    step = q if steps >= 0 else -q
    # Largest fractional remainder first; index breaks ties deterministically.
    order = sorted(range(len(raw)), key=lambda i: (-abs(raw[i] - floored[i]), i))
    for i in order[: abs(steps)]:
        floored[i] += step

    if sum(floored) != total:
        raise MoneyError(
            f"allocate: parts sum to {sum(floored)}, expected {total}. "
            "This is a bug in allocate(), not in your inputs."
        )
    return floored


def convert_fx(
    amount: Decimal | str | int,
    rate: Decimal | str | int,
    to_currency: str,
    rate_type: str,
    rate_date: str,
) -> Decimal:
    """Convert using an explicitly directional rate. Rounds once, at the end.

    rate_type and rate_date are required arguments rather than optional metadata
    because a converted amount without them is unauditable. Record both
    alongside the result.

    rate must be expressed as (to_currency per from_currency).
    """
    valid_types = {"spot", "average", "closing", "historical"}
    if rate_type not in valid_types:
        raise MoneyError(f"rate_type must be one of {sorted(valid_types)}, got {rate_type!r}")
    if not rate_date:
        raise MoneyError("rate_date is required; a conversion without it cannot be reconstructed")

    rate = to_decimal(rate, "rate")
    if rate <= 0:
        raise MoneyError(f"rate must be positive, got {rate}")

    return quantize_money(to_decimal(amount) * rate, to_currency)


def assert_balanced(
    debits: Iterable[Decimal | str | int],
    credits: Iterable[Decimal | str | int],
    label: str = "entry",
) -> None:
    """Assert debits equal credits. Call before posting, per entry and per batch."""
    d = sum((to_decimal(x, "debit") for x in debits), Decimal(0))
    c = sum((to_decimal(x, "credit") for x in credits), Decimal(0))
    if d != c:
        raise MoneyError(f"{label} does not balance: debits {d}, credits {c}, delta {d - c}")


def assert_single_currency(currencies: Iterable[str], label: str = "amounts") -> str:
    """Assert a set of amounts share one currency. Returns it.

    Guards the most common silent error in multi-entity reporting: summing
    across currencies without conversion.
    """
    distinct = {c.upper() for c in currencies if c}
    if not distinct:
        raise MoneyError(f"{label}: no currency present")
    if len(distinct) > 1:
        raise MoneyError(
            f"{label}: mixed currencies {sorted(distinct)}. "
            "Convert with an explicit rate, rate type, and rate date before summing."
        )
    return distinct.pop()


@dataclass
class Reconciliation:
    """Control-total reconciliation, produced as output by any money transform.

    An unexplained delta is a failure, not a note. Default tolerance is zero;
    a non-zero tolerance is a decision a human made, with a reason.
    """

    source: str
    rows_in: int
    rows_out: int
    rows_excluded: int
    total_in: Decimal
    total_out: Decimal
    total_excluded: Decimal
    currency: str
    tolerance: Decimal = Decimal("0")
    notes: str = ""

    @property
    def delta(self) -> Decimal:
        return self.total_in - self.total_excluded - self.total_out

    def check(self) -> None:
        """Raise if rows or control totals do not reconcile."""
        expected_rows = self.rows_in - self.rows_excluded
        if self.rows_out != expected_rows:
            raise MoneyError(
                f"row count broken: {self.rows_in} in, {self.rows_excluded} excluded, "
                f"{self.rows_out} out, expected {expected_rows}. Rows were silently dropped."
            )
        if abs(self.delta) > self.tolerance:
            raise MoneyError(
                f"control total delta {self.delta} {self.currency} "
                f"exceeds tolerance {self.tolerance}. Do not proceed until explained."
            )

    def report(self) -> str:
        status = "ties exactly" if self.delta == 0 else f"DELTA {self.delta} — explain before proceeding"
        return (
            f"Source:    {self.source}\n"
            f"Rows in:   {self.rows_in:>12,}   Control total in:  {self.total_in:>18,} {self.currency}\n"
            f"Excluded:  {self.rows_excluded:>12,}   Excluded total:    {self.total_excluded:>18,} {self.currency}\n"
            f"Rows out:  {self.rows_out:>12,}   Control total out: {self.total_out:>18,} {self.currency}\n"
            f"Delta:     {status}\n"
            + (f"Notes:     {self.notes}\n" if self.notes else "")
        )
