// Report logic ported from the dBASE IV .PRG programs shipped with the Kursk Data Base
// (data/kosave/orig/DATABASE/*.PRG). Each report keeps the program's name in `id`.
//
// A report is { id, menu, title, params, run(db, params) } and run() returns
//   { notes: [string], sections: [{ heading, columns, rows, total }] }
// where columns are { key, label, fmt, align } and fmt is one of
// int | pct | ratio | date | text.
//
// dBASE conventions kept here:
//  - A blank numeric field counts as 0 (SQLite holds it as NULL), see `n()`.
//  - Values >= 99999 in the personnel fields mark "missing" and are skipped or zeroed,
//    as the originals do.
//  - Lists are in record (rowid) order unless the program sorts or indexes them.

import type { Database } from 'sql.js';

// Rows come straight from SQLite, so their values are typed loosely at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type Fmt = 'int' | 'pct' | 'ratio' | 'ratio1' | 'date' | 'text';
export interface Column { key: string; label: string; fmt: Fmt; align: 'l' | 'r' }
export interface Section { heading: string; columns: Column[]; rows: Row[]; total?: Row }
export interface ReportResult { notes: string[]; sections: Section[] }
export type ParamValue = string | boolean;
export type Params = Record<string, ParamValue>;
export interface Option { value: string; label: string }
export interface Param {
  key: string; label: string; type: 'select' | 'unit' | 'date' | 'text' | 'bool';
  default: ParamValue; options?: Option[]; min?: string; max?: string;
}
export interface Report {
  id: string; menu: string; title: string; params: Param[];
  run: (db: Database, params: Params) => ReportResult;
}

export const CAMPAIGN_START = '1943-07-04';
export const CAMPAIGN_END = '1943-07-18';
export const NATIONS: Option[] = [
  { value: 'G', label: 'G - German' },
  { value: 'S', label: 'S - Soviet' },
  { value: 'A', label: 'A - American' },
  { value: 'B', label: 'B - British' },
];

const ATCH_NAME = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
  .map((s) => `ATCH_DTCH${s}`);
const ATCH_TYPE = Array.from({ length: 20 }, (_, i) => `ADTYPE${i + 1}`);

export function all(db: Database, sql: string, params: (string | number)[] = []): Row[] {
  const st = db.prepare(sql);
  st.bind(params);
  const out: Row[] = [];
  while (st.step()) out.push(st.getAsObject() as Row);
  st.free();
  return out;
}

const n = (v: unknown): number => (v == null || v === '' ? 0 : Number(v));
const missing = (v: unknown) => n(v) >= 99999;
const clean = (v: unknown) => (missing(v) ? 0 : n(v));
const pct = (a: number, b: number): number | null => (b ? (a / b) * 100 : null);
const ratio = (a: number, b: number): number | null => (b ? a / b : null);
const trim = (s: unknown): string => (s == null ? '' : String(s).trim());

