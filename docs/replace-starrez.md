# Bring your StarRez bookings across

StarRez keeps residents as **entries**, beds as **room spaces** inside **room locations**, and stays as **bookings** in a **term session**. Build a report on bookings in StarRez, save it as CSV, and one command loads it. Report columns are whatever your report builder chose, so the importer takes a mapping file for headings that differ.

## 1. The report

One row per booking. Default headings (any order):

| StarRez heading | Becomes |
|---|---|
| BookingID | The stay's reference (re-running skips bookings already loaded) |
| EntryID | The resident's reference |
| NameFirst, NameLast, Email, DOB, ID1 | Resident name, email, date of birth (YYYY-MM-DD), student id |
| RoomLocation | Building (added if new) |
| RoomSpace, RoomType, Beds | Room, its type (single, twin, studio, ensuite, apartment) and bed count |
| CheckInDate, CheckOutDate | Start and end of the stay (YYYY-MM-DD) |
| EntryStatus | Rows containing "Cancel" or "Withdrawn" are skipped |
| WeeklyRate | Weekly fee, plain number without symbols |
| TermSession | Term name |

`fixtures/starrez/bookings.csv` is a sample. If your headings differ, write a mapping file with only the ones that change:

```json
{ "booking": "Booking Ref", "fee": "Rate per week", "building": "Hall" }
```

Keys: `entry, first, last, email, dob, student_id, booking, building, room, room_type, beds, start, end, status, fee, term`.

## 2. Preview, then load

```bash
npm run accom -- import starrez --file=imports/bookings.csv --map=imports/map.json --actor="Your name" --dry-run
npm run accom -- import starrez --file=imports/bookings.csv --map=imports/map.json --actor="Your name"
```

The preview prints buildings, rooms, residents and bookings it would add. It refuses a row with a missing value, a duplicate booking, a fee with a currency symbol, or more residents in a room than it has beds, and changes nothing when it refuses.

## 3. What comes across, and what does not

- **Comes across:** buildings, rooms, residents, and each booking as an **offered** contract with its room, dates and weekly fee.
- **You record next:** the dates you gave the house rules and complaints information, and the refund policy (`disclose`), then `sign` and `check-in`. The Code needs those dates on your record, and a booking report does not carry them.
- **Does not come across:** transactions and balances, incidents and welfare notes, room inspections, applications, portal settings and email history. Export what you must keep from StarRez before your access ends. Enterprise DNA can map transactions and other reports for you.

## 4. Run both, then switch

Keep StarRez running for a fortnight. Compare `occupancy` and `residents` with StarRez each morning. When they agree and the team is using the commands, stop entering into StarRez.
