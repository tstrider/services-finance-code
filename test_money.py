"""Tests for money.py. Run: python3 -m pytest test_money.py -q

Covers the edge cases from testing-finance-code.md that actually occur:
the 33.33 case, negative totals, zero weights, non-standard minor units,
mixed currencies, and float rejection.
"""

from decimal import Decimal, ROUND_HALF_EVEN, ROUND_HALF_UP

import pytest

from money import (
    MoneyError,
    Reconciliation,
    allocate,
    assert_balanced,
    assert_single_currency,
    convert_fx,
    minor_unit_exponent,
    quantize_money,
    to_decimal,
)

D = Decimal


# --- to_decimal ---------------------------------------------------------

def test_rejects_float():
    with pytest.raises(MoneyError, match="refusing to build a Decimal from float"):
        to_decimal(0.1)


def test_accepts_string_and_int():
    assert to_decimal("1234.56") == D("1234.56")
    assert to_decimal(100) == D("100")


def test_string_preserves_exactness():
    assert to_decimal("0.1") + to_decimal("0.2") == D("0.3")


def test_rejects_garbage():
    with pytest.raises(MoneyError, match="cannot parse"):
        to_decimal("not a number")


# --- minor units --------------------------------------------------------

@pytest.mark.parametrize("currency,expected", [
    ("USD", D("0.01")), ("EUR", D("0.01")), ("GBP", D("0.01")),
    ("JPY", D("1")), ("KRW", D("1")),
    ("KWD", D("0.001")), ("BHD", D("0.001")),
    ("jpy", D("1")),  # case insensitive
])
def test_minor_unit_exponent(currency, expected):
    assert minor_unit_exponent(currency) == expected


def test_rejects_bad_currency_code():
    with pytest.raises(MoneyError, match="3-letter ISO 4217"):
        minor_unit_exponent("DOLLARS")


# --- rounding -----------------------------------------------------------

def test_rounding_mode_is_explicit():
    assert quantize_money("2.675", "USD", ROUND_HALF_UP) == D("2.68")
    assert quantize_money("2.665", "USD", ROUND_HALF_UP) == D("2.67")
    assert quantize_money("2.665", "USD", ROUND_HALF_EVEN) == D("2.66")


def test_rounding_respects_minor_units():
    assert quantize_money("1234.56", "JPY") == D("1235")
    assert quantize_money("1.23456", "KWD") == D("1.235")


# --- allocation ---------------------------------------------------------

def test_the_thirty_three_case():
    """100 split three ways must sum to exactly 100, not 99.99."""
    parts = allocate("100.00", [1, 1, 1])
    assert sum(parts) == D("100.00")
    assert sorted(parts) == [D("33.33"), D("33.33"), D("33.34")]


def test_allocation_is_exhaustive_across_many_shapes():
    cases = [
        ("100.00", [1, 1, 1]),
        ("0.01", [1, 1, 1]),
        ("1000000.00", [7, 13, 29, 31]),
        ("33.33", [1]),
        ("999.99", [1] * 7),
        ("100.00", [50, 30, 20]),
        ("0.03", [1, 1, 1]),
    ]
    for total, weights in cases:
        parts = allocate(total, weights)
        assert sum(parts) == D(total), f"{total} across {weights} lost money"
        assert len(parts) == len(weights)


def test_negative_total_allocates_exhaustively():
    """Credit memos and refunds are negative. They must still tie."""
    parts = allocate("-100.00", [1, 1, 1])
    assert sum(parts) == D("-100.00")
    assert all(p <= 0 for p in parts)


def test_zero_weight_gets_nothing():
    parts = allocate("100.00", [1, 0, 1])
    assert sum(parts) == D("100.00")
    assert parts[1] == D("0.00")


def test_zero_total():
    assert allocate("0.00", [1, 2, 3]) == [D("0.00")] * 3


def test_allocation_respects_minor_units():
    parts = allocate("1000", [1, 1, 1], currency="JPY")
    assert sum(parts) == D("1000")
    assert all(p == p.to_integral_value() for p in parts)


def test_allocation_is_deterministic():
    a = allocate("100.00", [1, 1, 1])
    b = allocate("100.00", [1, 1, 1])
    assert a == b


def test_rejects_empty_weights():
    with pytest.raises(MoneyError, match="must not be empty"):
        allocate("100.00", [])


def test_rejects_all_zero_weights():
    with pytest.raises(MoneyError, match="sum to zero"):
        allocate("100.00", [0, 0])


def test_rejects_negative_weights():
    with pytest.raises(MoneyError, match="non-negative"):
        allocate("100.00", [1, -1])


# --- FX -----------------------------------------------------------------

def test_convert_requires_rate_type_and_date():
    with pytest.raises(MoneyError, match="rate_type"):
        convert_fx("100.00", "1.08", "USD", "made_up", "2026-07-31")
    with pytest.raises(MoneyError, match="rate_date is required"):
        convert_fx("100.00", "1.08", "USD", "spot", "")


def test_convert_rounds_once_to_target_minor_units():
    assert convert_fx("100.00", "1.0855", "USD", "spot", "2026-07-31") == D("108.55")
    assert convert_fx("100.00", "155.372", "JPY", "closing", "2026-07-31") == D("15537")


def test_rejects_non_positive_rate():
    with pytest.raises(MoneyError, match="must be positive"):
        convert_fx("100.00", "0", "USD", "spot", "2026-07-31")


# --- assertions ---------------------------------------------------------

def test_balanced_entry_passes():
    assert_balanced(["100.00", "50.00"], ["150.00"])


def test_unbalanced_entry_raises_with_the_delta():
    with pytest.raises(MoneyError, match="delta 0.01"):
        assert_balanced(["100.01"], ["100.00"])


def test_single_currency_returns_it():
    assert assert_single_currency(["USD", "USD"]) == "USD"


def test_mixed_currency_raises():
    with pytest.raises(MoneyError, match="mixed currencies"):
        assert_single_currency(["USD", "EUR"])


def test_empty_currency_raises():
    with pytest.raises(MoneyError, match="no currency present"):
        assert_single_currency([])


# --- reconciliation -----------------------------------------------------

def test_clean_reconciliation_passes():
    r = Reconciliation(
        source="NetSuite SuiteQL 2026-07",
        rows_in=1000, rows_out=950, rows_excluded=50,
        total_in=D("100000.00"), total_out=D("95000.00"),
        total_excluded=D("5000.00"), currency="USD",
    )
    r.check()
    assert r.delta == D("0")
    assert "ties exactly" in r.report()


def test_silent_row_drop_is_caught():
    r = Reconciliation(
        source="test", rows_in=1000, rows_out=940, rows_excluded=50,
        total_in=D("100000.00"), total_out=D("95000.00"),
        total_excluded=D("5000.00"), currency="USD",
    )
    with pytest.raises(MoneyError, match="silently dropped"):
        r.check()


def test_control_total_delta_is_caught():
    r = Reconciliation(
        source="test", rows_in=1000, rows_out=950, rows_excluded=50,
        total_in=D("100000.00"), total_out=D("94999.99"),
        total_excluded=D("5000.00"), currency="USD",
    )
    with pytest.raises(MoneyError, match="exceeds tolerance"):
        r.check()


def test_explicit_tolerance_is_honored():
    r = Reconciliation(
        source="test", rows_in=1000, rows_out=950, rows_excluded=50,
        total_in=D("100000.00"), total_out=D("94999.99"),
        total_excluded=D("5000.00"), currency="USD",
        tolerance=D("0.01"), notes="rounding tolerance approved by controller",
    )
    r.check()