export function addDays(iso: string, k: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}
export function campaignDays(): string[] {
  const out: string[] = [];
  for (let d = CAMPAIGN_START; d <= CAMPAIGN_END; d = addDays(d, 1)) out.push(d);
  return out;
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

const col = (key: string, label: string, fmt: Fmt = 'text', align?: 'l' | 'r'): Column => ({ key, label, fmt, align: align || (fmt === 'text' || fmt === 'date' ? 'l' : 'r') });
const section = (heading: string, columns: Column[], rows: Row[], total?: Row): Section => ({ heading, columns, rows, total });

// ---------------------------------------------------------------- listings

function unitList(db: Database): ReportResult {
  const rows = all(db, `
    select unit_name, nation, parent, sources from unitloc
    where rowid in (select min(rowid) from unitloc group by unit_name)
    order by unit_name`);
  return { notes: [`${rows.length} distinct units (first record of each, as the unique index keeps).`],
    sections: [section('', [col('unit_name', 'Unit name'), col('nation', 'Nat'), col('parent', 'Parent'), col('sources', 'Source')], rows)] };
}

function weaponsBy(orderBy: string) {
  return (db: Database): ReportResult => ({
    notes: [],
    sections: [section('', [col('rec', 'Rec #', 'int'), col('wpn_name', 'Weapon name'), col('sources', 'Source')],
      all(db, `select rowid as rec, wpn_name, sources from wpns order by ${orderBy}, rowid`))],
  });
}

function refList(db: Database): ReportResult {
  return { notes: [], sections: [section('', [col('rec', 'Rec #', 'int'), col('sources', 'Source name')],
    all(db, 'select rowid as rec, sources from referenc order by sources, rowid'))] };
}

// TOENDX / INVNDX: the distinct values of each numbered column, one list per column.
function distinctValues(table: string, columns: string[]) {
  return (db: Database): ReportResult => {
    const sections: Section[] = [];
    for (const c of columns) {
      const rows = all(db, `select distinct trim(${c}) as name from ${table} where trim(coalesce(${c}, '')) != '' order by name`);
      if (rows.length) sections.push(section(`${c} (${rows.length})`, [col('name', 'Name')], rows));
    }
    return { notes: [], sections };
  };
}
const seq = (p: string, k: number) => Array.from({ length: k }, (_, i) => `${p}${i + 1}`);

// ------------------------------------------------------------------- air

// SRTICNTK matches each aircraft with at() on ac_name, first match wins, in this order.
const AIRCRAFT = ['Fw-189', 'He-111', 'Hs-123', 'Hs-126', 'Hs-129', 'Il-2', 'Ju-52', 'Ju-87', 'Ju-88', 'La-5', 'Me-109',
  'Pe-2', 'Po-2', 'Yak-1', 'Yak-7', 'Yak-9', 'Storch', 'Fw-190', 'Ar-66', 'R-5', 'Boston', 'DB-3'];

function sortiesByType(db: Database): ReportResult {
  const days = campaignDays();
  const grid = new Map<string, Record<string, number>>(); // type -> day -> sorties
  for (const t of AIRCRAFT) grid.set(t, Object.fromEntries(days.map((d) => [d, 0])));
  let unmatched = 0;
  for (const r of all(db, 'select day, ac_name, sorties from air')) {
    if (!(r.day >= CAMPAIGN_START && r.day <= CAMPAIGN_END)) continue;
    const t = AIRCRAFT.find((a) => String(r.ac_name ?? '').includes(a));
    if (t) grid.get(t)![r.day] += n(r.sorties);
    else unmatched += n(r.sorties);
  }
  const columns = [col('type', 'Aircraft'), ...days.map((d) => col(d, fmtDate(d).slice(0, 5), 'int')), col('total', 'Total', 'int')];
  const rows = [...grid.keys()].sort().map((t) => {
    const row: Row = { type: t, ...grid.get(t) };
    row.total = days.reduce((s, d) => s + row[d], 0);
    return row;
  });
  const total: Row = { type: 'All types', total: 0 };
  for (const d of days) { total[d] = rows.reduce((s, r) => s + r[d], 0); total.total += total[d]; }
  return { notes: unmatched ? [`${unmatched} sorties are not attributed to any listed aircraft type (blank aircraft name).`] : [],
    sections: [section('Sorties by aircraft type by day', columns, rows, total)] };
}

function sortiesByNation(db: Database): ReportResult {
  const days = campaignDays();
  const side = (c: unknown) => ({ G: 'german', A: 'usa', B: 'uk', S: 'sov' }[String(c ?? '').toUpperCase()] ?? 'oth');
  const rows: Row[] = days.map((d) => ({ day: d, german: 0, usa: 0, uk: 0, sov: 0, oth: 0 }));
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  for (const r of all(db, 'select day, nation, sorties from air')) {
    if (byDay[r.day]) byDay[r.day][side(r.nation)] += n(r.sorties);
  }
  const total: Row = { day: 'Total' };
  for (const k of ['german', 'usa', 'uk', 'sov', 'oth']) total[k] = rows.reduce((s, r) => s + r[k], 0);
  return { notes: [], sections: [section('Sorties by nationality by day',
    [col('day', 'Date', 'date'), col('german', 'German', 'int'), col('usa', 'USA', 'int'), col('uk', 'Britain', 'int'),
      col('sov', 'Soviet', 'int'), col('oth', 'Other', 'int')], rows, total)] };
}

// ------------------------------------------------------ attachments

function attachmentRows(db: Database, nation?: string): Row[] {
  const sel = ATCH_NAME.map((c, i) => `${c} as n${i}, ${ATCH_TYPE[i]} as t${i}`).join(', ');
  const where = nation ? 'where upper(nation) = upper(?)' : '';
  const out = [];
  for (const r of all(db, `select rowid as rec, unit_name, date, nation, ${sel} from unitdata ${where} order by rowid`, nation ? [nation] : [])) {
    for (let i = 0; i < 20; i++) {
      if (trim(r[`n${i}`]) === '') continue;
      const type = trim(r[`t${i}`]);
      out.push({ rec: r.rec, unit_name: r.unit_name, date: r.date, sign: type.slice(0, 1), type, name: trim(r[`n${i}`]) });
    }
  }
  return out;
}

function adlist(db: Database, p: Params): ReportResult {
  const nation = String(p.nation);
  const byUnit = new Map();
  for (const r of attachmentRows(db, nation).sort((a, b) => (a.unit_name < b.unit_name ? -1 : a.unit_name > b.unit_name ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : a.rec - b.rec))) {
    if (!byUnit.has(r.unit_name)) byUnit.set(r.unit_name, []);
    byUnit.get(r.unit_name).push(r);
  }
  return { notes: [`Nationality ${nation}. ${[...byUnit.values()].flat().length} attachment/detachment entries.`],
    sections: [...byUnit].map(([u, rows]) => section(u, [col('date', 'Date', 'date'), col('type', 'Type'), col('name', 'Unit')], rows)) };
}

function adlistByDate(db: Database, p: Params): ReportResult {
  const nation = String(p.nation);
  const byDate = new Map();
  for (const r of attachmentRows(db, nation).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.unit_name < b.unit_name ? -1 : a.unit_name > b.unit_name ? 1 : a.rec - b.rec))) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  return { notes: [`Nationality ${nation}.`],
    sections: [...byDate].map(([d, rows]) => section(fmtDate(d), [col('unit_name', 'Reporting unit'), col('type', 'Type'), col('name', 'Unit')], rows)) };
}

