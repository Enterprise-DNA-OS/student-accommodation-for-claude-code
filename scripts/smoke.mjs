#!/usr/bin/env node
// npm test: a fresh database in a temp folder, migrate twice, seed twice, then every
// command with assertions on what it returns. PASS or a failing assertion.
// Set TEST_DATABASE_URL to an empty Postgres database to run the same checks there.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv } from './lib/csv.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'accom-smoke-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.OUTPUT_DIR = dir;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const env = { ...process.env };
const covered = new Set();
let checks = 0;

function run(script, args = [], ok = true) {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  assert.equal(r.status, ok ? 0 : 1, `${script} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  checks++;
  return r;
}
function cli(cmd, args = [], ok = true) {
  covered.add(cmd);
  const r = run('accom.mjs', [cmd, ...args, ...(cmd === 'help' ? [] : ['--json'])], ok);
  return ok && cmd !== 'help' ? JSON.parse(r.stdout) : r;
}
async function query(sql, params = []) {
  const db = await getDb();
  try { return await db.query(sql, params); } finally { await db.close(); }
}
const actor = '--actor=Tester';
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

try {
  assert.equal((await query("select tablename from pg_tables where schemaname = 'public'")).length, 0, 'TEST_DATABASE_URL must point at an empty database');
  run('migrate.mjs'); run('migrate.mjs'); run('seed.mjs'); run('seed.mjs');
  assert.equal((await query('select count(*)::int as n from residents'))[0].n, 8, 'seed runs once');

  // Reads on the demo.
  const help = cli('help');
  assert.match(help.stdout, /import starrez/);
  assert.equal(cli('buildings').length, 2);
  assert.equal(cli('rooms').length, 8);
  const occ = cli('occupancy');
  assert.deepEqual(occ.map((o) => [o.building, o.occupied, o.vacant]), [['Kowhai House', 4, 0], ['Rata Court', 3, 4]]);
  assert.equal(cli('residents').length, 7);
  assert.equal(cli('arrivals')[0].resident, 'Hannah Brooks');
  assert.equal(cli('departures')[0].resident, "Jack O'Neill");
  const arrears = cli('arrears');
  const tom = arrears.find((a) => a.resident === 'Tom Walker');
  assert.equal(Number(tom.balance_cents), 78000);
  assert.equal(tom.days_overdue, 14);
  assert(cli('welfare').some((w) => w.resident === 'Mei Tanaka' && w.item === 'plan review'));
  assert.equal(cli('concerns').length, 2);
  assert.equal(cli('plans').length, 1);
  assert.equal(cli('complaints').length, 2);
  assert.equal(cli('repairs').length, 2);
  assert.equal(cli('entries').length, 3);
  assert.equal(cli('settings').length, 6);
  assert.deepEqual(cli('activity'), []);
  const rules = new Set(cli('compliance').map((c) => c.rule));
  for (const r of ['DISCLOSURE_BEFORE_SIGNING', 'CONTRACT_TERMS', 'UNDER_18_GUARDIAN', 'AT_RISK_NO_PLAN', 'PLAN_REVIEW_OVERDUE', 'ACTIVITY_CHECK', 'ROOM_ENTRY_NOTICE', 'URGENT_REPAIR', 'COMPLAINT_OPEN']) {
    assert(rules.has(r), `demo shows ${r}`);
  }
  const attention = cli('attention');
  assert.equal(attention['arrivals not signed'][0].resident, 'Hannah Brooks');
  assert.equal(attention.arrears.length, 1);
  assert.equal(attention['urgent repairs'].length, 1);
  const weekly = cli('weekly-review');
  assert(weekly['compliance by rule'].length >= 9);
  const person = cli('resident', ['--resident=priya']);
  assert.equal(person.resident[0].name, 'Priya Raman');
  assert.equal(person.concerns.length, 1);
  cli('resident', ['--resident=a'], false); // ambiguous fragment lists and fails
  const vac = cli('vacancies', [`--from=${iso(30)}`, `--to=${iso(60)}`]);
  assert.equal(vac.reduce((n, r) => n + r.free_beds, 0), 4, 'RC-03 has three free beds, RC-02 frees up when Jack leaves, RC-04 is booked');
  cli('vacancies', [`--from=${iso(5)}`, `--to=${iso(1)}`], false);

  // Dry run changes nothing.
  cli('add-resident', ['--name=Preview Person', actor, '--dry-run']);
  assert.equal(cli('activity').length, 0);

  // Contract journey: offer, sign is blocked until disclosure, assign respects beds.
  const res = cli('add-resident', ['--name=Ruby Example', `--dob=${iso(-365 * 17)}`, '--email=ruby@example.com', actor]);
  const offer = cli('offer', ['--resident=Ruby Example', '--term=Summer school', `--start=${iso(-1)}`, `--end=${iso(60)}`, '--fee=300', '--deposit=600', actor]);
  cli('assign', [`--contract=${offer.id.slice(0, 8)}`, '--room=KH-101', actor], false); // KH-101 is full
  cli('assign', [`--contract=${offer.id.slice(0, 8)}`, '--room=KH-104', actor], false); // offline
  cli('assign', [`--contract=${offer.id.slice(0, 8)}`, '--room=Rata Court RC-03', actor]);
  cli('sign', ['--contract=Ruby', actor], false); // no disclosure yet
  cli('disclose', ['--contract=Ruby', `--house-rules=${iso(-2)}`, `--complaints-info=${iso(-2)}`, actor]);
  cli('sign', ['--contract=Ruby', actor], false); // no refund policy yet
  cli('disclose', ['--contract=Ruby', '--refund-policy=Standard refund policy v3', actor]);
  cli('disclose', ['--contract=Ruby', `--house-rules=${iso(3)}`, actor], false);
  const signed = cli('sign', ['--contract=Ruby', actor]);
  assert.equal(signed.status, 'signed');
  assert(cli('compliance').some((c) => c.rule === 'UNDER_18_GUARDIAN' && c.subject === 'Ruby Example'));
  cli('update-resident', ['--resident=Ruby Example', '--guardian=Pat Example', '--guardian-phone=021 000 9999', actor]);
  assert(!cli('compliance').some((c) => c.rule === 'UNDER_18_GUARDIAN' && c.subject === 'Ruby Example'));
  cli('check-in', ['--contract=Ruby', `--on=${iso(3)}`, actor], false);
  cli('check-in', ['--contract=Ruby', actor]);
  cli('check-in', ['--contract=Ruby', actor], false);
  assert(cli('residents').some((r) => r.resident === 'Ruby Example'));
  cli('check-in', ['--contract=Hannah', actor], false); // offered, not signed

  // Money: bill fees, take a payment, refuse a duplicate reference.
  const billed = cli('bill-fees', [actor]);
  assert(billed.charges_added >= 1);
  assert.equal(cli('bill-fees', [actor]).charges_added, 0, 'billing twice adds nothing');
  cli('charge', ['--contract=Ruby', '--kind=damage', '--amount=45.50', `--due=${iso(0)}`, '--description=Replace lost key', actor]);
  cli('charge', ['--contract=Ruby', '--kind=rent', '--amount=1', `--due=${iso(0)}`, '--description=x', actor], false);
  const payTom = ['--contract=Tom Walker', '--amount=780', '--reference=BANK-1', actor];
  cli('pay', payTom);
  cli('pay', payTom, false);
  assert(!cli('arrears').some((a) => a.resident === 'Tom Walker'));
  cli('pay', ['--contract=Tom Walker', '--amount=12.345', '--reference=BAD', actor], false);
  const arrearsLetter = cli('draft-arrears-letter', ['--contract=Sione']);
  assert(existsSync(arrearsLetter.file));
  cli('draft-arrears-letter', ['--contract=Aroha'], false);

  // Welfare: a high-risk concern points at a plan; plan reviews move the date.
  const concern = cli('raise-concern', ['--resident=Ruby Example', '--category=wellbeing', '--risk=high', '--summary=Homesick, not eating', actor]);
  assert.match(concern.next, /open-plan/);
  const plan = cli('open-plan', ['--resident=Ruby Example', '--owner=Kate', '--summary=Daily check-in for a week', actor]);
  cli('open-plan', ['--resident=Ruby Example', '--owner=Kate', '--summary=Again', actor], false);
  assert(!cli('compliance').some((c) => c.rule === 'AT_RISK_NO_PLAN' && c.subject === 'Ruby Example'));
  const reviewed = cli('review-plan', [`--plan=${plan.id.slice(0, 8)}`, '--outcome=Eating again, settling in', `--next=${iso(7)}`, actor]);
  assert.equal(reviewed.review_on, iso(7));
  const mei = cli('plans').find((p) => p.resident === 'Mei Tanaka');
  cli('review-plan', [`--plan=${mei.id}`, '--outcome=Attending tutorials', actor]);
  assert(!cli('compliance').some((c) => c.rule === 'PLAN_REVIEW_OVERDUE'));
  cli('close-plan', [`--plan=${plan.id.slice(0, 8)}`, '--outcome=Settled', actor]);
  cli('close-concern', [`--concern=${concern.id.slice(0, 8)}`, '--outcome=Settled after a week', actor]);
  cli('close-concern', [`--concern=${concern.id.slice(0, 8)}`, '--outcome=again', actor], false);
  cli('log-check', ['--resident=Priya', '--kind=welfare', '--outcome=Spoke at her door, agreed to see the nurse', actor]);
  cli('log-check', ["--resident=Jack O'Neill", '--kind=activity', '--outcome=Seen at dinner', actor]);
  assert(!cli('compliance').some((c) => c.rule === 'ACTIVITY_CHECK'));
  cli('log-check', ['--resident=Priya', '--kind=party', '--outcome=x', actor], false);

  // Room entry: a future routine entry without 24 hours' notice is refused.
  const soon = new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16);
  const now = new Date().toISOString().slice(0, 16);
  const later = new Date(Date.now() + 30 * 3600000).toISOString().slice(0, 16);
  cli('log-entry', ['--room=KH-102', '--reason=routine', `--entry=${soon}`, `--notified=${now}`, actor], false);
  cli('log-entry', ['--room=KH-102', '--reason=routine', `--entry=${later}`, `--notified=${now}`, '--note=Smoke alarm test', actor]);
  cli('log-entry', ['--room=KH-102', '--reason=emergency', `--entry=${now}`, '--note=Water leak', actor]);
  const notice = cli('draft-entry-notice', ['--room=KH-102', `--entry=${later}`, '--reason=Smoke alarm test']);
  assert.equal(notice.enough_notice, true);
  assert(readFileSync(notice.file, 'utf8').includes('Liam Chen'));

  // Repairs and complaints.
  const heater = cli('repairs').find((r) => r.category === 'heating');
  cli('resolve-repair', [`--repair=${heater.id}`, actor]);
  cli('resolve-repair', [`--repair=${heater.id}`, actor], false);
  const leak = cli('report-repair', ['--building=Kowhai', '--room=KH-102', '--category=water', '--summary=Tap dripping', '--urgent', actor]);
  assert.equal(leak.urgent, true);
  cli('report-repair', ['--building=Kowhai', '--room=RC-01', '--category=water', '--summary=x', actor], false);
  const comp = cli('log-complaint', ['--building=Rata Court', '--resident=Sione', '--summary=Kitchen not cleaned', actor]);
  cli('resolve-complaint', [`--complaint=${comp.id.slice(0, 8)}`, '--response=Cleaning roster changed', actor]);
  const noise = cli('complaints').find((c) => c.summary.startsWith('Noise'));
  cli('resolve-complaint', [`--complaint=${noise.id}`, '--response=Quiet hours enforced from 11pm', actor]);
  assert(!cli('compliance').some((c) => c.rule === 'COMPLAINT_OPEN'));

  // Rooms, buildings, settings.
  cli('add-building', ['--name=Harakeke Lodge', '--code=HL', actor]);
  cli('add-room', ['--building=Harakeke', '--name=HL-1', '--type=twin', '--beds=2', '--fee=280', actor]);
  cli('add-room', ['--building=Harakeke', '--name=HL-2', '--type=castle', '--fee=280', actor], false);
  cli('set-room', ['--room=HL-1', '--fee=285', actor]);
  cli('set-room', ['--room=KH-101', '--offline=Painting', actor], false); // occupied
  cli('set-room', ['--room=KH-104', '--online', actor]);
  cli('set', ['--key=activity_check_days', '--value=5', actor]);
  cli('set', ['--key=activity_check_days', '--value=soon', actor], false);
  cli('set', ['--key=nope', '--value=1', actor], false);

  // Leaving: check out, then a cancelled offer frees the bed.
  cli('check-out', ["--contract=Jack O'Neill", actor]);
  assert(!cli('residents').some((r) => r.resident === "Jack O'Neill"));
  cli('cancel', ['--contract=Hannah', '--reason=Withdrew from study', actor]);
  assert(!cli('arrivals').some((a) => a.resident === 'Hannah Brooks'));
  cli('cancel', ['--contract=Aroha', '--reason=x', actor], false); // checked in

  // StarRez import: preview, load, re-run unchanged, cancelled rows skipped.
  const imp = ['starrez', '--file=fixtures/starrez/bookings.csv', actor];
  const preview = cli('import', [...imp, '--dry-run']);
  assert.equal(preview.contracts_added, 3);
  assert.equal((await query("select count(*)::int as n from buildings where name = 'Harbour Hall'"))[0].n, 0);
  const loaded = cli('import', imp);
  assert.deepEqual([loaded.buildings_added, loaded.rooms_added, loaded.residents_added, loaded.contracts_added, loaded.skipped_cancelled], [1, 2, 3, 3, 1]);
  assert.equal(cli('import', imp).unchanged, 3);
  const crlf = path.join(dir, 'windows.csv');
  writeFileSync(crlf, readFileSync(path.join(REPO_ROOT, 'fixtures/starrez/bookings.csv'), 'utf8').replace(/\r?\n/g, '\r\n'));
  assert.equal(cli('import', ['starrez', `--file=${crlf}`, actor]).unchanged, 3);
  const src = readFileSync(path.join(REPO_ROOT, 'fixtures/starrez/bookings.csv'), 'utf8').replace(/\r\n/g, '\n');
  const bad = path.join(dir, 'bad.csv');
  writeFileSync(bad, src.replace('305.00', '$305'));
  cli('import', ['starrez', `--file=${bad}`, actor], false);
  writeFileSync(bad, src.replace('50002', '50001'));
  cli('import', ['starrez', `--file=${bad}`, actor], false);
  writeFileSync(bad, src.replace('50001,9001', '50009,9009').replace('HH-201', 'HH-202').replace('Single Room,1', 'Twin Room,2'));
  cli('import', ['starrez', `--file=${bad}`, actor], false); // a third resident in a twin
  const renamed = path.join(dir, 'renamed.csv');
  writeFileSync(renamed, src.replace('BookingID', 'Booking Ref').replace('50001', '60001').replace('50002', '60002').replace('50003', '60003'));
  const map = path.join(dir, 'map.json');
  writeFileSync(map, JSON.stringify({ booking: 'Booking Ref' }));
  cli('import', ['starrez', `--file=${renamed}`, actor], false); // without the map
  cli('import', ['starrez', `--file=${renamed}`, `--map=${map}`, actor, '--dry-run'], false); // beds already booked
  writeFileSync(map, JSON.stringify({ nonsense: 'x' }));
  cli('import', ['starrez', `--file=${renamed}`, `--map=${map}`, actor], false);
  cli('import', ['--file=x.csv', actor], false);

  // Output: views, documents, export, and the audit trail cannot be edited.
  run('view.mjs');
  assert.equal(readdirSync(path.join(dir, 'views')).length, 3);
  const docs = run('docs.mjs');
  assert.match(docs.stdout, /document\(s\) rendered/);
  assert(readdirSync(path.join(dir, 'docs-out', 'complaints-log')).length >= 3);
  const archive = path.join(dir, 'archive.json');
  const exported = cli('export', [`--out=${archive}`]);
  assert(exported.counts.contracts >= 12);
  cli('export', [`--out=${archive}`], false); // never overwrites
  assert(cli('activity').length > 40);
  await assert.rejects(query("update events set actor = 'X'"), /Events cannot be changed/);
  cli('occupancy', ['--surprise'], false);
  cli('add-room', ['--name=No actor'], false);
  cli('not-a-command', [], false);
  assert.equal(parseCsv('A,B\r\n"two, words","line\nnext"')[0].B, 'line\nnext');

  console.log(`PASS: ${checks} command runs, ${covered.size} CLI commands covered, contract, money, welfare, entry-notice and import rules held (${env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'}).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
