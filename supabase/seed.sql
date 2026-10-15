-- Fictional demo: two buildings, twelve beds, eight residents. Dates are relative
-- to today so there is always something overdue, stale or due this week.
-- Runs once: a second run changes nothing.
do $$
begin
  if exists (select 1 from buildings where id = 'b1a2c3d4-0000-4000-8000-000000000001') then
    return;
  end if;

  insert into buildings (id, name, code, address) values
    ('b1a2c3d4-0000-4000-8000-000000000001', 'Kowhai House', 'KH', '12 Example Street, Dunedin'),
    ('b2b3c4d5-0000-4000-8000-000000000002', 'Rata Court', 'RC', '40 Sample Road, Dunedin');

  insert into rooms (id, building_id, name, room_type, floor, beds, weekly_fee_cents, offline_reason) values
    ('a1000001-1111-4111-8111-000000000001', 'b1a2c3d4-0000-4000-8000-000000000001', 'KH-101', 'single', '1', 1, 31000, null),
    ('a2000002-2222-4222-8222-000000000002', 'b1a2c3d4-0000-4000-8000-000000000001', 'KH-102', 'single', '1', 1, 31000, null),
    ('a3000003-3333-4333-8333-000000000003', 'b1a2c3d4-0000-4000-8000-000000000001', 'KH-103', 'twin', '1', 2, 26000, null),
    ('a4000004-4444-4444-8444-000000000004', 'b1a2c3d4-0000-4000-8000-000000000001', 'KH-104', 'ensuite', '1', 1, 36000, 'Water damage repair'),
    ('a5000005-5555-4555-8555-000000000005', 'b2b3c4d5-0000-4000-8000-000000000002', 'RC-01', 'studio', 'G', 1, 42000, null),
    ('a6000006-6666-4666-8666-000000000006', 'b2b3c4d5-0000-4000-8000-000000000002', 'RC-02', 'studio', 'G', 1, 42000, null),
    ('a7000007-7777-4777-8777-000000000007', 'b2b3c4d5-0000-4000-8000-000000000002', 'RC-03', 'apartment', '1', 4, 29000, null),
    ('a8000008-8888-4888-8888-000000000008', 'b2b3c4d5-0000-4000-8000-000000000002', 'RC-04', 'single', '1', 1, 30000, null);

  insert into residents (id, name, email, phone, student_id, institution, date_of_birth, guardian_name, guardian_phone, emergency_contact) values
    ('c1000001-1111-4111-8111-000000000001', 'Aroha Ngata', 'aroha@example.com', '021 000 0001', 'S1001', 'Example University', current_date - interval '19 years 2 months', null, null, 'Mere Ngata 021 000 1001'),
    ('c2000002-2222-4222-8222-000000000002', 'Liam Chen', 'liam@example.com', '021 000 0002', 'S1002', 'Example University', current_date - interval '17 years 8 months', 'Grace Chen', null, 'Grace Chen'),
    ('c3000003-3333-4333-8333-000000000003', 'Priya Raman', 'priya@example.com', '021 000 0003', 'S1003', 'Example Polytechnic', current_date - interval '20 years', null, null, 'Raj Raman 021 000 1003'),
    ('c4000004-4444-4444-8444-000000000004', 'Tom Walker', 'tom@example.com', '021 000 0004', 'S1004', 'Example University', current_date - interval '19 years 9 months', null, null, 'Sue Walker 021 000 1004'),
    ('c5000005-5555-4555-8555-000000000005', 'Mei Tanaka', 'mei@example.com', '021 000 0005', 'S1005', 'Example University', current_date - interval '21 years', null, null, 'Ken Tanaka +81 00 0000 0005'),
    ('c6000006-6666-4666-8666-000000000006', 'Sione Fifita', 'sione@example.com', '021 000 0006', 'S1006', 'Example Polytechnic', current_date - interval '18 years 4 months', null, null, 'Ana Fifita 021 000 1006'),
    ('c7000007-7777-4777-8777-000000000007', 'Hannah Brooks', 'hannah@example.com', '021 000 0007', 'S1007', 'Example University', current_date - interval '18 years 1 month', null, null, 'Paul Brooks 021 000 1007'),
    ('c8000008-8888-4888-8888-000000000008', 'Jack O''Neill', 'jack@example.com', '021 000 0008', 'S1008', 'Example University', current_date - interval '22 years', null, null, 'Deb O''Neill 021 000 1008');

  insert into contracts (id, resident_id, room_id, term, starts_on, ends_on, weekly_fee_cents, deposit_cents, refund_policy,
                         house_rules_given_on, complaints_info_given_on, signed_on, status, checked_in_on) values
    ('d1000001-1111-4111-8111-000000000001', 'c1000001-1111-4111-8111-000000000001', 'a1000001-1111-4111-8111-000000000001', 'Academic year', current_date - 70, current_date + 140, 31000, 62000, 'Standard refund policy v3', current_date - 100, current_date - 100, current_date - 95, 'signed', current_date - 70),
    ('d2000002-2222-4222-8222-000000000002', 'c2000002-2222-4222-8222-000000000002', 'a2000002-2222-4222-8222-000000000002', 'Academic year', current_date - 70, current_date + 140, 31000, 62000, 'Standard refund policy v3', current_date - 98, current_date - 98, current_date - 96, 'signed', current_date - 70),
    ('d3000003-3333-4333-8333-000000000003', 'c3000003-3333-4333-8333-000000000003', 'a3000003-3333-4333-8333-000000000003', 'Academic year', current_date - 70, current_date + 140, 26000, 52000, 'Standard refund policy v3', current_date - 90, current_date - 90, current_date - 88, 'signed', current_date - 69),
    ('d4000004-4444-4444-8444-000000000004', 'c4000004-4444-4444-8444-000000000004', 'a3000003-3333-4333-8333-000000000003', 'Academic year', current_date - 70, current_date + 140, 26000, 52000, 'Standard refund policy v3', current_date - 90, current_date - 90, current_date - 85, 'signed', current_date - 70),
    ('d5000005-5555-4555-8555-000000000005', 'c5000005-5555-4555-8555-000000000005', 'a5000005-5555-4555-8555-000000000005', 'Academic year', current_date - 70, current_date + 140, 42000, 84000, 'Standard refund policy v3', current_date - 110, current_date - 110, current_date - 104, 'signed', current_date - 68),
    ('d6000006-6666-4666-8666-000000000006', 'c6000006-6666-4666-8666-000000000006', 'a7000007-7777-4777-8777-000000000007', 'Academic year', current_date - 70, current_date + 140, 29000, 58000, 'Standard refund policy v3', current_date - 60, current_date - 60, current_date - 80, 'signed', current_date - 70),
    ('d7000007-7777-4777-8777-000000000007', 'c7000007-7777-4777-8777-000000000007', 'a8000008-8888-4888-8888-000000000008', 'Second semester', current_date + 10, current_date + 140, 30000, 60000, null, null, null, null, 'offered', null),
    ('d8000008-8888-4888-8888-000000000008', 'c8000008-8888-4888-8888-000000000008', 'a6000006-6666-4666-8666-000000000006', 'First semester', current_date - 70, current_date + 14, 42000, 84000, 'Standard refund policy v3', current_date - 120, current_date - 120, current_date - 118, 'signed', current_date - 70);

  -- Deposits, then weekly fees from the start of each stay to today.
  insert into charges (contract_id, kind, description, amount_cents, due_on)
  select id, 'deposit', 'Deposit', deposit_cents, starts_on - 14 from contracts where status = 'signed';
  insert into charges (contract_id, kind, description, amount_cents, due_on)
  select c.id, 'fee', 'Weekly fee, week of ' || d::date, c.weekly_fee_cents, d::date
  from contracts c, generate_series(c.starts_on, current_date, interval '7 days') d
  where c.status = 'signed';

  -- Everyone is paid up except Tom (three weeks short) and Sione (one week short).
  insert into payments (contract_id, amount_cents, received_on, reference)
  select c.id,
    (select sum(amount_cents) from charges ch where ch.contract_id = c.id)
      - case c.id when 'd4000004-4444-4444-8444-000000000004' then 3 * c.weekly_fee_cents
                  when 'd6000006-6666-4666-8666-000000000006' then c.weekly_fee_cents else 0 end,
    current_date - 2, 'DEMO-' || substr(c.id::text, 1, 8)
  from contracts c where c.status = 'signed';

  insert into checks (resident_id, checked_on, kind, checked_by, outcome) values
    ('c1000001-1111-4111-8111-000000000001', current_date - 2, 'activity', 'Ana (RA)', 'Seen at dinner'),
    ('c2000002-2222-4222-8222-000000000002', current_date - 1, 'activity', 'Ana (RA)', 'Seen at floor meeting'),
    ('c3000003-3333-4333-8333-000000000003', current_date - 12, 'activity', 'Ben (RA)', 'Seen leaving for class'),
    ('c4000004-4444-4444-8444-000000000004', current_date - 3, 'activity', 'Ben (RA)', 'Seen in common room'),
    ('c5000005-5555-4555-8555-000000000005', current_date - 4, 'welfare', 'Kate (Head of Hall)', 'Talked through exam stress; plan in place'),
    ('c6000006-6666-4666-8666-000000000006', current_date - 2, 'activity', 'Ben (RA)', 'Seen at dinner'),
    ('c8000008-8888-4888-8888-000000000008', current_date - 9, 'activity', 'Ana (RA)', 'Seen at reception');

  insert into concerns (resident_id, reported_on, reported_by, category, risk, summary) values
    ('c3000003-3333-4333-8333-000000000003', current_date - 5, 'Roommate', 'wellbeing', 'high', 'Not attending meals, staying in room, roommate worried'),
    ('c5000005-5555-4555-8555-000000000005', current_date - 20, 'Kate (Head of Hall)', 'study', 'medium', 'Exam stress, missed two tutorials');

  insert into welfare_plans (resident_id, owner, opened_on, review_on, summary) values
    ('c5000005-5555-4555-8555-000000000005', 'Kate (Head of Hall)', current_date - 18, current_date - 4, 'Weekly check-in, referral to student counselling, study plan with tutor');

  insert into room_entries (room_id, reason, notified_at, entry_at, staff, note) values
    ('a3000003-3333-4333-8333-000000000003', 'routine', now() - interval '3 days 6 hours', now() - interval '3 days', 'Ben (RA)', 'Fire alarm test, notice posted only six hours before'),
    ('a1000001-1111-4111-8111-000000000001', 'routine', now() - interval '9 days', now() - interval '8 days', 'Ana (RA)', 'Room condition check'),
    ('a5000005-5555-4555-8555-000000000005', 'maintenance', now() - interval '2 days', now() - interval '1 day', 'Facilities', 'Heater inspection');

  insert into maintenance (building_id, room_id, reported_on, category, urgent, summary, resolved_on) values
    ('b2b3c4d5-0000-4000-8000-000000000002', 'a5000005-5555-4555-8555-000000000005', current_date - 5, 'heating', true, 'Wall heater not working', null),
    ('b1a2c3d4-0000-4000-8000-000000000001', 'a4000004-4444-4444-8444-000000000004', current_date - 30, 'water', true, 'Leak from shower, room offline', current_date - 25),
    ('b1a2c3d4-0000-4000-8000-000000000001', 'a3000003-3333-4333-8333-000000000003', current_date - 8, 'furniture', false, 'Desk drawer broken', null);

  insert into complaints (building_id, resident_id, received_on, summary, code_related, response, resolved_on) values
    ('b1a2c3d4-0000-4000-8000-000000000001', 'c4000004-4444-4444-8444-000000000004', current_date - 26, 'Noise from the common room after midnight', false, null, null),
    ('b2b3c4d5-0000-4000-8000-000000000002', 'c5000005-5555-4555-8555-000000000005', current_date - 40, 'Room was entered without notice', true, 'Apology given; entry notices now posted 24 hours ahead', current_date - 33);
end $$;
