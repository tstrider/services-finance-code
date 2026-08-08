# Install

One self-contained skill plus drop-in Claude Code configuration.

For the short version, see the Quick start in the [README](../README.md). This page covers the full setup, verification, and the reasoning behind the structure.

## Before you start

If you already have a general-purpose coding skill installed, note that this one is self-contained: it includes clean code fundamentals and a security review, not just finance domain knowledge. Running it alongside another broad engineering skill means Claude gets two overlapping instruction sets and has to pick between them, which is worse than either alone. Prefer one or the other.

## What's in the repo

```
install.sh                         one-command installer (run with: bash install.sh)
skills/clean-finance-code/
  SKILL.md                         risk tiers, money invariants, clean code, security,
                                   reconciliation, ledger, controls, GAAP, domains
  references/                      19 files, loaded on demand

    — engineering and tooling —
    modern-toolchain.md            named 2026 tools run as gates: uv, ruff, mypy strict,
                                   pydantic, pytest, SQLFluff, dbt contracts and unit tests,
                                   Excel and Power Query discipline, gitleaks, semgrep,
                                   pip-audit, SBOM/SLSA/Sigstore, CI structure, AI-dev
                                   controls, and the adoption order
    code-quality.md                anti-pattern catalogue with smallest-remediation guidance,
                                   including the data and query anti-patterns that produce
                                   wrong numbers rather than crashes, plus AI code smells
    architecture-and-dependencies.md  decision factors, ADR template, dependency scorecard,
                                   performance, reliability, observability, and the
                                   constraints finance adds to each
    self-review.md                 pre-report checklist: code, numbers, security, honesty
    testing-finance-code.md        golden datasets, property tests, edge cases that occur
    security-review.md             OWASP Top 10:2025 checklist scoped to finance systems

    — finance correctness —
    money-invariants.md            decimal, rounding, allocation, FX, signs — working code
    reconciliation-and-controls.md control totals, SOD, audit trail, ITGC, sensitive data
    gaap-reference.md              ASC 606/830/842/450, recent ASUs, escalation triggers
    data-modeling.md               COA, dimensions, grain, effective dating, warehouse layers
    erp-and-systems.md             named 2026 systems and their integration hazards
    workflows.md                   runbooks: analysis, models, pipelines, close, review, cleanup

    — by function —
    commercial-finance.md          DEEP — pricing, rate cards, scopes, margin defense
    fpna.md                        DEEP — drivers, vintages, variance bridges, headcount
    ap.md  ar-billing.md  treasury.md  controllership.md
    finance-products.md            building in-house finance tools

  helpers/
    money.py                       tested Decimal helpers (37 passing tests)
    test_money.py

config/
  CLAUDE.md                        project template — fill in the bracketed parts
  settings.json                    → .claude/settings.json
  TOKEN-BUDGET.md                  why each setting is there
  rules/finance-code.md            → .claude/rules/   (path-scoped to finance paths)
  rules/security-sensitive.md      → .claude/rules/
  rules/tests.md                   → .claude/rules/
  hooks/guard-destructive.sh       → .claude/hooks/
  hooks/format-and-lint.sh         → .claude/hooks/
  hooks/guard-finance-numerics.sh  → .claude/hooks/

docs/
  INSTALL.md                       this file
  DESIGN-NOTES.md                  why it is built this way, research and sources
```

## 1. Install

From inside the repo folder:

```bash
bash install.sh
```

Run it with `bash`, not `./install.sh`, so no executable bit is needed. It copies the skill, config, rules, and hooks into the current project, sets permissions, adds the right entries to `.gitignore`, and verifies the hooks actually fire.

| Command | Scope |
|---|---|
| `bash install.sh` | Skill + config into this project |
| `bash install.sh --user` | Skill only, into `~/.claude/skills/` for all projects |
| `bash install.sh --skill-only` | Skill into this project, no config changes |

It backs up anything it would overwrite with a `.bak-<timestamp>` suffix, and it is safe to re-run.

### Or install manually

```bash
mkdir -p .claude/skills .claude/rules .claude/hooks

cp -R skills/clean-finance-code .claude/skills/
cp config/CLAUDE.md      ./CLAUDE.md
cp config/settings.json  .claude/settings.json
cp config/rules/*.md     .claude/rules/
cp config/hooks/*.sh     .claude/hooks/
```

No `chmod` needed: `settings.json` invokes each hook as `bash "<path>"`, so the executable bit is irrelevant. Set it anyway if you like to run the hooks directly.

For a personal install available in every project, copy the skill to `~/.claude/skills/` instead.

## 2. Configure (required)

The installer cannot do these two, and skipping them makes the setup worse than not installing it:

