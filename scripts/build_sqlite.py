"""Build kosave.sqlite from the dBASE IV files in data/raw/kosave/DATABASE,
including memo fields from the .DBT files (which the csv/ export drops).

    uv run --with dbfread scripts/build_sqlite.py [src_dir] [out.sqlite]
"""

import sqlite3
import sys
from pathlib import Path
from typing import override

from dbfread import DBF, FieldParser


class Parser(FieldParser):
    """Treat unparsable numerics (e.g. a lone '.') as NULL."""

    @override
    def parseN(self, field, data):
        try:
            return super().parseN(field, data)
        except ValueError:
            return None

    @override
    def parseF(self, field, data):
        try:
            return super().parseF(field, data)
        except ValueError:
            return None


src = Path(sys.argv[1] if len(sys.argv) > 1 else "data/raw/kosave/DATABASE")
out = Path(sys.argv[2] if len(sys.argv) > 2 else "data/kosave.sqlite")
TABLES = ["AIR", "BIBLIOG", "INVENTOR", "REFERENC", "TOE", "UNITDATA", "UNITLOC", "WPNS"]
SQLTYPE = {"C": "TEXT", "M": "TEXT", "N": "NUMERIC", "F": "REAL", "D": "TEXT", "L": "INTEGER"}

out.parent.mkdir(parents=True, exist_ok=True)
out.unlink(missing_ok=True)
con = sqlite3.connect(out)
for name in TABLES:
    t = DBF(
        src / f"{name}.DBF",
        encoding="latin-1",
        ignore_missing_memofile=False,
        char_decode_errors="replace",
        parserclass=Parser,
    )
    cols = ", ".join(f'"{f.name.lower()}" {SQLTYPE.get(f.type, "TEXT")}' for f in t.fields)
    con.execute(f'CREATE TABLE "{name}" ({cols})')
    marks = ",".join("?" * len(t.fields))
    rows = ([r[f.name] for f in t.fields] for r in t)
    con.executemany(
        f'INSERT INTO "{name}" VALUES ({marks})',  # noqa: S608  (name is from TABLES; values are bound)
        ([v.isoformat() if hasattr(v, "isoformat") else v for v in row] for row in rows),
    )
    print(f"{name}: {len(t)} rows, {len(t.fields)} cols")
con.commit()
con.close()
