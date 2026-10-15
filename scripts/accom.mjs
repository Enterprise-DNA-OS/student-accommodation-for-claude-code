#!/usr/bin/env node
// The one CLI for student accommodation. Human tables by default, --json for machines.
//   npm run accom -- help
//   npm run accom -- attention
//   npm run accom -- offer --resident="Hannah" --term="Second semester" --start=2027-02-20 --end=2027-06-30 --fee=300 --actor=Kate
// Every change takes --actor and can be previewed with --dry-run.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { getDb } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table as textTable } from './lib/format.mjs';
import { page, table, writeOut, esc } from './lib/render.mjs';

// ---------------------------------------------------------------- reads

export const reads = {
  buildings: `select b.name, b.code, b.address, o.beds, o.occupied, o.vacant from buildings b left join occupancy o on o.building = b.name order by b.name`,
  rooms: `select b.name as building, rm.name as room, rm.room_type as type, rm.beds, rm.weekly_fee_cents as weekly_fee_cents,
            (select count(*) from live_contracts lc where lc.room_id = rm.id)::int as occupied, coalesce(rm.offline_reason, '') as offline
          from rooms rm join buildings b on b.id = rm.building_id order by b.name, rm.name`,
  occupancy: `select * from occupancy order by building`,
  residents: `select resident, building, room, term, checked_in_on, ends_on, last_check, days_since_check from residents_now order by building, room, resident`,
  arrivals: `select resident, building, room, term, starts_on, status, signed_on from arrivals order by starts_on, resident`,
  departures: `select resident, building, room, term, ends_on from departures order by ends_on, resident`,
  arrears: `select resident, term, balance_cents, days_overdue from arrears order by days_overdue desc nulls last, resident`,
  welfare: `select resident, item, due_on, owner, detail from welfare_due order by due_on, resident`,
  concerns: `select substr(c.id::text, 1, 8) as id, r.name as resident, c.reported_on, c.category, c.risk, c.summary
             from concerns c join residents r on r.id = c.resident_id where c.closed_on is null order by c.risk = 'high' desc, c.reported_on`,
  plans: `select substr(p.id::text, 1, 8) as id, r.name as resident, p.owner, p.opened_on, p.review_on, p.summary
          from welfare_plans p join residents r on r.id = p.resident_id where p.closed_on is null order by p.review_on`,
  complaints: `select substr(c.id::text, 1, 8) as id, b.name as building, c.received_on, c.summary, c.code_related, coalesce(c.response, '') as response, c.resolved_on
               from complaints c join buildings b on b.id = c.building_id order by c.resolved_on is null desc, c.received_on desc`,
  repairs: `select substr(m.id::text, 1, 8) as id, b.name as building, coalesce(rm.name, '') as room, m.category, m.urgent, m.reported_on,
              (current_date - m.reported_on)::int as days_open, m.summary
            from maintenance m join buildings b on b.id = m.building_id left join rooms rm on rm.id = m.room_id
            where m.resolved_on is null order by m.urgent desc, m.reported_on`,
  entries: `select b.name as building, rm.name as room, e.reason, to_char(e.notified_at, 'YYYY-MM-DD HH24:MI') as notified,
              to_char(e.entry_at, 'YYYY-MM-DD HH24:MI') as entered, e.staff, coalesce(e.note, '') as note
            from room_entries e join rooms rm on rm.id = e.room_id join buildings b on b.id = rm.building_id
            where e.entry_at >= now() - interval '30 days' order by e.entry_at desc`,
  compliance: `select rule, subject, issue from compliance_issues order by rule, subject`,
  settings: `select key, value, note from settings order by key`,
  activity: `select to_char(created_at, 'YYYY-MM-DD HH24:MI') as at, actor, action, substr(record_id::text, 1, 8) as record from events order by created_at, id`,
};

const MUTATIONS = {
  'add-building': ['name', 'code', 'address'],
  'add-room': ['building', 'name', 'type', 'beds', 'fee', 'floor'],
  'set-room': ['room', 'fee', 'offline', 'online'],
  'add-resident': ['name', 'email', 'phone', 'student-id', 'institution', 'dob', 'guardian', 'guardian-phone', 'emergency'],
  'update-resident': ['resident', 'name', 'email', 'phone', 'student-id', 'institution', 'dob', 'guardian', 'guardian-phone', 'emergency'],
  offer: ['resident', 'term', 'start', 'end', 'fee', 'deposit', 'refund-policy', 'room'],
  disclose: ['contract', 'house-rules', 'complaints-info', 'refund-policy'],
  sign: ['contract', 'on'],
  assign: ['contract', 'room'],
  'check-in': ['contract', 'on'],
  'check-out': ['contract', 'on'],
  cancel: ['contract', 'reason'],
  'bill-fees': ['through'],
  charge: ['contract', 'kind', 'amount', 'due', 'description'],
  pay: ['contract', 'amount', 'reference', 'on'],
  'raise-concern': ['resident', 'category', 'risk', 'summary', 'on', 'by'],
  'close-concern': ['concern', 'outcome'],
  'open-plan': ['resident', 'owner', 'summary', 'review'],
  'review-plan': ['plan', 'outcome', 'next'],
  'close-plan': ['plan', 'outcome'],
  'log-check': ['resident', 'kind', 'outcome', 'on'],
  'log-entry': ['room', 'reason', 'entry', 'notified', 'note'],
  'report-repair': ['building', 'room', 'category', 'summary', 'urgent', 'on'],
  'resolve-repair': ['repair', 'on'],
  'log-complaint': ['building', 'resident', 'summary', 'code-related', 'on'],
  'resolve-complaint': ['complaint', 'response', 'on'],
  set: ['key', 'value'],
  import: ['file', 'map', 'term'],
};
const OTHER = {
  resident: ['resident'],
  vacancies: ['from', 'to'],
  attention: [],
  'weekly-review': [],
  export: ['out'],
  'draft-arrears-letter': ['contract'],
  'draft-entry-notice': ['room', 'entry', 'reason'],
  help: [],
};
const FLAGS = { ...Object.fromEntries(Object.keys(reads).map((k) => [k, []])), ...OTHER, ...MUTATIONS };
const BOOLEAN = new Set(['json', 'dry-run', 'urgent', 'code-related', 'online']);

