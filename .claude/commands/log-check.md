---
description: Record that a resident was seen and active, or a welfare check.
---

Run `npm run accom -- log-check --resident="<name>" --kind=activity|welfare --outcome="…" [--on=YYYY-MM-DD] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Clause 27(1)(c)(ii). Resident assistants can log several at once: run the command once per resident.
