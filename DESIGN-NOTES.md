# Design Notes

Why this is built the way it is, and what the research behind it says. Useful if you are evaluating whether to adopt it, or considering changing it.

## The problem it solves

AI coding agents default to the shortest path: skip the specs, skip the tests, skip the reconciliation. On most software that produces mediocre code. On financial code it produces a number that looks plausible and is wrong, which is strictly worse than an obvious failure — obvious failures get caught.

Thoughtworks named the broader cost in Technology Radar v34 (April 2026): **cognitive debt**, the widening gap between humans and the systems they nominally own as agents generate more of the code. The industry response has been a return to fundamentals rather than a new methodology, and this skill follows that.

Research on professional developer behavior in 2025 found that experienced developers do not "vibe code" — they deliberately constrain agents through planning and active supervision, limit concurrent tasks, keep agents away from core business logic, and instruct them to follow established style guides. The pattern is control, not delegation. This skill is one such control.

## Why risk tiers

The single most important design decision.

A skill that applies uniform rigor gets abandoned. Demand an architecture decision record before someone can pivot a trial balance and they will stop invoking it within a week, at which point it protects nothing. Demand nothing on a payment run and it protects nothing either.

So discipline scales with consequence:

- **Tier 0** (ad hoc analysis) keeps only the rules that prevent wrong answers: reconcile to a control total, state period and basis, report row counts.
- **Tier 2** (systems of record) adds the full engineering, security, and controls apparatus.

The classification is stated out loud at the start of every task, and escalation is called out when it happens, because "quick analysis that quietly became a monthly process" is how untested code ends up feeding the close.

## Why accounting judgments escalate

Code that infers an accounting treatment from data shape will silently change the financials when the data changes.

```
# WRONG — presentation flips when the data flips
presentation = 'gross' if contract.has_pass_through_spend else 'net'

# RIGHT — a dated decision made by accounting, stored as data
contract.revenue_presentation   # 'gross' | 'net', with rationale and date
```

Principal versus agent under ASC 606 is the sharpest example. Control is the criterion, and identical economics can produce reported revenue differing by the entire pass-through amount. That moves reported growth, margin percentages, revenue-based covenants, and revenue-based compensation — with no change to cash.

The skill presents indicators and evidence, then stops and names the decision as the controller's or auditor's. Records missing a required treatment attribute are flagged rather than defaulted.

## Why enforcement is split three ways

Per the Claude Code documentation, CLAUDE.md content is delivered as context that Claude reads and tries to follow. **There is no guarantee of compliance**, especially for vague or conflicting instructions. Permission rules and hooks, by contrast, are enforced by the client regardless of what the model decides.

So the split is deliberate:

- Judgment, standards, and domain knowledge → the skill and CLAUDE.md
- Things that must never happen → `permissions.deny` and hooks

"Always use Decimal for money" as prose is a suggestion. As a hook that fails the edit, it is a rule. The finance hook exists because the highest-value checks are mechanical.

## Why SKILL.md is front-loaded

After a session compacts, invoked skill bodies are re-injected but **capped at 5,000 tokens per skill and 25,000 total**, and truncation keeps the *start* of the file. So the risk tiers and money invariants sit at the top, and detail lives in `references/` loaded on demand.

Similarly, path-scoped rules in `.claude/rules/` load only when Claude reads a matching file, which saves context — at the cost of being lost after compaction until a matching file is read again. Anything that must always persist belongs in the root CLAUDE.md. That tradeoff is why the finance rules are split the way they are.

## Currency of recommendations

Classified so you know what is durable and what may move.

**STABLE** (decades of evidence): reconcile before analyzing, decimal not float, debits equal credits, posted entries immutable, parameterized queries, least privilege, explicit error handling, failing test before bug fix, evidence-driven performance work.

**CURRENT** (well supported now): OWASP Top 10:2025 as the reference list, treating an agent run as a production change request, keeping agents off core business logic without supervision, risk-based testing over coverage targets, supply-chain vigilance.

**EMERGING** (real but unsettled): Agent Skills as a control mechanism, spec-driven development, harness engineering. The practices are real; the terminology is unstable and suffers semantic diffusion.

**MOVING** (verify before relying): ASU effective dates, PCAOB and COSO expectations for AI-generated code, vendor API capabilities.

**DEPRECATED**: coverage percentage as a quality target, microservices as a default, rewriting working code to modernize it.

## A disagreement worth preserving

Whether AI assistance makes experienced engineers faster is genuinely contested.

METR's July 2025 randomized controlled trial (16 experienced open-source developers, 246 tasks, mature repositories they knew well) found subjects were **19% slower** with early-2025 AI tools while believing they were 20% faster. METR now labels the result historical and notes it may not reflect current tools or workflows. Industry surveys report the opposite.

Both are probably right about different situations — codebase familiarity, task type, and review rigor dominate. The skill therefore refuses to claim a speedup and optimizes for correctness and review quality instead. If you want the real answer for your team, you have to measure it.

## Maintenance

Review quarterly, and immediately when any of these happen:

- A new OWASP Top 10 release
- A new Thoughtworks Technology Radar volume (roughly twice yearly)
- A new FASB ASU affecting anything in `gaap-reference.md`
- A material change to Claude Code skills, memory, or settings behavior
- A major supply-chain incident
- Rigorous research contradicting a classified recommendation

**Recency alone never justifies a change. Vendor marketing never does either.** When sources conflict, preserve the conflict and write a conditional rule rather than silently picking a winner.

## Sources

**Claude Code / Anthropic**
- [Skills](https://code.claude.com/docs/en/skills) · [Memory and CLAUDE.md](https://code.claude.com/docs/en/memory) · [Settings](https://code.claude.com/docs/en/settings) · [Context window](https://code.claude.com/docs/en/context-window)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

**Security**
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/) · [Cheat Sheet Series](https://cheatsheetseries.owasp.org/) · [Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

**Accounting**
- [FASB ASU 2024-03 (DISE) overview](https://viewpoint.pwc.com/us/en/pwc/in-depth/id202406.html)
- [ASC 606 principal vs agent, services context](https://www.mgocpa.com/perspective/gross-or-net-recognize-revenue-media-placement-talent-procurement/)
- Verify all standards and effective dates against FASB directly.

**Engineering practice**
- [Thoughtworks Technology Radar v34: cognitive debt](https://www.thoughtworks.com/about-us/news/2026/combat-ai-cognitive-debt-radar-v34) · [Spec-driven development](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development)
- [METR: Impact of Early-2025 AI on Experienced Developer Productivity](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) ([arXiv](https://arxiv.org/abs/2507.09089))
- [Professional Software Developers Don't Vibe, They Control](https://arxiv.org/pdf/2512.14012)
- [Is Agent Code Less Maintainable Than Human Code?](https://arxiv.org/pdf/2606.21804)