// FAATCH, CAVATCH, TDATCH, CMLATCH, AAAATCH: attachments whose unit text contains a pattern.
function tracker(label: string, pattern: string, { sortByDate }: { sortByDate: boolean }) {
  return {
    params: [
      { key: 'pattern', label: 'Text to find', type: 'text' as const, default: pattern },
      { key: 'ignoreCase', label: 'Ignore case', type: 'bool' as const, default: false },
    ],
    run(db: Database, p: Params): ReportResult {
      const pat = String(p.pattern);
      const ignoreCase = p.ignoreCase === true;
      const norm = (s: string) => (ignoreCase ? s.toLowerCase() : s);
      const needle = norm(pat);
      let rows = attachmentRows(db).filter((r) => needle !== '' && (norm(r.name).includes(needle) || norm(r.type).includes(needle)));
      if (sortByDate) rows = rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rec - b.rec));
      const notes = [`${label} attachments and detachments: entries whose unit name or type contains "${pat}"${ignoreCase ? ' (any case)' : ' (case-sensitive)'}.`];
      if (!rows.length) notes.push('No matches. The original program looked for this exact text, which comes from the earlier Ardennes database; the Kursk entries use type codes such as +ArtBn, -AABty and +InfRgt. Try another pattern or tick "Ignore case".');
      return { notes, sections: [section('', [col('rec', 'Rec #', 'int'), col('unit_name', 'Reporting unit'), col('date', 'Date', 'date'),
        col('sign', '+/-'), col('type', 'Type'), col('name', 'Unit')], rows)] };
    },
  };
}

