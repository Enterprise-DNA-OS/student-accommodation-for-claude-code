# Why there is no front end

StarRez is a database with a subscription. Underneath sit ordinary records: buildings, rooms, residents, bookings, charges, incidents. What the subscription pays for is the layer on top that lets staff without database skills reach those records: screens, a resident portal, dashboards, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, ask "who has not been seen this week?" or "which rooms are free from February?", and it runs the right command and explains the answer.

## What you gain

- **Answers the dashboard never had.** Who signed before they had the house rules. Which at-risk resident has no plan. Which routine room entry had six hours' notice.
- **No per-bed or per-module bill.** The free version has no licence fee as the hall grows.
- **Your records in your own database.** Back them up, query them from anything, leave any time.
- **Rules you can read.** The Code checks are listed in `docs/compliance.md` with the clause beside each one.

## What a screen gives that this does not

- **A resident portal.** Applications, room selection and payments online. Here, staff enter what residents send in, or import it.
- **A phone app for resident assistants.** Here, an RA logs checks where Claude Code runs, or tells a staff member who logs them.
- **Card payments.** This records payments; it does not take them.
- **A help desk at the vendor.** This is open source. Enterprise DNA supports the installed version for providers who want someone to call.

## Who this fits

A hall, a private student house or a boarding operator with a small residential life team who would rather ask than click. If you need a resident portal, Enterprise DNA builds one on top of the same records for your version.

Installed and run for you: https://enterprisedna.co/omni/instead-of/starrez
