// Report logic ported from the dBASE IV .PRG programs shipped with the Kursk Data Base
// (data/kosave/orig/DATABASE/*.PRG). Each report keeps the program's name in `id`.
//
// A report is { id, menu, title, params, run(db, params) } and run() returns
//   { notes: [string], sections: [{ heading, columns, rows, total }] }
// where columns are { key, label, fmt, align } and fmt is one of
// int | pct | ratio | ratio1 | date | text.
//
// dBASE conventions kept here:
//  - A blank numeric field counts as 0 (SQLite holds it as NULL), see `n()`.
//  - Values >= 99999 in the personnel fields mark "missing" and are skipped or zeroed,
//    as the originals do.
//  - Lists are in record (rowid) order unless the program sorts or indexes them.

import type { Database } from "sql.js";

// ------------------------------------------------------------------ types

export type Fmt = "int" | "pct" | "ratio" | "ratio1" | "date" | "text";
type Num = number | null;
type Text = string | null;

/** A column as the page renders it; `key` names a property of each row. */
export interface ColumnDef {
  key: string;
  label: string;
  fmt: Fmt;
  align: "l" | "r";
}
/** A column whose key is checked against the row type it will be drawn from. */
export interface Col<R extends object> extends ColumnDef {
  key: keyof R & string;
}
export interface Section {
  heading: string;
  columns: ColumnDef[];
  rows: readonly object[];
  total?: object;
}
export interface ReportResult {
  notes: string[];
  sections: Section[];
}
export type ParamValue = string | boolean;
export type Params = Record<string, ParamValue>;
export interface Option {
  value: string;
  label: string;
}
export interface Param {
  key: string;
  label: string;
  type: "select" | "unit" | "date" | "text" | "bool";
  default: ParamValue;
  options?: Option[];
  min?: string;
  max?: string;
}
export interface Report {
  id: string;
  menu: string;
  title: string;
  params: Param[];
  run: (db: Database, params: Params) => ReportResult;
}

export const CAMPAIGN_START = "1943-07-04";
export const CAMPAIGN_END = "1943-07-18";
export const NATIONS: Option[] = [
  { value: "G", label: "G - German" },
  { value: "S", label: "S - Soviet" },
  { value: "A", label: "A - American" },
  { value: "B", label: "B - British" },
];

const ATCH_NAME = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
].map((s) => `ATCH_DTCH${s}`);
const ATCH_TYPE = Array.from({ length: 20 }, (_, i) => `ADTYPE${i + 1}`);

// --------------------------------------------------------------- helpers

/**
 * Run a query and return its rows. The caller names the row shape; SQLite is the one place
 * where that shape can't be checked, so this is the only cast.
 */
export function all<T extends object>(
  db: Database,
  sql: string,
  params: (string | number)[] = [],
): T[] {
  const st = db.prepare(sql);
  st.bind(params);
  const out: T[] = [];
  while (st.step()) {
    out.push(st.getAsObject() as unknown as T);
  }
  st.free();
  return out;
}

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));
const missing = (v: unknown) => n(v) >= 99999;
const clean = (v: unknown) => (missing(v) ? 0 : n(v));
const pct = (a: number, b: number): Num => (b ? (a / b) * 100 : null);
const ratio = (a: number, b: number): Num => (b ? a / b : null);
const trim = (s: unknown): string => (s == null ? "" : String(s).trim());
const param = (p: Params, key: string): string => String(p[key]);
const flag = (p: Params, key: string): boolean => p[key] === true;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) {
      list.push(item);
    } else {
      out.set(k, [item]);
    }
  }
  return out;
}

