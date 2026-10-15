-- Student accommodation: buildings, rooms, residents, contracts, money, welfare,
-- room entries, maintenance and the complaints log. Runs on Postgres and PGlite.

create function touch_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table settings (
  key text primary key,
  value text not null,
  note text not null
);
insert into settings (key, value, note) values
  ('activity_check_days', '7', 'Days without a recorded check before an in-residence resident is flagged (Code 27(1)(c)(ii); the interval is the operator''s choice).'),
  ('plan_review_days', '14', 'Default days between welfare plan reviews.'),
  ('room_entry_notice_hours', '24', 'Notice before staff enter a room for a routine check (Code 27(1)(c)(v)).'),
  ('urgent_repair_days', '2', 'Days an urgent repair (heating, damp, security, water) may stay open before it is flagged (Code 33(1)(c); the target is the operator''s choice).'),
  ('complaint_target_days', '20', 'Operator target for resolving a complaint. A house standard, not a Code period.'),
  ('currency', 'NZD', 'Currency for fees and payments.');

create table buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  name text not null,
  room_type text not null check (room_type in ('single', 'twin', 'studio', 'ensuite', 'apartment')),
  floor text,
  beds int not null default 1 check (beds between 1 and 12),
  weekly_fee_cents bigint not null check (weekly_fee_cents >= 0),
  offline_reason text,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, name)
);

create table residents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  student_id text,
  institution text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  emergency_contact text,
  notes text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One contract per resident per stay. The room is the assignment.
create table contracts (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  room_id uuid references rooms(id),
  term text not null,
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  weekly_fee_cents bigint not null check (weekly_fee_cents >= 0),
  deposit_cents bigint not null default 0 check (deposit_cents >= 0),
  refund_policy text,
  house_rules_given_on date,
  complaints_info_given_on date,
  signed_on date,
  status text not null default 'offered' check (status in ('offered', 'signed', 'cancelled')),
  checked_in_on date,
  checked_out_on date,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checked_out_on is null or checked_in_on is not null),
  check (checked_out_on is null or checked_out_on >= checked_in_on)
);

create table charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id),
  kind text not null check (kind in ('fee', 'deposit', 'damage', 'other')),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_on date not null,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id),
  amount_cents bigint not null check (amount_cents > 0),
  received_on date not null,
  reference text not null,
  created_at timestamptz not null default now(),
  unique (contract_id, reference)
);

-- A cause for concern about a resident (Code 27(1)(b)).
create table concerns (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  reported_on date not null,
  reported_by text not null,
  category text not null check (category in ('wellbeing', 'behaviour', 'safety', 'health', 'study', 'other')),
  risk text not null check (risk in ('low', 'medium', 'high')),
  summary text not null,
  closed_on date,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Welfare management plan for a resident assessed as at risk (Code 27(1)(c)(i)).
create table welfare_plans (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  owner text not null,
  opened_on date not null,
  review_on date not null,
  summary text not null,
  closed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_on >= opened_on)
);

-- Welfare and activity checks: "seen and active" counts (Code 27(1)(c)(ii), (iv)).
create table checks (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  checked_on date not null,
  kind text not null check (kind in ('activity', 'welfare', 'plan-review')),
  checked_by text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);

-- Staff entering a room (Code 27(1)(c)(v): 24 hours' notice for routine checks).
create table room_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  reason text not null check (reason in ('routine', 'maintenance', 'emergency', 'welfare')),
  notified_at timestamptz,
  entry_at timestamptz not null,
  staff text not null,
  note text,
  created_at timestamptz not null default now()
);

create table maintenance (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  room_id uuid references rooms(id),
  reported_on date not null,
  category text not null check (category in ('heating', 'damp', 'security', 'water', 'electrical', 'cleaning', 'furniture', 'other')),
  urgent boolean not null default false,
  summary text not null,
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolved_on is null or resolved_on >= reported_on)
);

-- The complaints log residents can see (Code 31(5)).
create table complaints (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  resident_id uuid references residents(id),
  received_on date not null,
  summary text not null,
  code_related boolean not null default false,
  response text,
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolved_on is null or resolved_on >= received_on)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  record_id uuid,
  before_record jsonb,
  after_record jsonb,
  created_at timestamptz not null default now()
);
create function events_locked() returns trigger language plpgsql as $$
begin raise exception 'Events cannot be changed'; end $$;
create trigger events_no_update before update or delete on events for each row execute function events_locked();

create trigger t_buildings before update on buildings for each row execute function touch_updated();
create trigger t_rooms before update on rooms for each row execute function touch_updated();
create trigger t_residents before update on residents for each row execute function touch_updated();
create trigger t_contracts before update on contracts for each row execute function touch_updated();
create trigger t_concerns before update on concerns for each row execute function touch_updated();
create trigger t_plans before update on welfare_plans for each row execute function touch_updated();
create trigger t_maintenance before update on maintenance for each row execute function touch_updated();
create trigger t_complaints before update on complaints for each row execute function touch_updated();

