---
description: Open a welfare management plan for a resident assessed as at risk.
---

Run `npm run accom -- open-plan --resident="<name>" --owner="<staff>" --summary="<checks, referrals, contacts>" [--review=YYYY-MM-DD] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Clause 27(1)(c)(i). The summary names the welfare checks and any referral. Default review is in `settings` (plan_review_days).