export function addDays(iso: string, k: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}
export function campaignDays(): string[] {
  const out: string[] = [];
  for (let d = CAMPAIGN_START; d <= CAMPAIGN_END; d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  const [y = "", m = "", d = ""] = String(iso).split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

function col<R extends object>(
  key: keyof R & string,
  label: string,
  fmt: Fmt = "text",
  align?: "l" | "r",
): Col<R> {
  return { key, label, fmt, align: align ?? (fmt === "text" || fmt === "date" ? "l" : "r") };
}
function section<R extends object>(
  heading: string,
  columns: Col<R>[],
  rows: R[],
  total?: Partial<R>,
): Section {
  return total ? { heading, columns, rows, total } : { heading, columns, rows };
}

// ---------------------------------------------------------------- listings

interface UnitListRow {
  unit_name: string;
  nation: Text;
  parent: Text;
  sources: Text;
}

function unitList(db: Database): ReportResult {
  const rows = all<UnitListRow>(
    db,
    `
    select unit_name, nation, parent, sources from unitloc
    where rowid in (select min(rowid) from unitloc group by unit_name)
    order by unit_name`,
  );
  return {
    notes: [`${rows.length} distinct units (first record of each, as the unique index keeps).`],
    sections: [
      section<UnitListRow>(
        "",
        [
          col("unit_name", "Unit name"),
          col("nation", "Nat"),
          col("parent", "Parent"),
          col("sources", "Source"),
        ],
        rows,
      ),
    ],
  };
}

interface WeaponRow {
  rec: number;
  wpn_name: Text;
  sources: Text;
}

function weaponsBy(orderBy: string) {
  return (db: Database): ReportResult => ({
    notes: [],
    sections: [
      section<WeaponRow>(
        "",
        [col("rec", "Rec #", "int"), col("wpn_name", "Weapon name"), col("sources", "Source")],
        all<WeaponRow>(
          db,
          `select rowid as rec, wpn_name, sources from wpns order by ${orderBy}, rowid`,
        ),
      ),
    ],
  });
}

interface RefRow {
  rec: number;
  sources: Text;
}

function refList(db: Database): ReportResult {
  return {
    notes: [],
    sections: [
      section<RefRow>(
        "",
        [col("rec", "Rec #", "int"), col("sources", "Source name")],
        all<RefRow>(db, "select rowid as rec, sources from referenc order by sources, rowid"),
      ),
    ],
  };
}

interface NameRow {
  name: string;
}

// TOENDX / INVNDX: the distinct values of each numbered column, one list per column.
function distinctValues(table: string, columns: string[]) {
  return (db: Database): ReportResult => {
    const sections: Section[] = [];
    for (const c of columns) {
      const rows = all<NameRow>(
        db,
        `select distinct trim(${c}) as name from ${table} where trim(coalesce(${c}, '')) != '' order by name`,
      );
      if (rows.length > 0) {
        sections.push(section<NameRow>(`${c} (${rows.length})`, [col("name", "Name")], rows));
      }
    }
    return { notes: [], sections };
  };
}
const seq = (p: string, k: number) => Array.from({ length: k }, (_, i) => `${p}${i + 1}`);

// ------------------------------------------------------------------- air

// SRTICNTK matches each aircraft with at() on ac_name, first match wins, in this order.
const AIRCRAFT = [
  "Fw-189",
  "He-111",
  "Hs-123",
  "Hs-126",
  "Hs-129",
  "Il-2",
  "Ju-52",
  "Ju-87",
  "Ju-88",
  "La-5",
  "Me-109",
  "Pe-2",
  "Po-2",
  "Yak-1",
  "Yak-7",
  "Yak-9",
  "Storch",
  "Fw-190",
  "Ar-66",
  "R-5",
  "Boston",
  "DB-3",
];

interface AirRow {
  day: string;
  ac_name: Text;
  sorties: Num;
  nation: Text;
}

/** One line of the sorties-by-type matrix: a count for each campaign day, keyed by date. */
type TypeRow = { type: string; total: number } & Record<string, string | number>;

function sortiesByType(db: Database): ReportResult {
  const days = campaignDays();
  const grid = new Map<string, Map<string, number>>(); // type -> day -> sorties
  for (const t of AIRCRAFT) {
    grid.set(t, new Map(days.map((d) => [d, 0])));
  }
  let unmatched = 0;
  for (const r of all<AirRow>(db, "select day, ac_name, sorties, nation from air")) {
    if (!(r.day >= CAMPAIGN_START && r.day <= CAMPAIGN_END)) {
      continue;
    }
    const t = AIRCRAFT.find((a) => String(r.ac_name ?? "").includes(a));
    const byDay = t ? grid.get(t) : undefined;
    if (byDay) {
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + n(r.sorties));
    } else {
      unmatched += n(r.sorties);
    }
  }
  const columns = [
    col<TypeRow>("type", "Aircraft"),
    ...days.map((d) => col<TypeRow>(d, fmtDate(d).slice(0, 5), "int")),
    col<TypeRow>("total", "Total", "int"),
  ];
  const rows: TypeRow[] = [...grid.keys()].sort().map((t) => {
    const byDay = grid.get(t) ?? new Map<string, number>();
    const row: TypeRow = { type: t, total: 0 };
    for (const d of days) {
      row[d] = byDay.get(d) ?? 0;
      row.total += byDay.get(d) ?? 0;
    }
    return row;
  });
  const total: TypeRow = { type: "All types", total: 0 };
  for (const d of days) {
    const sum = rows.reduce((s, r) => s + n(r[d]), 0);
    total[d] = sum;
    total.total += sum;
  }
  return {
    notes: unmatched
      ? [
          `${unmatched} sorties are not attributed to any listed aircraft type (blank aircraft name).`,
        ]
      : [],
    sections: [section<TypeRow>("Sorties by aircraft type by day", columns, rows, total)],
  };
}

interface NationRow {
  day: string;
  german: number;
  usa: number;
  uk: number;
  sov: number;
  oth: number;
}
type Side = "german" | "usa" | "uk" | "sov" | "oth";

function sortiesByNation(db: Database): ReportResult {
  const days = campaignDays();
  const side = (c: unknown): Side => {
    switch (String(c ?? "").toUpperCase()) {
      case "G":
        return "german";
      case "A":
        return "usa";
      case "B":
        return "uk";
      case "S":
        return "sov";
      default:
        return "oth";
    }
  };
  const rows: NationRow[] = days.map((d) => ({ day: d, german: 0, usa: 0, uk: 0, sov: 0, oth: 0 }));
  const byDay = new Map(rows.map((r) => [r.day, r]));
  for (const r of all<AirRow>(db, "select day, ac_name, sorties, nation from air")) {
    const row = byDay.get(r.day);
    if (row) {
      row[side(r.nation)] += n(r.sorties);
    }
  }
  const sum = (k: Side) => rows.reduce((s, r) => s + r[k], 0);
  const total: NationRow = {
    day: "Total",
    german: sum("german"),
    usa: sum("usa"),
    uk: sum("uk"),
    sov: sum("sov"),
    oth: sum("oth"),
  };
  return {
    notes: [],
    sections: [
      section<NationRow>(
        "Sorties by nationality by day",
        [
          col("day", "Date", "date"),
          col("german", "German", "int"),
          col("usa", "USA", "int"),
          col("uk", "Britain", "int"),
          col("sov", "Soviet", "int"),
          col("oth", "Other", "int"),
        ],
        rows,
        total,
      ),
    ],
  };
}

// ------------------------------------------------------ attachments

/** A UNITDATA record with its twenty attachment names (n0..) and types (t0..) by column alias. */
interface AttachmentRaw {
  rec: number;
  unit_name: string;
  date: string;
  [alias: string]: string | number | null;
}

interface Attachment {
  rec: number;
  unit_name: string;
  date: string;
  sign: string;
  type: string;
  name: string;
}

const ATTACHMENT_COLUMNS = ATCH_NAME.map((c, i) => `${c} as n${i}, ${ATCH_TYPE[i]} as t${i}`).join(
  ", ",
);

function attachmentRows(db: Database, nation?: string): Attachment[] {
  const where = nation ? "where upper(nation) = upper(?)" : "";
  const out: Attachment[] = [];
  for (const r of all<AttachmentRaw>(
    db,
    `select rowid as rec, unit_name, date, nation, ${ATTACHMENT_COLUMNS} from unitdata ${where} order by rowid`,
    nation ? [nation] : [],
  )) {
    for (let i = 0; i < 20; i++) {
      if (trim(r[`n${i}`]) === "") {
        continue;
      }
      const type = trim(r[`t${i}`]);
      out.push({
        rec: r.rec,
        unit_name: r.unit_name,
        date: r.date,
        sign: type.slice(0, 1),
        type,
        name: trim(r[`n${i}`]),
      });
    }
  }
  return out;
}

function adlist(db: Database, p: Params): ReportResult {
  const nation = param(p, "nation");
  const rows = attachmentRows(db, nation).sort(
    (a, b) => cmp(a.unit_name, b.unit_name) || cmp(a.date, b.date) || a.rec - b.rec,
  );
  const byUnit = groupBy(rows, (r) => r.unit_name);
  return {
    notes: [`Nationality ${nation}. ${rows.length} attachment/detachment entries.`],
    sections: [...byUnit].map(([u, rs]) =>
      section<Attachment>(
        u,
        [col("date", "Date", "date"), col("type", "Type"), col("name", "Unit")],
        rs,
      ),
    ),
  };
}

function adlistByDate(db: Database, p: Params): ReportResult {
  const nation = param(p, "nation");
  const rows = attachmentRows(db, nation).sort(
    (a, b) => cmp(a.date, b.date) || cmp(a.unit_name, b.unit_name) || a.rec - b.rec,
  );
  const byDate = groupBy(rows, (r) => r.date);
  return {
    notes: [`Nationality ${nation}.`],
    sections: [...byDate].map(([d, rs]) =>
      section<Attachment>(
        fmtDate(d),
        [col("unit_name", "Reporting unit"), col("type", "Type"), col("name", "Unit")],
        rs,
      ),
    ),
  };
}

// FAATCH, CAVATCH, TDATCH, CMLATCH, AAAATCH: attachments whose unit text contains a pattern.
function tracker(label: string, pattern: string, { sortByDate }: { sortByDate: boolean }) {
  const params: Param[] = [
    { key: "pattern", label: "Text to find", type: "text", default: pattern },
    { key: "ignoreCase", label: "Ignore case", type: "bool", default: false },
  ];
  const run = (db: Database, p: Params): ReportResult => {
    const pat = param(p, "pattern");
    const ignoreCase = flag(p, "ignoreCase");
    const norm = (s: string) => (ignoreCase ? s.toLowerCase() : s);
    const needle = norm(pat);
    let rows = attachmentRows(db).filter(
      (r) => needle !== "" && (norm(r.name).includes(needle) || norm(r.type).includes(needle)),
    );
    if (sortByDate) {
      rows = rows.sort((a, b) => cmp(a.date, b.date) || a.rec - b.rec);
    }
    const notes = [
      `${label} attachments and detachments: entries whose unit name or type contains "${pat}"${ignoreCase ? " (any case)" : " (case-sensitive)"}.`,
    ];
    if (rows.length === 0) {
      notes.push(
        'No matches. The original program looked for this exact text, which comes from the earlier Ardennes database; the Kursk entries use type codes such as +ArtBn, -AABty and +InfRgt. Try another pattern or tick "Ignore case".',
      );
    }
    return {
      notes,
      sections: [
        section<Attachment>(
          "",
          [
            col("rec", "Rec #", "int"),
            col("unit_name", "Reporting unit"),
            col("date", "Date", "date"),
            col("sign", "+/-"),
            col("type", "Type"),
            col("name", "Unit"),
          ],
          rows,
        ),
      ],
    };
  };
  return { params, run };
}

// ------------------------------------------------------------ casualties

interface UnitDataRow {
  rec: number;
  unit_name: string;
  nation: Text;
  date: string;
  onhand_men: Num;
  total_cas: Num;
  tot_killed: Num;
  tot_wound: Num;
  tot_capmia: Num;
  tot_dnbi: Num;
  repl_tot: Num;
  ret_tot: Num;
}

function unitdataRows(db: Database, extra = "", params: (string | number)[] = []): UnitDataRow[] {
  return all<UnitDataRow>(
    db,
    `select rowid as rec, unit_name, nation, date, onhand_men, total_cas, tot_killed, tot_wound, tot_capmia,
    tot_dnbi, repl_tot, ret_tot from unitdata ${extra}`,
    params,
  );
}

interface DayTotals {
  onhand: number;
  repl: number;
  rtd: number;
  cas: number;
  kia: number;
  wia: number;
  mia: number;
  dnbi: number;
}
interface CasSumRow {
  date: string;
  onhand: Num;
  repl: number;
  rtd: number;
  cas: number;
  kia: number;
  wia: number;
  mia: number;
  dnbi: number;
  pcas: Num;
  pbtc: Num;
  pbdc: Num;
  kw: Num;
}

const emptyTotals = (): DayTotals => ({
  onhand: 0,
  repl: 0,
  rtd: 0,
  cas: 0,
  kia: 0,
  wia: 0,
  mia: 0,
  dnbi: 0,
});

/** Add one UNITDATA record to its day's totals, skipping values the file marks as missing. */
function accumulate(d: DayTotals, r: UnitDataRow): void {
  // CASSUM treats >= 99999 as missing for strength and casualties, >= 9999 for the rest.
  const add = (sum: number, v: Num, limit: number) => (n(v) < limit ? sum + n(v) : sum);
  d.onhand = add(d.onhand, r.onhand_men, 99999);
  d.cas = add(d.cas, r.total_cas, 99999);
  d.kia = add(d.kia, r.tot_killed, 9999);
  d.wia = add(d.wia, r.tot_wound, 9999);
  d.mia = add(d.mia, r.tot_capmia, 9999);
  d.dnbi = add(d.dnbi, r.tot_dnbi, 9999);
  d.rtd = add(d.rtd, r.ret_tot, 9999);
  d.repl = add(d.repl, r.repl_tot, 9999);
}

function casSum(db: Database, p: Params): ReportResult {
  const nation = param(p, "nation");
  const byDay = new Map(campaignDays().map((d) => [d, emptyTotals()]));
  for (const r of unitdataRows(db, "where upper(nation) = upper(?)", [nation])) {
    const d = byDay.get(r.date);
    if (!d) {
      continue;
    }
    accumulate(d, r);
  }
  const rows: CasSumRow[] = [];
  const t = emptyTotals();
  for (const [date, d] of byDay) {
    const x = d.onhand + d.cas;
    rows.push({
      ...d,
      date,
      pcas: pct(d.cas, x),
      pbtc: pct(d.cas - d.dnbi, x),
      pbdc: pct(d.kia + d.wia, x),
      kw: ratio(d.kia, d.wia),
    });
    t.onhand += d.onhand;
    t.repl += d.repl;
    t.rtd += d.rtd;
    t.cas += d.cas;
    t.kia += d.kia;
    t.wia += d.wia;
    t.mia += d.mia;
    t.dnbi += d.dnbi;
  }
  // The program's grand-total percentages divide by the sum of the daily on-hand strengths.
  const total: CasSumRow = {
    date: "Total",
    onhand: null,
    repl: t.repl,
    rtd: t.rtd,
    cas: t.cas,
    kia: t.kia,
    wia: t.wia,
    mia: t.mia,
    dnbi: t.dnbi,
    pcas: pct(t.cas, t.cas + t.onhand),
    pbtc: pct(t.kia + t.wia + t.mia, t.onhand + t.kia + t.mia + t.wia),
    pbdc: pct(t.kia + t.wia, t.onhand + t.kia + t.wia),
    kw: ratio(t.kia * 100, t.wia),
  };
  return {
    notes: [
      "%CAS = casualties / (on hand + casualties). %BAT CAS = (casualties - DNBI) / (on hand + casualties). %BLD CAS = (KIA + WIA) / (on hand + casualties).",
      "The Total row uses the original grand-total formulas, which divide by the sum of the daily on-hand strengths, and its KIA/WIA is x100.",
    ],
    sections: [
      section<CasSumRow>(
        `Casualties by day, nation ${nation}`,
        [
          col("date", "Date", "date"),
          col("onhand", "EOD on hand", "int"),
          col("repl", "Repl", "int"),
          col("rtd", "RTD", "int"),
          col("cas", "Total cas", "int"),
          col("kia", "KIA", "int"),
          col("wia", "WIA", "int"),
          col("mia", "MIA", "int"),
          col("dnbi", "DNBI", "int"),
          col("pcas", "%CAS", "pct"),
          col("pbtc", "%BAT CAS", "pct"),
          col("pbdc", "%BLD CAS", "pct"),
          col("kw", "KIA/WIA", "ratio"),
        ],
        rows,
        total,
      ),
    ],
  };
}

/** The fields every per-record casualty report shows. */
interface CasualtyBase {
  rec: number;
  unit: string;
  date: string;
  onhand: number;
  cas: number;
  kia: number;
  wia: number;
  mia: number;
  dnbi: number;
}

interface PerRecordSpec<R extends CasualtyBase> {
  note: string;
  columns: Col<R>[];
  /** True for a record the program leaves out because its strength is marked missing. */
  skip: (onhand: number) => boolean;
  /** Adds the report's own fields; `x` is on hand + casualties. */
  row: (base: CasualtyBase, u: UnitDataRow, x: number) => R;
}

// MEDRPT, UTOTCAS, UTOTCS2, UTCNDNBI, BIGBAMBI: one line per UNITDATA record.
function perRecord<R extends CasualtyBase>(spec: PerRecordSpec<R>) {
  return (db: Database): ReportResult => {
    let skipped = 0;
    const rows: R[] = [];
    for (const u of unitdataRows(db, "order by rowid")) {
      const oh = n(u.onhand_men);
      if (spec.skip(oh)) {
        skipped++;
        continue;
      }
      const cas = n(u.total_cas);
      const base: CasualtyBase = {
        rec: u.rec,
        unit: u.unit_name,
        date: u.date,
        onhand: oh,
        cas,
        kia: n(u.tot_killed),
        wia: n(u.tot_wound),
        mia: n(u.tot_capmia),
        dnbi: n(u.tot_dnbi),
      };
      rows.push(spec.row(base, u, oh + cas));
    }
    return {
      notes: [spec.note, ...(skipped ? [`${skipped} records with missing strength skipped.`] : [])],
      sections: [section<R>("", spec.columns, rows)],
    };
  };
}

const strengthMissing = (oh: number) => oh >= 99999;

interface MedRow extends CasualtyBase {
  kiaRate: Num;
  wiaRate: Num;
  dnbiRate: Num;
}
const medrpt = perRecord<MedRow>({
  note: "Rates are a percentage of on hand + total casualties.",
  skip: strengthMissing,
  columns: [
    col("unit", "Unit"),
    col("date", "Date", "date"),
    col("onhand", "On hand", "int"),
    col("kia", "KIA", "int"),
    col("wia", "WIA", "int"),
    col("dnbi", "DNBI", "int"),
    col("kiaRate", "KIA rate %", "pct"),
    col("wiaRate", "WIA rate %", "pct"),
    col("dnbiRate", "DNBI rate %", "pct"),
  ],
  row: (b, _u, x) => ({
    ...b,
    kiaRate: pct(b.kia, x),
    wiaRate: pct(b.wia, x),
    dnbiRate: pct(b.dnbi, x),
  }),
});

interface LossRow extends CasualtyBase {
  pcas: Num;
  pbat: Num;
  kw: Num;
}
const lossColumns: Col<LossRow>[] = [
  col("unit", "Unit"),
  col("date", "Date", "date"),
  col("onhand", "On hand", "int"),
  col("cas", "Losses", "int"),
  col("kia", "KIA", "int"),
  col("wia", "WIA", "int"),
  col("mia", "MIA", "int"),
  col("dnbi", "DNBI", "int"),
  col("pcas", "%CAS", "pct"),
  col("pbat", "%BAT CAS", "pct"),
  col("kw", "KIA/WIA", "ratio"),
];
const utotcas = perRecord<LossRow>({
  note: "Percentages use beginning-of-day strength (on hand).",
  skip: strengthMissing,
  columns: lossColumns,
  row: (b) => ({
    ...b,
    pcas: pct(b.cas, b.onhand),
    pbat: pct(b.cas - b.dnbi, b.onhand),
    kw: ratio(b.kia, b.wia),
  }),
});
const utotcs2 = perRecord<LossRow>({
  note: "Percentages use end-of-day strength (on hand + casualties).",
  skip: strengthMissing,
  columns: lossColumns,
  row: (b, _u, x) => ({
    ...b,
    pcas: pct(b.cas, x),
    pbat: pct(b.cas - b.dnbi, x),
    kw: ratio(b.kia, b.wia),
  }),
});

interface BattleRow extends CasualtyBase {
  batcas: number;
  pbat: Num;
}
const utcndnbi = perRecord<BattleRow>({
  note: "Battle casualties = total casualties - DNBI; percent of total personnel on hand.",
  skip: strengthMissing,
  columns: [
    col("unit", "Unit"),
    col("date", "Date", "date"),
    col("onhand", "Total personnel", "int"),
    col("batcas", "Battle casualties", "int"),
    col("pbat", "% battle cas", "pct"),
  ],
  row: (b) => ({ ...b, batcas: b.cas - b.dnbi, pbat: pct(b.cas - b.dnbi, b.onhand) }),
});

interface BigRow extends CasualtyBase {
  repl: number;
  rtd: number;
  pcas: Num;
  pbtc: Num;
  pbdc: Num;
  kw: Num;
}
const bigbambi = perRecord<BigRow>({
  note: "Percentages use on hand + casualties.",
  // The original drops any strength whose digits contain 9999, not only the 99999 marker.
  skip: (oh) => String(oh).includes("9999"),
  columns: [
    col("unit", "Unit"),
    col("date", "Date", "date"),
    col("onhand", "On hand", "int"),
    col("repl", "Repl", "int"),
    col("rtd", "RTD", "int"),
    col("cas", "Cas", "int"),
    col("kia", "KIA", "int"),
    col("wia", "WIA", "int"),
    col("mia", "MIA", "int"),
    col("dnbi", "DNBI", "int"),
    col("pcas", "%CAS", "pct"),
    col("pbtc", "%BAT CAS", "pct"),
    col("pbdc", "%BLD CAS", "pct"),
    col("kw", "KIA/WIA", "ratio"),
  ],
  row: (b, u, x) => ({
    ...b,
    repl: n(u.repl_tot),
    rtd: n(u.ret_tot),
    pcas: pct(b.cas, x),
    pbtc: pct(b.cas - b.dnbi, x),
    pbdc: pct(b.kia + b.wia, x),
    kw: ratio(b.kia, b.wia),
  }),
});

interface DutyRow {
  date: string;
  chg: number;
  cas: number;
  repl: number;
  rtd: number;
  cur: number;
  calc: number;
  delta: number;
}

interface DutyTotal {
  date: string;
  cas: number;
  repl: number;
  rtd: number;
  delta: number;
}
interface Flows {
  cas: number;
  repl: number;
  rtd: number;
}
const flowsOf = (u: UnitDataRow): Flows => ({
  cas: clean(u.total_cas),
  repl: clean(u.repl_tot),
  rtd: clean(u.ret_tot),
});

/** The day-to-day reconciliation of one unit's strength, and its totals row. */
function dutyRows(
  rs: UnitDataRow[],
  variant: "DELTACAS" | "NAZIDCAS",
): { rows: DutyRow[]; tot: DutyTotal } {
  const rows: DutyRow[] = [];
  const tot: DutyTotal = { date: "Totals", cas: 0, repl: 0, rtd: 0, delta: 0 };
  const addFlows = (f: Flows) => {
    tot.cas += f.cas;
    tot.repl += f.repl;
    tot.rtd += f.rtd;
  };
  for (let i = 0; i < rs.length; i++) {
    // DELTACAS reports the changes recorded on day d+1 against day d's strength;
    // NAZIDCAS reports day d's changes and compares with day d+1's strength.
    const [a, b] = variant === "DELTACAS" ? [rs[i - 1], rs[i]] : [rs[i], rs[i + 1]];
    const day = rs[i];
    if (variant === "NAZIDCAS" && day) {
      addFlows(flowsOf(day));
    }
    if (!(a && b)) {
      continue;
    }
    const f = flowsOf(variant === "DELTACAS" ? b : a);
    if (variant === "DELTACAS") {
      addFlows(f);
    }
    const calc = clean(a.onhand_men) - f.cas + f.repl + f.rtd;
    const delta = n(b.onhand_men) - calc;
    tot.delta += delta;
    rows.push({
      date: addDays(a.date, 1),
      chg: f.repl + f.rtd - f.cas,
      ...f,
      cur: n(b.onhand_men),
      calc,
      delta,
    });
  }
  return { rows, tot };
}

function returnToDuty(variant: "DELTACAS" | "NAZIDCAS") {
  return (db: Database): ReportResult => {
    const byUnit = groupBy(unitdataRows(db, "order by unit_name, date, rowid"), (r) => r.unit_name);
    const columns: Col<DutyRow>[] = [
      col("date", "Date", "date"),
      col("chg", "Cas chg", "int"),
      col("cas", "Tot cas", "int"),
      col("repl", "Tot repl", "int"),
      col("rtd", "Tot RTD", "int"),
      col("cur", "Current str", "int"),
      col("calc", "Calc str", "int"),
      col("delta", "Delta", "int"),
    ];
    const sections: Section[] = [];
    for (const [unit, rs] of byUnit) {
      const { rows, tot } = dutyRows(rs, variant);
      sections.push(section<DutyRow>(unit, columns, rows, tot));
    }
    return {
      notes: [
        variant === "DELTACAS"
          ? "Calculated strength = previous day on hand - casualties + replacements + returns, using the flows recorded on the later day. Delta = reported on hand - calculated."
          : "Calculated strength = day on hand - casualties + replacements + returns, using the same day's flows. Delta = next day on hand - calculated. Totals include the last day's flows.",
      ],
      sections,
    };
  };
}

// ------------------------------------------------------- location & other

interface CombatTimeRow {
  unit_name: string;
  date: string;
  st_cbt_tim: Text;
  endcbt_tim: Text;
  tim_in_cbt: Num;
  tim_no_cbt: Num;
}

function timeInCombat(db: Database): ReportResult {
  return {
    notes: [],
    sections: [
      section<CombatTimeRow>(
        "",
        [
          col("unit_name", "Unit"),
          col("date", "Date", "date"),
          col("st_cbt_tim", "Start cbt time"),
          col("endcbt_tim", "End cbt time"),
          col("tim_in_cbt", "Hrs in cbt", "ratio1"),
          col("tim_no_cbt", "Hrs not in cbt", "ratio1"),
        ],
        all<CombatTimeRow>(
          db,
          "select unit_name, date, st_cbt_tim, endcbt_tim, tim_in_cbt, tim_no_cbt from unitloc order by rowid",
        ),
      ),
    ],
  };
}

function unitNames(db: Database): string[] {
  return all<{ v: string }>(
    db,
    "select distinct trim(unit_name) as v from unitloc where trim(coalesce(unit_name, '')) != '' order by v",
  ).map((r) => r.v);
}

interface HierarchyRow {
  level: number;
  unit: string;
}

// IMPUS traced the parent chain through UNITLOC for a date. The original hard-coded the
// Ardennes dates (12/16/44 - 1/16/45); here the Kursk campaign dates are used.
function commandHierarchy(db: Database, p: Params): ReportResult {
  const unit = param(p, "unit");
  const date = param(p, "date");
  const chain = [unit];
  const seen = new Set(chain);
  let cur = unit;
  const notes: string[] = [];
  for (let i = 0; i < 25; i++) {
    const [r] = all<{ parent: Text }>(
      db,
      "select parent from unitloc where date = ? and trim(unit_name) = ? order by rowid limit 1",
      [date, cur],
    );
    if (!r) {
      if (i === 0) {
        notes.push(`No UNITLOC record for ${unit} on ${fmtDate(date)}.`);
      }
      break;
    }
    const parent = trim(r.parent);
    if (!parent) {
      break;
    }
    if (seen.has(parent)) {
      notes.push(`Loop in the chain at ${parent}; stopped.`);
      break;
    }
    chain.push(parent);
    seen.add(parent);
    cur = parent;
  }
  return {
    notes: [`Unit hierarchy for ${unit} on ${fmtDate(date)}, lowest level first.`, ...notes],
    sections: [
      section<HierarchyRow>(
        "",
        [col("level", "Level", "int"), col("unit", "Unit")],
        chain.map((u, i) => ({ level: i, unit: u })),
      ),
    ],
  };
}

interface StrengthRow {
  what: string;
  type: string;
  name: string;
  men: Num;
  after: Num;
}

// AUTHSTR started from a unit's TO&E strength and added or subtracted the TO&E strength
// of each unit attached or detached on the date. The Kursk attachment entries do not
// name TO&E units, so those strengths can't be resolved and are shown as unknown.
/** The units attached or detached on a date, or undefined when the unit has no record that day. */
function attachedUnits(db: Database, unit: string, date: string): StrengthRow[] | undefined {
  const [ud] = all<AttachmentRaw>(
    db,
    `select rowid as rec, unit_name, date, ${ATTACHMENT_COLUMNS} from unitdata where trim(unit_name) = ? and date = ? order by rowid limit 1`,
    [unit, date],
  );
  if (!ud) {
    return undefined;
  }
  const rows: StrengthRow[] = [];
  for (let i = 0; i < 20; i++) {
    const name = trim(ud[`n${i}`]);
    if (name === "") {
      continue;
    }
    const [t] = all<{ total_men: Num }>(
      db,
      "select total_men from toe where trim(unit_name) = ? limit 1",
      [name],
    );
    const type = trim(ud[`t${i}`]);
    rows.push({
      what: type.startsWith("-") ? "Detached" : type.startsWith("+") ? "Attached" : "Other",
      type,
      name,
      men: t ? n(t.total_men) : null,
      after: null,
    });
  }
  return rows;
}

/** Fill in `after` as a running total; returns false when any strength is unknown. */
function addRunningStrength(rows: StrengthRow[]): boolean {
  const known = rows.every((r) => r.men != null);
  let running = 0;
  for (const r of rows) {
    if (r.men != null) {
      running += r.what === "Detached" ? -r.men : r.men;
    }
    r.after = known ? running : null;
  }
  return known;
}

function authorizedStrength(db: Database, p: Params): ReportResult {
  const unit = param(p, "unit");
  const date = param(p, "date");
  const [toe] = all<{ total_men: Num }>(
    db,
    "select total_men from toe where trim(unit_name) = ? order by rowid limit 1",
    [unit],
  );
  const notes: string[] = [];
  if (!toe) {
    notes.push(`${unit} has no TO&E record, so the base authorized strength is unknown.`);
  }
  const attached = attachedUnits(db, unit, date);
  if (!attached) {
    notes.push(`No UNITDATA record for ${unit} on ${fmtDate(date)}.`);
  }
  const rows: StrengthRow[] = [
    {
      what: "TO&E base strength",
      type: "",
      name: unit,
      men: toe ? n(toe.total_men) : null,
      after: null,
    },
    ...(attached ?? []),
  ];
  const known = addRunningStrength(rows);
  if (!known && toe) {
    notes.push(
      "Some attached or detached units have no TO&E strength, so the running authorized strength is not computed.",
    );
  }
  return {
    notes: [`Authorized strength for ${unit} on ${fmtDate(date)}.`, ...notes],
    sections: [
      section<StrengthRow>(
        "",
        [
          col("what", "Entry"),
          col("type", "Type"),
          col("name", "Unit"),
          col("men", "TO&E men", "int"),
          col("after", "Authorized after", "int"),
        ],
        rows,
      ),
    ],
  };
}

// ------------------------------------------------------------- registry

const nationParam: Param = {
  key: "nation",
  label: "Nationality",
  type: "select",
  options: NATIONS,
  default: "G",
};
const dateParam: Param = {
  key: "date",
  label: "Date",
  type: "date",
  min: CAMPAIGN_START,
  max: CAMPAIGN_END,
  default: CAMPAIGN_START,
};
const unitParam: Param = { key: "unit", label: "Unit", type: "unit", default: "" };

const simple = (
  id: string,
  menu: string,
  title: string,
  run: Report["run"],
  params: Param[] = [],
): Report => ({ id, menu, title, params, run });
const trk = (id: string, label: string, pattern: string, sortByDate: boolean): Report => {
  const t = tracker(label, pattern, { sortByDate });
  return {
    id,
    menu: "Other",
    title: `${label} unit attachment/detachment tracking`,
    params: t.params,
    run: t.run,
  };
};

export const REPORTS: Report[] = [
  simple(
    "UNITLIST",
    "Unit location",
    "Alphabetic listing of units, their parents and nationalities",
    unitList,
  ),
  simple("ADLIST", "Unit data", "Attachment/detachment list by division", adlist, [nationParam]),
  simple("ADLIST2", "Unit data", "Attachment/detachment list by date", adlistByDate, [nationParam]),
  simple("WPNLIST", "Weapons", "Weapons listing sorted by name", weaponsBy("wpn_name")),
  simple("WPNLIST2", "Weapons", "Weapons listing sorted by source", weaponsBy("sources")),
  simple("SRTICNTK", "Air", "Sorties by aircraft type by day", sortiesByType),
  simple("SRTICNT2", "Air", "Sorties by nationality by day", sortiesByNation),
  simple(
    "TOENDX",
    "TO&E",
    "Indexed list of equipment names",
    distinctValues("toe", seq("EQP_TYPE", 48)),
  ),
  simple(
    "INVNDX",
    "Unit inventory",
    "Indexed list of equipment names",
    distinctValues("inventor", seq("NAME", 16)),
  ),
  simple("REFLIST2", "Reference data", "Alphabetical listing of sources in REFERENC", refList),
  simple("CASSUM", "Casualties", "Total casualties for a nation or side for each day", casSum, [
    nationParam,
  ]),
  simple("MEDRPT", "Casualties", "Medical casualties and rates for each unit each day", medrpt),
  simple("DELTACAS", "Casualties", "Return-to-duty tracking report", returnToDuty("DELTACAS")),
  simple(
    "BIGBAMBI",
    "Casualties",
    "Comprehensive casualty report (battle attrition and manpower by unit)",
    bigbambi,
  ),
  simple("NAZIDCAS", "Casualties", "German return-to-duty report", returnToDuty("NAZIDCAS")),
  simple("UTOTCAS", "Casualties", "Total daily casualties by unit using BOD strengths", utotcas),
  simple("UTOTCS2", "Casualties", "Total daily casualties by unit using EOD strengths", utotcs2),
  simple("UTCNDNBI", "Casualties", "Daily unit battle casualties report", utcndnbi),
  simple("TIMCBT", "Other", "Time in combat report", timeInCombat),
  simple("IMPUS", "Other", "Unit command hierarchy search and report", commandHierarchy, [
    unitParam,
    dateParam,
  ]),
  simple("AUTHSTR", "Other", "Authorized strength report", authorizedStrength, [
    unitParam,
    dateParam,
  ]),
  trk("FAATCH", "FA", "FA", false),
  trk("CAVATCH", "Cavalry", "Cav", true),
  trk("TDATCH", "TD", "TD", true),
  trk("CMLATCH", "Chemical mortar", "Cml", true),
  trk("AAAATCH", "AAA", "AAA", true),
];

export const MENU_ORDER = [
  "Unit location",
  "Unit data",
  "Weapons",
  "Air",
  "TO&E",
  "Unit inventory",
  "Reference data",
  "Casualties",
  "Other",
];

export function unitChoices(db: Database): string[] {
  return unitNames(db);
}

export function defaultParams(report: Report): Params {
  return Object.fromEntries(report.params.map((p) => [p.key, p.default]));
}