create function setting_int(k text) returns int language sql stable as $$
  select value::int from settings where key = k
$$;

-- A contract is live on a day when it is not cancelled, has a room, covers the day
-- and the resident has not checked out.
create view live_contracts as
select c.*, r.name as resident, rm.name as room, rm.building_id, b.name as building
from contracts c
join residents r on r.id = c.resident_id
left join rooms rm on rm.id = c.room_id
left join buildings b on b.id = rm.building_id
where c.status <> 'cancelled'
  and c.room_id is not null
  and c.starts_on <= current_date and c.ends_on > current_date
  and c.checked_out_on is null;

create view occupancy as
select b.name as building,
  sum(rm.beds)::int as beds,
  sum(case when rm.offline_reason is not null then rm.beds else 0 end)::int as offline,
  coalesce(sum(occ.n), 0)::int as occupied,
  (sum(case when rm.offline_reason is null then rm.beds else 0 end) - coalesce(sum(occ.n), 0))::int as vacant,
  round(100.0 * coalesce(sum(occ.n), 0) / nullif(sum(case when rm.offline_reason is null then rm.beds else 0 end), 0), 1) as occupancy_pct
from buildings b
join rooms rm on rm.building_id = b.id
left join (select room_id, count(*) as n from live_contracts group by room_id) occ on occ.room_id = rm.id
group by b.name;

create view residents_now as
select lc.resident_id as id, lc.resident, lc.building, lc.room, lc.term, lc.checked_in_on, lc.ends_on,
  (select max(k.checked_on) from checks k where k.resident_id = lc.resident_id) as last_check,
  (current_date - coalesce((select max(k.checked_on) from checks k where k.resident_id = lc.resident_id), lc.checked_in_on, lc.starts_on))::int as days_since_check
from live_contracts lc;

create view balances as
select c.id as contract_id, r.name as resident, c.term,
  coalesce((select sum(amount_cents) from charges ch where ch.contract_id = c.id and ch.due_on <= current_date), 0)::bigint as due_cents,
  coalesce((select sum(amount_cents) from payments p where p.contract_id = c.id), 0)::bigint as paid_cents,
  (coalesce((select sum(amount_cents) from charges ch where ch.contract_id = c.id and ch.due_on <= current_date), 0)
   - coalesce((select sum(amount_cents) from payments p where p.contract_id = c.id), 0))::bigint as balance_cents,
  (select min(ch.due_on) from charges ch where ch.contract_id = c.id and ch.due_on <= current_date) as oldest_due
from contracts c
join residents r on r.id = c.resident_id
where c.status <> 'cancelled';

-- Arrears: oldest unpaid charge first. Payments clear the oldest charges first.
create view arrears as
select b.contract_id, b.resident, b.term, b.balance_cents,
  (select (current_date - ch.due_on)::int from charges ch
    where ch.contract_id = b.contract_id and ch.due_on <= current_date
      and (select coalesce(sum(c2.amount_cents), 0) from charges c2 where c2.contract_id = b.contract_id and (c2.due_on, c2.id) <= (ch.due_on, ch.id)) > b.paid_cents
    order by ch.due_on, ch.id limit 1) as days_overdue
from balances b
where b.balance_cents > 0;

create view arrivals as
select c.id as contract_id, r.name as resident, coalesce(b.name, '(no room)') as building, coalesce(rm.name, '(no room)') as room,
  c.term, c.starts_on, c.status, c.signed_on
from contracts c
join residents r on r.id = c.resident_id
left join rooms rm on rm.id = c.room_id
left join buildings b on b.id = rm.building_id
where c.status <> 'cancelled' and c.checked_in_on is null
  and c.starts_on between current_date - 7 and current_date + 21;

create view departures as
select c.id as contract_id, r.name as resident, b.name as building, rm.name as room, c.term, c.ends_on
from contracts c
join residents r on r.id = c.resident_id
join rooms rm on rm.id = c.room_id
join buildings b on b.id = rm.building_id
where c.status = 'signed' and c.checked_in_on is not null and c.checked_out_on is null
  and c.ends_on <= current_date + 21;

create view welfare_due as
select r.name as resident, 'plan review' as item, p.review_on as due_on, p.owner, p.summary as detail
from welfare_plans p join residents r on r.id = p.resident_id
where p.closed_on is null and p.review_on <= current_date + 3
union all
select rn.resident, 'activity check', (current_date - rn.days_since_check + setting_int('activity_check_days')), null,
  'Last check ' || coalesce(rn.last_check::text, 'never') || ', ' || rn.days_since_check || ' days ago'
from residents_now rn
where rn.days_since_check >= setting_int('activity_check_days')
union all
select r.name, 'open ' || c.risk || ' concern', c.reported_on, c.reported_by, c.summary
from concerns c join residents r on r.id = c.resident_id
where c.closed_on is null and c.risk in ('medium', 'high');

