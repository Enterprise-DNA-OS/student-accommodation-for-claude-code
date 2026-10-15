<h1 align="center">Student Accommodation for Claude Code</h1>

<p align="center">
  <strong>The open-source student accommodation system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your StarRez data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=starrez">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/starrez?utm_source=github&utm_medium=readme&utm_campaign=starrez">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-starrez">Instead of StarRez</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Student Accommodation for Claude Code does the job you pay StarRez for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the StarRez dashboard cannot.

StarRez publishes no price list. One university's public purchase order shows US$75,620 for a single year's subscription covering up to 3,781 beds, after a US$29,152 discount, plus US$19,873.70 of implementation ([source](https://sfasu.edu/application/procurement/contracts/B2500350.pdf), checked 15 October 2026). Smaller halls pay less, but the bill is per bed, per module and every year.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=starrez).

It covers what a residential life team does every week: rooms and vacancies, offers and contracts, check-in and check-out, weekly fees and arrears, causes for concern, welfare plans and activity checks, room entry notices, repairs and the complaints log. It is built for New Zealand halls, private student housing and boarding operators that sit under the Pastoral Care Code, and `/compliance` checks your records against the clauses that apply to accommodation.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/student-accommodation-for-claude-code.git
cd student-accommodation-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. It answers from the demo halls: who has not been seen in a week, an at-risk resident with no plan, a contract signed before the house rules were given, a heater out for five days.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

Every command drives one CLI, `npm run accom -- <command>` (`--json` for machines, `help` for every flag). Changes take `--actor` and `--dry-run`, and land in an audit trail nobody can edit.

**Every day**

| Command | What it does |
|---|---|
| `/attention` | What needs attention today across the residences: Code checks, welfare due, unsigned arrivals, fees overdue and urgent repairs. |
| `/residents` | Who is in residence now, by building and room, with days since their last check. |
| `/arrivals` | Arrivals in the next three weeks, with contract status. |
| `/departures` | Residents leaving in the next three weeks. |
| `/welfare` | Welfare due: plan reviews, residents not seen within the check interval, open medium and high concerns. |
| `/log-check` | Record that a resident was seen and active, or a welfare check. |
| `/raise-concern` | Record a cause for concern about a resident: wellbeing, behaviour, safety, health or study. |
| `/repairs` | Open repairs, urgent first, with days open. |
| `/report-repair` | Log a repair. Mark heating, damp, security and water problems urgent. |

**Monday**

| Command | What it does |
|---|---|
| `/weekly-review` | The Monday review for the head of hall: occupancy, who arrives and leaves, fees overdue, welfare due, Code checks by rule, open complaints and repairs. |
| `/occupancy` | Beds, residents, offline rooms and vacancies by building today. |
| `/arrears` | Fees overdue by resident, oldest first. |
| `/compliance` | Check the records against the Pastoral Care Code and the house standards in docs/compliance.md, and report what is breached or about to be, with the clause cited. |

**Contracts**

| Command | What it does |
|---|---|
| `/vacancies` | Rooms with a free bed between two dates, for a new booking or a room change. |
| `/add-resident` | Add a resident (or applicant). |
| `/update-resident` | Change a resident's details. |
| `/offer` | Offer a resident a stay: term, dates, weekly fee, deposit, refund policy and optionally a room. |
| `/disclose` | Record the day the resident was given the house rules, the complaints process (with the Dispute Resolution Scheme) and the refund policy. |
| `/sign` | Mark a contract signed. Refused until house rules, complaints information and the refund policy are recorded. |
| `/assign` | Put a contract into a room. Refused if the room is offline or every bed is booked for those dates. |
| `/check-in` | Check a resident in. Needs a signed contract and a room. |
| `/check-out` | Check a resident out. |
| `/cancel` | Cancel a contract that has not started or has ended. Frees the bed. |
| `/resident` | Everything about one resident: contracts, balance, concerns, plans and recent checks. |

**Money**

| Command | What it does |
|---|---|
| `/bill-fees` | Raise the weekly fee charges for every signed stay up to a date. Safe to run twice. |
| `/charge` | Add a one-off charge to a contract (damage, deposit, other). |
| `/pay` | Record a payment against a contract. |
| `/draft-arrears-letter` | Draft a fees-overdue letter with the charges and payments on record. |

**Welfare**

| Command | What it does |
|---|---|
| `/concerns` | Open concerns, high risk first. |
| `/close-concern` | Close a concern with its outcome. |
| `/open-plan` | Open a welfare management plan for a resident assessed as at risk. |
| `/review-plan` | Record a welfare plan review and set the next review date. |
| `/close-plan` | Close a welfare plan. |
| `/plans` | Open welfare plans and their review dates. |

**Rooms and the building**

| Command | What it does |
|---|---|
| `/rooms` | Every room with type, beds, fee, occupancy and offline reason. |
| `/buildings` | Buildings with beds, occupied and vacant. |
| `/add-building` | Add a building. |
| `/add-room` | Add a room. |
| `/set-room` | Change a room's fee or take it offline (and back). |
| `/log-entry` | Record staff entering a room. A future routine entry without 24 hours' notice is refused. |
| `/entries` | Room entries in the last 30 days with notice given. |
| `/draft-entry-notice` | Draft the notice to residents before a room entry. |
| `/resolve-repair` | Mark a repair done. |

**Complaints**

| Command | What it does |
|---|---|
| `/log-complaint` | Add a complaint to the log residents can see. |
| `/resolve-complaint` | Record the response to a complaint and close it. |
| `/complaints` | The complaints log, open first. |

**Setup and data**

| Command | What it does |
|---|---|
| `/settings` | The house settings: check interval, notice hours, repair and complaint targets, currency. |
| `/set` | Change a house setting. |
| `/activity` | The audit trail: who changed what, when. |
| `/import` | Bring residents, rooms and bookings across from a StarRez booking report saved as CSV. |
| `/export` | Write every record to one JSON archive. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |

Documents, in your brand from `brand.json`: `npm run docs` renders accommodation statements, the complaints log residents can see (names left off) and an evacuation roll per building. `npm run view` renders three read-only pages: this week, occupancy, and the welfare board.

## Ten questions StarRez does not answer

1. Who has not been seen in their room or at a meal for a week? (`/residents`, `/welfare`)
2. Which at-risk resident has no welfare plan? (`/compliance`)
3. Which welfare plan is past its review date, and who owns it? (`/welfare`)
4. Which contracts were signed before the resident had the house rules and complaints information? (`/compliance`)
5. Which under-18 residents have no guardian phone on file? (`/compliance`)
6. Which routine room entries had less than 24 hours' notice this month? (`/compliance`, `/entries`)
7. Which urgent heating, damp or security repairs are past our target? (`/repairs`, `/compliance`)
8. Who owes fees, how many days overdue, and do they also have an open concern? (`/arrears`, `/resident`)
9. Which arrivals in the next three weeks cannot check in because their contract is unsigned? (`/attention`)
10. Which rooms have a free bed from February to November? (`/vacancies`)

## Your first hour: ten things to ask for

1. "Put our business name and logo on everything." (`brand.json`)
2. "Add our three halls and their rooms." (`/add-building`, `/add-room`)
3. "Bring across this StarRez booking report." (`/import`)
4. "Our activity check interval is five days." (`/set`)
5. "Add a field for dietary needs to residents." (`/customise`)
6. "Raise this week's fees." (`/bill-fees`)
7. "What needs attention today?" (`/attention`)
8. "Draft a notice for the fire alarm test on Thursday at 10." (`/draft-entry-notice`)
9. "Make me a page of every resident on level 2 with their RA." (`/new-view`)
10. "Write Monday's review for the head of hall." (`/weekly-review`)

## Instead of StarRez

Build a booking report in StarRez, save it as CSV, preview with `npm run accom -- import starrez --file=bookings.csv --actor="Your name" --dry-run`, then load it. Buildings, rooms, residents and bookings come across; transactions, incidents and portal history do not. The full guide, with the column mapping: [docs/replace-starrez.md](docs/replace-starrez.md).

What the checks are based on: [docs/compliance.md](docs/compliance.md).

## Architecture

```
student-accommodation-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/accom.mjs         the one CLI the commands drive
  documents.json            accommodation statement, complaints log, evacuation roll
  views.json                this week, occupancy, welfare board
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Student Accommodation for Claude Code for your business, migrates your StarRez data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=starrez)
- Read more: [enterprisedna.co/omni/instead-of/starrez](https://enterprisedna.co/omni/instead-of/starrez?utm_source=github&utm_medium=readme&utm_campaign=starrez)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
