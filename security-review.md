# Security Review

Run when the change touches any trigger surface in SKILL.md §3, or on any Tier 2 change.

Aligned to **OWASP Top 10:2025** (supersedes the 2021 list). Broken Access Control remains A01. Security Misconfiguration moved to A02. **Mishandling of Exceptional Conditions is new at A10** — improper error handling, logic errors, and failing open — which is precisely where finance code and agent-written code fail most.

Finance systems are high-value targets. They hold payment rails, bank credentials, payroll data, and pre-release results. Treat every one as in scope.

## Step 1 — Map the change

Answer before reviewing code. If you cannot, you have not read enough.

- **Trust boundaries crossed**: where does untrusted data enter?
- **Attack surface added**: new endpoint, file path, query, subprocess, dependency, or integration?
- **Privileged operations**: what can a caller now do that they could not before? Specifically: can they move money, change a payee, approve something, or see another entity's data?
- **Sensitive data touched**: bank details, tax IDs, payroll, cardholder data, customer PII, unreleased results?
- **Who is the attacker**: unauthenticated internet, authenticated low-privilege user, a compromised vendor or dependency, or an insider with legitimate access?

That last one matters more in finance than in most domains. Most finance loss is authorized-user abuse, not perimeter breach.

## Step 2 — Checklist by surface

### Access control (A01)
- [ ] Authorization enforced server-side on every privileged operation, not only at the router or in the UI.
- [ ] Object-level checks: can a user pass another entity's ID and retrieve its data? (IDOR)
- [ ] Function-level checks: can a normal user reach an approval or posting endpoint directly?
- [ ] **Entity and dimension scoping**: a department head sees their department, a client lead sees their clients. Enforced in the query, not filtered after retrieval.
- [ ] Default deny on new routes.
- [ ] Privilege never derived from a client-supplied field (`role`, `entity_id`, `approval_limit` in the request body).
- [ ] **Approval thresholds server-side.** A UI limit is decoration.

### Configuration (A02)
- [ ] No debug mode, verbose errors, or stack traces reachable in production. Finance stack traces leak schema and account structure.
- [ ] Security headers present: CSP, HSTS, `X-Content-Type-Options`, frame options.
- [ ] CORS is an explicit allowlist. Never `*` with credentials.
- [ ] Default credentials, sample API keys, and open management ports removed.
- [ ] Cloud storage holding exports, statements, or reports is not public. Financial exports in an open bucket is a recurring real-world breach.

### Supply chain
- [ ] New or upgraded dependencies CVE-checked.
- [ ] Lockfile updated and committed; integrity hashes intact.
- [ ] **Typosquat check**: package name is exactly the one intended.
- [ ] No install scripts from unfamiliar packages accepted blindly.
- [ ] CI uses least-privilege tokens; workflows never run untrusted PR code with production credentials.
- [ ] ERP and bank SDK versions pinned, and their update path is deliberate.

### Crypto (A04)
- [ ] Established libraries only. No hand-rolled crypto, tokens, or password hashing.
- [ ] Passwords: argon2id or bcrypt at a current work factor. Never SHA/MD5.
- [ ] Randomness from a CSPRNG (`secrets`, `crypto.randomBytes`), never `Math.random`. **Idempotency keys, payment references, and invoice tokens must be unguessable.**
- [ ] TLS enforced; certificate validation never disabled "temporarily," including against bank and ERP endpoints.
- [ ] Keys from a secret manager, rotatable, never in code or default arguments.

### Injection (A05)
- [ ] SQL parameterized. Zero string concatenation of user input. This is a defect with no exceptions.
- [ ] Dynamic account, entity, or period filters built from an allowlist, not string interpolation. Report builders that accept a "filter" string are a common injection path in finance tooling.
- [ ] Shell: argument arrays, never string interpolation. Avoid `shell=True`.
- [ ] Templates and HTML: contextual output encoding, framework auto-escaping on.
- [ ] `eval`, `exec`, `pickle.loads`, `yaml.load`, and native deserialization never applied to untrusted input.
- [ ] **Spreadsheet formula injection**: a cell beginning `=`, `+`, `-`, or `@` in a generated CSV or XLSX executes when opened. Escape or prefix any user-supplied text in exports. This is the finance-specific injection everyone forgets.
- [ ] Path traversal: resolve and confirm the final path is inside the intended root. Reject `..`.

