<div align="center">

# Services Finance Code

**Finance code for services firms that actually ties out.**

When Claude builds a margin report, a pricing model, or a billing script for your firm, this makes it check the number before it hands it to you.

[![Claude Skill](https://img.shields.io/badge/Claude-Skill-D97757)](#install)
[![Built for services firms](https://img.shields.io/badge/built%20for-services%20firms-2ea44f)](#who-its-for)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Install](#install) · [The problem](#the-problem) · [Example](#see-the-difference) · [What it checks](#what-it-checks) · [FAQ](#faq)

</div>

---

Services Finance Code is a skill for Claude. A skill is a set of instructions Claude picks up on its own when a task calls for it. This one kicks in whenever Claude writes or runs code that touches your firm's money: margin, pricing, billable hours, WIP, invoicing, forecasts, reconciliations, or data from your accounting system.

## Who it's for

In-house finance teams at people-based services firms. Agencies, consultancies, law firms, accounting firms, engineering and design firms, staffing, and managed services. Roughly 20 to 1,000 people, running QuickBooks, Xero, NetSuite, or Sage Intacct, plus a time tracker and a lot of Excel.

You don't need to code. You ask for the report or the tool. Claude does the technical work and tells you, in plain words, whether the number holds up.

## The problem

In finance, bad code rarely crashes. It hands you a number that looks fine.

A join quietly drops the 40 invoices whose client isn't in the client list. A cost-per-hour formula divides by 2,080 hours and makes a losing scope look profitable. Last year's work gets priced at this year's rates. Fractions of a cent pile up until the report doesn't match the ledger, and nobody can say why.

None of these throw an error. You find out in the review meeting, or from the client.

## The fix

The skill gives Claude one priority: **get the number right first.** Then it makes sure you can see that it's right.

Every result comes with a tie-out: the rows in, the rows out, what was left out and why, and the source it was checked against. If the numbers don't tie and Claude can't explain the gap, it stops and tells you instead of papering over it.

## See the difference

*An illustration with made-up numbers.*

> **You:** What was our gross margin by client in Q3?

**Without the skill**

Claude writes a tidy script. It joins time entries to rate cards, divides each person's cost by 2,080 hours, sums by client, and returns a clean table. Blended margin: 41%. It runs in seconds and looks right.

Three things went wrong, and none of them show:

- Cost per hour used 2,080 paid hours instead of billable hours, so every hour looks about 13% cheaper than it really is.
- 312 time entries had a role missing from the rate card. The join dropped them, along with $58,400 of work.
- Rates were looked up as "current", so July's work was priced at September's new rates.

**With the skill**

```
Bottom line: Q3 gross margin was 33%, and the numbers tie to your P&L.
Ties to:     Q3 revenue ($4,212,880) matches the income statement exactly.
Assumed:     1,800 billable hours per person per year. Tell me your
             firm's number if it's different.
Needs you:   312 time entries ($58,400) have a role missing from the
             rate card. I kept them as "Unassigned" instead of dropping
             them. Two clients look worse than they are until they're mapped.
Not checked: Hours logged after Oct 5 aren't included.
```

Then a table by client, and a "Proof" section with the full tie-out and every check it ran, for anyone who wants to look.

The second answer took a little longer. It's the only one you can take into a meeting.

## What it checks

**The number**
- Money math is exact. No floating-point rounding errors, rounding done once and on purpose.
- No dropped rows. Every join is counted, and unmatched records are kept and reported.
- Every result ties to your system's own report: trial balance, P&L, AR aging, or bank statement.
- Rates come from the day the work was done, not today's rate card.

**Services-firm math**
- Cost per hour uses billable hours (1,800 by default, never 2,080), and it tells you the number it used.
- Utilization, realization, and fee burn come with their definitions, because firms define them differently.
- WIP, unbilled, and deferred revenue are kept apart.
- Late time entries are called out with a cut-off date.

**Judgment calls go to people**
- Gross versus net on pass-through costs (media, subcontractors, expert fees) is flagged for your controller, never guessed.
- It never tweaks a model to hit a target number. It shows what would have to be true instead.
- Before anything posts, bills, or pays, it shows you exactly what will happen and waits for a yes.

**Your data stays yours**
- Bank numbers, tax IDs, and pay are masked in every output and log.
- Sensitive data is never sent anywhere your own setup doesn't already use.
- A security check runs on every job, however small.

**Clean code underneath**
- Standard checks for formatting, types, tests, leaked passwords, and risky packages. If a tool is missing, Claude asks once before installing it, and only inside that project.

## How big a deal is the job?

Claude sorts every job into a tier first, so small questions stay fast and risky work gets full care.

| Tier | Example | What you get |
|---|---|---|
| **0: Quick look** | "What did we bill Acme last quarter?" | A fast answer that ties to your books |
| **1: Repeat run** | Monthly margin pack, forecast refresh | Plus: rerunnable, assumptions written down, old versions kept |
| **2: Books, bills, or pays** | Invoice generation, journal entries | Plus: your approval before anything is written, a full audit trail |
| **3: Finance tool** | A pricing calculator your team uses | Plus: access control, versioned logic, safe for many users |

## Install

**In the Claude app (web or desktop)**

1. Download [services-finance-code.zip](https://github.com/tstrider/services-finance-code/releases/latest/download/services-finance-code.zip).
2. In Claude, open **Settings**, then **Capabilities**, and make sure code execution is turned on.
3. In the **Skills** section, upload the zip.

**In Claude Code**

Download and unzip the file above, then copy the `services-finance-code` folder into `~/.claude/skills/` (for all your projects) or into your project's `.claude/skills/` folder (for one project).

Or from a terminal:

```sh
git clone https://github.com/tstrider/services-finance-code.git
cp -R services-finance-code/skills/services-finance-code ~/.claude/skills/
```

**Try it:** ask Claude "What's our cost per billable hour for a $120,000 salary with 25% benefits and taxes?" It should say which billable-hours number it used and invite you to change it.

## What's inside

```
skills/services-finance-code/
  SKILL.md             the core rules Claude always reads
  references/          16 guides Claude opens only when a task needs them
                       (pricing and margin, billing and revenue, FP&A,
                       money math, reconciliation, accounting rules with
                       IFRS notes, security checklist, systems, and more)
  scripts/money.py     tested helpers for exact money math, with no
                       outside packages, no internet, and no file access
```

## FAQ

**Is this accounting advice?**
No. It helps Claude build code that carries the right concepts and knows when to stop and ask. Accounting treatments, materiality, and audit conclusions belong to your controller and auditor.

**Does it make code secure?**
It lowers risk. It doesn't prove anything is secure, and it's told never to claim that. It says what it checked and what it didn't.

**Will it slow down quick questions?**
Barely. A quick look still gets a tie-out, and the security check marks most sections "not applicable" in a line each.

**My firm isn't a services firm. Will it still help?**
The money math, tie-outs, and security rules work anywhere. The pricing and billing guides are written for firms that sell people's time.

**What accounting rules does it know?**
US GAAP by default, with notes where IFRS differs. Tell Claude which your firm uses.

**Does it connect to my accounting system?**
It doesn't add any connections. It works with whatever access you've already set up, and it's careful with it: test company first, read before write, and your yes before anything is written.

**Does the helper code phone home?**
No. `money.py` uses only the Python standard library. It has no network access, reads and writes no files, and runs nothing else. Your IT team can read it in a few minutes.

## License

**MIT.** See [`LICENSE`](LICENSE). Use it, change it, share it. Keep the copyright line.
