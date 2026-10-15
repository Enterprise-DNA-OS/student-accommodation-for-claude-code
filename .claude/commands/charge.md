---
description: Add a one-off charge to a contract (damage, deposit, other).
---

Run `npm run accom -- charge --contract=<resident or id> --kind=damage|deposit|fee|other --amount=<n> --due=YYYY-MM-DD --description="…" --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Damage charges need the evidence named in the description (inspection date, photo reference).
