---
description: Record a payment against a contract.
---

Run `npm run accom -- pay --contract=<resident or id> --amount=<n> --reference=<bank ref> --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

A reference can only be used once per contract. If the resident has more than one stay, the command lists them: ask which.
