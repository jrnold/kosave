// npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import type InitSqlJs from "sql.js";
import { formatCell, toCsv } from "./format.ts";
import type { Params, ReportResult, Section } from "./reports.ts";
import {
  addDays,
  all,
  campaignDays,
  defaultParams,
  fmtDate,
  REPORTS,
  unitChoices,
} from "./reports.ts";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js") as typeof InitSqlJs;
const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(new URL("../../data/kosave.sqlite", import.meta.url)));

/** The first item, which the test requires to exist. */
function must<T>(items: readonly T[] | T | undefined, what = "item"): T {
  const item = Array.isArray(items) ? items[0] : items;
  if (item === undefined) {
    throw new Error(`Expected a ${what}`);
  }
  return item as T;
}
const run = (id: string, params: Params = {}): ReportResult => {
  const r = must(
    REPORTS.find((x) => x.id === id),
    `report ${id}`,
  );
  return r.run(db, { ...defaultParams(r), ...params });
};
const firstSection = (id: string, params: Params = {}): Section =>
  must(run(id, params).sections, "section");
/** A section's rows as the row type the test expects. */
const rowsOf = <T extends object>(s: Section): T[] => [...s.rows] as T[];
const one = (sql: string, p: (string | number)[] = []): number =>
  Number(Object.values(must(all<Record<string, number>>(db, sql, p)))[0]);

interface Rec {
  rec: number;
}
interface Pcts extends Rec {
  pcas: number;
  pbat: number;
}
interface Day {
  date: string;
  cas: number;
  kia: number;
  onhand: number;
  pcas: number;
}
interface Duty {
  date: string;
  calc: number;
  delta: number;
}

test("every program in the report menus has a report", () => {
  const ids = REPORTS.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "AAAATCH",
    "ADLIST",
    "ADLIST2",
    "AUTHSTR",
    "BIGBAMBI",
    "CASSUM",
    "CAVATCH",
    "CMLATCH",
    "DELTACAS",
    "FAATCH",
    "IMPUS",
    "INVNDX",
    "MEDRPT",
    "NAZIDCAS",
    "REFLIST2",
    "SRTICNT2",
    "SRTICNTK",
    "TDATCH",
    "TIMCBT",
    "TOENDX",
    "UNITLIST",
    "UTCNDNBI",
    "UTOTCAS",
    "UTOTCS2",
    "WPNLIST",
    "WPNLIST2",
  ]);
});

test("every report runs with its defaults and formats cleanly", () => {
  const unit = must(unitChoices(db), "unit");
  for (const r of REPORTS) {
    const defaults = defaultParams(r);
    const res = r.run(db, "unit" in defaults ? { ...defaults, unit } : defaults);
    assert.ok(Array.isArray(res.sections), r.id);
    for (const s of res.sections) {
      for (const row of s.rows) {
        for (const c of s.columns) {
          const v = (row as Record<string, unknown>)[c.key];
          assert.doesNotMatch(formatCell(v, c.fmt), /NaN|Infinity|undefined/, `${r.id} ${c.key}`);
        }
      }
      assert.equal(toCsv(s).split("\n").length, s.rows.length + 1 + (s.total ? 1 : 0), r.id);
    }
  }
});

test("UNITLIST has one row per distinct unit, alphabetical", () => {
  const rows = rowsOf<{ unit_name: string }>(firstSection("UNITLIST"));
  assert.equal(rows.length, one("select count(distinct unit_name) from unitloc"));
  const names = rows.map((r) => r.unit_name);
  assert.deepEqual(names, [...names].sort());
});

test("weapon and reference listings keep every record", () => {
  assert.equal(firstSection("WPNLIST").rows.length, one("select count(*) from wpns"));
  assert.equal(firstSection("REFLIST2").rows.length, one("select count(*) from referenc"));
  const bySrc = rowsOf<{ sources: string | null }>(firstSection("WPNLIST2")).map(
    (r) => r.sources ?? "",
  );
  assert.deepEqual(bySrc, [...bySrc].sort());
});

test("SRTICNTK and SRTICNT2 total the sorties in the AIR table", () => {
  const sorties = one(
    "select sum(sorties) from air where day between '1943-07-04' and '1943-07-18'",
  );
  const k = firstSection("SRTICNTK");
  const unmatched = Number(run("SRTICNTK").notes[0]?.match(/^(\d+)/)?.[1] ?? 0);
  assert.equal((k.total as { total: number }).total + unmatched, sorties);
  assert.equal(k.rows.length, 22);
  type Nation = { day: string; german: number; usa: number; uk: number; sov: number; oth: number };
  const nat = rowsOf<Nation>(firstSection("SRTICNT2"));
  const sum = (key: "german" | "usa" | "uk" | "sov" | "oth") => nat.reduce((s, r) => s + r[key], 0);
  assert.equal(sum("german") + sum("usa") + sum("uk") + sum("sov") + sum("oth"), sorties);
  const g = one("select sum(sorties) from air where upper(nation) = 'G' and day = '1943-07-04'");
  assert.equal(must(nat).german, g);
});

test("CASSUM day totals match an independent query", () => {
  for (const nation of ["G", "S"]) {
    const rows = rowsOf<Day>(firstSection("CASSUM", { nation }));
    assert.equal(rows.length, 15);
    for (const row of rows) {
      const q = must(
        all<{ cas: number; kia: number; oh: number }>(
          db,
          `select sum(coalesce(total_cas,0)) cas, sum(coalesce(tot_killed,0)) kia, sum(coalesce(onhand_men,0)) oh
        from unitdata where nation = ? and date = ?`,
          [nation, row.date],
        ),
      );
      assert.equal(row.cas, q.cas);
      assert.equal(row.kia, q.kia);
      assert.equal(row.onhand, q.oh);
      if (row.cas + row.onhand) {
        assert.ok(Math.abs(row.pcas - (100 * row.cas) / (row.cas + row.onhand)) < 1e-9);
      }
    }
  }
});

