---
description: Check a resident out.
---

Run `npm run accom -- check-out --contract=<resident or id> [--on=YYYY-MM-DD] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Then show their balance with `resident` and ask whether a room inspection or damage charge is needed.
