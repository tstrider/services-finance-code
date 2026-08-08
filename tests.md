---
paths:
  - "**/test_*.py"
  - "**/*_test.py"
  - "**/tests/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*_test.go"
---

# Test files

- Test behavior and boundaries, not implementation. A test that breaks on every refactor is a
  liability, not coverage.
- For a bug fix: write the failing test first and confirm it fails for the right reason.
- Name the claim: `rejects_transfer_when_balance_below_amount`, not `test_transfer_2`.
- Deterministic. Inject the clock and the random source. No `sleep`, no live network, no
  dependence on test ordering.
- Do not mock what you own into meaninglessness. If the test only proves the mock works, delete it.
- Do not add tests to raise a coverage number. Add them where failure is expensive or the logic
  is subtle.
- Prioritize: invalid input, authorization, boundaries, concurrency, retries and timeouts,
  partial failure, money, dates and timezones.
