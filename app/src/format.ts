// Cell formatting shared by the page and the tests.
import type { Fmt, Section } from "./reports.ts";
import { fmtDate } from "./reports.ts";

/** The value a column draws from a row; rows are plain objects keyed by column key. */
export function cellValue(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

export function formatCell(v: unknown, fmt: Fmt): string {
  if (v == null || v === "") {
    return "";
  }
  if (typeof v === "string" && fmt !== "date" && fmt !== "text") {
    return v;
  }
  switch (fmt) {
    case "int":
      return Number(v).toLocaleString("en-US");
    case "pct":
    case "ratio":
      return Number(v).toFixed(2);
    case "ratio1":
      return Number(v).toFixed(1);
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? fmtDate(String(v)) : String(v);
    default:
      return String(v);
  }
}

export function toCsv(section: Section): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [section.columns.map((c) => esc(c.label)).join(",")];
  for (const r of [...section.rows, ...(section.total ? [section.total] : [])]) {
    lines.push(
      section.columns
        .map((c) => {
          const v = cellValue(r, c.key);
          return esc(c.fmt === "int" && typeof v === "number" ? String(v) : formatCell(v, c.fmt));
        })
        .join(","),
    );
  }
  return lines.join("\n");
}
