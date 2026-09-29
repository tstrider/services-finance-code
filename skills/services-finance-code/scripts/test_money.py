"""Tests for money.py. Run from this folder: python3 -m pytest test_money.py -q

Covers the edge cases that actually occur: the 33.33 split, negative totals,
zero weights, non-standard minor units, mixed currencies, float rejection,
the 2,080-hour trap, fee burn, masking, and silent row loss.
"""

from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal

import pytest

from money import (
    MoneyError,
    Reconciliation,
    allocate,
    assert_balanced,
    assert_single_currency,
    convert_fx,
    cost_per_billable_hour,
    fee_burn,
    mask,
    minor_unit_exponent,
    quantize_money,
    to_decimal,
)

D = Decimal


# --- to_decimal ---------------------------------------------------------

def test_rejects_float():
    with pytest.raises(MoneyError, match="refusing to build a Decimal from float"):
        to_decimal(0.1)


def test_rejects_bool():
    with pytest.raises(MoneyError, match="bool"):
        to_decimal(True)


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-inf", D("NaN")])
def test_rejects_non_finite(bad):
    with pytest.raises(MoneyError, match="not a finite number"):
        to_decimal(bad)


def test_accepts_string_int_and_decimal():
    assert to_decimal("1234.56") == D("1234.56")
    assert to_decimal(" 1234.56 ") == D("1234.56")
    assert to_decimal(100) == D("100")
    assert to_decimal(D("7.25")) == D("7.25")


def test_string_preserves_exactness():
    assert to_decimal("0.1") + to_decimal("0.2") == D("0.3")


@pytest.mark.parametrize("bad", ["not a number", "1,234.56", "$100", ""])
def test_rejects_unparseable_text(bad):
    with pytest.raises(MoneyError, match="cannot parse"):
        to_decimal(bad)


def test_rejects_unsupported_type():
    with pytest.raises(MoneyError, match="unsupported type"):
        to_decimal([1])


# --- minor units --------------------------------------------------------

@pytest.mark.parametrize("currency,expected", [
    ("USD", D("0.01")), ("EUR", D("0.01")), ("GBP", D("0.01")),
    ("JPY", D("1")), ("KRW", D("1")),
    ("KWD", D("0.001")), ("BHD", D("0.001")),
    ("jpy", D("1")),
])
def test_minor_unit_exponent(currency, expected):
    assert minor_unit_exponent(currency) == expected


@pytest.mark.parametrize("bad", ["DOLLARS", "US", "12$", ""])
def test_rejects_bad_currency_code(bad):
    with pytest.raises(MoneyError, match="3-letter ISO 4217"):
        minor_unit_exponent(bad)


# --- rounding -----------------------------------------------------------

def test_rounding_mode_is_explicit():
    assert quantize_money("2.665", "USD", ROUND_HALF_UP) == D("2.67")
    assert quantize_money("2.665", "USD", ROUND_HALF_EVEN) == D("2.66")


def test_rounding_respects_minor_units():
    assert quantize_money("1234.56", "JPY") == D("1235")
    assert quantize_money("1.23456", "KWD") == D("1.235")


def test_rounding_lines_then_summing_drifts():
    """Why the skill says round once: three lines of 0.005 round to 0.03, the truth is 0.02."""
    lines = [D("0.005")] * 3
    rounded_then_summed = sum(quantize_money(x, "USD") for x in lines)
    summed_then_rounded = quantize_money(sum(lines), "USD")
    assert rounded_then_summed == D("0.03")
    assert summed_then_rounded == D("0.02")


# --- allocation ---------------------------------------------------------

def test_the_thirty_three_case():
    """100 split three ways must sum to exactly 100, not 99.99."""
    parts = allocate("100.00", [1, 1, 1], "USD")
    assert sum(parts) == D("100.00")
    assert sorted(parts) == [D("33.33"), D("33.33"), D("33.34")]


