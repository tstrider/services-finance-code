# Changelog

## 2.0.0 (2026-09-29)

A rebuild, renamed from Clean Finance Code to Services Finance Code.

**Focus**
- Written for in-house finance teams at people-based services firms of about 20 to 1,000 people.
- Deepest coverage on pricing and rate cards, utilization and margin, fee burn, WIP, billing, and FP&A. Lighter coverage of AP, cash, and close.
- Assumes the person asking is a finance professional, not a programmer.

**New**
- Reports open with a plain summary (bottom line, what it ties to, what was assumed, what needs you, what was not checked), then the technical proof.
- Clear rule for missing facts: use a stated default on low-risk work, stop and ask on anything that books, bills, or pays.
- Sensitive data rules: mask everywhere, keep local, stop on unexpected sensitive data.
- A security checklist that runs on every job, with "n/a" and a reason for sections that do not apply.
- Tool installs: ask once, then install inside the project only. Skipped checks are always reported.
- US GAAP with IFRS difference notes.
- Systems guide for QuickBooks Online, Xero, NetSuite, Sage Intacct, time and PSA tools, payroll, and bank files.
- `money.py` adds `cost_per_billable_hour`, `fee_burn`, and `mask`, and now refuses bools, NaN, infinity, and ambiguous thousands separators.

**Fixed**
- The repo layout: files are now in the folders the skill refers to.
- Fee burn compared cost to price. It now compares like with like.
- Principal-versus-agent indicators now follow the current standard.
- Leases: the low-value exemption is IFRS only, not US GAAP.
- Internal-use software reflects ASU 2025-06.
- Removed claims about auditor guidance that could not be confirmed.
- `allocate()` now refuses totals with more decimals than the currency allows, instead of failing with a misleading message.
- `convert_fx()` now takes both currencies and checks the rate date.
- Documented a Pydantic behavior where JSON numbers pass through floats even in strict mode, with a fix.

**Removed**
- The project setup kit (installer, hooks, settings template, path rules). The skill now installs as one folder with nothing to edit.

## 1.0.0 (2026-08-08)

First release as Clean Finance Code.
