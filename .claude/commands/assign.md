---
description: Put a contract into a room. Refused if the room is offline or every bed is booked for those dates.
---

Run `npm run accom -- assign --contract=<resident or id> --room=<room> --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Room names can be "RC-03", "Rata Court RC-03" or "RC RC-03".
