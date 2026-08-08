# ERP and Systems Integration

Named systems as of 2026, with the integration hazards specific to each. Vendor landscapes shift; verify current API versions and capabilities before building.

## Universal rules

1. **The source system is the system of record.** When your pipeline disagrees with the ERP, your pipeline is wrong until proven otherwise.
2. **Extract to staging, then transform.** Land raw, transform downstream. You cannot debug what you did not land, and you cannot re-run history you did not keep.
3. **Sandbox first** for anything that writes. Always. No exceptions for "small" changes.
4. **Design for resume, not restart.** Rate limits, pagination, timeouts, and partial failure are normal, not exceptional.
5. **Idempotency keys on every write.** Enforced by a unique constraint in the target where possible.
6. **Never hard-delete.** Never write directly to GL tables. Use the documented API or import path.
7. **Prefer the system's own saved search or report as the extraction contract.** It encodes business logic you would otherwise reimplement incorrectly, and it stays aligned when the business changes.
8. **Period locks are expected conditions**, not errors. Month-end is exactly when your job runs and exactly when the period closes.
9. **Snapshot every extraction** with a timestamp. A prior period re-pulled today may differ from last week's pull, and unexplained variance movement is usually this.

## ERP

### Oracle NetSuite
Widely used in mid-market and one of the largest installed bases.

- **SuiteQL** (SQL-ish, via REST) is the best general extraction path. **Saved Searches** via SuiteTalk are often better for anything encoding business logic. RESTlets for custom endpoints; SOAP SuiteTalk is legacy but still present.
- **Governance units** are the thing that breaks naive integrations. Every operation consumes units against a per-script limit. Budget them, batch accordingly, and handle governance exceptions by yielding rather than failing.
- Subsidiary, department, class, location are the standard segment dimensions. **OneWorld** multi-subsidiary adds consolidation and elimination complexity; know whether you are pulling subsidiary-level or consolidated figures, because both exist and they differ.
- Custom fields carry `custbody_` / `custcol_` / `custrecord_` prefixes and are not stable across environments. Map them explicitly.
- Period locks via accounting period status. Check before posting.
- Internal IDs versus external IDs: use external IDs for idempotent upserts.

### Sage Intacct
Strong in services businesses and nonprofits, which makes it common in agencies.

- Dimension-based rather than segment-string-based: entity, department, location, project, customer, vendor, employee, item, plus user-defined dimensions. This is a genuine strength for reporting and it means your model should carry dimensions as columns, not parse a concatenated account string.
- Web Services (XML) API with a session-based flow; REST API availability has been expanding. Confirm current support.
- Multi-entity with shared or separate chart of accounts, and inter-entity transactions that auto-balance via due-to/due-from. Understand the configuration before reconciling.

### SAP (S/4HANA and ECC)
Largest enterprise footprint.

- S/4HANA: OData services, CDS views, and the API Business Hub. ECC: BAPIs, IDocs, and RFC. They are different integration worlds; confirm which you are on.
- **Universal Journal (ACDOCA)** in S/4HANA unifies FI and CO into a single line-item table. It is the right target for most financial extraction and it is large; filter server-side.
- Company code, profit center, cost center, and functional area are the primary dimensions. GL account plus cost element behavior differs between ECC and S/4.
- Document types, posting keys, and number ranges matter for anything writing. Never invent a document number.
- Change control is typically strict and transport-based. Expect a formal path to production.

### Oracle Fusion Cloud ERP
- REST APIs plus BI Publisher reports plus BICC for bulk extraction. BICC is usually the right tool for volume.
- Chart of accounts as a structured segment string; parse it into columns in staging rather than carrying the concatenation.
- Essbase-backed balances cubes for reporting; querying the cube and querying the transaction tables give different answers by design.

### Microsoft Dynamics 365 Finance
- Data Entities via OData, plus the Data Management Framework for bulk. Dataverse for the Power Platform surface.
- Financial dimensions are configurable and the dimension set is client-specific. Never assume a fixed dimension list.

### Workday Financial Management
- Workday is worklet and business-process driven. **RaaS (Reports as a Service)** is the practical extraction path; the REST and SOAP APIs exist but reports are usually the sane contract.
- Worktags are the dimension model and they are pervasive. Business processes drive approvals, so writes go through a process, not a table.
- Often paired with Workday Adaptive Planning for FP&A, and Workday HCM as the headcount source of truth.

## EPM / FP&A platforms

- **Anaplan** — multidimensional hyperblock model. Very large enterprise, multi-year rollouts. Integration via Anaplan Connect or the API; be aware model size and sparsity drive performance and cost.
- **Workday Adaptive Planning** — mid-market to enterprise, tight Workday integration, strong for workforce planning.
- **OneStream** — unified CPM including consolidation, common where statutory consolidation and planning need to live together.
- **Oracle EPM Cloud (and legacy Hyperion)** — enterprise standard for consolidation and planning; Essbase underneath.
- **Planful** — FP&A-focused, faster to deploy than Anaplan.
- **Vena** — Excel-native front end over a database. Good adoption where finance will not leave Excel.
- **Pigment**, **Cube**, **Drivetrain**, **Abacum** — newer entrants, lighter deployment. Verify current capability before committing.