// ------------------------------------------------------------ casualties

function unitdataRows(db: Database, extra = '', params: (string | number)[] = []): Row[] {
  return all(db, `select rowid as rec, unit_name, nation, date, onhand_men, total_cas, tot_killed, tot_wound, tot_capmia,
    tot_dnbi, repl_tot, ret_tot from unitdata ${extra}`, params);
}

function casSum(db: Database, p: Params): ReportResult {
  const nation = String(p.nation);
  const rows: Row[] = [];
  const t: Row = { onhand: 0, repl: 0, rtd: 0, cas: 0, kia: 0, wia: 0, mia: 0, dnbi: 0 };
  const byDay = new Map<string, Row>(campaignDays().map((d) => [d, { onhand: 0, repl: 0, rtd: 0, cas: 0, kia: 0, wia: 0, mia: 0, dnbi: 0 }]));
  for (const r of unitdataRows(db, 'where upper(nation) = upper(?)', [nation])) {
    const d = byDay.get(r.date);
    if (!d) continue;
    // Each total skips values the file marks as missing (>= 99999 / >= 9999), as CASSUM does.
    if (n(r.onhand_men) < 99999) d.onhand += n(r.onhand_men);
    if (n(r.total_cas) < 99999) d.cas += n(r.total_cas);
    if (n(r.tot_killed) < 9999) d.kia += n(r.tot_killed);
    if (n(r.tot_wound) < 9999) d.wia += n(r.tot_wound);
    if (n(r.tot_capmia) < 9999) d.mia += n(r.tot_capmia);
    if (n(r.tot_dnbi) < 9999) d.dnbi += n(r.tot_dnbi);
    if (n(r.ret_tot) < 9999) d.rtd += n(r.ret_tot);
    if (n(r.repl_tot) < 9999) d.repl += n(r.repl_tot);
  }
  for (const [date, d] of byDay) {
    const repl = d.repl;
    const x = d.onhand + d.cas;
    rows.push({ date, onhand: d.onhand, repl, rtd: d.rtd, cas: d.cas, kia: d.kia, wia: d.wia, mia: d.mia, dnbi: d.dnbi,
      pcas: pct(d.cas, x), pbtc: pct(d.cas - d.dnbi, x), pbdc: pct(d.kia + d.wia, x), kw: ratio(d.kia, d.wia) });
    for (const k of Object.keys(t)) t[k] += k === 'repl' ? repl : d[k];
  }
  // The program's grand-total percentages divide by the sum of the daily on-hand strengths.
  const total = { date: 'Total', onhand: null, repl: t.repl, rtd: t.rtd, cas: t.cas, kia: t.kia, wia: t.wia, mia: t.mia, dnbi: t.dnbi,
    pcas: pct(t.cas, t.cas + t.onhand), pbtc: pct(t.kia + t.wia + t.mia, t.onhand + t.kia + t.mia + t.wia),
    pbdc: pct(t.kia + t.wia, t.onhand + t.kia + t.wia), kw: ratio(t.kia * 100, t.wia) };
  return {
    notes: ['%CAS = casualties / (on hand + casualties). %BAT CAS = (casualties - DNBI) / (on hand + casualties). %BLD CAS = (KIA + WIA) / (on hand + casualties).',
      'The Total row uses the original grand-total formulas, which divide by the sum of the daily on-hand strengths, and its KIA/WIA is x100.'],
    sections: [section(`Casualties by day, nation ${nation}`, [
      col('date', 'Date', 'date'), col('onhand', 'EOD on hand', 'int'), col('repl', 'Repl', 'int'), col('rtd', 'RTD', 'int'),
      col('cas', 'Total cas', 'int'), col('kia', 'KIA', 'int'), col('wia', 'WIA', 'int'), col('mia', 'MIA', 'int'), col('dnbi', 'DNBI', 'int'),
      col('pcas', '%CAS', 'pct'), col('pbtc', '%BAT CAS', 'pct'), col('pbdc', '%BLD CAS', 'pct'), col('kw', 'KIA/WIA', 'ratio')], rows, total)],
  };
}

