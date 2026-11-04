import type { Database, SqlJsStatic } from "sql.js";
import { cellValue, formatCell, toCsv } from "./format.ts";
import type { Option, Params, Report, Section } from "./reports.ts";
import { all, defaultParams, MENU_ORDER, REPORTS, unitChoices } from "./reports.ts";

declare const initSqlJs: (config?: {
  locateFile?: (file: string) => string;
}) => Promise<SqlJsStatic>;

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el as T;
}
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ESC[c] ?? c);
const TABLES = ["UNITDATA", "UNITLOC", "INVENTOR", "TOE", "WPNS", "AIR", "REFERENC", "BIBLIOG"];
const PAGE = 100;
let db: Database;
let units: string[] = [];

async function start(): Promise<void> {
  const Sql = await initSqlJs({ locateFile: (f) => `dist/${f}` });
  const url = new URLSearchParams(location.search).get("db") || "../data/kosave.sqlite";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Could not load ${url} (${res.status}). Run "dvc repro" and serve the repo root.`,
    );
  }
  db = new Sql.Database(new Uint8Array(await res.arrayBuffer()));
  units = unitChoices(db);
  const [count] = all<{ c: number }>(db, "select count(*) c from unitdata");
  $("status").textContent = `${(count?.c ?? 0).toLocaleString()} unit-day records`;
  buildMenu();
  buildTables();
}

// ------------------------------------------------------------ reports
function buildMenu(): void {
  const menu = $("menu");
  for (const group of MENU_ORDER) {
    const items = REPORTS.filter((r) => r.menu === group);
    if (items.length === 0) {
      continue;
    }
    menu.insertAdjacentHTML("beforeend", `<h2>${esc(group)}</h2>`);
    for (const r of items) {
      const b = document.createElement("button");
      b.innerHTML = `${esc(r.title)} <small>${r.id}</small>`;
      b.onclick = () => {
        for (const x of document.querySelectorAll("#menu button")) {
          x.classList.remove("active");
        }
        b.classList.add("active");
        openReport(r);
      };
      menu.append(b);
    }
  }
}

function makeInput(
  p: Report["params"][number],
  defaults: Params,
): HTMLInputElement | HTMLSelectElement {
  if (p.type === "select" || p.type === "unit") {
    const select = document.createElement("select");
    const opts: Option[] =
      p.type === "unit" ? units.map((u) => ({ value: u, label: u })) : (p.options ?? []);
    select.innerHTML = opts
      .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
      .join("");
    select.value = String(defaults[p.key]);
    return select;
  }
  const input = document.createElement("input");
  input.type = p.type === "bool" ? "checkbox" : p.type === "date" ? "date" : "text";
  if (p.min) {
    input.min = p.min;
  }
  if (p.max) {
    input.max = p.max;
  }
  if (p.type === "bool") {
    input.checked = !!defaults[p.key];
  } else {
    input.value = String(defaults[p.key]);
  }
  return input;
}

function openReport(report: Report): void {
  $("report-head").innerHTML = `<h2>${esc(report.title)} <small>(${report.id})</small></h2>`;
  const form = $<HTMLFormElement>("params");
  form.innerHTML = "";
  const defaults = defaultParams(report);
  for (const p of report.params) {
    const label = document.createElement("label");
    label.textContent = p.label;
    const input = makeInput(p, defaults);
    input.name = p.key;
    if (p.type === "bool") {
      label.className = "check";
      label.prepend(input);
    } else {
      label.append(input);
    }
    form.append(label);
  }
  const run = document.createElement("button");
  run.textContent = "Run report";
  form.append(run);
  form.onsubmit = (e) => {
    e.preventDefault();
    execute(report);
  };
  execute(report);
}

function readParams(report: Report): Params {
  const out: Params = {};
  for (const p of report.params) {
    const el = $<HTMLFormElement>("params").elements.namedItem(p.key) as HTMLInputElement;
    out[p.key] = p.type === "bool" ? el.checked : el.value;
  }
  return out;
}

function execute(report: Report): void {
  const out = $("result");
  try {
    const t0 = performance.now();
    const res = report.run(db, readParams(report));
    $("notes").innerHTML = res.notes
      .filter(Boolean)
      .map((n) => `<p>${esc(n)}</p>`)
      .join("");
    out.innerHTML = "";
    for (const s of res.sections) {
      out.append(renderSection(s, report.id));
    }
    if (res.sections.length === 0) {
      out.innerHTML = '<p class="hint">No rows.</p>';
    }
    $("status").textContent = `${report.id}: ${(performance.now() - t0).toFixed(0)} ms`;
  } catch (e) {
    $("notes").innerHTML = "";
    out.innerHTML = `<p style="color:#b00020">${esc((e as Error).message)}</p>`;
  }
}

function renderSection(s: Section, id: string): HTMLElement {
  const wrap = document.createElement("div");
  const head = s.heading ? `<h3>${esc(s.heading)}</h3>` : "";
  const th = s.columns
    .map((c) => `<th class="${c.align === "r" ? "r" : ""}">${esc(c.label)}</th>`)
    .join("");
  const cells = (r: object) =>
    s.columns
      .map(
        (c) =>
          `<td class="${c.align === "r" ? "r" : ""}">${esc(formatCell(cellValue(r, c.key), c.fmt))}</td>`,
      )
      .join("");
  const body =
    s.rows.map((r) => `<tr>${cells(r)}</tr>`).join("") ||
    `<tr><td colspan="${s.columns.length}" class="null">No rows</td></tr>`;
  const foot = s.total ? `<tfoot><tr>${cells(s.total)}</tr></tfoot>` : "";
  wrap.innerHTML = `${head}<div class="tools"><button type="button">Download CSV</button> <span class="hint">${s.rows.length.toLocaleString()} rows</span></div>
    <div class="scroll"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
  const download = wrap.querySelector("button");
  if (download) {
    download.onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([toCsv(s)], { type: "text/csv" }));
      a.download = `${id}${s.heading ? `-${s.heading.replace(/\W+/g, "_")}` : ""}.csv`;
      a.click();
    };
  }
  return wrap;
}

