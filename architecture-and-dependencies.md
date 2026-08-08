# Architecture and Dependencies

## Architecture: decide on evidence, not fashion

Before recommending any structural change, get answers to these. If you cannot, say so rather than guessing.

| Factor | Why it decides |
|---|---|
| Team size and boundaries | Services below team count add coordination cost without benefit |
| Change rate per area | Split what changes at different rates, not what sounds separable |
| Reliability target | An SLO justifies redundancy; a hunch does not |
| Latency and consistency needs | Strong consistency requirements often kill the distributed design |
| Ops maturity | Do not run a distributed system without on-call, tracing, and runbooks |
| Data volume, real not projected | Most "scale" problems are index problems |
| Cost | Including the engineer-hours to operate it |
| Reversibility | Prefer decisions you can undo |

**Default position**: a well-structured monolith with clear internal module boundaries. Extract a service when you have a named, present-tense reason: independent scaling profile, independent deploy cadence blocking a team, or a hard isolation requirement. "We might need to scale" is not one.

**Evolutionary architecture**: make the boundary a module first. If it stays clean for six months and the reason still holds, extract it. Modules are cheap to move; services are not.

**Complexity ratchet**: every added moving part must pay rent. Ask what breaks if you remove it. If the answer is "nothing yet," it should not be there yet.

## Architecture in finance systems specifically

Finance adds constraints that change the usual answers.

**Consistency usually beats availability.** A ledger that accepts a write during a partition and reconciles later is a ledger that has to explain itself to an auditor. Eventual consistency is fine for a dashboard, rarely fine for a posting path. Know which one you are building.

**The close is a batch window, not a stream.** Most finance workloads are periodic, deadline-driven, and reprocessed. Architectures optimized for low-latency streaming often fit badly. Ask when the answer is actually needed: continuously, daily, or at close.

**Reprocessing is a first-class requirement.** You will restate a period. If your design cannot replay from raw and produce a corrected, labeled result, it will be rebuilt within two years. This is why the raw layer is immutable.

**Idempotency is architectural, not incidental.** Anything that posts, bills, or pays must be safe to re-run. Decide this at the boundary design stage, not in the retry handler.

**Point-in-time correctness.** "What did we report in March, and what would we report for March today?" are different questions and both are legitimate. An architecture that cannot answer both will lose arguments with auditors.

**The ERP is the system of record.** Your service is a consumer. Designs that make an internal service authoritative over data the ERP also owns create a reconciliation problem you will own forever.

**Segregation of duties constrains the design.** If one service can both create a payee and approve payment, no amount of application logic makes that compliant. Split at the service or role boundary.

### ADR template

Record any decision that is expensive to reverse.

```markdown
# ADR-0007: <Decision in one line>

Date: 2026-08-08
Status: Accepted | Superseded by ADR-00XX | Deprecated

## Context
What forces are at play. Constraints, requirements, what we know and what we don't.
For finance systems, state explicitly: what is the system of record, what the
reprocessing story is, and whether this is in scope for financial reporting.

## Options considered
1. <Option> — pros / cons / cost
2. <Option> — pros / cons / cost
3. Do nothing — pros / cons

## Decision
What we chose and the deciding factor.

## Consequences
What becomes easier. What becomes harder. What we now owe.

## Revisit when
The concrete signal that would make us reopen this.
```

Store in `docs/adr/`. Never edit an accepted ADR; supersede it with a new one.

## Dependencies: the scorecard

Score before adding. A "no" on any starred line is a blocker until justified in writing.

| Check | Question |
|---|---|
| * Necessity | Does the stdlib, the framework, or existing code already do this? |
| * Maintenance | Last release? Open issues answered? More than one maintainer? |
| * License | Compatible with our distribution model? |
| * Security | Known CVEs? How fast were past ones fixed? |
| Transitive weight | How many packages does it drag in? |
| Runtime cost | Bundle size, cold start, memory |
| API stability | Breaking-change frequency across recent majors |
| Adoption | Production use elsewhere, or a solo weekend project? |
| Provenance | Published from a verifiable source? Name exactly right (typosquat check)? |
| Exit cost | How hard is removal in a year? Isolated in one adapter, or spread everywhere? |

