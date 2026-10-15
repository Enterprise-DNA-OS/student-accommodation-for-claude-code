---
description: Add a resident (or applicant).
---

Run `npm run accom -- add-resident --name="…" [--email= --phone= --student-id= --institution= --dob=YYYY-MM-DD --guardian= --guardian-phone= --emergency=] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

If they will be under 18 at the start of their stay, get a parent or guardian name and phone (Code 27(1)(c)(iii)).
