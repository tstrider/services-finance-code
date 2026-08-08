# Workflows

Runbooks. Each ends with the report block from SKILL.md §9.

## Ad hoc analysis (Tier 0)

1. **State the question precisely.** "Why is margin down" is not answerable. "Why is Q3 gross margin 4.2 points below budget for the services line" is.
2. **Establish the source and pin it.** System, extraction timestamp, filters. Snapshot it.
3. **Reconcile before analyzing.** Tie the extract to the source system's own report. Analysis on an unreconciled extract is wasted work, and worse, it is confidently wrong.
4. **State period, basis, entity, currency, and every exclusion.**
5. Answer the question. Show the bridge, not just the delta.
6. **Keep the file.** You will be asked to reproduce this.

Speed matters here. Do not add ceremony. But never skip step 3.

## Building or changing a model (Tier 1)

1. Identify drivers and rates. Every number is a driver, a rate, or derived. If a value cannot be classified, the model is wrong.
2. Separate inputs, calculations, and outputs physically.
3. Source the assumptions from actuals, and cite where each came from.
4. Build sanity assertions in: balance sheet balances, cash non-negative without a facility, margins in a plausible band, capacity constrains revenue.
5. **Preserve the vintage.** Never overwrite a prior forecast version.
6. Sensitivity on the two or three drivers that matter. Not a point estimate.
7. Reconcile actuals to the GL before comparing anything to them.

## Building a data pipeline (Tier 1 or 2)

1. **Land raw first.** Immutable, timestamped, never transformed in flight.
2. Type and conform in staging. Split concatenated account strings into dimension columns here, once.
3. Apply business logic in core, **exactly once**. Logic duplicated across marts diverges within a quarter.
4. **Assert at every boundary**: row counts across joins, control totals, single currency, no future postings, effective-date ranges non-overlapping and gapless.
5. **Tie to the source system's own report per period.** This is the test that matters; no other compensates.
6. Produce the reconciliation block as output, not as an internal check.
7. Alert on control-total movement, not only on job failure. A job that succeeds with a total that moved 15% is the dangerous case.

## Integrating with a source system (Tier 2)

1. **Read the API docs and the data model before writing anything.** Confirm which product version and which API surface you are on.
2. **Sandbox first.** Always.
3. Prefer the system's own saved search or report as the extraction contract over hand-built queries.
4. Design for resume: rate limits, pagination, timeouts, partial failure, and governance limits are normal conditions.
5. **Handle period lock as an expected outcome**, not a crash.
6. Idempotency key on every write, enforced by a unique constraint in the target.
7. Never hold a transaction open across the call. Outbox pattern: record intent, submit, record result, reconcile.
8. Reconcile what you wrote against what the system says it has. Do not trust a 200 response as proof of state.
9. Security review before production. Credentials, scopes, and least privilege.

## Automating a close task (Tier 2)

1. **Watch the manual process first.** Document what the human actually does, including the judgment calls. The judgment calls are the part you must not automate.
2. Encode the dependency, not just the task. Sub-ledgers before GL, allocations after cost is complete.
3. **Parallel run for at least one full cycle.** Reconcile every difference to zero or explain each individually. Never cut over on a green test suite.
4. Preserve the reviewer step. Automation produces the entry; a human approves it.
5. Evidence retained: what ran, on what data, who reviewed it.

## Reviewing finance code

Read in this order:

1. **Does it reconcile?** Find the tie-out. If there is none, that is the review finding; stop there.
2. **Grain and joins.** Row counts asserted? Any inner join that could drop rows? Any fan-out?
3. **Decimal throughout?** Any float touching money? Any `Decimal(0.1)`?
4. **Rounding**: mode explicit, applied once?
5. **Currency**: mixed anywhere without an explicit rate, rate type, and rate date?
6. **Dates**: correct field for the purpose? Effective-dated lookups by service date?
7. **Immutability**: any `UPDATE` or `DELETE` against posted records?
8. **Security triggers** (SKILL.md §3), if any.
9. Naming and readability last.

Label every comment **blocking** (wrong number, security, data loss), **should fix**, or **nit**. Unlabeled review comments waste the author's time.

## Investigating a variance you cannot explain

1. **Confirm the comparison is valid.** Same period definition, same entity set, same basis, same currency treatment, same hierarchy version. Most "unexplained" variances are comparison errors.
2. Check for a **reorganization or mapping change** between the two points. Prior-period figures under a new hierarchy legitimately differ.
3. Check for **late-arriving transactions**: re-pull the prior period and compare to your snapshot.
4. Check **FX**: separate constant-currency from reported movement.
5. Decompose: volume, rate, mix, timing, one-offs. **The bridge must tie exactly.** If a residual remains, show it as unexplained rather than absorbing it into "other."
6. Only then look for an error in the underlying data.

## Performance on a slow finance query

1. **Measure.** Query plan or profile. No plan, no change.
2. Usual suspects in order: missing index on the join or filter column, unbounded date range, fan-out from a bad join, row-by-row processing that should be set-based, and re-aggregating a fact table that should be pre-aggregated.
3. **Verify the result is unchanged.** Compare control totals before and after, exactly. A faster query returning a different number is not an optimization.
4. Record before and after in the PR.

## Cleaning up an inherited finance model or pipeline

Order matters. Tests and control totals green between every step.

1. **Establish the current answer first.** Capture control totals and outputs before touching anything. That is your regression baseline, whether or not it is correct.
2. **Find whether it reconciles at all.** If it never tied out, say so immediately — that changes the nature of the work from cleanup to rebuild.
3. Delete dead code, unused scenarios, and speculative flags.
4. **Hunt hardcoded values inside formulas.** These are the highest-value find: invisible, wrong, and never reviewed.
5. Find duplicated business logic and consolidate to one implementation.
6. Fix float-to-Decimal, rounding, and currency handling.
7. Replace `is_current` lookups with service-date resolution.
8. Add the missing assertions: row counts, control totals, balance.
9. **Now** compare to the baseline and explain every difference. Differences you find at this stage are usually bugs you just fixed. Document them for the owner rather than silently adopting the new number.

Never present a corrected number without flagging that it differs from what was previously reported. Someone may have acted on the old one.

## Session hygiene

- One task per session; clear context between unrelated work.
- Re-read the plan and any constraints before the final pass on long sessions; earlier instructions get summarized away during compaction.
- Delegate large reads (log dumps, big extracts, research) to a subagent so the content stays out of the main context.
- Review the diff yourself. Approving unread output is the failure mode behind most of the defects this skill exists to prevent.
