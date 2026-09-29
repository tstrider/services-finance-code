# Security

## What this skill tells Claude to do with your data

- Mask bank numbers, tax IDs, and pay in every output, log, sample, and test file.
- Keep sensitive data local: never put it in a web search, a URL, an online tool, or any service your own setup does not already use.
- Never commit data extracts, and never ask you to paste a password or key into the chat.
- Stop and tell you if it finds sensitive data it did not expect.
- Run a security checklist on every job.

## What the skill contains

- Text instructions (`SKILL.md` and the `references/` folder).
- One Python helper, `scripts/money.py`, plus its tests. It uses only the Python standard library. It makes no network calls, reads or writes no files, reads no environment variables, and starts no other programs.

There is no installer, no background process, and no code that runs on its own.

## Limits

This skill lowers risk. It does not make any system secure, and it is instructed never to claim that. Have a qualified person review anything that moves money, handles card data, or controls access.

## Reporting a problem

Open an issue on this repository. For anything sensitive, use GitHub's private vulnerability reporting on the repository's Security tab instead of a public issue.