// MEDRPT, UTOTCAS, UTOTCS2, UTCNDNBI, BIGBAMBI: one line per UNITDATA record.
function perRecord(kind: 'MEDRPT' | 'UTOTCAS' | 'UTOTCS2' | 'UTCNDNBI' | 'BIGBAMBI') {
  return (db: Database): ReportResult => {
    let skipped = 0;
    const rows = [];
    for (const r of unitdataRows(db, 'order by rowid')) {
      const oh = n(r.onhand_men);
      if (kind === 'BIGBAMBI' ? String(oh).includes('9999') : oh >= 99999) { skipped++; continue; }
      const cas = n(r.total_cas), kia = n(r.tot_killed), wia = n(r.tot_wound), mia = n(r.tot_capmia), dnbi = n(r.tot_dnbi);
      const x = oh + cas;
      const base = { rec: r.rec, unit: r.unit_name, date: r.date, onhand: oh, cas, kia, wia, mia, dnbi };
      if (kind === 'MEDRPT') rows.push({ ...base, kiaRate: pct(kia, x), wiaRate: pct(wia, x), dnbiRate: pct(dnbi, x) });
      else if (kind === 'UTOTCAS') rows.push({ ...base, pcas: pct(cas, oh), pbat: pct(cas - dnbi, oh), kw: ratio(kia, wia) });
      else if (kind === 'UTOTCS2') rows.push({ ...base, pcas: pct(cas, x), pbat: pct(cas - dnbi, x), kw: ratio(kia, wia) });
      else if (kind === 'UTCNDNBI') rows.push({ ...base, batcas: cas - dnbi, pbat: pct(cas - dnbi, oh) });
      else rows.push({ ...base, repl: n(r.repl_tot), rtd: n(r.ret_tot), pcas: pct(cas, x), pbtc: pct(cas - dnbi, x), pbdc: pct(kia + wia, x), kw: ratio(kia, wia) });
    }
    const common = [col('unit', 'Unit'), col('date', 'Date', 'date')];
    const cols: Record<string, Column[]> = {
      MEDRPT: [...common, col('onhand', 'On hand', 'int'), col('kia', 'KIA', 'int'), col('wia', 'WIA', 'int'), col('dnbi', 'DNBI', 'int'),
        col('kiaRate', 'KIA rate %', 'pct'), col('wiaRate', 'WIA rate %', 'pct'), col('dnbiRate', 'DNBI rate %', 'pct')],
      UTOTCAS: [...common, col('onhand', 'On hand', 'int'), col('cas', 'Losses', 'int'), col('kia', 'KIA', 'int'), col('wia', 'WIA', 'int'),
        col('mia', 'MIA', 'int'), col('dnbi', 'DNBI', 'int'), col('pcas', '%CAS', 'pct'), col('pbat', '%BAT CAS', 'pct'), col('kw', 'KIA/WIA', 'ratio')],
      UTCNDNBI: [...common, col('onhand', 'Total personnel', 'int'), col('batcas', 'Battle casualties', 'int'), col('pbat', '% battle cas', 'pct')],
      BIGBAMBI: [...common, col('onhand', 'On hand', 'int'), col('repl', 'Repl', 'int'), col('rtd', 'RTD', 'int'), col('cas', 'Cas', 'int'),
        col('kia', 'KIA', 'int'), col('wia', 'WIA', 'int'), col('mia', 'MIA', 'int'), col('dnbi', 'DNBI', 'int'), col('pcas', '%CAS', 'pct'),
        col('pbtc', '%BAT CAS', 'pct'), col('pbdc', '%BLD CAS', 'pct'), col('kw', 'KIA/WIA', 'ratio')],
    };
    cols.UTOTCS2 = cols.UTOTCAS;
    const notes = {
      MEDRPT: 'Rates are a percentage of on hand + total casualties.',
      UTOTCAS: 'Percentages use beginning-of-day strength (on hand).',
      UTOTCS2: 'Percentages use end-of-day strength (on hand + casualties).',
      UTCNDNBI: 'Battle casualties = total casualties - DNBI; percent of total personnel on hand.',
      BIGBAMBI: 'Percentages use on hand + casualties.',
    }[kind];
    return { notes: [notes, ...(skipped ? [`${skipped} records with missing strength skipped.`] : [])], sections: [section('', cols[kind], rows)] };
  };
}