// ---------------------------------------------------------------- argument parsing

function parseArgs(argv) {
  const cmd = argv[0] || 'help';
  if (!FLAGS[cmd]) throw new Error(`Unknown command "${cmd}". Run: npm run accom -- help`);
  const opts = {};
  const positional = [];
  for (const arg of argv.slice(1)) {
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const at = arg.indexOf('=');
    const key = arg.slice(2, at < 0 ? undefined : at);
    const value = at < 0 ? true : arg.slice(at + 1);
    const allowed = [...FLAGS[cmd], 'json', ...(MUTATIONS[cmd] ? ['actor', 'dry-run'] : [])];
    if (!allowed.includes(key)) throw new Error(`Unknown flag --${key} for ${cmd}`);
    if (Object.hasOwn(opts, key)) throw new Error(`Repeated flag --${key}`);
    if (BOOLEAN.has(key) ? value !== true : value === true || value === '') throw new Error(`Invalid value for --${key}`);
    opts[key] = value;
  }
  if (cmd === 'import' ? positional.join(' ') !== 'starrez' : positional.length) {
    throw new Error(cmd === 'import' ? 'Usage: import starrez --file=report.csv --actor=NAME' : `Unexpected argument: ${positional[0]}`);
  }
  return { cmd, opts };
}

function help() {
  const line = (c) => `  ${c}${c === 'import' ? ' starrez' : ''} ${FLAGS[c].map((f) => (BOOLEAN.has(f) ? `[--${f}]` : `--${f}=…`)).join(' ')}${MUTATIONS[c] ? ' --actor=NAME [--dry-run]' : ''} [--json]`;
  return ['Reads:', ...Object.keys(reads).map(line), ...Object.keys(OTHER).map(line), '', 'Changes:', ...Object.keys(MUTATIONS).map(line)].join('\n');
}

// ---------------------------------------------------------------- value checks

const isoDate = (v, what = 'date') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw new Error(`Invalid ${what}: ${v} (use YYYY-MM-DD)`);
  return v;
};
const isoTime = (v, what = 'time') => {
  const s = String(v).replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || !Number.isFinite(Date.parse(`${s}:00Z`))) throw new Error(`Invalid ${what}: ${v} (use YYYY-MM-DDTHH:MM)`);
  return `${s}:00`;
};
const cents = (v) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(v))) throw new Error(`Invalid amount: ${v} (plain number, no symbols)`);
  const [whole, frac = ''] = String(v).split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n > 9_000_000_000_000) throw new Error('Amount too large');
  return n;
};
const posInt = (v, what) => {
  if (!/^\d+$/.test(String(v)) || Number(v) < 1) throw new Error(`Invalid ${what}: ${v}`);
  return Number(v);
};
const oneOf = (v, list, what) => {
  const s = String(v).toLowerCase();
  if (!list.includes(s)) throw new Error(`Invalid ${what}: ${v} (one of ${list.join(', ')})`);
  return s;
};

// ---------------------------------------------------------------- main

