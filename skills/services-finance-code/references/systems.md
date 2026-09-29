# Systems

Integration hazards for the systems small and mid-size services firms actually use. Vendors change their APIs, limits, and features often: **read the current official docs before building,** and treat anything specific here as a pointer, not a spec.

Which systems you may connect to, and with what access, is decided by the user's setup. Work within it.

## Rules for every system

1. **The accounting system is the system of record.** When your numbers disagree with it, yours are wrong until proven otherwise.
2. **Land the raw extract first, then transform.** Keep it, timestamped. You cannot debug or replay what you did not keep.
3. **Tie to the system's own reports** (trial balance, P&L, AR aging) for the same period and filters.
4. **Use a sandbox or test company for anything that writes.** Most systems offer one.
5. **Amounts often arrive as JSON numbers,** which most libraries parse as floats. In Python use `json.loads(text, parse_float=Decimal)` or your HTTP library's equivalent, or read the raw text. Never let an API amount pass through a float.
6. **Pull incrementally by "last modified", report by service or posting date.** Late edits to old periods only show up if you ask for records changed since your last pull, whatever their date.
7. **Expect limits and partial failure.** Rate limits, pagination, timeouts, and expired logins are normal. Honor `Retry-After`, page to the end, and resume from a checkpoint.
8. **Idempotent writes.** Use the system's external ID or reference field so a retry updates instead of duplicating.
9. **Respect period locks.** A write into a locked or closed period being refused is expected, not a crash. Never ask the user to unlock a period so a job can post.
10. **Never write to ledger tables directly.** Use the documented API or import.
11. **Credentials** (OAuth tokens, API keys) live in environment variables, the keychain, or a secret manager. Refresh tokens often rotate on use; store the new one each time.

## Accounting systems

### QuickBooks Online

- Dimensions are limited: **classes** and **locations**, plus customers, projects, and items. Firms often squeeze client or service line into account names or memo text. Map those to real columns once, with a mapping table, and report anything unmapped.
- The API's query endpoint pages results; always page to the end.
- The **Reports API** (profit and loss, balance sheet, trial balance, AR aging) is the tie-out source. Match its accounting method (accrual or cash) and date settings to yours.
- The **closing date** setting can block or password-protect changes before a date. Treat it as a period lock.
- A free **sandbox company** is available with a developer account. Test writes there.

### Xero

- **Tracking categories** are the dimensions, and only two can be active at a time. Firms use them for department, office, or service line. Client often lives on the contact, not in tracking.
- Rate limits apply per connected organization, per minute and per day. Plan bulk pulls around them.
- The **Reports API** (trial balance, profit and loss, aged receivables) is the tie-out source.
- **Lock dates** block changes before a date. Treat them as period locks.
- The **Demo Company** is free for testing.

### NetSuite

- **SuiteQL** (SQL-like, over REST) is the usual extraction path. **Saved searches** often encode business logic already; prefer them as the extraction contract when they exist.
- **Governance limits** cap how much a script can do. Batch work and handle limit errors by yielding and resuming.
- **OneWorld** (multi-subsidiary) accounts hold both subsidiary-level and consolidated figures. Label which you pulled.
- Custom fields (`custbody_`, `custcol_`, `custrecord_` prefixes) can differ between production and sandbox. Map them explicitly.
- Use external IDs for safe upserts. Check accounting period status before posting.

### Sage Intacct

- Built on dimensions (entity, department, location, project, customer, vendor, employee, and user-defined ones). Carry them as columns.
- Multi-entity setups can auto-balance transactions between entities. Understand the configuration before reconciling.
- Confirm which API the firm's subscription supports (the newer REST API or the older XML web services) before building.

### Larger ERPs

Firms at the top of the size range may run Microsoft Dynamics 365, Oracle, SAP, or Workday. The same rules apply, with more formal change control. Confirm the product version and API surface first; they differ widely between editions.

## Time, projects, and PSA

Time tracking is the revenue driver in a services firm, and it is late, incomplete, and revised.

Common tools: Harvest, Toggl, Clockify, Float and Runn (resourcing), Kantata, BigTime, Scoro, Productive, Teamwork, Accelo, Workamajig and Function Point (agencies), Deltek Vantagepoint and Ajera (architecture and engineering), Clio (law), Karbon (accounting firms).

- **Every time entry has two dates:** when the work happened and when it was entered or last changed. Keep both. Report by the work date; pull by the changed date so late edits are caught.
- **State the cut-off** on every number built from time.
- **Rates in the time tool may differ from the rate card** in the accounting system. Decide which is the source of truth, write it down, and reconcile the other to it.
- **Hours by person are sensitive when combined with pay.** Keep cost rates at role level where you can.
- **Reconcile time to billing:** hours billed should equal billable hours delivered minus write-downs, per scope.

## Payroll and HR

Common tools: Gusto, ADP, Paychex, Rippling, Paylocity, Justworks, TriNet, BambooHR.

- **The most sensitive data in the firm.** Pay, tax IDs, garnishments, benefits. Mask everywhere, keep local, and prefer role-level summaries.
- **The payroll register ties to the ledger** every cycle: gross pay, each tax, each deduction, employer costs, and net pay to the bank.
- **The HR system is usually the headcount source** for FP&A. Plan headcount, HR headcount, and payroll headcount will drift apart. Reconcile monthly.
- Employer taxes have annual wage caps, so the effective rate falls through the year. See `fpna.md`.

## Billing, AP, and spend

- Invoicing may live in the accounting system, the PSA, or a separate billing tool. Know which one issues the legal invoice and treat the others as copies.
- AP and spend tools (for example BILL, Ramp, Brex, Expensify, Navan) act as sub-ledgers. Tie them to the AP or card liability accounts each period.
- Duplicate vendors across tools are normal. Match on tax ID and normalized bank details, never on name alone.

## Banks

| Format | Use |
|---|---|
| BAI2 | US statement and balance reporting |
| CAMT.053 / .052 / .054 | ISO 20022 statement, intraday, and notifications |
| MT940 / MT942 | SWIFT end-of-day and intraday statements |
| PAIN.001 / .002 | ISO 20022 payment initiation and status |
| NACHA | US ACH files |
| CSV export | The common small-firm reality; column layouts vary by bank |

- **Never build a parser from one sample file.** Banks vary within a standard, and the variant you did not see arrives at quarter-end.
- **Tie parsed totals to the file's own control totals** (BAI2 and CAMT carry them) or to the statement's opening and closing balances.
- Bank-data aggregation services carry sensitive credentials. Use only what the firm has already approved.
- **Anything that creates a payment file is Tier 2.** Two approvals, and a person releases it at the bank.

## Spreadsheets and BI

- Excel and Google Sheets are where most finance work lives. Build the data layer well and hand it to the spreadsheet cleanly. Do not force finance into a worse tool.
- BI tools (Power BI, Tableau, Looker, and others) should read one governed set of numbers. Logic copied into each dashboard means dashboards that disagree.
- A spreadsheet that feeds invoices or postings is Tier 2 and cannot provide the controls. Say so. See `tooling.md`.