**Rules of thumb**

- A 30-line utility beats a 200-transitive-dependency package.
- Wrap third-party libraries you expect to replace behind your own thin interface. Do not wrap ones you never will; that is premature abstraction.
- Pin exact versions in applications; use ranges in libraries. Commit lockfiles either way.
- Automate vulnerability alerts. Update deliberately on a cadence, not reflexively on every alert and not never.
- Never add a package because it is trending.

### Dependencies in finance code specifically

- **A dependency that computes money is a dependency that can be wrong.** Tax engines, FX providers, date and holiday calendars, and amortization libraries all encode decisions. Verify against known answers before trusting, and pin the version, because a silent update changes your numbers.
- **Date and calendar libraries deserve unusual scrutiny.** Fiscal calendars, business-day conventions, and holiday sets vary by jurisdiction and change annually.
- **Prefer `Decimal` from the standard library** over a third-party money type unless you need multi-currency arithmetic with enforced currency safety. If you do adopt one, check how it rounds and how it allocates.
- **A dependency in a SOX-relevant path is in scope for change management.** Upgrading it is a program change. Budget for the evidence, not just the merge.
- **Vendor SDKs for ERPs and banks** are often thin, poorly versioned, and occasionally abandoned. Wrap them. You will replace them.

## Performance

Evidence only. The order is: **measure, find the bottleneck, fix that one thing, measure again.**

- No optimization without a profile, query plan, or trace pointing at the code you are about to change.
- The bottleneck is usually I/O: N+1 queries, missing index, serial network calls, unbounded result sets. Check those before touching algorithms.
- Establish the target first. "Faster" is not a target. "p95 under 200ms" is.
- Record before and after numbers. An optimization with no measurement is a guess with extra risk.
- **In finance, verify the result is unchanged.** Compare control totals before and after, exactly. A faster query returning a different number is not an optimization, it is a regression that got promoted.
- Common finance-specific wins: pre-aggregate at the reporting grain rather than re-aggregating a fact table per query; index on the period and entity columns everything filters by; bound date ranges by default; push filters into the source-system extract rather than pulling everything and filtering locally.

## Reliability

For anything crossing a network boundary:

- **Timeouts on every call.** A missing timeout is the most common cause of cascading failure.
- **Retries only on idempotent operations**, with exponential backoff, jitter, and a cap.
- **Idempotency keys** on payments and any mutation a client may retry, enforced by a database unique constraint.
- **Circuit breaking or a bulkhead** where a slow dependency can exhaust your pool.
- **Graceful degradation**: define what the feature does when the dependency is down. For a finance job, "fail loudly and do not post" is usually the correct degraded behavior.
- **Correct transaction boundaries.** Never hold a transaction open across a network call to a bank or ERP. Use an outbox.
- **Design for resume, not restart.** Period-length jobs that must start over on failure will eventually miss a close deadline.

## Observability

- Structured logs (JSON) with a correlation or run ID threaded through.
- Log at boundaries and decisions, not in loops. **Never log secrets, bank details, tax IDs, salary, or PII.**
- Metrics on what you would page on: error rate, latency percentiles, saturation, queue depth.
- Tracing when a request crosses more than two services.
- Error messages that say what failed, what input caused it, and what the caller should do.

**Finance-specific**: alert on **control-total movement**, not only on job failure. A job that completes successfully with a total 15% off is the dangerous case; a job that crashes gets noticed. Also alert on missing expected data (a source that sent nothing is not the same as a source that sent zeros), on unmatched reconciliation items exceeding a threshold, and on any run that posts outside its expected window.

Do not add distributed tracing infrastructure to a system that fits on one box.