function returnToDuty(variant: 'DELTACAS' | 'NAZIDCAS') {
  return (db: Database): ReportResult => {
    const byUnit = new Map();
    for (const r of unitdataRows(db, 'order by unit_name, date, rowid')) {
      if (!byUnit.has(r.unit_name)) byUnit.set(r.unit_name, []);
      byUnit.get(r.unit_name).push(r);
    }
    const columns = [col('date', 'Date', 'date'), col('chg', 'Cas chg', 'int'), col('cas', 'Tot cas', 'int'), col('repl', 'Tot repl', 'int'),
      col('rtd', 'Tot RTD', 'int'), col('cur', 'Current str', 'int'), col('calc', 'Calc str', 'int'), col('delta', 'Delta', 'int')];
    const sections = [];
    for (const [unit, rs] of byUnit) {
      const rows = [];
      const tot = { date: 'Totals', cas: 0, repl: 0, rtd: 0, delta: 0 };
      for (let i = 0; i < rs.length; i++) {
        // DELTACAS reports the changes recorded on day d+1 against day d's strength;
        // NAZIDCAS reports day d's changes and compares with day d+1's strength.
        const [a, b] = variant === 'DELTACAS' ? [rs[i - 1], rs[i]] : [rs[i], rs[i + 1]];
        if (variant === 'NAZIDCAS') {
          tot.cas += clean(rs[i].total_cas); tot.repl += clean(rs[i].repl_tot); tot.rtd += clean(rs[i].ret_tot);
        }
        if (!a || !b) continue;
        const flows = variant === 'DELTACAS' ? b : a;
        const cas = clean(flows.total_cas), repl = clean(flows.repl_tot), rtd = clean(flows.ret_tot);
        const calc = clean(a.onhand_men) - cas + repl + rtd;
        const delta = n(b.onhand_men) - calc;
        if (variant === 'DELTACAS') { tot.cas += cas; tot.repl += repl; tot.rtd += rtd; }
        tot.delta += delta;
        rows.push({ date: addDays(a.date, 1), chg: repl + rtd - cas, cas, repl, rtd, cur: n(b.onhand_men), calc, delta });
      }
      sections.push(section(unit, columns, rows, tot));
    }
    return { notes: [variant === 'DELTACAS'
      ? 'Calculated strength = previous day on hand - casualties + replacements + returns, using the flows recorded on the later day. Delta = reported on hand - calculated.'
      : 'Calculated strength = day on hand - casualties + replacements + returns, using the same day\'s flows. Delta = next day on hand - calculated. Totals include the last day\'s flows.'],
    sections };
  };
}

// ------------------------------------------------------- location & other

function timeInCombat(db: Database): ReportResult {
  return { notes: [], sections: [section('', [col('unit_name', 'Unit'), col('date', 'Date', 'date'), col('st_cbt_tim', 'Start cbt time'),
    col('endcbt_tim', 'End cbt time'), col('tim_in_cbt', 'Hrs in cbt', 'ratio1'), col('tim_no_cbt', 'Hrs not in cbt', 'ratio1')],
  all(db, 'select unit_name, date, st_cbt_tim, endcbt_tim, tim_in_cbt, tim_no_cbt from unitloc order by rowid'))] };
}

