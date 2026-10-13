"""The page's only link to money.py.

Every number on the site comes through these functions: once when the site is
built (design/tickandtie-build/build.py) and again, live, in the visitor's
browser. Amounts go in and out as text, never as floats.
"""

from __future__ import annotations

import json
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

import money as M

PAID_HOURS_PER_YEAR = Decimal(2080)  # 52 weeks x 40 hours, from the skill's pricing guide


def _j(**fields: object) -> str:
    return json.dumps(fields)


def _usd(amount: Decimal) -> str:
    return f"{M.quantize_money(amount, 'USD'):,}"


def _pct1(ratio: Decimal) -> str:
    return str((ratio * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def split(total: str, parts: int, currency: str) -> str:
    """Split a total into equal parts with allocate(), next to the naive split."""
    try:
        count = int(parts)
        shares = M.allocate(total, [1] * count, currency)
        unit = M.minor_unit_exponent(currency)
        whole = M.to_decimal(total, "total")
        naive = [(whole / count).quantize(unit, rounding=ROUND_HALF_UP)] * count
        return _j(
            ok=True,
            whole=f"{whole:,}",
            parts=[f"{p:,}" for p in shares],
            total=f"{sum(shares, Decimal(0)):,}",
            naive=[f"{p:,}" for p in naive],
            naive_total=f"{sum(naive, Decimal(0)):,}",
            naive_gap=f"{abs(whole - sum(naive, Decimal(0))):,}",
            naive_ties=sum(naive, Decimal(0)) == whole,
        )
    except M.MoneyError as exc:
        return _j(ok=False, err=str(exc))


def mask(value: str, keep_last: int = 4) -> str:
    try:
        return _j(ok=True, out=M.mask(value, int(keep_last)))
    except M.MoneyError as exc:
        return _j(ok=False, err=str(exc))


def cph(salary: str, benefits_pct: str, hours: str, bill_rate: str = "") -> str:
    """Cost per billable hour, and the gap to a bill rate when one is given."""
    try:
        base = M.to_decimal(salary, "salary")
        pct = M.to_decimal(benefits_pct, "benefits and taxes")
        loaded = base * (1 + pct / 100)
        cost = M.cost_per_billable_hour(loaded, hours)
        out: dict[str, object] = {
            "ok": True,
            "loaded": _usd(loaded),
            "cost": _usd(cost),
            "hours": f"{M.to_decimal(hours, 'hours'):,}",
        }
        if bill_rate:
            rate = M.to_decimal(bill_rate, "bill rate")
            if rate <= 0:
                raise M.MoneyError(f"bill rate must be positive, got {rate}")
            # The gap is taken from the cost as shown, so the three figures on screen foot.
            gap = rate - M.quantize_money(cost, "USD")
            out["rate"] = _usd(rate)
            out["gap"] = _usd(abs(gap))
            out["earns"] = gap > 0
            out["margin"] = _pct1(gap / rate)
        return json.dumps(out)
    except M.MoneyError as exc:
        return _j(ok=False, err=str(exc))


def target(loaded: str, hours: str, bill_rate: str, target_pct: str) -> str:
    """What would have to be true for a scope to reach a target margin.

    Margin per role = (bill rate - cost per billable hour) / bill rate.
    The model's own inputs are never changed.
    """
    try:
        rate = M.to_decimal(bill_rate, "bill rate")
        goal = M.to_decimal(target_pct, "target margin") / 100
        if not Decimal(0) < goal < Decimal(1):
            raise M.MoneyError("target margin must be between 0 and 100 percent")
        cost = M.cost_per_billable_hour(loaded, hours)
        now = (rate - cost) / rate
        need_rate = cost / (1 - goal)
        need_hours = (M.to_decimal(loaded, "loaded cost") / (rate * (1 - goal))).quantize(
            Decimal(1), rounding=ROUND_CEILING
        )
        return _j(
            ok=True,
            now=_pct1(now),
            goal=_pct1(goal),
            met=now >= goal,
            cost=_usd(cost),
            rate=_usd(rate),
            hours=f"{M.to_decimal(hours, 'hours'):,}",
            need_rate=_usd(need_rate),
            need_hours=f"{need_hours:,}",
            over_paid_year=need_hours > PAID_HOURS_PER_YEAR,
        )
    except M.MoneyError as exc:
        return _j(ok=False, err=str(exc))


def burn(delivered: str, fee: str, day: int, total_days: int) -> str:
    try:
        result = M.fee_burn(delivered, fee, int(day), int(total_days))
        used, passed = _pct1(result.burn), _pct1(result.elapsed)
        gap = abs(Decimal(used) - Decimal(passed))  # the gap between the two figures as shown
        return _j(
            ok=True,
            burn=used,
            elapsed=passed,
            variance=str(gap) if gap or result.variance == 0 else "less than 0.1",
            ahead=result.is_ahead_of_calendar,
        )
    except M.MoneyError as exc:
        return _j(ok=False, err=str(exc))


_NAMES: dict[str, object] = {name: getattr(M, name) for name in M.__all__}
_NAMES.update(Decimal=Decimal, sum=sum, len=len, str=str, int=int, float=float, list=list, range=range)
_NAMES["print"] = lambda *args: " ".join(str(a) for a in args)  # shown as the line's result


def repl(code: str) -> str:
    """Run one line against money.py and return what Python prints for it."""
    try:
        value = eval(code, {"__builtins__": {}}, dict(_NAMES))  # noqa: S307 - the visitor's own browser
    except M.MoneyError as exc:
        return _j(ok=False, kind="MoneyError", out=str(exc))
    except Exception as exc:  # noqa: BLE001 - shown to the visitor as Python would show it
        return _j(ok=False, kind=type(exc).__name__, out=str(exc))
    if value is None:
        return _j(ok=True, out="None  (no error raised)")
    return _j(ok=True, out=value if isinstance(value, str) else repr(value))
