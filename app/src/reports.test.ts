// npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Params } from './reports.ts';
import { REPORTS, all, defaultParams, unitChoices, campaignDays, fmtDate, addDays } from './reports.ts';
import { formatCell, toCsv } from './format.ts';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js') as typeof import('sql.js').default;
const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(new URL('../../data/kosave.sqlite', import.meta.url)));
const get = (id: string) => REPORTS.find((r) => r.id === id);
const run = (id: string, params: Params = {}) => { const r = get(id)!; return r.run(db, { ...defaultParams(r), ...params }); };
const one = (sql: string, p: (string | number)[] = []) => Object.values(all(db, sql, p)[0])[0];

test('every program in the report menus has a report', () => {
  const ids = REPORTS.map((r) => r.id).sort();
  assert.deepEqual(ids, ['AAAATCH', 'ADLIST', 'ADLIST2', 'AUTHSTR', 'BIGBAMBI', 'CASSUM', 'CAVATCH', 'CMLATCH', 'DELTACAS', 'FAATCH',
    'IMPUS', 'INVNDX', 'MEDRPT', 'NAZIDCAS', 'REFLIST2', 'SRTICNT2', 'SRTICNTK', 'TDATCH', 'TIMCBT', 'TOENDX', 'UNITLIST', 'UTCNDNBI',
    'UTOTCAS', 'UTOTCS2', 'WPNLIST', 'WPNLIST2']);
});

test('every report runs with its defaults and formats cleanly', () => {
  const unit = unitChoices(db)[0];
  for (const r of REPORTS) {
    const p = defaultParams(r);
    if ('unit' in p) p.unit = unit;
    const res = r.run(db, p);
    assert.ok(Array.isArray(res.sections), r.id);
    for (const s of res.sections) {
      for (const row of s.rows) for (const c of s.columns) assert.doesNotMatch(formatCell(row[c.key], c.fmt), /NaN|Infinity|undefined/, `${r.id} ${c.key}`);
      assert.ok(toCsv(s).split('\n').length === s.rows.length + 1 + (s.total ? 1 : 0), r.id);
    }
  }
});

test('UNITLIST has one row per distinct unit, alphabetical', () => {
  const rows = run('UNITLIST').sections[0].rows;
  assert.equal(rows.length, one('select count(distinct unit_name) from unitloc'));
  assert.deepEqual(rows.map((r) => r.unit_name), [...rows.map((r) => r.unit_name)].sort());
});

test('weapon and reference listings keep every record', () => {
  assert.equal(run('WPNLIST').sections[0].rows.length, one('select count(*) from wpns'));
  assert.equal(run('REFLIST2').sections[0].rows.length, one('select count(*) from referenc'));
  const bySrc = run('WPNLIST2').sections[0].rows.map((r) => r.sources ?? '');
  assert.deepEqual(bySrc, [...bySrc].sort());
});

test('SRTICNTK and SRTICNT2 total the sorties in the AIR table', () => {
  const all_ = one("select sum(sorties) from air where day between '1943-07-04' and '1943-07-18'");
  const k = run('SRTICNTK').sections[0];
  const unmatched = Number((run('SRTICNTK').notes[0] || '').match(/^(\d+)/)?.[1] ?? 0);
  assert.equal(k.total!.total + unmatched, all_);
  assert.equal(k.rows.length, 22);
  const nat = run('SRTICNT2').sections[0];
  const sum = (key: string) => nat.rows.reduce((s, r) => s + r[key], 0);
  assert.equal(sum('german') + sum('usa') + sum('uk') + sum('sov') + sum('oth'), all_);
  const g = one("select sum(sorties) from air where upper(nation) = 'G' and day = '1943-07-04'");
  assert.equal(nat.rows[0].german, g);
});

test('CASSUM day totals match an independent query', () => {
  for (const nation of ['G', 'S']) {
    const s = run('CASSUM', { nation }).sections[0];
    assert.equal(s.rows.length, 15);
    for (const row of s.rows) {
      const [q] = all(db, `select sum(coalesce(total_cas,0)) cas, sum(coalesce(tot_killed,0)) kia, sum(coalesce(onhand_men,0)) oh
        from unitdata where nation = ? and date = ?`, [nation, row.date]);
      assert.equal(row.cas, q.cas); assert.equal(row.kia, q.kia); assert.equal(row.onhand, q.oh);
      if (row.cas + row.onhand) assert.ok(Math.abs(row.pcas - (100 * row.cas) / (row.cas + row.onhand)) < 1e-9);
    }
  }
});

