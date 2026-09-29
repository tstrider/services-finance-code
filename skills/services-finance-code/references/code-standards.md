# Code Standards

Clean code, the anti-patterns to refuse, smells common in AI-written code, and how to choose architecture and dependencies. In finance, a structural defect usually shows up as a wrong number rather than a crash, so these are correctness rules, not style.

## Before writing

- **Read first.** Read the file you will change in full, plus its callers and tests. Search for a function before changing its signature. Match the repo's conventions over general best practice.
- **State three things:** what else could break, which conventions you found, and what you assumed. If what you read contradicts the request, say so before building.
- **Prefer, in order:** change nothing (the request may rest on a misunderstanding), change one function, change one module, add an abstraction. Move down the list only when the option above cannot work, and say why.
- **For a new project,** start simple: one folder, a `pyproject.toml`, a `src/` or flat module, a `tests/` folder, a `data/` folder in `.gitignore`, and a short README saying how to run it and what it ties to.

## While writing

- **Smallest correct change.** No drive-by refactors, no reformatting untouched lines, no renames you were not asked for. List unrelated problems at the end.
- **Functions do one thing.** If the name needs "and", split it. A boolean argument that switches behavior is two functions in one, and in finance one branch usually posts to the ledger.
- **Nesting stops at three levels.** Use guard clauses and early returns.
- **Errors are explicit.** No bare `except:`, no `except Exception: pass`, no ignored return codes. Failures surface where someone can act on them. Never fail open on an approval, permission, or validation path.
- **Validate once, at the edge.** Parse input into a typed shape (a dataclass or a Pydantic model in strict mode), then trust it inside. Do not scatter the same check through every layer.
- **No hidden state.** No module-level mutable variables, no implicit "current period" or "current entity" read deep in the code. Pass them in. Results must not depend on when the job ran.
- **One implementation of every business rule.** Search before writing. Margin in the pricing tool and margin in the report will disagree, and a client or auditor will find it.
- **Names carry units and basis.** `revenue_usd_accrual`, `usd_per_eur`, `fee_bps`, `service_date`. Never `date`, `amount`, `value`, or `type` in finance code.
- **No magic values.** Named constants with a comment saying where the value came from. If it changes over time, it is not a constant; it is dated data. Never type a rate, threshold, or assumption into a formula.
- **Comments explain why,** never what. Delete comments that repeat the code.
- **Type hints on everything,** with `Decimal` for money and never `Any` on a money path.

## Anti-patterns to refuse

For each one: how to spot it, and the smallest fix. When you find one in existing code, name the risk and propose the smallest fix. Do not rewrite uninvited. Exception: fail-open authorization is fixed on sight and flagged as security.

**Duplicated business logic** *(finance-critical)*. Spot: the same rule in two places. Fix: extract to one function and call it from both.

**Magic value in a formula** *(finance-critical)*. Spot: `cost / 2080`, `rate * 0.21`, `if amount > 10000`. Fix: lift to one named input with its source; if it changes on a date, make it dated data.

**Silent failure** *(finance-critical)*. Spot: `except: pass`, a job that logs a warning and carries on after a rate failed to load. Fix: raise with context, or handle explicitly with a comment explaining why.

**Fail open** *(fix on sight)*. Spot: an error in an approval or permission path that lets the action through. Fix: deny by default in the handler.

**Hidden global state.** Spot: module-level mutables, a global current period. Fix: pass it as a parameter on the path you are changing.

**God module.** Spot: one `utils.py` or `FinanceService` that does allocation, FX, tax, and reporting. Fix: move out the one responsibility you are touching.

**Giant file.** Spot: past about 500 lines with more than one job. Fix: move the functions you are working on to a sibling module.

**Premature abstraction.** Spot: an interface with one implementation, a factory that builds one thing. Fix: inline it.

**Speculative feature and dead code.** Spot: flags and paths nothing uses; commented-out blocks. Fix: delete after searching for every reference, including dynamic ones.

**Inconsistent error handling.** Spot: some paths raise, some return None. Fix: match the module's dominant style.

### Data and query anti-patterns *(finance-critical)*