function unitNames(db: Database): string[] {
  return all(db, "select distinct trim(unit_name) as v from unitloc where trim(coalesce(unit_name, '')) != '' order by v").map((r) => r.v);
}

// IMPUS traced the parent chain through UNITLOC for a date. The original hard-coded the
// Ardennes dates (12/16/44 - 1/16/45); here the Kursk campaign dates are used.
function commandHierarchy(db: Database, p: Params): ReportResult {
  const unit = String(p.unit);
  const date = String(p.date);
  const chain = [unit];
  const seen = new Set(chain);
  let cur = unit;
  const notes = [];
  for (let i = 0; i < 25; i++) {
    const [r] = all(db, 'select parent from unitloc where date = ? and trim(unit_name) = ? order by rowid limit 1', [date, cur]);
    if (!r) { if (i === 0) notes.push(`No UNITLOC record for ${unit} on ${fmtDate(date)}.`); break; }
    const parent = trim(r.parent);
    if (!parent) break;
    if (seen.has(parent)) { notes.push(`Loop in the chain at ${parent}; stopped.`); break; }
    chain.push(parent); seen.add(parent); cur = parent;
  }
  return { notes: [`Unit hierarchy for ${unit} on ${fmtDate(date)}, lowest level first.`, ...notes],
    sections: [section('', [col('level', 'Level', 'int'), col('unit', 'Unit')], chain.map((u, i) => ({ level: i, unit: u })))] };
}

// AUTHSTR started from a unit's TO&E strength and added or subtracted the TO&E strength
// of each unit attached or detached on the date. The Kursk attachment entries do not
// name TO&E units, so those strengths can't be resolved and are shown as unknown.
function authorizedStrength(db: Database, p: Params): ReportResult {
  const unit = String(p.unit);
  const date = String(p.date);
  const [toe] = all(db, 'select unit_name, nation, total_men from toe where trim(unit_name) = ? order by rowid limit 1', [unit]);
  const notes = [];
  if (!toe) notes.push(`${unit} has no TO&E record, so the base authorized strength is unknown.`);
  const sel = ATCH_NAME.map((c, i) => `${c} as n${i}, ${ATCH_TYPE[i]} as t${i}`).join(', ');
  const [ud] = all(db, `select ${sel} from unitdata where trim(unit_name) = ? and date = ? order by rowid limit 1`, [unit, date]);
  const rows: Row[] = [{ what: 'TO&E base strength', type: '', name: unit, men: toe ? n(toe.total_men) : null }];
  if (ud) {
    for (let i = 0; i < 20; i++) {
      if (trim(ud[`n${i}`]) === '') continue;
      const name = trim(ud[`n${i}`]);
      const [t] = all(db, 'select total_men from toe where trim(unit_name) = ? limit 1', [name]);
      const type = trim(ud[`t${i}`]);
      rows.push({ what: type.startsWith('-') ? 'Detached' : type.startsWith('+') ? 'Attached' : 'Other', type, name, men: t ? n(t.total_men) : null });
    }
  } else notes.push(`No UNITDATA record for ${unit} on ${fmtDate(date)}.`);
  const known = rows.every((r) => r.men != null);
  let running = 0;
  for (const r of rows) {
    if (r.men != null) running += r.what === 'Detached' ? -r.men : r.men;
    r.after = known ? running : null;
  }
  if (!known && toe) notes.push('Some attached or detached units have no TO&E strength, so the running authorized strength is not computed.');
  return { notes: [`Authorized strength for ${unit} on ${fmtDate(date)}.`, ...notes],
    sections: [section('', [col('what', 'Entry'), col('type', 'Type'), col('name', 'Unit'), col('men', 'TO&E men', 'int'), col('after', 'Authorized after', 'int')], rows)] };
}

// ------------------------------------------------------------- registry