test('per-record casualty reports use the right denominators', () => {
  const [r] = all(db, 'select rowid rec, onhand_men oh, total_cas c, tot_dnbi d from unitdata where onhand_men > 0 and total_cas > 0 limit 1');
  const find = (id: string) => run(id).sections[0].rows.find((x) => x.rec === r.rec)!;
  assert.ok(Math.abs(find('UTOTCAS').pcas - (100 * r.c) / r.oh) < 1e-9);
  assert.ok(Math.abs(find('UTOTCS2').pcas - (100 * r.c) / (r.oh + r.c)) < 1e-9);
  assert.ok(Math.abs(find('UTCNDNBI').pbat - (100 * (r.c - (r.d || 0))) / r.oh) < 1e-9);
  assert.equal(run('UTOTCAS').sections[0].rows.length, one('select count(*) from unitdata'));
});

test('DELTACAS and NAZIDCAS reconcile strengths as the programs do', () => {
  const unit = one("select unit_name from unitdata group by unit_name having count(*) = 15 limit 1");
  const rs = all(db, 'select date, onhand_men oh, total_cas c, repl_tot p, ret_tot t from unitdata where unit_name = ? order by date', [unit]);
  const z = (v: number | null) => v ?? 0;
  const delta = run('DELTACAS').sections.find((s) => s.heading === unit)!;
  assert.equal(delta.rows.length, 14);
  const d0 = delta.rows[0];
  assert.equal(d0.date, addDays(rs[0].date, 1));
  assert.equal(d0.calc, z(rs[0].oh) - z(rs[1].c) + z(rs[1].p) + z(rs[1].t));
  assert.equal(d0.delta, rs[1].oh - d0.calc);
  const nazi = run('NAZIDCAS').sections.find((s) => s.heading === unit)!;
  const n0 = nazi.rows[0];
  assert.equal(n0.calc, z(rs[0].oh) - z(rs[0].c) + z(rs[0].p) + z(rs[0].t));
  assert.equal(n0.delta, rs[1].oh - n0.calc);
  assert.equal(nazi.total!.cas, rs.reduce((s, r) => s + z(r.c), 0));
});

test('attachment lists cover every non-blank entry', () => {
  const cols = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map((c) => `atch_dtch${c}`);
  const expected = one(`select ${cols.map((c) => `sum(trim(coalesce(${c},'')) != '')`).join(' + ')} from unitdata where nation = 'G'`);
  const res = run('ADLIST', { nation: 'G' });
  assert.equal(res.sections.reduce((s, x) => s + x.rows.length, 0), expected);
  assert.equal(run('ADLIST2', { nation: 'G' }).sections.reduce((s, x) => s + x.rows.length, 0), expected);
});

test('trackers find matches and explain empty results', () => {
  const none = run('FAATCH');
  assert.ok(none.notes.join(' ').includes('No matches') || none.sections[0].rows.length > 0);
  const art = run('CAVATCH', { pattern: 'Art', ignoreCase: false }).sections[0].rows;
  assert.ok(art.length > 0 && art.every((r) => r.type.includes('Art') || r.name.includes('Art')));
  const dates = art.map((r) => r.date);
  assert.deepEqual(dates, [...dates].sort());
});

test('TIMCBT, TOENDX and INVNDX', () => {
  assert.equal(run('TIMCBT').sections[0].rows.length, one('select count(*) from unitloc'));
  const toe = run('TOENDX').sections;
  assert.ok(toe.length > 0 && toe.every((s) => new Set(s.rows.map((r) => r.name)).size === s.rows.length));
  assert.ok(run('INVNDX').sections.length > 0);
});

test('IMPUS traces parents and AUTHSTR reads TO&E', () => {
  const [r] = all(db, "select unit_name, date from unitloc where trim(coalesce(parent,'')) != '' limit 1");
  const chain = run('IMPUS', { unit: r.unit_name.trim(), date: r.date }).sections[0].rows;
  assert.equal(chain[0].unit, r.unit_name.trim());
  assert.ok(chain.length >= 2);
  const [t] = all(db, 'select t.unit_name u, t.total_men m from toe t join unitdata d on trim(d.unit_name) = trim(t.unit_name) where t.total_men > 0 limit 1');
  const auth = run('AUTHSTR', { unit: t.u.trim(), date: '1943-07-04' }).sections[0].rows;
  assert.equal(auth[0].men, t.m);
});

test('date helpers', () => {
  assert.equal(campaignDays().length, 15);
  assert.equal(fmtDate('1943-07-04'), '07/04/43');
});
