import type { Database } from "sql.js";
import type { SqlJsStatic } from "sql.js";
import { REPORTS, MENU_ORDER, all, defaultParams, unitChoices } from "./reports.ts";
import type { Option, Params, Report, Row, Section } from "./reports.ts";
import { formatCell, toCsv } from "./format.ts";

declare const initSqlJs: (config?: {
  locateFile?: (file: string) => string;
}) => Promise<SqlJsStatic>;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ESC[c]);
const TABLES = ["UNITDATA", "UNITLOC", "INVENTOR", "TOE", "WPNS", "AIR", "REFERENC", "BIBLIOG"];
const PAGE = 100;
let db: Database;
let units: string[] = [];

async function start(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: (f) => `dist/${f}` });
  const url = new URLSearchParams(location.search).get("db") || "../data/kosave.sqlite";
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      `Could not load ${url} (${res.status}). Run "dvc repro" and serve the repo root.`,
    );
  db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
  units = unitChoices(db);
  $("status").textContent =
    `${all(db, "select count(*) c from unitdata")[0].c.toLocaleString()} unit-day records`;
  buildMenu();
  buildTables();
}

// ------------------------------------------------------------ reports
function buildMenu(): void {
  const menu = $("menu");
  for (const group of MENU_ORDER) {
    const items = REPORTS.filter((r) => r.menu === group);
    if (!items.length) continue;
    menu.insertAdjacentHTML("beforeend", `<h2>${esc(group)}</h2>`);
    for (const r of items) {
      const b = document.createElement("button");
      b.innerHTML = `${esc(r.title)} <small>${r.id}</small>`;
      b.onclick = () => {
        document.querySelectorAll("#menu button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        openReport(r);
      };
      menu.append(b);
    }
  }
}

function openReport(report: Report): void {
  $("report-head").innerHTML = `<h2>${esc(report.title)} <small>(${report.id})</small></h2>`;
  const form = $<HTMLFormElement>("params");
  form.innerHTML = "";
  const defaults = defaultParams(report);
  for (const p of report.params) {
    const label = document.createElement("label");
    label.textContent = p.label;
    let input: HTMLInputElement | HTMLSelectElement;
    if (p.type === "select" || p.type === "unit") {
      input = document.createElement("select");
      const opts: Option[] =
        p.type === "unit" ? units.map((u) => ({ value: u, label: u })) : (p.options ?? []);
      input.innerHTML = opts
        .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
        .join("");
    } else {
      input = document.createElement("input");
      (input as HTMLInputElement).type =
        p.type === "bool" ? "checkbox" : p.type === "date" ? "date" : "text";
      if (p.min) (input as HTMLInputElement).min = p.min;
      if (p.max) (input as HTMLInputElement).max = p.max;
    }
    input.name = p.key;
    if (p.type === "bool") {
      (input as HTMLInputElement).checked = !!defaults[p.key];
      label.className = "check";
      label.prepend(input);
    } else {
      input.value = String(defaults[p.key]);
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
    res.sections.forEach((s) => out.append(renderSection(s, report.id)));
    if (!res.sections.length) out.innerHTML = '<p class="hint">No rows.</p>';
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
  const cells = (r: Row) =>
    s.columns
      .map(
        (c) => `<td class="${c.align === "r" ? "r" : ""}">${esc(formatCell(r[c.key], c.fmt))}</td>`,
      )
      .join("");
  const body =
    s.rows.map((r) => `<tr>${cells(r)}</tr>`).join("") ||
    `<tr><td colspan="${s.columns.length}" class="null">No rows</td></tr>`;
  const foot = s.total ? `<tfoot><tr>${cells(s.total)}</tr></tfoot>` : "";
  wrap.innerHTML = `${head}<div class="tools"><button type="button">Download CSV</button> <span class="hint">${s.rows.length.toLocaleString()} rows</span></div>
    <div class="scroll"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
  wrap.querySelector("button")!.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(s)], { type: "text/csv" }));
    a.download = `${id}${s.heading ? "-" + s.heading.replace(/\W+/g, "_") : ""}.csv`;
    a.click();
  };
  return wrap;
}

// ------------------------------------------------------------- browse
let current: { table: string | null; offset: number; term: string } = {
  table: null,
  offset: 0,
  term: "",
};

function buildTables(): void {
  const box = $("tables");
  box.insertAdjacentHTML("beforeend", "<h2>Tables</h2>");
  for (const t of TABLES) {
    const count = all(db, `select count(*) c from ${t}`)[0].c;
    const b = document.createElement("button");
    b.innerHTML = `${t} <small>${count.toLocaleString()}</small>`;
    b.onclick = () => {
      box.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
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
    if (current.table) browse();
  };
}

function browse(): void {
  const { table, offset, term } = current;
  if (!table) return;
  const cols = all(db, `pragma table_info(${table})`);
  const textCols = cols.filter((c) => c.type === "TEXT").map((c) => c.name);
  const where =
    term && textCols.length ? "where " + textCols.map((c) => `"${c}" like ?`).join(" or ") : "";
  const params = term ? textCols.map(() => `%${term}%`) : [];
  const total = all(db, `select count(*) c from ${table} ${where}`, params)[0].c;
  const shown = cols.slice(0, 8);
  const rows = all(
    db,
    `select rowid as _rec, ${shown.map((c) => `"${c.name}"`).join(", ")} from ${table} ${where} order by rowid limit ${PAGE} offset ${offset}`,
    params,
  );
  $("pager").innerHTML =
    `${total.toLocaleString()} records · ${Math.min(offset + 1, total)}–${Math.min(offset + PAGE, total)}
    <button type="button" id="prev" ${offset ? "" : "disabled"}>Prev</button><button type="button" id="next" ${offset + PAGE < total ? "" : "disabled"}>Next</button>`;
  $("prev")!.onclick = () => {
    current.offset -= PAGE;
    browse();
  };
  $("next")!.onclick = () => {
    current.offset += PAGE;
    browse();
  };
  const out = $("browse-result");
  out.innerHTML = `<div class="scroll"><table><thead><tr><th class="r">Rec</th>${shown.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr class="click" data-rec="${r._rec}"><td class="r">${r._rec}</td>${shown.map((c) => `<td>${esc(formatCell(r[c.name], "text"))}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table></div><div id="detail"></div>`;
  out.querySelectorAll<HTMLElement>("tr.click").forEach((tr) => {
    tr.onclick = () => showRecord(table, Number(tr.dataset.rec));
  });
}

function showRecord(table: string, rec: number): void {
  const [row] = all(db, `select * from ${table} where rowid = ?`, [rec]);
  const items = Object.entries(row).filter(([, v]) => v != null && String(v).trim() !== "");
  $("detail").innerHTML =
    `<h3>${table} record ${rec}</h3><dl class="detail">${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  $("detail").scrollIntoView({ behavior: "smooth" });
}

// --------------------------------------------------------------- tabs
document.querySelectorAll<HTMLButtonElement>("nav button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("active", x === b));
    $("reports-view").hidden = b.dataset.view !== "reports";
    $("browse-view").hidden = b.dataset.view !== "browse";
  };
});

start().catch((e: Error) => {
  $("status").textContent = e.message;
});