These look like working code that returns a wrong number.

- **Inner join on a fact table.** Use a left join and count the unmatched.
- **`COALESCE(amount, 0)`** to make a total tie. Find the missing record.
- **`SELECT DISTINCT`** as a duplicate fix. Find the fan-out join.
- **Grain mismatch.** State the grain; count rows across the join.
- **`is_current` lookup on dated data.** Resolve by service date.
- **Float on money.** Decimal or integer minor units.
- **pandas `merge` without `validate=` and `indicator=True`.** Use `validate="many_to_one"` (or the right cardinality) so fan-out raises, and `indicator=True` to count unmatched rows.

## Smells common in AI-written code

Look for these in any agent-written code, including your own from earlier in the session.

- The same null check at every layer instead of once at the edge.
- `try/except` wrapped around everything with generic messages that lose the real error.
- Layers of managers, handlers, and services with one method each.
- Docstrings that repeat the signature and say nothing about units or failure modes.
- **Invented APIs:** methods, parameters, or endpoints that do not exist. Check the real documentation or source.
- **Plausible but wrong constants:** a tax rate, day count, or hours figure that sounds right and is not. Verify every number against a source.
- Tests that pass trivially or test the implementation instead of the requirement.
- Helper functions duplicated because nobody searched first.
- Large refactors bundled into a small change.
- Confident claims in comments or summaries that nothing verified.

Cleanup order for inherited code: delete dead and speculative code, verify every API call and every number, collapse needless layers, fix error handling, then remove duplicated logic. **Tie-outs green between each step.**

## Architecture

Decide on evidence, not fashion.

- **Default:** a single, well-organized program with clear internal modules. Split into services only for a named, present-tense reason.
- **For a small firm,** a scheduled script plus a small database (or well-organized files) usually beats a platform. Do not build infrastructure the team cannot run.
- **Consistency beats availability on anything that posts.** A dashboard can be eventually consistent; a posting path cannot.
- **The close is a batch window,** not a stream. Ask when the answer is really needed: continuously, daily, or at close.
- **Reprocessing is a requirement.** You will restate a period. Keep raw data unchanged so you can replay it.
- **Safe re-runs are designed in,** not patched into the retry handler.
- **Point-in-time answers:** "what did we report for March" and "what would we report for March today" must both be answerable.
- **The accounting system is the system of record.** Your code is a consumer. Never make a side system the authority on data the accounting system owns.
- **Record expensive decisions** in a short decision note: context, options, choice, consequences, when to revisit. Keep notes in `docs/decisions/`.

## Dependencies

Before adding a package, check: does the standard library or existing code already do it? Is it maintained (recent releases, more than one maintainer)? Is the license compatible? Any known vulnerabilities? How many other packages does it pull in? How hard would it be to remove later? Is the name exactly right?

- A 30-line helper beats a package with 200 dependencies.
- Pin exact versions in applications and commit the lockfile.
- **A package that computes money can be wrong.** Tax engines, FX feeds, holiday calendars, and amortization libraries all encode decisions. Check them against known answers and pin the version, because a silent update changes your numbers.
- Wrap accounting-system and bank SDKs behind your own thin module. They change and get abandoned.

## Performance

Measure first. No change without a profile or query plan pointing at the code.

- The usual culprits are I/O: missing indexes, unbounded date ranges, one query per row, pulling everything and filtering locally.
- **Confirm the result is unchanged.** Compare control totals before and after, exactly. A faster query with a different number is a regression, not an optimization.

## Reliability

For anything calling another system:

- Timeouts on every call.
- Retries only on operations that are safe to repeat, with backoff and a cap.
- Idempotency keys on anything that creates or pays, enforced by a unique constraint.
- Never hold a database transaction open across a bank or accounting-system call. Record the intent, make the call, record the result, then reconcile.
- When a dependency is down, a finance job should fail loudly and not post.
- Long jobs resume from a checkpoint instead of starting over.

## Reporting what you found but did not fix

```
Found: <pattern> at file:line
Risk:  <what goes wrong, concretely>
Fix:   <smallest change>
Scope: outside this change, flagging not fixing
```