// ------------------------------------------------------------- browse
interface BrowseState {
  table: string | null;
  offset: number;
  term: string;
}
/** A table row for the browse view; `rec` is the SQLite rowid, the other keys are columns. */
interface BrowseRow {
  rec: number;
  [column: string]: unknown;
}
interface TableColumn {
  name: string;
  type: string;
}

let current: BrowseState = { table: null, offset: 0, term: "" };

function buildTables(): void {
  const box = $("tables");
  box.insertAdjacentHTML("beforeend", "<h2>Tables</h2>");
  for (const t of TABLES) {
    const [row] = all<{ c: number }>(db, `select count(*) c from ${t}`);
    const b = document.createElement("button");
    b.innerHTML = `${t} <small>${(row?.c ?? 0).toLocaleString()}</small>`;
    b.onclick = () => {
      for (const x of box.querySelectorAll("button")) {
        x.classList.remove("active");
      }
      b.classList.add("active");
      current = { table: t, offset: 0, term: $<HTMLInputElement>("search").value };
      browse();
    };
    box.append(b);
  }
  $<HTMLFormElement>("browse-controls").onsubmit = (e) => {
    e.preventDefault();
  };
  $<HTMLInputElement>("search").oninput = () => {
    current.term = $<HTMLInputElement>("search").value;
    current.offset = 0;
    if (current.table) {
      browse();
    }
  };
}

function browse(): void {
  const { table, offset, term } = current;
  if (!table) {
    return;
  }
  const cols = all<TableColumn>(db, `pragma table_info(${table})`);
  const textCols = cols.filter((c) => c.type === "TEXT").map((c) => c.name);
  const where =
    term && textCols.length > 0 ? `where ${textCols.map((c) => `"${c}" like ?`).join(" or ")}` : "";
  const params = term ? textCols.map(() => `%${term}%`) : [];
  const [totalRow] = all<{ c: number }>(db, `select count(*) c from ${table} ${where}`, params);
  const total = totalRow?.c ?? 0;
  const shown = cols.slice(0, 8);
  const rows = all<BrowseRow>(
    db,
    `select rowid as rec, ${shown.map((c) => `"${c.name}"`).join(", ")} from ${table} ${where} order by rowid limit ${PAGE} offset ${offset}`,
    params,
  );
  $("pager").innerHTML =
    `${total.toLocaleString()} records · ${Math.min(offset + 1, total)}–${Math.min(offset + PAGE, total)}
    <button type="button" id="prev" ${offset ? "" : "disabled"}>Prev</button><button type="button" id="next" ${offset + PAGE < total ? "" : "disabled"}>Next</button>`;
  $("prev").onclick = () => {
    current.offset -= PAGE;
    browse();
  };
  $("next").onclick = () => {
    current.offset += PAGE;
    browse();
  };
  const out = $("browse-result");
  out.innerHTML = `<div class="scroll"><table><thead><tr><th class="r">Rec</th>${shown.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr class="click" data-rec="${r.rec}"><td class="r">${r.rec}</td>${shown.map((c) => `<td>${esc(formatCell(r[c.name], "text"))}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table></div><div id="detail"></div>`;
  for (const tr of out.querySelectorAll<HTMLElement>("tr.click")) {
    tr.onclick = () => showRecord(table, Number(tr.getAttribute("data-rec")));
  }
}

function showRecord(table: string, rec: number): void {
  const [row] = all<Record<string, unknown>>(db, `select * from ${table} where rowid = ?`, [rec]);
  const items = Object.entries(row ?? {}).filter(([, v]) => v != null && String(v).trim() !== "");
  $("detail").innerHTML =
    `<h3>${table} record ${rec}</h3><dl class="detail">${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  $("detail").scrollIntoView({ behavior: "smooth" });
}

// --------------------------------------------------------------- tabs
for (const b of document.querySelectorAll<HTMLButtonElement>("nav button")) {
  b.onclick = () => {
    for (const x of document.querySelectorAll("nav button")) {
      x.classList.toggle("active", x === b);
    }
    $("reports-view").hidden = b.getAttribute("data-view") !== "reports";
    $("browse-view").hidden = b.getAttribute("data-view") !== "browse";
  };
}

start().catch((e: Error) => {
  $("status").textContent = e.message;
});
