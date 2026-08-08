<!-- Project CLAUDE.md template. Loaded in full at every session start, so it costs
     tokens on every message. Target under 200 lines. Delete anything that does not
     change behavior. Comments like this one are stripped before Claude sees them. -->

# Project

<!-- One or two lines. What this is and who uses it. Delete the rest. -->
<!-- Do NOT paste a directory tree or dependency list here - Claude can read those
     from disk on demand, and they go stale. /doctor will flag them as trims. -->

## Commands

<!-- The exact commands. This is the highest-value content in the file. -->

- Install: `<cmd>`
- Dev: `<cmd>`
- Test (all): `<cmd>`
- Test (single file): `<cmd> path/to/test`
- Lint: `<cmd>`
- Typecheck: `<cmd>`
- Build: `<cmd>`

Run typecheck and the focused tests before reporting any change as done.

## Engineering standard

Follow the `clean-finance-code` skill for any non-trivial change. In short:

- Recon before writing. Read the file, its callers, and its tests.
- Smallest correct change. No drive-by refactors, no reformatting untouched lines.
- Match existing conventions in this repo over general best practice.
- Errors explicit. No swallowed exceptions.
- Validate untrusted input once, at the boundary.
- Every bug fix gets a test that fails before the fix.
- Report exactly what was verified and what was not. Never claim a command was run if it was not.

## Security

Run the skill's security review before reporting when the change touches: auth, authorization,
sessions, tokens, payments, secrets, personal data, file paths, external input, deserialization,
subprocess, SQL, CORS, crypto, CI permissions, or dependencies.

Always: parameterized queries only. Established crypto libraries only. Secrets from env or a
secret manager, never in code or defaults. Never log secrets or PII. Default deny.

## Conventions

<!-- Only what differs from the tool defaults or what Claude got wrong before.
     Delete anything Claude would infer correctly from reading the code. -->

- <e.g. API handlers live in `src/api/handlers/`>
- <e.g. Use `pnpm`, never `npm`>
- <e.g. Money is `Decimal`, never float>
- <e.g. Prefer composition over inheritance in `src/domain/`>

## Do not

- Commit or push unless asked.
- Run destructive commands (`git reset --hard`, `push --force`, `DROP`, `rm -rf`, migration
  rollbacks) without explicit confirmation.
- Add a dependency without running the dependency scorecard.
- Modify files under <e.g. `generated/`, `vendor/`, `*.lock`> by hand.
- Rewrite working code to modernize it.

## Context discipline

- Delegate large reads (log dumps, big files, research) to a subagent so output stays out of the
  main context.
- Prefer `Grep`/`Glob` with a targeted pattern over reading whole directories.
- When a task ends, say so; the user will `/clear` before the next unrelated task.

<!-- ------------------------------------------------------------------
MAINTENANCE

Add a line here when: Claude makes the same mistake twice, a review catches
something Claude should have known, or you type the same correction twice.

Move here from chat. Move OUT to a skill if it is a multi-step procedure, or to
.claude/rules/ with `paths:` frontmatter if it only matters for part of the tree.

Check size with /context. Run /doctor for trim suggestions.
------------------------------------------------------------------ -->
