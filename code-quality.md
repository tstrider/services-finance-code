# Code Quality

The anti-pattern catalogue. For each: how to spot it, why it costs, and the **smallest** remediation. Name the issue; do not perform an uninvited rewrite.

Finance-specific variants are marked. They matter more than the generic versions because in finance a structural defect usually surfaces as a wrong number rather than a crash.

## Structure

**God object / god module**
Spot: one class or file everything imports, touching unrelated domains. In finance this is usually a `utils.py` or a `FinanceService` that does allocation, FX, tax, and reporting.
Cost: every change risks everything; impossible to test in isolation.
Smallest fix: extract the one cohesive responsibility you are already touching. Leave the rest.

**Giant file**
Spot: past ~500 lines with more than one reason to change.
Cost: merge conflicts, poor discoverability, hidden coupling.
Smallest fix: move the group of functions you are working on into a sibling module. Do not split the whole file.

**Deep nesting**
Spot: more than three levels of indentation.
Cost: unreadable branch logic, missed cases. In finance, missed cases are unhandled account types or currencies.
Smallest fix: guard clauses and early returns. Extract the innermost block into a named function.

**Multi-purpose function**
Spot: the name contains "and," or a boolean parameter selects behavior. `process_invoice(inv, post=True)`.
Cost: callers cannot reason about what happens, and in finance one branch posts to the ledger.
Smallest fix: split into two named functions; keep the old one as a thin delegator if callers are many.

**Circular dependency**
Spot: A imports B imports A; "just move it to utils."
Smallest fix: move the shared type or interface into a third module both depend on.

## Abstraction

**Premature abstraction**
Spot: an interface with one implementation, a factory constructing one thing, a `BaseCalculator` with one subclass.
Cost: indirection traversed forever for flexibility never used.
Smallest fix: inline it. Two concrete cases beat one speculative abstraction.

**Leaky abstraction**
Spot: callers must know the implementation to use it correctly — must call `init` first, must not call twice, must catch a library-specific exception.
Smallest fix: enforce the invariant inside, or delete the layer and use the library directly.

**Wrapper with no value**
Spot: a class whose every method forwards one-to-one to the library beneath.
Smallest fix: delete it, unless you have a concrete plan to swap the library.

## Logic

**Duplicated business logic** *(finance-critical)*
Spot: the same rule implemented twice. A margin calculation in the pricing tool and in the reporting mart. A tax rule in the invoice generator and in the accrual job.
Cost: they diverge, and the divergence is found by a client or an auditor. This is the single most expensive anti-pattern in finance code.
Smallest fix: extract to one function and call it from both. Do this even when the surrounding code is untouched.

**Copy-paste block**
Spot: near-identical blocks differing by one or two values.
Smallest fix: parameterize. But if the two blocks are conceptually different things that happen to look alike right now, leave them. Coincidental duplication is not duplication.

**Magic values** *(finance-critical)*
Spot: `if status == 3`, `rate * 0.21`, `if amount > 10000`, `cost / 2080`.
In services models the billable-hours denominator is the classic one: it belongs in the assumptions block as a named input (default 1,800), never inside a formula.
Cost: nobody knows if changing it is safe, and in finance the number usually encodes a policy, a tax rate, or a contract term that changes on a date.
Smallest fix: named constant plus a comment on provenance ("federal rate per IRC §11, effective 2018"). If it changes over time, it is not a constant at all: move it to effective-dated data.

**Hardcoded value inside a formula** *(finance-critical)*
Spot: a growth rate, utilization assumption, or FX rate typed directly into a calculation or spreadsheet formula.
Cost: invisible, never reviewed, and silently wrong at the next reforecast. The highest-value find when cleaning up an inherited model.
Smallest fix: lift to a named input in one place.

**Speculative feature**
Spot: config flags, hooks, or code paths nothing uses.
Smallest fix: delete. Version control remembers.

**Dead code**
Spot: unreferenced functions, unreachable branches, commented-out blocks.
Smallest fix: delete after a repo-wide search including dynamic references (reflection, string dispatch, config, saved-search names).

## State and errors

**Hidden global state**
Spot: module-level mutable variables, singletons carrying request data, an implicit "current period" or "current entity" read deep in the call stack.
Cost: order-dependent bugs, untestable code, concurrency hazards. In finance, a global "current period" produces numbers whose meaning depends on when the job ran.
Smallest fix: pass it as a parameter on the one call path you are changing.

