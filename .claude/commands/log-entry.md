---
description: Record staff entering a room. A future routine entry without 24 hours' notice is refused.
---

Run `npm run accom -- log-entry --room=<room> --reason=routine|maintenance|emergency|welfare --entry=YYYY-MM-DDTHH:MM [--notified=YYYY-MM-DDTHH:MM] [--note=…] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Clause 27(1)(c)(v). Past entries are recorded as they happened and show on `compliance` if notice was short.
