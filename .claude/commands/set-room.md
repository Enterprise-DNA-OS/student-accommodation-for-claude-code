---
description: Change a room's fee or take it offline (and back).
---

Run `npm run accom -- set-room --room=<room> [--fee=<weekly>] [--offline="<reason>" | --online] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

A room with residents cannot go offline: move them first.