@pytest.mark.parametrize("total,weights", [
    ("100.00", [1, 1, 1]),
    ("0.01", [1, 1, 1]),
    ("1000000.00", [7, 13, 29, 31]),
    ("33.33", [1]),
    ("999.99", [1] * 7),
    ("100.00", [50, 30, 20]),
    ("0.03", [1, 1, 1]),
    ("12345.67", ["0.125", "0.375", "0.5"]),
])
def test_allocation_is_exhaustive(total, weights):
    parts = allocate(total, weights, "USD")
    assert sum(parts) == D(total)
    assert len(parts) == len(weights)


def test_negative_total_allocates_exhaustively():
    """Credit memos and refunds are negative. They must still tie."""
    parts = allocate("-100.00", [1, 1, 1], "USD")
    assert sum(parts) == D("-100.00")
    assert all(p <= 0 for p in parts)


def test_zero_weight_gets_nothing():
    parts = allocate("100.00", [1, 0, 1], "USD")
    assert sum(parts) == D("100.00")
    assert parts[1] == D("0.00")


def test_zero_total():
    assert allocate("0.00", [1, 2, 3], "USD") == [D("0.00")] * 3


def test_allocation_respects_minor_units():
    parts = allocate("1000", [1, 1, 1], "JPY")
    assert sum(parts) == D("1000")
    assert all(p == p.to_integral_value() for p in parts)


def test_allocation_is_deterministic():
    assert allocate("100.00", [1, 1, 1], "USD") == allocate("100.00", [1, 1, 1], "USD")


def test_rejects_total_with_too_many_decimals():
    with pytest.raises(MoneyError, match="Round the total first"):
        allocate("100.005", [1, 1], "USD")


def test_rejects_empty_weights():
    with pytest.raises(MoneyError, match="must not be empty"):
        allocate("100.00", [], "USD")


def test_rejects_all_zero_weights():
    with pytest.raises(MoneyError, match="sum to zero"):
        allocate("100.00", [0, 0], "USD")


def test_rejects_negative_weights():
    with pytest.raises(MoneyError, match="non-negative"):
        allocate("100.00", [1, -1], "USD")


# --- FX -----------------------------------------------------------------

def test_convert_rounds_once_to_target_minor_units():
    assert convert_fx("100.00", "EUR", "USD", "1.0855", "spot", "2026-07-31") == D("108.55")
    assert convert_fx("100.00", "USD", "JPY", "155.372", "closing", "2026-07-31") == D("15537")


def test_convert_requires_known_rate_type():
    with pytest.raises(MoneyError, match="rate_type"):
        convert_fx("100.00", "EUR", "USD", "1.08", "made_up", "2026-07-31")


@pytest.mark.parametrize("bad_date", ["", "July 31", "2026-13-01", None])
def test_convert_requires_iso_rate_date(bad_date):
    with pytest.raises(MoneyError, match="rate_date"):
        convert_fx("100.00", "EUR", "USD", "1.08", "spot", bad_date)


def test_convert_rejects_same_currency():
    with pytest.raises(MoneyError, match="nothing to convert"):
        convert_fx("100.00", "USD", "usd", "1", "spot", "2026-07-31")


def test_convert_rejects_non_positive_rate():
    with pytest.raises(MoneyError, match="must be positive"):
        convert_fx("100.00", "EUR", "USD", "0", "spot", "2026-07-31")


# --- services math ------------------------------------------------------

def test_cost_per_billable_hour_uses_billable_hours():
    assert cost_per_billable_hour("180000", "1800") == D("100")


def test_2080_understates_cost_per_hour():
    """The trap the skill warns about: 2,080 makes each hour look about 13% cheaper."""
    true_cost = cost_per_billable_hour("180000", 1800)
    paid_hours_cost = cost_per_billable_hour("180000", 2080)
    understated_by = 1 - paid_hours_cost / true_cost
    assert D("0.13") < understated_by < D("0.14")


