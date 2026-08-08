# Token and Context Budget

Every key below was verified against the official Claude Code settings and context-window docs (checked 2026-08-08). Defaults are stated where the docs state them.

## The mental model

Context is a budget spent on every single message, not once per session. Four things load at startup and never stop costing:

1. **System prompt and tool definitions** - grows with every MCP server you connect
2. **Skill listing** - name + description of every available skill, every turn
3. **CLAUDE.md files** - loaded in full, all of them, up the directory tree
4. **Auto memory index** - `MEMORY.md`, first 200 lines or 25KB

Then conversation accumulates on top. When it fills, compaction summarizes it away, and things get lost.

Run `/context` for the live breakdown of your own session, and `/doctor` for trim suggestions. Do that before tuning anything below.

## Biggest levers, in order

### 1. Trim MCP servers

Usually the single largest fixed cost. Every connected server injects the full JSON schema of every tool it exposes into the system prompt, every turn. Ten servers you rarely use can cost more than your entire CLAUDE.md.

```json
{ "enableAllProjectMcpServers": false }
```

Then enable only what a given project needs via `enabledMcpjsonServers`. Disconnect what you are not using this week.

### 2. Keep CLAUDE.md short and specific

Target under 200 lines. Longer files cost more **and** reduce adherence, per the official docs.

- Do not paste directory trees, dependency lists, or architecture overviews. Claude reads those from disk on demand and they go stale. `/doctor` proposes exactly these as trims.
- Do keep: exact commands, conventions that differ from tool defaults, pitfalls, "always do X" rules.
- `@path` imports organize but do **not** save context - imported files load at launch too.
- Path-scoped rules in `.claude/rules/` with `paths:` frontmatter **do** save context. They load only when Claude reads a matching file.
- Block-level HTML comments in CLAUDE.md are stripped before Claude sees them. Free maintainer notes.
- In monorepos, use `claudeMdExcludes` to skip other teams' files.

### 3. Move procedures into skills

A skill's body loads only when invoked. A CLAUDE.md rule loads always. Anything that is a multi-step procedure belongs in a skill.

Skill listing cost is controlled by two keys:

```json
{
  "skillListingBudgetFraction": 0.01,
  "skillListingMaxDescChars": 1024
}
```

`skillListingBudgetFraction` defaults to `0.01` (1% of the context window reserved for the listing). When the listing exceeds it, descriptions of the least-used skills are dropped and only names remain, so Claude can still invoke them but no longer knows what they do. `skillListingMaxDescChars` defaults to `1536`; lowering it fits more skills under the same budget. Use `skillOverrides` (`"on"`, `"name-only"`, `"user-invocable-only"`, `"off"`) to hide skills you never use without editing their files.

### 4. Set the auto-compact window deliberately

```json
{ "autoCompactWindow": "500k" }
```

Accepts 100K to 1M. Compacting earlier means summarizing more often; compacting later means longer, more expensive turns. Whether this saves or costs depends on your workflow: if you mostly do short focused tasks, a lower window keeps turns cheap. If you do long research passes, a higher window avoids losing detail.

`/compact focus on <topic>` before starting a new phase beats letting the automatic pass guess.

### 5. Delegate large reads to subagents

The largest single win available inside a session. A subagent reads the 5,000-line log file, and only its conclusion returns to your context. Use it for research, codebase exploration, and anything that dumps output.

### 6. `/clear` between unrelated tasks

Old conversation crowds out the files you need and costs tokens on every subsequent message. Clearing is free; not clearing is not.

## What survives compaction

Worth knowing, because instructions "disappearing" is usually this:

| Mechanism | After compaction |
|---|---|
| System prompt, output style | Unchanged |
| Project-root CLAUDE.md, unscoped rules | Re-injected from disk |
| Auto memory | Re-injected from disk |
| Rules with `paths:` frontmatter | **Lost** until a matching file is read again |
| Nested CLAUDE.md in subdirectories | **Lost** until a file there is read again |
| Invoked skill bodies | Re-injected, capped at 5,000 tokens per skill and 25,000 total, oldest dropped first |
| Hooks | N/A - they run as code, not context |

Two practical consequences:

- **Put your most important skill instructions at the top of SKILL.md.** Truncation on re-injection keeps the start of the file.
- **If a rule must survive compaction, drop its `paths:` frontmatter or move it to the project-root CLAUDE.md.** You are trading context savings for persistence; pick deliberately.

## Other keys worth setting

| Key | Effect |
|---|---|
| `verbose: false` | Truncated tool output instead of full. Default is `false`; do not set `true` globally. |
| `includeGitInstructions` | Default `true`. Set `false` to drop built-in commit/PR instructions and the git status block if you never use Claude for git. |
| `disableBundledSkills: true` | Drops the skills shipped with Claude Code from the listing. Only if you truly do not use them. |
| `autoMemoryEnabled` | Default `true`. Claude accumulates learnings across sessions. Keep on - it reduces re-explaining, which is the expensive thing. |
| `fileCheckpointingEnabled` | Default `true`. Snapshots before each edit so `/rewind` works. No context cost. Leave on. |
| `model` / `fallbackModel` / `effortLevel` | Route work by cost. Lower effort for mechanical tasks, higher for design and security review. |
| `cleanupPeriodDays` | Default `30`. Disk hygiene, not context. |

## Enforcement vs. guidance

This distinction matters and is stated explicitly in the docs:

- **CLAUDE.md is context.** Claude reads it and tries to follow it. There is no guarantee, especially for vague or conflicting instructions.
- **`permissions` in settings.json is enforced by the client**, regardless of what Claude decides.
- **Hooks run as code** at fixed lifecycle events, regardless of what Claude decides.

So: "always run lint before committing" written in CLAUDE.md is a suggestion. Written as a `PreToolUse` hook, it is a rule. Anything you actually cannot tolerate being skipped belongs in `permissions.deny` or a hook, not in prose.

## Sources
- Claude Code settings reference - https://code.claude.com/docs/en/settings
- Memory and CLAUDE.md - https://code.claude.com/docs/en/memory
- Context window - https://code.claude.com/docs/en/context-window
- Skills - https://code.claude.com/docs/en/skills
- Effective context engineering for AI agents - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
