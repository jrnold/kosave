# Kursk database (KOSAVE II) in dBASE IV, in Docker

Runs the original dBASE IV programs of the Kursk Data Base under DOSBox-X, so the menus and
reports work as they did in 1996. dBASE IV is copyrighted and isn't in this repo, so you
supply your own copy of Borland dBASE IV 2.0: a 7-Zip archive of the 3.5-inch 720k floppies, at a
URL the build can download. The image then contains copyrighted software. Keep it local and never
push it to a public registry.

## Build

From the repo root:

```sh
docker build -f docker/Dockerfile --build-arg DBASE4_URL=<url> -t kosave .
```

`setup.sh` checks the download against a pinned SHA-256 (`5076ed1d…8e22`), refuses to unpack it on
a mismatch, then drives `INSTALL.EXE` under DOSBox-X with `xdotool`. The build takes about four
minutes. To use a different archive, also pass `--build-arg DBASE4_SHA256=<sha256>`. The database comes from
`data/raw/kosave/DATABASE/KURSK.EXE`, which 7-Zip unpacks into `C:\DBASE\KURSK`.

## Run

The container has no native window, so DOSBox-X is served in a browser through VNC and noVNC:

```sh
docker run -d --name kosave -e GUI=1 -p 127.0.0.1:6080:6080 kosave
docker logs kosave    # prints the URL and a random VNC password
```

Open <http://localhost:6080/vnc.html?autoconnect=1&resize=scale> and enter the password. The
Kursk main menu opens. Option 25 is the report menu. Type `0` to leave the menu, then `QUIT`
at the dBASE dot prompt. Quitting ends the container. Remove it with `docker rm -f kosave`.
Always publish the port on `127.0.0.1`.

To start in the report menu, add `-e START=reports`.

**Headless.** Feed in keystrokes and save screenshots, for example the Time In Combat report:

```sh
docker run --rm -v "$PWD/out:/work" -e START=reports -e KEYS_WAIT=12 \
  -e KEYS='type:10 key:Return 3 type:1 key:Return 3 type:N key:Return 6' \
  -e SHOT_AT='40' -e TIMEOUT=45 kosave
```

## Notes

- Reports go to the screen. Answer `N` to "Do you want a hardcopy?". Printing to a file through
  LPT1 does not work yet.
- Changes made in the menus (enter or edit data) stay in the container and are lost with it.
- `KEYS.COM` from `~/code/par/quattro-pro-4` doesn't reach this installer's text fields, so
  keystrokes are real X11 events from `xdotool`.

## Environment variables

  | Variable    | Meaning                                                                     |
  | ----------- | --------------------------------------------------------------------------- |
  | `GUI`       | Set to `1` to serve the display on port 6080 with a password.               |
  | `START`     | `main` (default) or `reports`.                                              |
  | `KEYS`      | `xdotool` tokens: a number sleeps, `key:Return` presses, `type:text` types. |
  | `KEYS_WAIT` | Seconds before the first key. Default 8.                                    |
  | `SHOT_AT`   | Seconds after start at which to save `/work/shot-<s>.png`.                  |
  | `TIMEOUT`   | Kill DOSBox-X after this many seconds. Default 120, or never with `GUI`.    |