**Edit `CLAUDE.md`** and replace every `<bracketed>` placeholder with your real build, test, lint, and typecheck commands.

**Edit `.claude/settings.json`** and adjust the `permissions` lists to your stack. They currently assume npm and pytest, so Claude will prompt on every command until you change them.

Add to `.gitignore` if the installer did not (it only touches an existing git repo):

```
.claude/settings.local.json
CLAUDE.local.md
```

## 3. Verify

```bash
cd skills/clean-finance-code/helpers && python3 -m pytest test_money.py -q
# expect: 37 passed

echo '{"tool_input":{"command":"git push --force"}}' | bash .claude/hooks/guard-destructive.sh; echo "exit=$?"
# expect: exit=2

printf 'CREATE TABLE i (total_amount FLOAT);' > /tmp/t.sql
echo '{"tool_input":{"file_path":"/tmp/t.sql"}}' | bash .claude/hooks/guard-finance-numerics.sh; echo "exit=$?"
# expect: exit=2, flagging FLOAT on a money field
```

In a session: `/context` to confirm CLAUDE.md loaded and see your startup cost, `/doctor` for trim suggestions, and `/skills` to confirm `clean-finance-code` is listed.

## 4. Token budget

Read `config/TOKEN-BUDGET.md`. In order of impact:

1. **Disconnect MCP servers you are not using.** Usually the largest fixed cost by far.
2. **Keep CLAUDE.md under 200 lines.** No directory trees, no dependency lists.
3. **Procedures go in skills**, not CLAUDE.md. Skills load on demand.
4. **`/clear` between unrelated tasks.**
5. **Delegate large reads to subagents.**

## How the pieces relate

**Three enforcement levels, and the distinction is the whole point.**

| Mechanism | Nature | Use for |
|---|---|---|
| Skill and CLAUDE.md | Context Claude reads and tries to follow. No guarantee. | Judgment, standards, domain knowledge |
| `permissions` in settings.json | Enforced by the client regardless of what Claude decides | Hard blocks |
| Hooks | Run as code at lifecycle events regardless of what Claude decides | Format, lint, secret scan, destructive guard, finance numerics |

Anything you cannot tolerate being skipped belongs in a hook or a deny rule, not in prose.

**Why SKILL.md is front-loaded.** After compaction, invoked skill bodies are re-injected but capped at 5,000 tokens per skill, and truncation keeps the *start* of the file. The risk tiers and money invariants sit at the top for exactly that reason. Detail lives in `references/`.

**Why path-scoped rules.** `rules/finance-code.md` loads only when Claude opens a file under a finance path, so it costs nothing otherwise. Tradeoff: path-scoped rules are lost after compaction until a matching file is read again. Anything that must always persist belongs in the root CLAUDE.md.

## Design notes

**Risk tiers are load-bearing.** Tier 0 analysis stays fast and informal; Tier 2 systems of record get full controls. Without the tiering, the skill would demand an ADR to pivot a trial balance and you would stop using it. Claude states the tier before starting and says so when work escalates between tiers.

**Accounting judgments escalate, never resolve.** Revenue presentation, capitalization, recognition timing, and reserve adequacy are controller and auditor calls. The skill presents indicators and evidence, then stops. It also carries `revenue_presentation` as a dated data attribute rather than inferring it, so presentation cannot silently flip when the data changes.

**Verticals are people-based services**: agencies, law firms, consultancies, engineering and design firms, staffing, managed services. The common structure is that revenue is a function of people's time, capacity is the constraint, and margin is defended at pricing. Nothing is written for a single company or sector.

**The GAAP file is not accounting advice.** It exists so code encodes the right concepts and so Claude knows when to stop. Verify effective dates against FASB directly; deferrals happen.

**System coverage reflects the 2026 landscape** as researched on the build date. Vendor capabilities and API versions move; confirm before building an integration.

## Adapting it

Everything here is a starting point, not doctrine.

- **`config/settings.json`** assumes npm and pytest. Change the `permissions` lists to your stack or Claude will prompt on every test run.
- **`config/hooks/guard-finance-numerics.sh`** is advisory-strength: it warns on likely defects rather than blocking every possible false positive. Tune the patterns to your repo's naming conventions.
- **`config/rules/finance-code.md`** matches paths like `**/finance/**` and `**/billing/**`. Adjust the `paths` frontmatter to your directory layout or the rule will never fire.
- **`skills/clean-finance-code/references/`** files are yours to edit. The domain files in particular benefit from your own worked examples and your organization's specific conventions.

## Notes

The skill contains no personal, employer, or client-identifying content, and no real credentials, account numbers, or internal data. Examples are synthetic. If you share it, the only things to review first are the `permissions` block in `settings.json` and any placeholders you filled into `CLAUDE.md`, since both become repo-specific once configured.