@pytest.mark.parametrize("hours", [0, -1, 9000])
def test_cost_per_billable_hour_rejects_impossible_hours(hours):
    with pytest.raises(MoneyError, match="annual_billable_hours"):
        cost_per_billable_hour("100000", hours)


def test_fee_burn_ahead_of_calendar():
    result = fee_burn("60000", "100000", elapsed_days=45, total_days=90)
    assert result.burn == D("0.6")
    assert result.elapsed == D("0.5")
    assert result.variance == D("0.1")
    assert result.is_ahead_of_calendar


def test_fee_burn_on_track():
    result = fee_burn("25000", "100000", elapsed_days=30, total_days=90)
    assert not result.is_ahead_of_calendar


@pytest.mark.parametrize("fee,elapsed,total", [("0", 1, 10), ("100", 11, 10), ("100", 1, 0)])
def test_fee_burn_rejects_bad_inputs(fee, elapsed, total):
    with pytest.raises(MoneyError):
        fee_burn("10", fee, elapsed, total)


# --- balance and currency checks -----------------------------------------

def test_balanced_entry_passes():
    assert_balanced(["100.00", "50.00"], ["150.00"])


def test_unbalanced_entry_raises_with_the_delta():
    with pytest.raises(MoneyError, match=r"delta 0\.01"):
        assert_balanced(["100.01"], ["100.00"])


def test_single_currency_returns_it():
    assert assert_single_currency(["USD", "usd"]) == "USD"


def test_mixed_currency_raises():
    with pytest.raises(MoneyError, match="mixed currencies"):
        assert_single_currency(["USD", "EUR"])


def test_empty_currency_list_raises():
    with pytest.raises(MoneyError, match="no currency present"):
        assert_single_currency([])


def test_missing_currency_on_one_amount_raises():
    with pytest.raises(MoneyError, match="has no currency"):
        assert_single_currency(["USD", ""])


# --- masking ------------------------------------------------------------

def test_mask_keeps_last_four():
    assert mask("021000021") == "*****0021"


def test_mask_never_reveals_more_than_half():
    assert mask("1234") == "**34"
    assert mask("7") == "*"


def test_mask_handles_empty_and_none():
    assert mask("") == ""
    assert mask(None) == ""


# --- reconciliation -----------------------------------------------------

def _recon(**overrides):
    base = dict(
        source="Accounting system export, 2026-07",
        rows_in=1000, rows_out=950, rows_excluded=50,
        total_in=D("100000.00"), total_out=D("95000.00"),
        total_excluded=D("5000.00"), currency="USD",
    )
    base.update(overrides)
    return Reconciliation(**base)


def test_clean_reconciliation_passes():
    r = _recon()
    r.check()
    assert r.delta == D("0")
    assert "ties exactly" in r.report()


def test_silent_row_drop_is_caught():
    r = _recon(rows_out=940)
    with pytest.raises(MoneyError, match="unaccounted for"):
        r.check()
    assert "ROWS UNACCOUNTED FOR" in r.report()


def test_control_total_delta_is_caught():
    r = _recon(total_out=D("94999.99"))
    with pytest.raises(MoneyError, match="exceeds tolerance"):
        r.check()
    assert "DELTA 0.01" in r.report()


def test_explicit_tolerance_is_honored():
    r = _recon(total_out=D("94999.99"), tolerance=D("0.01"),
               notes="rounding tolerance approved by controller")
    r.check()
    assert "within approved tolerance" in r.report()


def test_tolerance_without_a_reason_is_refused():
    with pytest.raises(MoneyError, match="needs a note"):
        _recon(tolerance=D("0.01"))


def test_reconciliation_refuses_float_totals():
    with pytest.raises(MoneyError, match="float"):
        _recon(total_in=100000.0)


def test_reconciliation_refuses_negative_row_counts():
    with pytest.raises(MoneyError, match="non-negative whole number"):
        _recon(rows_excluded=-1)