async function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (cmd === 'help') { console.log(help()); return; }

  const db = await getDb();
  const q = (sql, params = []) => db.query(sql, params);
  const one = async (sql, params = []) => (await q(sql, params))[0];
  const req = (k) => {
    if (typeof opts[k] !== 'string' || !opts[k].trim()) throw new Error(`Required: --${k}=…`);
    return opts[k].trim();
  };
  const opt = (k) => (typeof opts[k] === 'string' && opts[k].trim() ? opts[k].trim() : null);

  try {
    const today = (await one('select current_date::text as d')).d;
    const currency = (await one("select value from settings where key = 'currency'"))?.value || 'NZD';

    // Partial id, exact name (case-insensitive) or, failing that, a name fragment. Ambiguous lists and fails.
    const resolve = async (tableName, s, label = tableName) => {
      const sql = (where) => `select * from ${tableName} where ${where} order by name, id`;
      let rows = await q(sql('id::text = lower($1) or lower(name) = lower($1) or starts_with(id::text, lower($1))'), [s]);
      if (!rows.length) rows = await q(sql("lower(name) like '%' || lower($1) || '%'"), [s]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one ${label} matches "${s}": ${rows.map((r) => `${r.name} (${r.id.slice(0, 8)})`).join('; ')}` : `No ${label} matches "${s}"`);
      return rows[0];
    };
    const resolveRoom = async (s) => {
      const rows = await q(
        `select rm.*, b.name as building from rooms rm join buildings b on b.id = rm.building_id
         where starts_with(rm.id::text, lower($1)) or lower(rm.name) = lower($1) or lower(b.name || ' ' || rm.name) = lower($1) or lower(b.code || ' ' || rm.name) = lower($1)
         order by b.name, rm.name`, [s]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one room matches "${s}": ${rows.map((r) => `${r.building} ${r.name}`).join('; ')}` : `No room matches "${s}"`);
      return rows[0];
    };
    // A contract by id prefix, or by resident name (the one stay that is not cancelled).
    const resolveContract = async (s) => {
      let rows = await q(`select c.*, r.name as resident from contracts c join residents r on r.id = c.resident_id where starts_with(c.id::text, lower($1))`, [s]);
      if (!rows.length) {
        rows = await q(
          `select c.*, r.name as resident from contracts c join residents r on r.id = c.resident_id
           where c.status <> 'cancelled' and (lower(r.name) = lower($1) or lower(r.name) like '%' || lower($1) || '%') order by c.starts_on`, [s]);
      }
      if (rows.length !== 1) throw new Error(rows.length ? `More than one contract matches "${s}": ${rows.map((r) => `${r.resident} ${r.term} (${r.id.slice(0, 8)})`).join('; ')}` : `No contract matches "${s}"`);
      return rows[0];
    };
    const byPrefix = async (tableName, s, label) => {
      const rows = await q(`select * from ${tableName} where starts_with(id::text, lower($1))`, [s]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one ${label} starts with "${s}"` : `No ${label} with id "${s}"`);
      return rows[0];
    };
    const insert = async (t, obj) => {
      const keys = Object.keys(obj);
      return one(`insert into ${t} (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(obj));
    };
    const update = async (t, row, obj) => {
      const keys = Object.keys(obj);
      return one(`update ${t} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`, [...Object.values(obj), row.id]);
    };
    const log = (action, before, after) =>
      q('insert into events (actor, action, record_id, before_record, after_record) values ($1, $2, $3, $4::jsonb, $5::jsonb)',
        [req('actor'), action, after?.id || before?.id || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);

    // Beds already taken in a room across a date range, ignoring one contract.
    const bedsTaken = async (roomId, start, end, ignoreId = null) =>
      Number((await one(
        `select count(*)::int as n from contracts where room_id = $1 and status <> 'cancelled' and checked_out_on is null
         and starts_on < $3 and ends_on > $2 and ($4::uuid is null or id <> $4::uuid)`, [roomId, start, end, ignoreId])).n);
    const assertBed = async (room, start, end, ignoreId = null) => {
      if (room.offline_reason) throw new Error(`${room.name} is offline: ${room.offline_reason}`);
      const taken = await bedsTaken(room.id, start, end, ignoreId);
      if (taken >= room.beds) throw new Error(`${room.name} has ${room.beds} bed(s) and ${taken} already booked between ${start} and ${end}`);
    };

    let out;
    if (reads[cmd]) {
      out = await q(reads[cmd]);
    } else if (MUTATIONS[cmd]) {
      req('actor');
      await db.exec('BEGIN');
      try {
        out = await mutate(cmd);
        await db.exec(opts['dry-run'] ? 'ROLLBACK' : 'COMMIT');
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
    } else {
      out = await other(cmd);
    }
    if (opts['dry-run'] && out && !Array.isArray(out)) out = { ...out, preview: 'Preview only. Nothing was changed.' };
    print(out, cmd);

    // ---------------------------------------------------------------- read helpers

    async function other(c) {
      if (c === 'resident') {
        const r = await resolve('residents', req('resident'), 'resident');
        return {
          resident: [r],
          contracts: await q(`select substr(c.id::text, 1, 8) as id, c.term, coalesce(b.name || ' ' || rm.name, '(no room)') as room, c.starts_on, c.ends_on, c.status, c.signed_on, c.checked_in_on, c.checked_out_on
                              from contracts c left join rooms rm on rm.id = c.room_id left join buildings b on b.id = rm.building_id where c.resident_id = $1 order by c.starts_on`, [r.id]),
          balance: await q('select b.term, b.due_cents, b.paid_cents, b.balance_cents from balances b join contracts c on c.id = b.contract_id where c.resident_id = $1', [r.id]),
          concerns: await q('select reported_on, category, risk, summary, closed_on, outcome from concerns where resident_id = $1 order by reported_on', [r.id]),
          plans: await q('select owner, opened_on, review_on, summary, closed_on from welfare_plans where resident_id = $1 order by opened_on', [r.id]),
          checks: await q('select checked_on, kind, checked_by, outcome from checks where resident_id = $1 order by checked_on desc limit 10', [r.id]),
        };
      }
      if (c === 'vacancies') {
        const from = isoDate(req('from'), 'from date');
        const to = isoDate(req('to'), 'to date');
        if (to <= from) throw new Error('--to must be after --from');
        return q(`select b.name as building, rm.name as room, rm.room_type as type, rm.beds, rm.weekly_fee_cents,
                    (rm.beds - (select count(*) from contracts c where c.room_id = rm.id and c.status <> 'cancelled' and c.checked_out_on is null and c.starts_on < $2 and c.ends_on > $1))::int as free_beds
                  from rooms rm join buildings b on b.id = rm.building_id
                  where rm.offline_reason is null
                    and rm.beds > (select count(*) from contracts c where c.room_id = rm.id and c.status <> 'cancelled' and c.checked_out_on is null and c.starts_on < $2 and c.ends_on > $1)
                  order by b.name, rm.name`, [from, to]);
      }
      if (c === 'attention') {
        return {
          compliance: await q(reads.compliance),
          welfare: await q(reads.welfare),
          'arrivals not signed': await q(`select resident, building, room, term, starts_on from arrivals where status <> 'signed' order by starts_on`),
          arrears: await q(`select resident, term, balance_cents, days_overdue from arrears where days_overdue >= 7 order by days_overdue desc`),
          'urgent repairs': await q(`select building, room, category, days_open, summary from (${reads.repairs}) x where urgent`),
        };
      }
      if (c === 'weekly-review') {
        return {
          occupancy: await q(reads.occupancy),
          arrivals: await q(reads.arrivals),
          departures: await q(reads.departures),
          arrears: await q(reads.arrears),
          welfare: await q(reads.welfare),
          'compliance by rule': await q('select rule, count(*)::int as open from compliance_issues group by rule order by rule'),
          'open complaints': await q(`select building, received_on, summary from (${reads.complaints}) x where resolved_on is null`),
          'open repairs': await q(`select building, room, category, urgent, days_open from (${reads.repairs}) x`),
        };
      }
      if (c === 'export') {
        const file = path.resolve(req('out'));
        const data = { format: 'student-accommodation-archive-v1', created: new Date().toISOString(), records: {} };
        await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');
        try {
          for (const t of ['settings', 'buildings', 'rooms', 'residents', 'contracts', 'charges', 'payments', 'concerns', 'welfare_plans', 'checks', 'room_entries', 'maintenance', 'complaints', 'events']) {
            data.records[t] = await q(`select * from ${t} order by 1`);
          }
          await db.exec('COMMIT');
        } catch (e) {
          await db.exec('ROLLBACK');
          throw e;
        }
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
        return { file, counts: Object.fromEntries(Object.entries(data.records).map(([k, v]) => [k, v.length])) };
      }
      if (c === 'draft-arrears-letter') {
        const ct = await resolveContract(req('contract'));
        const bal = await one('select * from arrears where contract_id = $1', [ct.id]);
        if (!bal) throw new Error(`${ct.resident} has nothing overdue`);
        const lines = await q(`select due_on, description, amount_cents from charges where contract_id = $1 and due_on <= current_date order by due_on`, [ct.id]);
        const paid = await q('select received_on, reference, amount_cents from payments where contract_id = $1 order by received_on', [ct.id]);
        const money = (n) => `${currency} ${(Number(n) / 100).toFixed(2)}`;
        const file = writeOut('drafts', `arrears-${ct.resident.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today}`, page({
          title: 'DRAFT: fees overdue',
          subtitle: `${ct.resident}, ${ct.term}`,
          sections: [
            { title: 'Letter', html: `<p>Kia ora ${esc(ct.resident.split(' ')[0])},</p><p>Our records show ${esc(money(bal.balance_cents))} of accommodation fees is overdue, the oldest by ${esc(bal.days_overdue)} days. The charges and payments we hold are below.</p><p>If you have paid recently, reply with the reference and we will match it. If paying is hard right now, come and see us: we can set up a plan, and our support staff can connect you with hardship help.</p><p>Ngā mihi,<br>[Accommodation office]</p>` },
            { title: 'Charges due to date', html: table(lines.map((l) => ({ ...l, currency }))) },
            { title: 'Payments received', html: table(paid.map((p) => ({ ...p, currency }))) },
          ],
        }));
        return { file, resident: ct.resident, balance_cents: bal.balance_cents, note: 'Draft only. Nothing was sent.' };
      }
      if (c === 'draft-entry-notice') {
        const room = await resolveRoom(req('room'));
        const entry = isoTime(req('entry'), 'entry time');
        const reason = req('reason');
        const residents = await q('select resident from live_contracts where room_id = $1 order by resident', [room.id]);
        const hoursAhead = (Date.parse(`${entry}Z`) - Date.parse(`${(await one("select to_char(now(), 'YYYY-MM-DD\"T\"HH24:MI:SS') as t")).t}Z`)) / 3_600_000;
        const notice = Number((await one("select value from settings where key = 'room_entry_notice_hours'")).value);
        const file = writeOut('drafts', `entry-notice-${room.name.toLowerCase()}-${entry.slice(0, 10)}`, page({
          title: 'DRAFT: notice of room entry',
          subtitle: `${room.building} ${room.name}`,
          sections: [{ title: 'Notice', html: `<p>To ${esc(residents.map((r) => r.resident).join(' and ') || 'the resident')},</p><p>Staff will enter ${esc(room.building)} ${esc(room.name)} on ${esc(entry.replace('T', ' at ').slice(0, 19))} for: ${esc(reason)}.</p><p>You are welcome to be present. Ask the office if this time does not work.</p>` }],
        }));
        return { file, residents: residents.length, hours_notice_if_sent_now: Math.round(hoursAhead * 10) / 10, enough_notice: hoursAhead >= notice, note: 'Draft only. Nothing was sent.' };
      }
      throw new Error(`Unhandled command ${c}`);
    }

    // ---------------------------------------------------------------- changes

    async function mutate(c) {
      if (c === 'add-building') {
        const row = await insert('buildings', { name: req('name'), code: req('code').toUpperCase(), address: opt('address') });
        await log(c, null, row);
        return row;
      }
      if (c === 'add-room') {
        const b = await resolve('buildings', req('building'), 'building');
        const row = await insert('rooms', {
          building_id: b.id, name: req('name'), room_type: oneOf(req('type'), ['single', 'twin', 'studio', 'ensuite', 'apartment'], 'room type'),
          beds: opts.beds ? posInt(req('beds'), 'beds') : 1, weekly_fee_cents: cents(req('fee')), floor: opt('floor'),
        });
        await log(c, null, row);
        return row;
      }
      if (c === 'set-room') {
        const room = await resolveRoom(req('room'));
        const changes = {};
        if (opts.fee) changes.weekly_fee_cents = cents(req('fee'));
        if (opts.offline && opts.online) throw new Error('Choose --offline=REASON or --online, not both');
        if (opts.offline) {
          const live = await q('select resident from live_contracts where room_id = $1', [room.id]);
          if (live.length) throw new Error(`${room.name} has residents (${live.map((r) => r.resident).join(', ')}): move them first`);
          changes.offline_reason = req('offline');
        }
        if (opts.online) changes.offline_reason = null;
        if (!Object.keys(changes).length) throw new Error('Nothing to change: give --fee, --offline=REASON or --online');
        const { building, ...before } = room;
        const row = await update('rooms', before, changes);
        await log(c, before, row);
        return row;
      }
      if (c === 'add-resident' || c === 'update-resident') {
        const map = { name: 'name', email: 'email', phone: 'phone', 'student-id': 'student_id', institution: 'institution', dob: 'date_of_birth', guardian: 'guardian_name', 'guardian-phone': 'guardian_phone', emergency: 'emergency_contact' };
        const fields = {};
        for (const [flag, col] of Object.entries(map)) if (opt(flag)) fields[col] = flag === 'dob' ? isoDate(req(flag), 'date of birth') : req(flag);
        if (c === 'add-resident') {
          if (!fields.name) throw new Error('Required: --name=…');
          const row = await insert('residents', fields);
          await log(c, null, row);
          return row;
        }
        const r = await resolve('residents', req('resident'), 'resident');
        if (!Object.keys(fields).length) throw new Error('Nothing to change');
        const row = await update('residents', r, fields);
        await log(c, r, row);
        return row;
      }
      if (c === 'offer') {
        const r = await resolve('residents', req('resident'), 'resident');
        const start = isoDate(req('start'), 'start date');
        const end = isoDate(req('end'), 'end date');
        if (end <= start) throw new Error('--end must be after --start');
        const row = { resident_id: r.id, term: req('term'), starts_on: start, ends_on: end, weekly_fee_cents: cents(req('fee')), deposit_cents: opts.deposit ? cents(req('deposit')) : 0, refund_policy: opt('refund-policy') };
        if (opts.room) {
          const room = await resolveRoom(req('room'));
          await assertBed(room, start, end);
          row.room_id = room.id;
        }
        const out = await insert('contracts', row);
        await log(c, null, out);
        return out;
      }
      if (c === 'disclose') {
        const ct = await resolveContract(req('contract'));
        const changes = {};
        if (opts['house-rules']) changes.house_rules_given_on = isoDate(req('house-rules'), 'house rules date');
        if (opts['complaints-info']) changes.complaints_info_given_on = isoDate(req('complaints-info'), 'complaints information date');
        if (opts['refund-policy']) changes.refund_policy = req('refund-policy');
        if (!Object.keys(changes).length) throw new Error('Give --house-rules=DATE, --complaints-info=DATE and/or --refund-policy=TEXT');
        for (const d of [changes.house_rules_given_on, changes.complaints_info_given_on]) if (d && d > today) throw new Error('A disclosure date cannot be in the future');
        const { resident, ...before } = ct;
        const row = await update('contracts', before, changes);
        await log(c, before, row);
        return row;
      }
      if (c === 'sign') {
        const ct = await resolveContract(req('contract'));
        if (ct.status !== 'offered') throw new Error(`Contract is ${ct.status}, not offered`);
        const on = opts.on ? isoDate(req('on'), 'signing date') : today;
        if (on > today) throw new Error('Signing date cannot be in the future');
        const missing = [];
        if (!ct.house_rules_given_on || ct.house_rules_given_on > on) missing.push('house rules');
        if (!ct.complaints_info_given_on || ct.complaints_info_given_on > on) missing.push('complaints process and Dispute Resolution Scheme information');
        if (missing.length) throw new Error(`Give the resident the ${missing.join(' and ')} before signing (Code 31(4)). Record it with: disclose --contract=… --house-rules=DATE --complaints-info=DATE`);
        if (!ct.refund_policy) throw new Error('Record the refund policy on the contract before signing (Code 31(1)(d), 31(3)): disclose --refund-policy=…');
        const { resident, ...before } = ct;
        const row = await update('contracts', before, { status: 'signed', signed_on: on });
        await log(c, before, row);
        return row;
      }
      if (c === 'assign') {
        const ct = await resolveContract(req('contract'));
        if (ct.status === 'cancelled') throw new Error('Contract is cancelled');
        const room = await resolveRoom(req('room'));
        await assertBed(room, ct.starts_on, ct.ends_on, ct.id);
        const { resident, ...before } = ct;
        const row = await update('contracts', before, { room_id: room.id });
        await log(c, before, row);
        return row;
      }
      if (c === 'check-in' || c === 'check-out') {
        const ct = await resolveContract(req('contract'));
        const on = opts.on ? isoDate(req('on')) : today;
        if (on > today) throw new Error('Date cannot be in the future');
        const { resident, ...before } = ct;
        let changes;
        if (c === 'check-in') {
          if (ct.status !== 'signed') throw new Error('Contract is not signed: no check-in without a signed contract');
          if (!ct.room_id) throw new Error('No room assigned');
          if (ct.checked_in_on) throw new Error(`Already checked in on ${ct.checked_in_on}`);
          changes = { checked_in_on: on };
        } else {
          if (!ct.checked_in_on) throw new Error('Not checked in');
          if (ct.checked_out_on) throw new Error(`Already checked out on ${ct.checked_out_on}`);
          if (on < ct.checked_in_on) throw new Error('Check-out is before check-in');
          changes = { checked_out_on: on };
        }
        const row = await update('contracts', before, changes);
        await log(c, before, row);
        return row;
      }
      if (c === 'cancel') {
        const ct = await resolveContract(req('contract'));
        if (ct.checked_in_on && !ct.checked_out_on) throw new Error('Resident is checked in: check them out first');
        if (ct.status === 'cancelled') throw new Error('Already cancelled');
        const { resident, ...before } = ct;
        const row = await update('contracts', before, { status: 'cancelled' });
        await log(`${c}: ${req('reason')}`, before, row);
        return row;
      }
      if (c === 'bill-fees') {
        const through = opts.through ? isoDate(req('through'), 'through date') : today;
        const rows = await q(
          `insert into charges (contract_id, kind, description, amount_cents, due_on)
           select c.id, 'fee', 'Weekly fee, week of ' || d::date, c.weekly_fee_cents, d::date
           from contracts c, generate_series(c.starts_on, least($1::date, c.ends_on - 1), interval '7 days') d
           where c.status = 'signed' and c.checked_out_on is null
             and not exists (select 1 from charges x where x.contract_id = c.id and x.kind = 'fee' and x.due_on = d::date)
           returning *`, [through]);
        for (const r of rows) await log(c, null, r);
        return { charges_added: rows.length, through, total_cents: rows.reduce((n, r) => n + Number(r.amount_cents), 0), currency };
      }
      if (c === 'charge') {
        const ct = await resolveContract(req('contract'));
        const row = await insert('charges', { contract_id: ct.id, kind: oneOf(req('kind'), ['fee', 'deposit', 'damage', 'other'], 'kind'), description: req('description'), amount_cents: cents(req('amount')), due_on: isoDate(req('due'), 'due date') });
        await log(c, null, row);
        return row;
      }
      if (c === 'pay') {
        const ct = await resolveContract(req('contract'));
        const on = opts.on ? isoDate(req('on')) : today;
        if (on > today) throw new Error('Payment date cannot be in the future');
        const dup = await one('select id from payments where contract_id = $1 and reference = $2', [ct.id, req('reference')]);
        if (dup) throw new Error(`Payment reference ${req('reference')} is already recorded for ${ct.resident}`);
        const row = await insert('payments', { contract_id: ct.id, amount_cents: cents(req('amount')), received_on: on, reference: req('reference') });
        await log(c, null, row);
        return row;
      }
      if (c === 'raise-concern') {
        const r = await resolve('residents', req('resident'), 'resident');
        const row = await insert('concerns', {
          resident_id: r.id, reported_on: opts.on ? isoDate(req('on')) : today, reported_by: opt('by') || req('actor'),
          category: oneOf(req('category'), ['wellbeing', 'behaviour', 'safety', 'health', 'study', 'other'], 'category'),
          risk: oneOf(req('risk'), ['low', 'medium', 'high'], 'risk'), summary: req('summary'),
        });
        await log(c, null, row);
        const plan = await one('select id from welfare_plans where resident_id = $1 and closed_on is null', [r.id]);
        return row.risk === 'high' && !plan ? { ...row, next: `High risk with no open welfare plan: open one (open-plan --resident="${r.name}") (Code 27(1)(c)(i))` } : row;
      }
      if (c === 'close-concern') {
        const row0 = await byPrefix('concerns', req('concern'), 'concern');
        if (row0.closed_on) throw new Error('Concern already closed');
        const row = await update('concerns', row0, { closed_on: today, outcome: req('outcome') });
        await log(c, row0, row);
        return row;
      }
      if (c === 'open-plan') {
        const r = await resolve('residents', req('resident'), 'resident');
        if (await one('select id from welfare_plans where resident_id = $1 and closed_on is null', [r.id])) throw new Error(`${r.name} already has an open welfare plan: review it instead`);
        const days = Number((await one("select value from settings where key = 'plan_review_days'")).value);
        const review = opts.review ? isoDate(req('review'), 'review date') : (await one('select (current_date + $1::int)::text as d', [days])).d;
        if (review < today) throw new Error('Review date is in the past');
        const row = await insert('welfare_plans', { resident_id: r.id, owner: req('owner'), opened_on: today, review_on: review, summary: req('summary') });
        await log(c, null, row);
        return row;
      }
      if (c === 'review-plan' || c === 'close-plan') {
        const p = await byPrefix('welfare_plans', req('plan'), 'plan');
        if (p.closed_on) throw new Error('Plan is closed');
        await insert('checks', { resident_id: p.resident_id, checked_on: today, kind: 'plan-review', checked_by: req('actor'), outcome: req('outcome') });
        let changes;
        if (c === 'close-plan') changes = { closed_on: today };
        else {
          const days = Number((await one("select value from settings where key = 'plan_review_days'")).value);
          changes = { review_on: opts.next ? isoDate(req('next'), 'next review date') : (await one('select (current_date + $1::int)::text as d', [days])).d };
          if (changes.review_on <= today) throw new Error('Next review must be after today');
        }
        const row = await update('welfare_plans', p, changes);
        await log(c, p, row);
        return row;
      }
      if (c === 'log-check') {
        const r = await resolve('residents', req('resident'), 'resident');
        const on = opts.on ? isoDate(req('on')) : today;
        if (on > today) throw new Error('Check date cannot be in the future');
        const row = await insert('checks', { resident_id: r.id, checked_on: on, kind: oneOf(req('kind'), ['activity', 'welfare'], 'kind'), checked_by: req('actor'), outcome: req('outcome') });
        await log(c, null, row);
        return row;
      }
      if (c === 'log-entry') {
        const room = await resolveRoom(req('room'));
        const reason = oneOf(req('reason'), ['routine', 'maintenance', 'emergency', 'welfare'], 'reason');
        const entry = isoTime(req('entry'), 'entry time');
        const notified = opts.notified ? isoTime(req('notified'), 'notice time') : null;
        if (notified && notified > entry) throw new Error('Notice time is after the entry');
        const needed = Number((await one("select value from settings where key = 'room_entry_notice_hours'")).value);
        const hours = notified ? (Date.parse(`${entry}Z`) - Date.parse(`${notified}Z`)) / 3_600_000 : 0;
        const future = (await one('select $1::timestamp > now()::timestamp as f', [entry])).f;
        if (reason === 'routine' && future && hours < needed) throw new Error(`A routine entry needs ${needed} hours' notice (Code 27(1)(c)(v)); this gives ${hours.toFixed(1)}. Move the time or send the notice first.`);
        const row = await insert('room_entries', { room_id: room.id, reason, notified_at: notified, entry_at: entry, staff: req('actor'), note: opt('note') });
        await log(c, null, row);
        return reason === 'routine' && hours < needed ? { ...row, warning: `Recorded with ${hours.toFixed(1)} hours' notice: this shows on the compliance check` } : row;
      }
      if (c === 'report-repair') {
        const b = await resolve('buildings', req('building'), 'building');
        const room = opts.room ? await resolveRoom(req('room')) : null;
        if (room && room.building_id !== b.id) throw new Error(`${room.name} is not in ${b.name}`);
        const category = oneOf(req('category'), ['heating', 'damp', 'security', 'water', 'electrical', 'cleaning', 'furniture', 'other'], 'category');
        const row = await insert('maintenance', { building_id: b.id, room_id: room?.id || null, reported_on: opts.on ? isoDate(req('on')) : today, category, urgent: Boolean(opts.urgent), summary: req('summary') });
        await log(c, null, row);
        return row;
      }
      if (c === 'resolve-repair') {
        const m = await byPrefix('maintenance', req('repair'), 'repair');
        if (m.resolved_on) throw new Error('Already resolved');
        const row = await update('maintenance', m, { resolved_on: opts.on ? isoDate(req('on')) : today });
        await log(c, m, row);
        return row;
      }
      if (c === 'log-complaint') {
        const b = await resolve('buildings', req('building'), 'building');
        const r = opts.resident ? await resolve('residents', req('resident'), 'resident') : null;
        const row = await insert('complaints', { building_id: b.id, resident_id: r?.id || null, received_on: opts.on ? isoDate(req('on')) : today, summary: req('summary'), code_related: Boolean(opts['code-related']) });
        await log(c, null, row);
        return row;
      }
      if (c === 'resolve-complaint') {
        const cp = await byPrefix('complaints', req('complaint'), 'complaint');
        if (cp.resolved_on) throw new Error('Already resolved');
        const row = await update('complaints', cp, { response: req('response'), resolved_on: opts.on ? isoDate(req('on')) : today });
        await log(c, cp, row);
        return row;
      }
      if (c === 'set') {
        const s = await one('select * from settings where key = $1', [req('key')]);
        if (!s) throw new Error(`No setting "${req('key')}". Run: npm run accom -- settings`);
        if (s.key !== 'currency') posInt(req('value'), s.key);
        const row = await one('update settings set value = $1 where key = $2 returning *', [req('value'), s.key]);
        await log(c, s, row);
        return row;
      }
      if (c === 'import') return importStarRez();
      throw new Error(`Unhandled command ${c}`);
    }

    // ---------------------------------------------------------------- StarRez import

    // A StarRez booking report saved as CSV: one row per booking. Report columns are chosen
    // by whoever builds the report, so other headings come in with --map=mapping.json.
    async function importStarRez() {
      const file = path.resolve(req('file'));
      const rows = parseCsv(readFileSync(file, 'utf8'));
      if (!rows.length) throw new Error('The file has no rows');
      const defaults = {
        entry: 'EntryID', first: 'NameFirst', last: 'NameLast', email: 'Email', dob: 'DOB', student_id: 'ID1',
        booking: 'BookingID', building: 'RoomLocation', room: 'RoomSpace', room_type: 'RoomType', beds: 'Beds',
        start: 'CheckInDate', end: 'CheckOutDate', status: 'EntryStatus', fee: 'WeeklyRate', term: 'TermSession',
      };
      const mapping = opts.map ? JSON.parse(readFileSync(path.resolve(req('map')), 'utf8')) : {};
      for (const [k, v] of Object.entries(mapping)) if (!Object.hasOwn(defaults, k) || typeof v !== 'string' || !v) throw new Error(`Invalid mapping entry: ${k}`);
      const cols = { ...defaults, ...mapping };
      const summary = { residents_added: 0, rooms_added: 0, buildings_added: 0, contracts_added: 0, unchanged: 0, skipped_cancelled: 0 };
      const seen = new Set();
      for (const [i, r] of rows.entries()) {
        const at = `Row ${i + 2}`;
        const val = (k, required = true) => {
          const v = pick(r, cols[k]).trim();
          if (required && !v) throw new Error(`${at}: missing ${cols[k]}`);
          return v;
        };
        const booking = val('booking');
        if (seen.has(booking)) throw new Error(`${at}: booking ${booking} appears twice`);
        seen.add(booking);
        const status = val('status', false).toLowerCase();
        if (/cancel|withdr/.test(status)) { summary.skipped_cancelled++; continue; }
        const start = isoDate(val('start'), `${at} check-in date`);
        const end = isoDate(val('end'), `${at} check-out date`);
        if (end <= start) throw new Error(`${at}: check-out is not after check-in`);
        const feeText = val('fee');
        if (!/^\d+(\.\d{1,2})?$/.test(feeText)) throw new Error(`${at}: ${cols.fee} must be a plain number (no symbols)`);
        const fee = cents(feeText);

        let b = await one('select * from buildings where lower(name) = lower($1)', [val('building')]);
        if (!b) {
          const code = val('building').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'BLD';
          b = await insert('buildings', { name: val('building'), code: `${code}-${seen.size}` });
          summary.buildings_added++;
          await log('import-starrez', null, b);
        }
        let room = await one('select * from rooms where building_id = $1 and lower(name) = lower($2)', [b.id, val('room')]);
        if (!room) {
          const typeText = val('room_type', false).toLowerCase();
          const type = ['single', 'twin', 'studio', 'ensuite', 'apartment'].find((t) => typeText.includes(t)) || 'single';
          const bedsText = val('beds', false);
          room = await insert('rooms', { building_id: b.id, name: val('room'), room_type: type, beds: bedsText ? posInt(bedsText, `${at} beds`) : 1, weekly_fee_cents: fee, source_ref: `starrez:${val('room')}` });
          summary.rooms_added++;
          await log('import-starrez', null, room);
        }
        const entryRef = `starrez:entry:${val('entry')}`;
        let resident = await one('select * from residents where source_ref = $1', [entryRef]);
        if (!resident) {
          const dob = val('dob', false);
          resident = await insert('residents', {
            name: `${val('first')} ${val('last')}`.trim(), email: val('email', false) || null, student_id: val('student_id', false) || null,
            date_of_birth: dob ? isoDate(dob, `${at} date of birth`) : null, source_ref: entryRef,
          });
          summary.residents_added++;
          await log('import-starrez', null, resident);
        }
        const bookingRef = `starrez:booking:${booking}`;
        if (await one('select id from contracts where source_ref = $1', [bookingRef])) { summary.unchanged++; continue; }
        await assertBed(room, start, end);
        const inHouse = /in room|checked in|in residence/.test(status);
        const ct = await insert('contracts', {
          resident_id: resident.id, room_id: room.id, term: val('term', false) || opt('term') || 'Imported', starts_on: start, ends_on: end,
          weekly_fee_cents: fee, status: 'offered', checked_in_on: null, source_ref: bookingRef,
        });
        summary.contracts_added++;
        await log('import-starrez', null, ct);
        if (inHouse) summary.in_residence_needing_signature = (summary.in_residence_needing_signature || 0) + 1;
      }
      return {
        ...summary,
        notice: 'Imported as offered contracts. Record the house rules, complaints information and refund policy you gave, then sign and check in. Money, welfare notes and complaints are not in a booking report and are not imported.',
      };
    }
  } finally {
    await db.close();
  }

  // ---------------------------------------------------------------- output

  function print(value, c) {
    if (opts.json) { console.log(JSON.stringify(value, null, 2)); return; }
    const show = (rows) => {
      if (!rows.length) return '  (none)';
      return textTable(rows, Object.keys(rows[0]).map((k) => ({
        key: k, label: k.replace(/_cents$/, ''), width: 60,
        format: (v) => (v === null || v === undefined ? '' : k.endsWith('_cents') ? `${(Number(v) / 100).toFixed(2)}` : v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : typeof v === 'object' ? JSON.stringify(v) : v),
      })));
    };
    if (Array.isArray(value)) console.log(show(value));
    else if (value && Object.values(value).every(Array.isArray)) for (const [k, v] of Object.entries(value)) console.log(`\n${k}\n${show(v)}`);
    else console.log(show([value]));
    void c;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
