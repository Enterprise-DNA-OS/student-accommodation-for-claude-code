# StarRez selection, 15 October 2026

**The annual bill.** US$75,620 is the year-one annual software subscription in one university's public StarRez purchase order (10/31/2024 to 10/30/2029), covering up to 3,781 beds, 40 concurrent staff users and 400 concurrent portal users. The order lists the subscription at US$104,772 less a US$29,152 discount, and implementation services at US$19,873.70. Year two rises to US$77,888.60 and year three to US$80,225.26. This is one public contract, not a NZ or AU invoice. StarRez publishes no price list. Source: [Stephen F. Austin State University purchase order](https://sfasu.edu/application/procurement/contracts/B2500350.pdf), checked today.

**The data model.** Fivetran's StarRez connector lists BOOKING, ENTRY, ROOMBASE, ROOM_LOCATION, ROOM_TYPE, TERM_SESSION and TRANSACTION among its tables, which is the shape the importer uses. Source: [Fivetran StarRez connector](https://fivetran.com/docs/applications/starrez).

**The rules.** The Education (Pastoral Care of Tertiary and International Learners) Code of Practice 2021, Part 5, Outcomes 5 to 7, applies to tertiary student accommodation in New Zealand. Clauses used are quoted in `docs/compliance.md`.

Scores, in order: annual bill 5, data-shaped 4, our buyers 2, search demand 2, one-session buildable 4, import path 4. Total 21/30. The bill is the highest documented in the queue's open families. Buyer fit is the weak score: halls belong to universities and larger private operators, not the small professional firms Enterprise DNA usually serves; boarding houses and private student housing are closer. Search demand for "StarRez alternative" is thin; the page also targets "student accommodation software".
