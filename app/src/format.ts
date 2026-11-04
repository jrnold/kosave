// Cell formatting shared by the page and the tests.
import { fmtDate } from "./reports.ts";
import type { Fmt, Section } from "./reports.ts";

export function formatCell(v: unknown, fmt: Fmt): string {
  if (v == null || v === "") return "";
  if (typeof v === "string" && fmt !== "date" && fmt !== "text") return v;
  switch (fmt) {
    case "int":
      return Number(v as number).toLocaleString("en-US");
    case "pct":
      return Number(v as number).toFixed(2);
    case "ratio":
      return Number(v as number).toFixed(2);
    case "ratio1":
      return Number(v as number).toFixed(1);
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
        .map((c) =>
          esc(
            c.fmt === "int" && r[c.key] != null && typeof r[c.key] === "number"
              ? String(r[c.key])
              : formatCell(r[c.key], c.fmt),
          ),
        )
        .join(","),
    );
  }
  return lines.join("\n");
}
