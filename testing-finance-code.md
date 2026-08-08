# Testing Finance Code

Extends the clean code fundamentals in SKILL.md §2. The difference in finance: a passing test suite over wrong data is the failure mode. Reconciliation tests matter more than unit tests.

## The test that matters most

**Tie to the source system, per period, automatically.** If your pipeline does not assert that its output matches the ERP's own trial balance for the period, no other test compensates.

```python
def test_ties_to_source_trial_balance(period):
    ours   = pipeline_total(period)
    theirs = erp_trial_balance_total(period)   # the ERP's own report, not a re-derivation
    assert ours == theirs, f"period {period}: ours {ours}, ERP {theirs}, delta {ours - theirs}"
```

Everything below supports this one.

## Golden datasets

A fixed input set with agreed expected outputs, signed off by the finance owner.

- **Agreed, not derived from the code.** If the expected values came from running the code, the test proves the code does what it does.
- **Real shapes, synthetic values.** Cover the actual messiness: multi-currency, partial periods, credit memos, reversals, intercompany, a 53-week year, a mid-period rate change.
- **Version the golden set** alongside the logic version. When logic changes intentionally, the golden set changes deliberately with an approval.
- These are acceptance criteria as much as tests.

## Property-based tests for money

Money has invariants that hold across all inputs. Test the invariant, not examples.

```python
from hypothesis import given, strategies as st
from decimal import Decimal

money = st.decimals(min_value=Decimal("-1e9"), max_value=Decimal("1e9"),
                    places=2, allow_nan=False, allow_infinity=False)

@given(total=money, weights=st.lists(st.integers(1, 1000), min_size=1, max_size=50))
def test_allocation_is_exhaustive(total, weights):
    parts = allocate(total, [Decimal(w) for w in weights])
    assert sum(parts) == total          # exact, no tolerance

@given(amount=money, rate=st.decimals(min_value=Decimal("0.0001"),
                                      max_value=Decimal("1000"), places=6))
def test_round_trip_conversion_within_rounding(amount, rate):
    there = convert(amount, rate)
    back  = convert(there, Decimal(1) / rate)
    assert abs(back - amount) <= Decimal("0.01")

@given(entries=journal_entries())
def test_entries_balance(entries):
    assert sum(e.debit for e in entries) == sum(e.credit for e in entries)
```

Invariants worth asserting this way: allocation exhaustiveness, debits equal credits, sign conventions preserved, currency never silently mixed, roll-forward ties (opening plus activity equals closing), aggregation is associative across dimension orderings.

## Reconciliation tests

Test the pipeline's own reconciliation reporting, not just its output.

```python
def test_no_silent_row_loss(sample):
    result = transform(sample)
    assert result.rows_out == result.rows_in - result.rows_excluded
    assert result.control_total_out == result.control_total_in - result.excluded_total

def test_unmatched_join_is_surfaced_not_dropped(sample_with_orphan_invoice):
    result = transform(sample_with_orphan_invoice)
    assert result.unmatched_count == 1        # visible
    assert result.rows_out == result.rows_in  # not dropped
```

**A pipeline that silently drops a row must fail a test.** This is the single most valuable test class in finance engineering, and it is usually absent.

## Edge cases that actually occur

Build fixtures for each. These are not exotic; they arrive every quarter.

**Periods and dates**
- 53-week fiscal year
- 4-4-5 period boundaries
- Fiscal year not starting in January
- Adjusting period 13
- Transaction on the period boundary, in a different timezone
- Leap day
- Backdated entry into a closed period (must be rejected)

**Amounts**
- Zero
- Negative revenue (credit memo, refund)
- Amount smaller than the rounding unit
- Very large values near column precision
- JPY (0 decimals) and KWD (3 decimals) alongside USD
- Allocation across 3 equal parts (the 33.33 case)
- Allocation where one weight is zero
- 100% discount

**Data**
- Duplicate invoice with different punctuation in the number
- Vendor with no invoices
- Invoice with no matching vendor (orphan)
- NULL where a rate is expected
- Two rate card versions with an overlapping effective range
- A gap between rate card versions
- Mid-period rate change
- Late time entry restating a prior period
- Reversal of a reversal

**Process**
- Retried payment batch (must not double-pay)
- Partial batch settlement
- Concurrent edit of the same record
- Job interrupted mid-allocation
- Period locked during a run

## What not to test

- The Decimal library's arithmetic
- The ERP's own calculations
- That a sum sums
- Snapshot tests of large outputs nobody reads. A regenerated snapshot approved without inspection is worse than no test, because it launders an error into an expectation.

## Testing against source systems

- **Never test against production.** Use a sandbox.
- Record and replay API responses for deterministic tests. Live integration tests are flaky and slow.
- Test the failure modes explicitly: rate limit, timeout, partial page, period lock rejection, malformed response, authentication expiry mid-run.
- Test resume-from-checkpoint, not just clean runs.

## Parallel run

For anything replacing an existing process, the test suite is not sufficient evidence.

Run old and new side by side for at least one full cycle. **Reconcile every difference to zero or explain each one individually.** Differences that are "just rounding" are usually not. Do not cut over on a green suite.

## Review checklist for finance code

- [ ] Ties to an independent source, asserted in a test
- [ ] Row counts and control totals asserted across every join and filter
- [ ] Decimal throughout; no float touches money
- [ ] Rounding mode explicit; rounding happens once
- [ ] Allocation asserted exhaustive
- [ ] Currency never mixed without an explicit rate, rate date, and rate type
- [ ] Effective-dated lookups use the service date, not the current date
- [ ] Period boundaries from a period table, not date arithmetic
- [ ] Reversals modeled as rows; no update or delete of posted records
- [ ] Idempotency enforced by a database constraint on anything money-moving
- [ ] Golden scenarios agreed with the finance owner
- [ ] Edge case fixtures present for the cases above
- [ ] No sensitive data in fixtures, logs, or test output
- [ ] Reconciliation block produced as output, not just internally asserted
