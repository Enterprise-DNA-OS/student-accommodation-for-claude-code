---
description: Bring residents, rooms and bookings across from a StarRez booking report saved as CSV.
---

Run `npm run accom -- import starrez --file=<report.csv> [--map=<mapping.json>] [--term="…"] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Read docs/replace-starrez.md first. Always run with --dry-run and show the counts before the real run. Imported bookings arrive as offered contracts: the operator records disclosure dates and signs them. Money, welfare notes and complaints do not come across in a booking report.