Integration rule for all of them: **the plan data lives in the EPM tool, the actuals live in the ERP.** Push actuals in, do not pull plan out and re-derive it elsewhere. Two systems both claiming to hold the forecast is how vintages get destroyed.

## AP, spend, and procure-to-pay

- **Coupa** — procurement-led, large global enterprises, strong supplier and sourcing side.
- **Tipalti** — mid-market to enterprise, global mass payments, multi-currency, supplier tax collection (W-8/W-9), payment method breadth.
- **BILL** — SMB to mid-market, strong QuickBooks and mid-market ERP sync.
- **Ramp**, **Brex** — card-first spend management with AP attached. Fast-moving feature sets; check current API surface.
- **Airbase** — procure-to-pay plus spend management for mid-market and up.
- **AvidXchange**, **Stampli**, **Rillion**, **Order.co** — AP-specific alternatives with different industry strengths.

Integration hazards: these systems are usually the **sub-ledger**, and the ERP holds the GL. Reconcile the sub-ledger to the GL control account every period. Duplicate vendor records across systems are the norm, not the exception; match on tax ID and normalized remit-to, never on name alone.

## Close, reconciliation, and controls

- **BlackLine** — enterprise standard for account reconciliation, transaction matching, journal entry, and close task management.
- **FloQast** — close management and reconciliation, popular with mid-market and accountant-friendly.
- **Trintech** (incl. Adra) — reconciliation across mid-market and enterprise.
- **Numeric** — newer, AI-forward close tooling.

If one of these is in place, **it owns the reconciliation record.** Do not build a parallel reconciliation in a warehouse that diverges from the system of record for controls.

## Treasury

- **Kyriba** — the widely used dedicated TMS: cash positioning, liquidity, payments, FX and debt management.
- **GTreasury**, **Coupa Treasury** (formerly Bellin), **FIS Quantum**, **ION Treasury** — enterprise alternatives.
- Bank portals and host-to-host connections for direct connectivity.

## Billing and revenue

- **Zuora** (incl. Zuora Revenue, formerly RevPro) — enterprise subscription billing and ASC 606 automation at scale.
- **Stripe Billing** and **Stripe Revenue Recognition** — strong where Stripe is already the processor.
- **Chargebee**, **Maxio**, **Recurly** — subscription billing across mid-market.
- **Salesforce Revenue Cloud / CPQ** — where the quote-to-cash motion starts in Salesforce.

## People-based services: agencies, law firms, consultancies

Directly relevant to agency finance:

- **Workamajig** — agency-specific project management plus accounting. Integrates with media buying systems including Mediaocean, Strata/FreeWheel, and Bionic.
- **Mediaocean** — media buying and billing platform; its accounting side (Spectra, Ignitia) manages media invoicing, payments, and reconciliation. Media reconciliation between planned, ordered, delivered, and invoiced is its own discipline and a frequent source of disputes.
- **Deltek Vantagepoint / Maconomy** — project-based ERP for agencies and professional services.
- **Kantata** — PSA with project accounting, revenue recognition, and profitability.
- **Harvest**, **Toggl**, **Float**, **Runn** — time tracking and resource management; usually the source of billable hours, and therefore the source of your revenue driver.

**The services-firm hazard**: in any people-based business, time entry is the revenue driver, and time entry is late, incomplete, and revised. Any margin or fee-burn calculation must state its time-entry cut-off and handle late entries as restatements of a prior view rather than silent changes.

## Payroll and HCM

- **Workday HCM**, **ADP**, **UKG**, **Paylocity**, **Paycom**, **Rippling**, **Gusto**, **TriNet**.
- Payroll data is highly sensitive. Access-controlled, encrypted, never in a shared notebook, never in a log line.
- HCM is usually the headcount source of truth for FP&A. Reconcile plan headcount to HCM actual headcount every cycle; they will diverge.

## Banking formats and connectivity

| Format | Use |
|---|---|
| **BAI2** | US bank statement and balance reporting |
| **MT940 / MT942** | SWIFT statement (end of day / intraday) |
| **CAMT.053 / .052 / .054** | ISO 20022 statement, intraday, debit-credit notification. Increasingly the standard |
| **PAIN.001 / .002** | ISO 20022 payment initiation and status |
| **NACHA ACH** | US ACH origination |
| **EDI 820 / 810** | Remittance advice / invoice |

Notes: ISO 20022 migration is ongoing across payment rails; confirm what your banks currently accept. Parsing is unforgiving of format variants, and banks vary within a nominal standard. **Never build a parser from a sample file alone** and always reconcile parsed totals to the statement's own control totals.

## BI and the spreadsheet layer

- **Power BI**, **Tableau**, **Looker**, **Sigma**, **Qlik** — reporting layer. Push semantics into a governed model rather than replicating logic per dashboard, or your dashboards will disagree with each other and with the ERP.
- **Excel and Google Sheets** remain where most modeling actually lives. This is not a failure state; it is the tool finance is fluent in. Engineering respect for it means: build the data layer well, expose it cleanly, and do not force finance into a worse tool.
- For generated spreadsheets, use `openpyxl` or `xlsxwriter` and preserve formulas where the recipient must audit the math. A hardcoded value where a formula belongs makes the file unauditable.
- **Never let a spreadsheet become a system of record for Tier 2 work.** It has no access control, no audit trail, and no referential integrity. If it has become one, say so and propose a path off it.
