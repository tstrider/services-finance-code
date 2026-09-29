# Workflows

Step-by-step runbooks. Each one ends with the report from SKILL.md section 10: plain summary first, then the proof.

## Quick analysis (Tier 0)

1. **Pin the question.** "Why is margin down?" cannot be answered. "Why is Q3 gross margin on the Acme retainer 6 points below budget?" can.
2. **Name the source and keep a copy.** System, extract time, filters.
3. **Tie the extract to the system's own report before analyzing.** Analysis on an untied extract is confidently wrong. Never skip this step.
4. **State period, basis, entities, currency, time-entry cut-off, and every exclusion.**
5. Answer the question. Show the bridge, not just the difference.
6. Run the security checklist (most sections n/a) and mask anything sensitive in the output.
7. **Keep the script and the extract** so the answer can be reproduced.

Speed matters. No ceremony. But never skip step 3.

## Margin by client or scope (Tier 0 or 1)

1. Pull time entries (by changed date, reported by service date), rate cards, cost rates, invoices, write-downs, and pass-through costs.
2. State the time-entry cut-off and the billable-hours assumption (default 1,800, invite a correction).
3. Value hours at the rate in effect on each service date. Count hours with no matching rate; never drop them.
4. Cost hours at cost per billable hour by role.
5. Tie total hours to the time system's own report and total revenue to the accounting system's P&L.
6. Show revenue (gross and net if pass-throughs exist), direct cost, margin, over-servicing in dollars, realization, and fee burn for fixed-fee scopes.
7. Flag scopes missing a revenue presentation decision instead of guessing.

## Building or changing a model (Tier 1)

1. Classify every number as a driver, a rate, or derived.
2. Keep inputs, calculations, and outputs apart.
3. Source assumptions from actuals and note where each came from.
4. Build sanity checks in as assertions.
5. **Save a new version;** never overwrite a prior forecast.
6. Show sensitivity on the two or three drivers that matter.
7. Tie actuals to the ledger before comparing anything to them.

## Building a data pipeline (Tier 1 or 2)

1. **Land raw first,** unchanged and timestamped.
2. Type and clean in staging. Split combined account strings into columns once.
3. Apply business logic in one place.
4. **Check at every boundary:** row counts across joins, control totals, single currency, no future dates, rate versions with no overlaps or gaps.
5. **Tie to the source system's own report per period,** as a test.
6. Output the tie-out block every run.
7. Alert on control-total movement, not only on failure.
8. Keep extracts out of git.

## Connecting to a system (Tier 2 when it writes)

1. **Read the current API docs** and confirm which product edition and API version you are on.
2. Confirm the access the user's setup provides. Do not ask for more than the task needs.
3. **Sandbox or test company first** for anything that writes.
4. Read amounts without passing through floats.
5. Plan for limits, paging, timeouts, and expired logins.
6. **Treat a period lock as an expected outcome.**
7. Use external IDs so retries do not duplicate.
8. Never hold a database transaction open across the call. Record intent, call, record result, reconcile.
9. **Read back what you wrote** and compare. A success response is not proof.
10. Before the first live write, show exactly what will be written and get a yes.

## Automating a close task (Tier 2)

1. **Watch the manual process first.** Write down what the person actually does, including the judgment calls. Do not automate the judgment calls.
2. Encode the dependencies, not just the task.
3. **Parallel run for at least one full cycle.** Explain every difference.
4. Keep the reviewer step. Automation prepares the entry; a person approves it.
5. Keep the evidence: what ran, on what data, who reviewed it.

## Reviewing finance code

Read in this order and stop at the first blocking problem:

1. **Does it tie out?** If there is no tie-out, that is the finding.
2. **Grain and joins.** Row counts checked? Inner joins that could drop rows? Fan-out?
3. **Decimal throughout?** Any float, any `Decimal(0.1)`, any JSON amount parsed as float?
4. **Rounding** explicit and done once?
5. **Currency** mixed anywhere?
6. **Dates:** right field for the purpose? Rates by service date? Time cut-off stated?
7. **Billable hours:** any 2,080 in a cost calculation? Any hours figure buried in a formula?
8. **Immutability:** any edit or delete of posted records?
9. **Security checklist.**
10. Naming and readability last.

Label each comment **blocking** (wrong number, security, data loss), **should fix**, or **nit**.

## Explaining a variance nobody can explain

1. **Check the comparison is valid:** same period definition, entities, basis, currency treatment, hierarchy version, time cut-off. Most "unexplained" variances are comparison errors.
2. Look for a **reorganization or mapping change** between the two points.
3. Look for **late time and late transactions:** re-pull the earlier period and compare to the saved extract.
4. Separate **FX** from real movement.
5. Break it down: volume, rate, mix, timing, one-offs. The bridge ties exactly; anything left is shown as unexplained.
6. Only then look for a data error.

## Cleaning up an inherited model or pipeline

Tie-outs stay green between every step.

1. **Capture today's answers first,** right or wrong. That is the baseline.
2. **Check whether it ever tied out.** If not, say so at once; that turns a cleanup into a rebuild.
3. Delete dead code, unused scenarios, and unused flags.
4. **Hunt numbers typed into formulas.** The highest-value find.
5. Merge duplicated business logic into one place.
6. Fix float, rounding, and currency handling.
7. Replace current-rate lookups with service-date lookups.
8. Add the missing checks: row counts, control totals, balance.
9. **Compare to the baseline and explain every difference.** Differences at this stage are usually bugs you just fixed. Write them up for the owner rather than quietly adopting the new numbers.

**Never present a corrected number without saying it differs from what was reported before.** Someone may have acted on the old one.

## Session habits

- Re-read the task and constraints before the final pass on long sessions.
- Review your own diff before reporting. Approving unread output is behind most of the defects this skill exists to prevent.
