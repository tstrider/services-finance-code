# Treasury

Cash positioning, liquidity, bank connectivity, capital allocation, escrow and partner distributions.

## Cash positioning

The daily question: how much cash do we have, where, in what currency, and what is committed?

```
cash_position(as_of_date, entity_id, bank_id, account_id, currency,
              opening_balance, cleared_activity, projected_activity,
              closing_balance, available_balance, source, retrieved_at)
```

- **Ledger balance, available balance, and value-dated balance are three different numbers.** Float, holds, and value dating separate them. Using the wrong one produces a liquidity decision based on money you cannot actually move.
- **Timing is everything.** A balance is meaningless without a timestamp and a cut-off convention. Intraday reporting (MT942, CAMT.052) versus prior-day (BAI2, MT940, CAMT.053) answer different questions.
- **Multi-currency positions are never summed without an explicit rate and rate date.** Show both the native position and the converted view, never the converted view alone.
- Reconcile the bank feed to the GL cash account daily. A break in cash is either fraud or an unrecorded transaction, and both are urgent.

## Cash forecasting

- **Direct method** (receipts and disbursements) for short horizons, typically 13 weeks. Built from AR collections expectations, AP payment schedules, payroll dates, tax dates, and debt service. This is the operational forecast.
- **Indirect method** (from the P&L and balance sheet movement) for longer horizons. This is the planning forecast.
- **They must reconcile at the boundary.** If the 13-week direct forecast and the indirect cash flow disagree at week 13, one of them is wrong.
- **Collection timing from actual behavior**, not from terms. A net-30 client that reliably pays in 52 days should be modeled at 52. Derive the distribution from payment history per client.
- Forecast accuracy tracked by horizon. Week-1 accuracy and week-13 accuracy are different problems.
- Payroll, tax, and debt service dates are known with certainty. Model them as fixed, not as run-rate.

## Bank connectivity

| Format | Purpose |
|---|---|
| BAI2 | US prior-day statement and balance reporting |
| MT940 / MT942 | SWIFT end-of-day / intraday statement |
| CAMT.053 / .052 / .054 | ISO 20022 statement / intraday / debit-credit notification |
| PAIN.001 / .002 | ISO 20022 payment initiation and status report |
| NACHA | US ACH origination |
| Fedwire / SWIFT MT103 | Wire |

Rules:

- **Never build a parser from a single sample file.** Banks vary within a nominal standard, and the variant you did not see will arrive at quarter-end.
- **Reconcile parsed totals to the file's own control totals.** BAI2 and CAMT both carry them. If the file says 412 transactions and you parsed 409, stop.
- ISO 20022 migration is ongoing across rails. Confirm what each bank currently accepts and sends; do not assume.
- Payment initiation requires the same idempotency and approval discipline as AP payment runs. See `ap.md`.
- **Dual authorization on outbound payments**, enforced at the bank as well as in your system. Bank-side controls survive an application compromise.

## Liquidity and capital

- **Credit facilities**: track committed versus drawn versus available, and the covenant tests. Covenant headroom is a number leadership needs before it is breached, not after.
- **Covenant compliance** calculations must exactly match the credit agreement's definitions, which frequently differ from GAAP. Adjusted EBITDA in a credit agreement is a defined term with specific add-backs. Implement the agreement's definition, cite the section, and never substitute the management definition.
- **Cash concentration and pooling** structures (physical sweep versus notional) have different accounting and intercompany consequences. Notional pooling creates intercompany positions that must be tracked.
- **Restricted cash is not available cash.** Model the restriction and its release condition. Presenting restricted cash in an availability number is a serious error.
- Investment policy constraints (instrument type, tenor, counterparty concentration limits) enforced in code where the process is automated.

## Escrow and partner distributions

Common in agencies, law firms, consultancies, property management, and any business holding funds for others.

- **Client funds are not company funds.** Segregated accounts, separate ledger, and never commingled. In regulated contexts (legal trust accounts, IOLTA) this is a bar-rule requirement with severe consequences.
- The ledger for held funds must reconcile to the segregated bank account **per beneficiary**, not just in total. A total that ties while individual balances are wrong is still a breach.
- **Distribution waterfalls** are contractual logic: tiers, preferences, catch-ups, clawbacks. Implement from the agreement text, cite the clause per tier, and test against worked examples the counterparty agrees with before running live.
- Never net a distribution against an unrelated receivable without explicit contractual right of offset.
- Interest on held funds belongs to whoever the agreement or regulation says. Do not assume.

## Client-funded third-party payables

Where a firm holds or commits client funds to pay third-party vendors (media, subcontractors, experts, venues), treat it with escrow discipline: the obligation to the vendor exists regardless of whether the client has paid. Track client-funded versus firm-funded exposure separately. This is a real balance sheet risk that is frequently invisible until a client defaults.

## Tier guidance

- Ad hoc liquidity question or covenant check: **Tier 0**, with the agreement definition cited
- Daily cash position report, 13-week forecast refresh: **Tier 1**
- Anything initiating a payment, moving funds, or computing a distribution: **Tier 2**

## Common defects to check for

- Ledger balance used where available balance was required
- Multi-currency positions summed without an explicit rate
- Restricted cash included in availability
- Covenant calculation using the management definition rather than the credit agreement's
- Bank file parser built from one sample, with no control-total reconciliation
- Collection timing modeled from terms rather than actual payment behavior
- 13-week direct forecast never reconciled to the indirect view
- Client-held funds commingled or reconciled only in aggregate
- Distribution waterfall implemented without worked-example testing
- Single authorization on outbound payments
