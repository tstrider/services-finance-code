---
paths:
  - "**/auth/**"
  - "**/*auth*"
  - "**/payment*/**"
  - "**/billing/**"
  - "**/migrations/**"
  - "**/*.sql"
  - "**/infra/**"
  - "**/*.tf"
  - "**/.github/workflows/*.yml"
---

# Security-sensitive path

You are reading a file on a high-risk surface. Run the security review from the
`clean-finance-code` skill (`references/security-review.md`) before reporting any change
here, regardless of diff size.

- Authorization is checked server-side on every privileged operation.
- Parameterized queries only. No string concatenation into SQL, shell, or paths.
- Secrets from env or a secret manager. Never a literal, never a default argument.
- Fail closed. An exception on an auth path denies; it does not fall through.
- Migrations are backward-compatible and additive first. Destructive changes need an explicit
  rollback path and a confirmed backup. Never silently drop data.
- CI workflows use least-privilege tokens and never run untrusted PR code with secrets.

State explicitly what you verified and what needs specialist review. Do not call it secure.

<!-- Path-scoped rules load only when Claude reads a matching file, so they cost nothing
     the rest of the time. They are lost after compaction until a matching file is read
     again - if something here must always persist, move it to the root CLAUDE.md. -->