test("per-record casualty reports use the right denominators", () => {
  const r = must(
    all<{ rec: number; oh: number; c: number; d: number | null }>(
      db,
      "select rowid rec, onhand_men oh, total_cas c, tot_dnbi d from unitdata where onhand_men > 0 and total_cas > 0 limit 1",
    ),
  );
  const find = (id: string) => must(rowsOf<Pcts>(firstSection(id)).find((x) => x.rec === r.rec));
  assert.ok(Math.abs(find("UTOTCAS").pcas - (100 * r.c) / r.oh) < 1e-9);
  assert.ok(Math.abs(find("UTOTCS2").pcas - (100 * r.c) / (r.oh + r.c)) < 1e-9);
  assert.ok(Math.abs(find("UTCNDNBI").pbat - (100 * (r.c - (r.d ?? 0))) / r.oh) < 1e-9);
  assert.equal(firstSection("UTOTCAS").rows.length, one("select count(*) from unitdata"));
});

test("DELTACAS and NAZIDCAS reconcile strengths as the programs do", () => {
  const unit = String(
    Object.values(
      must(
        all<{ unit_name: string }>(
          db,
          "select unit_name from unitdata group by unit_name having count(*) = 15 limit 1",
        ),
      ),
    )[0],
  );
  const rs = all<{
    date: string;
    oh: number;
    c: number | null;
    p: number | null;
    t: number | null;
  }>(
    db,
    "select date, onhand_men oh, total_cas c, repl_tot p, ret_tot t from unitdata where unit_name = ? order by date",
    [unit],
  );
  const z = (v: number | null | undefined) => v ?? 0;
  const day0 = must(rs[0]);
  const day1 = must(rs[1]);
  const delta = must(run("DELTACAS").sections.find((s) => s.heading === unit));
  assert.equal(delta.rows.length, 14);
  const d0 = must(rowsOf<Duty>(delta));
  assert.equal(d0.date, addDays(day0.date, 1));
  assert.equal(d0.calc, z(day0.oh) - z(day1.c) + z(day1.p) + z(day1.t));
  assert.equal(d0.delta, day1.oh - d0.calc);
  const nazi = must(run("NAZIDCAS").sections.find((s) => s.heading === unit));
  const n0 = must(rowsOf<Duty>(nazi));
  assert.equal(n0.calc, z(day0.oh) - z(day0.c) + z(day0.p) + z(day0.t));
  assert.equal(n0.delta, day1.oh - n0.calc);
  assert.equal(
    (nazi.total as { cas: number }).cas,
    rs.reduce((s, r) => s + z(r.c), 0),
  );
});

test("attachment lists cover every non-blank entry", () => {
  const cols = [
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
  ].map((c) => `atch_dtch${c}`);
  const expected = one(
    `select ${cols.map((c) => `sum(trim(coalesce(${c},'')) != '')`).join(" + ")} from unitdata where nation = 'G'`,
  );
  const count = (id: string) =>
    run(id, { nation: "G" }).sections.reduce((s, x) => s + x.rows.length, 0);
  assert.equal(count("ADLIST"), expected);
  assert.equal(count("ADLIST2"), expected);
});

test("trackers find matches and explain empty results", () => {
  const none = run("FAATCH");
  assert.ok(none.notes.join(" ").includes("No matches") || firstSection("FAATCH").rows.length > 0);
  type Att = { date: string; type: string; name: string };
  const art = rowsOf<Att>(firstSection("CAVATCH", { pattern: "Art", ignoreCase: false }));
  assert.ok(art.length > 0 && art.every((r) => r.type.includes("Art") || r.name.includes("Art")));
  const dates = art.map((r) => r.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("TIMCBT, TOENDX and INVNDX", () => {
  assert.equal(firstSection("TIMCBT").rows.length, one("select count(*) from unitloc"));
  const toe = run("TOENDX").sections;
  assert.ok(
    toe.length > 0 &&
      toe.every(
        (s) => new Set(rowsOf<{ name: string }>(s).map((r) => r.name)).size === s.rows.length,
      ),
  );
  assert.ok(run("INVNDX").sections.length > 0);
});

test("IMPUS traces parents and AUTHSTR reads TO&E", () => {
  const r = must(
    all<{ unit_name: string; date: string }>(
      db,
      "select unit_name, date from unitloc where trim(coalesce(parent,'')) != '' limit 1",
    ),
  );
  const chain = rowsOf<{ unit: string }>(
    firstSection("IMPUS", { unit: r.unit_name.trim(), date: r.date }),
  );
  assert.equal(must(chain).unit, r.unit_name.trim());
  assert.ok(chain.length >= 2);
  const t = must(
    all<{ u: string; m: number }>(
      db,
      "select t.unit_name u, t.total_men m from toe t join unitdata d on trim(d.unit_name) = trim(t.unit_name) where t.total_men > 0 limit 1",
    ),
  );
  const auth = rowsOf<{ men: number }>(
    firstSection("AUTHSTR", { unit: t.u.trim(), date: "1943-07-04" }),
  );
  assert.equal(must(auth).men, t.m);
});

test("date helpers", () => {
  assert.equal(campaignDays().length, 15);
  assert.equal(fmtDate("1943-07-04"), "07/04/43");
});