create view compliance_issues as
-- Code 31(4): house rules and complaints information before signing.
select 'DISCLOSURE_BEFORE_SIGNING' as rule, r.name as subject,
  'Signed ' || c.signed_on || ' without house rules or complaints information given first' as issue, c.id as record_id
from contracts c join residents r on r.id = c.resident_id
where c.signed_on is not null and c.status = 'signed'
  and (c.house_rules_given_on is null or c.house_rules_given_on > c.signed_on
    or c.complaints_info_given_on is null or c.complaints_info_given_on > c.signed_on)
union all
-- Code 31(1)(d) and 31(3): deposit, fees and refund policy set out.
select 'CONTRACT_TERMS', r.name, 'Contract for ' || c.term || ' has no refund policy recorded', c.id
from contracts c join residents r on r.id = c.resident_id
where c.status <> 'cancelled' and (c.refund_policy is null or length(trim(c.refund_policy)) = 0)
union all
-- Code 27(1)(c)(iii): residents under 18 and a parent or guardian contact.
select 'UNDER_18_GUARDIAN', r.name, 'Under 18 at start of ' || c.term || ' with no parent or guardian contact', c.id
from contracts c join residents r on r.id = c.resident_id
where c.status <> 'cancelled' and r.date_of_birth is not null
  and r.date_of_birth > (c.starts_on - interval '18 years')::date
  and (r.guardian_name is null or r.guardian_phone is null)
union all
-- Code 27(1)(c)(i): a resident assessed at risk has a welfare management plan.
select 'AT_RISK_NO_PLAN', r.name, 'High-risk concern raised ' || c.reported_on || ' with no open welfare plan', c.id
from concerns c join residents r on r.id = c.resident_id
where c.closed_on is null and c.risk = 'high'
  and not exists (select 1 from welfare_plans p where p.resident_id = c.resident_id and p.closed_on is null)
union all
select 'PLAN_REVIEW_OVERDUE', r.name, 'Welfare plan review was due ' || p.review_on, p.id
from welfare_plans p join residents r on r.id = p.resident_id
where p.closed_on is null and p.review_on < current_date
union all
-- Code 27(1)(c)(ii): regular checks that residents are active.
select 'ACTIVITY_CHECK', rn.resident, 'No recorded check for ' || rn.days_since_check || ' days', rn.id
from residents_now rn
where rn.days_since_check >= setting_int('activity_check_days')
union all
-- Code 27(1)(c)(v): 24 hours' notice before a routine room entry.
select 'ROOM_ENTRY_NOTICE', b.name || ' ' || rm.name,
  'Routine entry ' || to_char(e.entry_at, 'YYYY-MM-DD HH24:MI') || ' with ' ||
  coalesce(round(extract(epoch from (e.entry_at - e.notified_at)) / 3600.0, 1)::text || ' hours', 'no') || ' notice', e.id
from room_entries e join rooms rm on rm.id = e.room_id join buildings b on b.id = rm.building_id
where e.reason = 'routine'
  and (e.notified_at is null or e.entry_at - e.notified_at < make_interval(hours => setting_int('room_entry_notice_hours')))
union all
-- Code 33(1)(c): secure, clean, dry and warm. The repair target is the operator's.
select 'URGENT_REPAIR', b.name || coalesce(' ' || rm.name, ''),
  m.category || ' reported ' || m.reported_on || ', open ' || (current_date - m.reported_on) || ' days: ' || m.summary, m.id
from maintenance m join buildings b on b.id = m.building_id left join rooms rm on rm.id = m.room_id
where m.resolved_on is null and m.urgent and current_date - m.reported_on > setting_int('urgent_repair_days')
union all
-- House standard: complaints answered within the operator's target.
select 'COMPLAINT_OPEN', b.name, 'Complaint received ' || c.received_on || ' open ' || (current_date - c.received_on) || ' days: ' || c.summary, c.id
from complaints c join buildings b on b.id = c.building_id
where c.resolved_on is null and current_date - c.received_on > setting_int('complaint_target_days')
union all
-- Data check: never more residents in a room than it has beds.
select 'OVERBOOKED', b.name || ' ' || rm.name, count(*) || ' residents for ' || rm.beds || ' bed(s)', rm.id
from live_contracts lc join rooms rm on rm.id = lc.room_id join buildings b on b.id = rm.building_id
group by b.name, rm.name, rm.beds, rm.id
having count(*) > rm.beds;

alter table settings enable row level security;
alter table buildings enable row level security;
alter table rooms enable row level security;
alter table residents enable row level security;
alter table contracts enable row level security;
alter table charges enable row level security;
alter table payments enable row level security;
alter table concerns enable row level security;
alter table welfare_plans enable row level security;
alter table checks enable row level security;
alter table room_entries enable row level security;
alter table maintenance enable row level security;
alter table complaints enable row level security;
alter table events enable row level security;
