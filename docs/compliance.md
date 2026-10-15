# Rules this system checks

Checked 15 October 2026 against the **Education (Pastoral Care of Tertiary and International Learners) Code of Practice 2021**, Part 5 (student accommodation), in force since 1 January 2022. NZQA administers the Code. Source: [the Code (NZQA)](https://www2.nzqa.govt.nz/assets/International/Study-in-NZ/nzqa-pastoral-care-code-of-practice-english.pdf).

`npm run accom -- compliance` runs every check below. It reads your records; it does not certify that you meet the Code. You still complete the annual self-review against the whole Code. Outside New Zealand, replace the clauses with the rules you live under using `/customise`.

| Rule | What the data must show | Clause |
|---|---|---|
| DISCLOSURE_BEFORE_SIGNING | A signed contract has the house rules and the complaints process (with the Dispute Resolution Scheme) given on or before the signing date. `sign` refuses until both are recorded. | 31(4) |
| CONTRACT_TERMS | Every contract records its refund policy alongside the deposit and fees. `sign` refuses without it. | 31(1)(d), 31(3) |
| UNDER_18_GUARDIAN | A resident under 18 on the first day of their stay has a parent or guardian name and phone. | 27(1)(c)(iii) |
| AT_RISK_NO_PLAN | An open high-risk concern has an open welfare management plan. | 27(1)(c)(i) |
| PLAN_REVIEW_OVERDUE | An open welfare plan has not passed its review date. | 27(1)(c)(i), 27(1)(a) |
| ACTIVITY_CHECK | Every resident in residence has a recorded activity or welfare check within `activity_check_days` (default 7). The Code requires regular checks; the interval is your choice. | 27(1)(c)(ii) |
| ROOM_ENTRY_NOTICE | A routine room entry had at least `room_entry_notice_hours` (24) of notice. `log-entry` refuses a future routine entry with less. Emergency, maintenance and welfare entries are recorded but not held to this check; your house rules say when those apply. | 27(1)(c)(iv), 27(1)(c)(v) |
| URGENT_REPAIR | An urgent heating, damp, security or water repair is not open longer than `urgent_repair_days` (default 2). The target is yours; the duty is that facilities are secure, clean, dry and warm. | 33(1)(c) |
| COMPLAINT_OPEN | A complaint is not open longer than `complaint_target_days` (default 20). This is a house standard, not a Code period. The log itself, which residents can see, is clause 31(5): `npm run docs -- complaints-log` renders it without names. | 31(5) (log); house standard (time) |
| OVERBOOKED | A room never has more residents than beds. `assign`, `offer` and `import` refuse it. | Data check |

## The exact words

- **27(1)(c)(i)**: "developing and implementing a welfare management plan for residents assessed as being at risk, that includes welfare checks and which could include referral to external services".
- **27(1)(c)(ii)**: "systems to regularly check that residents continue to be active within their student accommodation and, if a resident is identified as being at risk, developing and implementing a welfare management plan".
- **27(1)(c)(iii)**: "appropriate arrangements for residents under 18, including for effective communication with a parent or legal guardian regarding wellbeing and safety".
- **27(1)(c)(v)**: "routine checks providing 24 hours' notice to a resident if staff members will be entering a resident's room".
- **31(1)(d)**: the contract "sets out the deposit, bond components, fees, refund policy and penalties".
- **31(4)**: providers "give prospective residents a copy of the house rules, and information about the complaints process and the Dispute Resolution Scheme before they sign the accommodation contract".
- **31(5)**: providers "keep a log of complaints received from residents concerning a breach or breaches of this code in relation to student accommodation and make this log available to the residents".
- **33(1)(c)**: facilities and services "are secure, clean, dry, warm, comfortable" (the clause continues).

## What this does not cover

Clause 27(3) asks for a critical incident and emergency procedures manual; that is a document you write, and `npm run docs -- evacuation-roll` prints who is in each building for it. Staff vetting (clause 26), the human resources strategy (clause 30(b)) and the website disclosures (clause 30(a)) are outside these records. Fees, deposits and refunds also sit under your contract and consumer law; the checks only confirm they are written down.

An actor name is a label, not a verified identity. The events table refuses edits, but the database owner can bypass it. Welfare records are personal health information under the Privacy Act 2020 and the Health Information Privacy Code: keep the database protected and give access only to staff who need it.
