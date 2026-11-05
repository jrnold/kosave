# KOSAVE II: the Kursk Data Base

![dBASE IV 2.0](https://img.shields.io/badge/dBASE_IV-2.0-blue)
![DOSBox-X](https://img.shields.io/badge/DOSBox--X-Docker-2496ED?logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![DVC](https://img.shields.io/badge/data-DVC-945DD6?logo=dvc&logoColor=white)

Tools for working with the Kursk Data Base (KDB), the dBASE IV database that accompanies the
US Army Concepts Analysis Agency study
*Kursk Operation Simulation and Validation Exercise, Phase II* (CAA-SR-98-7, September 1998).
The KDB tracks the location, status and activity of every division-size and larger unit on the
Southern Front of the Battle of Kursk, 4 to 18 July 1943. The Dupuy Institute built it.

This repo holds the original distribution plus three ways to use it:

  | Way               | What it is                                                               | Where                            |
  | ----------------- | ------------------------------------------------------------------------ | -------------------------------- |
  | Original dBASE IV | The original menus and reports, run in DOSBox-X inside Docker.           | `docker/`                        |
  | SQLite            | All tables, including the memo fields, in one `kosave.sqlite` file.      | `scripts/`, `data/kosave.sqlite` |
  | Web reports       | The `.PRG` reports ported to TypeScript, running in a browser on sql.js. | `app/`                           |

## Get the data

The data is archived on Zenodo: [10.5281/zenodo.23966568](https://doi.org/10.5281/zenodo.23966568).
It isn't in git, so download it from the repo root:

```sh
curl -L -o data/kosave.sqlite https://zenodo.org/records/23966568/files/kosave.sqlite
curl -L -o kosave-cdrom.zip https://zenodo.org/records/23966568/files/kosave-cdrom.zip
mkdir -p data/raw && unzip kosave-cdrom.zip -d data/raw && rm kosave-cdrom.zip
```

The web app needs only the SQLite file. The Docker image and `dvc repro` need the raw data.

## Layout

  | Path                      | Contents                                                                                                                                                         |
  | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `data/raw/kosave/`        | The CD-ROM as distributed: `DATABASE` (dBASE IV files and `.PRG` programs), `DOCUMENT`, `MAPS`, `PHOTOS`, the unit narrative and location folders, `README.TXT`. |
  | `data/kosave.sqlite`      | Built from `DATABASE` by `scripts/build_sqlite.py` (a DVC output).                                                                                               |
  | `docs/GUIDE.md`           | The user's guide, converted from `GUIDE.DOC`.                                                                                                                    |
  | `docs/DTIC_ADA360311.pdf` | The CAA study report (DTIC accession ADA360311), with a text copy.                                                                                               |
  | `scripts/build_sqlite.py` | Reads the `.DBF` and `.DBT` files into SQLite.                                                                                                                   |
  | `app/`                    | The browser app: `src/reports.ts` holds the report logic, `src/app.ts` the page.                                                                                 |
  | `docker/`                 | dBASE IV 2.0 under DOSBox-X, running the Kursk menus and reports.                                                                                                |

The tables are `AIR`, `BIBLIOG`, `INVENTOR`, `REFERENC`, `TOE`, `UNITDATA`, `UNITLOC` and `WPNS`.
The original `README.TXT` and `docs/GUIDE.md` describe the fields and conventions.

## SQLite

```sh
dvc repro                  # rebuilds data/kosave.sqlite from data/raw/kosave/DATABASE
# or, without DVC:
uv run --with dbfread python scripts/build_sqlite.py data/raw/kosave/DATABASE data/kosave.sqlite
```

The script keeps the `.DBT` memo text (the unit narratives), which a plain CSV export drops.
A numeric field that can't be parsed, such as a lone `.`, becomes `NULL`.

## Web reports

```sh
npm install
npm run build              # bundles app/src/app.ts into app/dist/
npm run serve              # then open http://localhost:8000/app/
npm test                   # report tests (node --test)
npm run typecheck
```

The page loads `data/kosave.sqlite` with sql.js, so [download the data](#get-the-data) first. Each report keeps the name of the `.PRG` program it comes from.

## Original dBASE IV in Docker

```sh
docker build -f docker/Dockerfile --build-arg DBASE4_URL=<url> -t kosave .
docker run -d --name kosave -e GUI=1 -p 127.0.0.1:6080:6080 kosave
docker logs kosave         # prints the URL and a random VNC password
```

`DBASE4_URL` is the URL of your own copy of Borland dBASE IV 2.0. The build downloads it, checks
it against a pinned SHA-256, and installs it. The image therefore contains copyrighted software: keep it local and
never push it to a public registry. See [`docker/README.md`](docker/README.md) for headless mode,
environment variables, and known limits (reports show on screen but can't print to a file).

## Data and licence

- **The CAA study report** (`docs/DTIC_ADA360311.pdf`) was written by the US Army Concepts
  Analysis Agency, so it is a US government work and in the public domain (17 U.S.C. § 105). Its
  cover page also says "Approved for public release; distribution unlimited".
- **The database and its documentation** were built by The Dupuy Institute under contract
  DASW01-95-C-0068, delivered to CAA, and released with the study on the KOSAVE II CD-ROM (DTIC
  accession ADM001006). This repo treats them as public domain:
  [The Dupuy Institute lists](https://dupuyinstitute.org/products/other-databases/kursk/) the March
  1996 version as owned by CAA and in the public domain.
- **dBASE IV** is Borland's copyrighted software and is not in this repo. The Docker build
  downloads your copy, which is why the image must stay local.

Large files (`docs/DTIC_ADA360311.pdf`, the SQLite file) are tracked with DVC, not git.
