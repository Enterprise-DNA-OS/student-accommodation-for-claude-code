---
description: Offer a resident a stay: term, dates, weekly fee, deposit, refund policy and optionally a room.
---

Run `npm run accom -- offer --resident="<name>" --term="…" --start=YYYY-MM-DD --end=YYYY-MM-DD --fee=<weekly> --deposit=<n> --refund-policy="…" [--room=<room>] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Add the resident first with `add-resident` if they are new. Check `vacancies` before choosing a room.