### Input validation
- [ ] Schema validation at the edge, once. Allowlist, not blocklist.
- [ ] Type, range, length, and format enforced before use. **Amount fields bounded**: a negative or absurdly large amount must be rejected at the boundary, not discovered in the GL.
- [ ] Size limits on request bodies, uploads, and array fields.
- [ ] File uploads (invoices, statements, remittance files) validated by content inspection, not extension; stored outside the webroot; never executed.
- [ ] **Uploaded bank and remittance files reconciled to their own control totals** before any downstream use.

### SSRF
- [ ] Server-side fetches of user-supplied URLs use a destination allowlist.
- [ ] Internal ranges and cloud metadata endpoints (169.254.169.254) blocked.
- [ ] Redirects followed only within the allowlist. Relevant anywhere a webhook or callback URL is configurable.

### Sessions and tokens
- [ ] Session IDs regenerated on privilege change; invalidated on logout.
- [ ] Cookies `HttpOnly`, `Secure`, `SameSite`.
- [ ] Token expiry short; refresh revocable; signature **and** audience/issuer verified.
- [ ] CSRF protection on state-changing cookie-authenticated endpoints — especially approval and payment-release endpoints.
- [ ] **Re-authentication or step-up for high-value actions**: payment release, payee change, bulk export.

### Errors and logging (A10 — new in 2025)
- [ ] **Fail closed.** An exception in an authorization or approval path denies; it never falls through.
- [ ] No secrets, tokens, bank details, tax IDs, salary, or PII in logs, error messages, telemetry, or notebook output. Mask at the source.
- [ ] Client errors generic; detail server-side only.
- [ ] Resources released on the error path (files, connections, locks).
- [ ] **Partial failure leaves no half-written state.** Transaction boundaries correct, and no database transaction held open across a bank or ERP call.
- [ ] A failed batch is not silently retried in whole. Retry at the item level against confirmed status.

### Rate limiting and abuse
- [ ] Auth, password reset, and expensive report endpoints rate limited.
- [ ] No account enumeration via response content or timing.
- [ ] **Idempotency keys on every payment and mutation endpoint**, enforced by a database unique constraint.
- [ ] Bulk export throttled and logged. Mass export of financial data is both an exfiltration vector and an insider-risk signal.

### Data protection
- [ ] Sensitive data encrypted at rest where required; TLS in transit.
- [ ] Retention and deletion defined for personal and payroll data.
- [ ] **Production financial data never copied to a development environment unmasked.** Routine and serious.
- [ ] Backups exist for anything a migration touches, and restore has been tested.
- [ ] **Material non-public information** (pre-release results, forecasts, deal data) access-controlled with the same care as PII. Unauthorized access carries securities-law exposure, not just privacy exposure.

### Fraud-specific controls
- [ ] **Payee and bank detail changes require out-of-band verification**, forced by the code path, not suggested. Business email compromise targeting remit-to changes is the most common finance fraud and is preventable here.
- [ ] Segregation of duties enforced by identity (see SKILL.md §7), including for service accounts.
- [ ] Dual authorization on outbound payments, enforced at the bank as well as in the application. Bank-side controls survive an application compromise.
- [ ] Anomaly alerting on control-total movement, off-hours postings, and unusual-account journal entries.

## Step 3 — Report

```
Severity: critical / high / medium / low / informational
Where:    file:line
Issue:    what an attacker or an authorized-but-malicious user can do
Fix:      smallest change that closes it
```

Close with an honest assurance statement:

> Reviewed against the checklist above and ran <scanners and tests actually executed>. This is not a substitute for review by a qualified security reviewer or a penetration test. <Anything warranting specialist review.>

**Never write "this code is secure."** Checklists and scanners reduce risk; they do not prove absence of vulnerabilities. Distinguish what you ran from what you concluded.

## Escalate to a specialist

- New cryptographic design or protocol
- Multi-tenant or multi-entity isolation boundaries
- Payment initiation, card handling, or anything in PCI scope
- Authentication implementation (as opposed to configuration) including SSO, OIDC, SAML
- Anything handling regulated data: payroll, PHI, biometrics, cardholder data
- Any finding you can describe but cannot confidently bound

## Sources
- OWASP Top 10:2025 — https://owasp.org/Top10/2025/
- OWASP Cheat Sheet Series — https://cheatsheetseries.owasp.org/
- OWASP Top 10 for LLM Applications — https://owasp.org/www-project-top-10-for-large-language-model-applications/