**Silent failure** *(finance-critical)*
Spot: `except: pass`, `catch {}`, `.catch(() => null)`, ignoring a returned error, or a job that logs a warning and continues after failing to load a rate.
Cost: corruption surfacing days later, far from the cause. In finance the corruption is a number someone already acted on.
Smallest fix: log with context and re-raise, or handle explicitly with a comment saying why swallowing is correct here.

**Fail-open** *(fix on sight)*
Spot: an exception in an auth, approval, or validation path that falls through to allow.
Cost: security vulnerability, and in finance an unapproved payment or posting.
Smallest fix: default deny in the handler. Worth fixing even if uninvited. Flag it as security.

**Inconsistent error handling**
Spot: some paths raise, some return null, some return an error tuple.
Smallest fix: match the dominant convention in the module you are editing. Do not unify the whole codebase uninvited.

## Data and query anti-patterns *(finance-critical)*

These do not look like code smells. They look like working code that returns a wrong number.

**Inner join on a fact table**
Spot: `JOIN` where `LEFT JOIN` plus an assertion belongs.
Cost: silent row loss. The most common cause of quiet data loss in finance pipelines.
Smallest fix: left join, then assert unmatched is zero or explain each one.

**`COALESCE(amount, 0)`**
Spot: a null money value defaulted to zero to make a total tie.
Cost: converts a data problem into a wrong number that reconciles.
Smallest fix: find the missing record. If zero is genuinely correct, comment why.

**`SELECT DISTINCT` as a duplicate fix**
Spot: DISTINCT added because the row count looked wrong.
Cost: hides a fan-out join, and will eventually deduplicate two legitimately identical transactions.
Smallest fix: find the join causing the fan-out.

**Grain mismatch**
Spot: summing a header amount after joining to lines; aggregating an already-allocated column.
Cost: inflated totals that look plausible.
Smallest fix: state the grain in a comment, and assert row counts across the join.

**`is_current` lookup on effective-dated data**
Spot: joining a rate, salary, or mapping table on a current flag.
Cost: historical periods repriced at today's rates. Silent, and it changes prior reported figures.
Smallest fix: resolve by service date.

**Float on money**
Spot: `FLOAT`/`REAL`/`DOUBLE` columns, `float64` in pandas, `Decimal(0.1)` from a literal.
Smallest fix: Decimal or integer minor units. See `money-invariants.md`.

## Naming and clarity

**Misleading name**
Spot: `get_user` writes to the database; `validate` mutates; `temp` is permanent.
Smallest fix: rename with an IDE-safe refactor, or if blast radius is large, add the correct name as a wrapper and deprecate.

**Name missing units or basis** *(finance-critical)*
Spot: `revenue`, `amount`, `rate`, `date`.
Cost: two developers assume different bases and the mismatch surfaces in a consolidation.
Smallest fix: `revenue_usd_accrual`, `usd_per_eur`, `fee_bps`, `service_date`. Never a finance column named `date`, `amount`, `value`, or `type`.

**Comment restating code**
Smallest fix: delete. Replace with a why-comment only where reasoning is non-obvious.

## AI-generated code smells

Increasingly the dominant source of everything above. Look for these specifically when reviewing agent output or cleaning up inherited work.

- **Defensive validation everywhere**: the same null check at every layer instead of once at the boundary.
- **Try/except wrapping everything** with generic messages that lose the original error.
- **Unnecessary abstraction layers** created to look thorough: managers, handlers, services with one method.
- **Docstrings restating signatures** with no information about behavior, units, or failure modes.
- **Invented APIs**: methods, flags, or config keys that do not exist. Verify against the actual library source.
- **Tests that assert the implementation** rather than the requirement, or that pass trivially.
- **Duplicated helper functions** because the agent did not grep before writing.
- **Over-broad refactors** bundled into an unrelated change.
- **Plausible-looking constants**: a tax rate, day count, or utilization figure that is confidently wrong. Agents fill gaps with reasonable-sounding numbers. Verify every literal in finance code against a source.
- **Confident but unverified claims** in comments or PR descriptions.

Cleanup order: delete dead and speculative code, then verify every external API call and every numeric literal, then collapse redundant layers, then fix error handling, then dedupe logic. **Control totals green between each step**, not once at the end.

## Reporting something you found but did not fix

```
Found: <pattern> at file:line
Risk:  <what goes wrong, concretely>
Fix:   <smallest change> (est. <size>)
Scope: outside this change — flagging, not fixing
```