const nationParam: Param = { key: 'nation', label: 'Nationality', type: 'select', options: NATIONS, default: 'G' };
const dateParam: Param = { key: 'date', label: 'Date', type: 'date', min: CAMPAIGN_START, max: CAMPAIGN_END, default: CAMPAIGN_START };
const unitParam: Param = { key: 'unit', label: 'Unit', type: 'unit', default: '' };

const simple = (id: string, menu: string, title: string, run: Report['run'], params: Param[] = []): Report => ({ id, menu, title, params, run });
const trk = (id: string, label: string, pattern: string, sortByDate: boolean): Report => {
  const t = tracker(label, pattern, { sortByDate });
  return { id, menu: 'Other', title: `${label} unit attachment/detachment tracking`, params: t.params, run: t.run };
};

export const REPORTS: Report[] = [
  simple('UNITLIST', 'Unit location', 'Alphabetic listing of units, their parents and nationalities', unitList),
  simple('ADLIST', 'Unit data', 'Attachment/detachment list by division', adlist, [nationParam]),
  simple('ADLIST2', 'Unit data', 'Attachment/detachment list by date', adlistByDate, [nationParam]),
  simple('WPNLIST', 'Weapons', 'Weapons listing sorted by name', weaponsBy('wpn_name')),
  simple('WPNLIST2', 'Weapons', 'Weapons listing sorted by source', weaponsBy('sources')),
  simple('SRTICNTK', 'Air', 'Sorties by aircraft type by day', sortiesByType),
  simple('SRTICNT2', 'Air', 'Sorties by nationality by day', sortiesByNation),
  simple('TOENDX', 'TO&E', 'Indexed list of equipment names', distinctValues('toe', seq('EQP_TYPE', 48))),
  simple('INVNDX', 'Unit inventory', 'Indexed list of equipment names', distinctValues('inventor', seq('NAME', 16))),
  simple('REFLIST2', 'Reference data', 'Alphabetical listing of sources in REFERENC', refList),
  simple('CASSUM', 'Casualties', 'Total casualties for a nation or side for each day', casSum, [nationParam]),
  simple('MEDRPT', 'Casualties', 'Medical casualties and rates for each unit each day', perRecord('MEDRPT')),
  simple('DELTACAS', 'Casualties', 'Return-to-duty tracking report', returnToDuty('DELTACAS')),
  simple('BIGBAMBI', 'Casualties', 'Comprehensive casualty report (battle attrition and manpower by unit)', perRecord('BIGBAMBI')),
  simple('NAZIDCAS', 'Casualties', 'German return-to-duty report', returnToDuty('NAZIDCAS')),
  simple('UTOTCAS', 'Casualties', 'Total daily casualties by unit using BOD strengths', perRecord('UTOTCAS')),
  simple('UTOTCS2', 'Casualties', 'Total daily casualties by unit using EOD strengths', perRecord('UTOTCS2')),
  simple('UTCNDNBI', 'Casualties', 'Daily unit battle casualties report', perRecord('UTCNDNBI')),
  simple('TIMCBT', 'Other', 'Time in combat report', timeInCombat),
  simple('IMPUS', 'Other', 'Unit command hierarchy search and report', commandHierarchy, [unitParam, dateParam]),
  simple('AUTHSTR', 'Other', 'Authorized strength report', authorizedStrength, [unitParam, dateParam]),
  trk('FAATCH', 'FA', 'FA', false),
  trk('CAVATCH', 'Cavalry', 'Cav', true),
  trk('TDATCH', 'TD', 'TD', true),
  trk('CMLATCH', 'Chemical mortar', 'Cml', true),
  trk('AAAATCH', 'AAA', 'AAA', true),
];

export const MENU_ORDER = ['Unit location', 'Unit data', 'Weapons', 'Air', 'TO&E', 'Unit inventory', 'Reference data', 'Casualties', 'Other'];

export function unitChoices(db: Database): string[] { return unitNames(db); }

export function defaultParams(report: Report): Params {
  return Object.fromEntries(report.params.map((p) => [p.key, p.default]));
}
