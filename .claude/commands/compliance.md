---
description: Check the records against the Pastoral Care Code and the house standards in docs/compliance.md, and report what is breached or about to be, with the clause cited.
---

1. Run `npm run accom -- compliance --json`. Each row has a rule, the person or room, and the issue.
2. Read `docs/compliance.md` for the clause behind each rule and what fixes it.
3. Report as a table: rule, count, the worst example, the clause. Order: resident safety first (AT_RISK_NO_PLAN, ACTIVITY_CHECK, PLAN_REVIEW_OVERDUE, UNDER_18_GUARDIAN), then contracts (DISCLOSURE_BEFORE_SIGNING, CONTRACT_TERMS), then the building (URGENT_REPAIR, ROOM_ENTRY_NOTICE, COMPLAINT_OPEN, OVERBOOKED).
4. For each, offer the command that fixes it: `open-plan`, `log-check`, `review-plan`, `update-resident`, `disclose`, `resolve-repair`, `draft-entry-notice`, `resolve-complaint`.
5. If a rule in `docs/compliance.md` looks out of date, say so and stop. Do not guess at the Code. The operator confirms, then you update the doc and the check together.

This is a record check, not legal advice and not an NZQA attestation. The operator still does the annual self-review against the whole Code.
