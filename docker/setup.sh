#!/usr/bin/env bash
# Download Borland dBASE IV 2.0 from a URL you supply, verify it, and install it under DOSBox-X.
#
# Usage: DBASE4_URL=<url> xvfb-run -a setup.sh [target-dir]     (default: ./emu next to this script)
# Needs: curl, 7zz (7-Zip), dosbox-x, xdotool, ImageMagick (only for debugging shots), and a
#        display (xvfb-run). The Dockerfile installs all of it.
#
# Result:
#   <target>/c/DBASE/   installed dBASE IV (mounted as C:)
#
# INSTALL.EXE ignores the DOS keyboard buffer tricks that par's KEYS.COM uses, so the
# installer is driven with real X11 key events from xdotool instead.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
TARGET=${1:-$HERE/emu}
# DBASE4_URL points to a 7-Zip archive of the "Borland dBase IV 2.0 (1993) (3.5-720k)" floppies.
# dBASE IV is copyrighted, so this repo doesn't say where to get it.
URL=${DBASE4_URL:-}
if [ -z "$URL" ] && [ ! -s "$TARGET/download/dbase4.7z" ]; then
  echo "DBASE4_URL is not set: give the URL of your copy of the dBASE IV 2.0 archive" >&2
  exit 1
fi
# sha256 of the archive tested with this script. The script refuses to unpack or run anything
# that does not match; set DBASE4_SHA256 to use a different download.
SHA256=${DBASE4_SHA256:-5076ed1d3e592696cf155964da5ad5970327958e2a12ebf2011cd50856418e22}
INSTALL_SECONDS=${INSTALL_SECONDS:-480}

if command -v sha256sum >/dev/null; then SHA=(sha256sum); else SHA=(shasum -a 256); fi
for tool in curl 7zz dosbox-x xdotool "${SHA[0]}"; do
  command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }
done
[ -n "${DISPLAY:-}" ] || { echo "no DISPLAY: run under xvfb-run -a" >&2; exit 1; }

mkdir -p "$TARGET"/{download,c/DBASE}
cd "$TARGET"

ARCHIVE=download/dbase4.7z
if [ ! -s "$ARCHIVE" ]; then
  echo "Downloading dBASE IV 2.0 ..."
  curl -fL --proto '=https' --proto-redir '=https' --retry 3 -A 'Mozilla/5.0' -e "$(echo "$URL" | cut -d/ -f1-3)/" -o "$ARCHIVE.part" "$URL"
  mv "$ARCHIVE.part" "$ARCHIVE"
fi
ACTUAL=$("${SHA[@]}" "$ARCHIVE" | cut -d' ' -f1)
if [ "$ACTUAL" != "$SHA256" ]; then
  echo "checksum mismatch for $ARCHIVE: expected $SHA256, got $ACTUAL" >&2
  echo "delete the file to re-download, or set DBASE4_SHA256 to accept a different archive" >&2
  exit 1
fi
7zz t "$ARCHIVE" >/dev/null || { echo "bad archive; delete $ARCHIVE and retry" >&2; exit 1; }

# All five floppies go in one folder, mounted as A:. INSTALL.EXE looks for DISKn.DSK on the
# source path, so one folder serves every disk.
rm -rf download/x c/SRC && mkdir -p download/x c/SRC
7zz x -y -odownload/x "$ARCHIVE" >/dev/null
for img in download/x/*/disk0[1-5].img; do 7zz x -y -oc/SRC "$img" >/dev/null; done
SERIAL=$(sed -n 's/^S\/N: *//p' download/x/*/*dBase*.txt | tr -d '[:space:]')
[[ $SERIAL =~ ^[A-Za-z0-9]{8,20}$ ]] || { echo "unexpected serial format: '$SERIAL'" >&2; exit 1; }
# Without UNZIP.EXE in the target, INSTALL fails to unpack the samples ("Cannot find UNZIP.EXE").
cp c/SRC/UNZIP.EXE c/DBASE/

cat > install.conf <<CONF
[sdl]
autolock=false
[dosbox]
memsize=16
machine=svga_s3
quit warning=false
[cpu]
cycles=max
[dos]
files=60
[autoexec]
mount c "$TARGET/c" -nocachedir
mount a "$TARGET/c/SRC" -t floppy
c:
a:
install
CONF

# Screens, in order: welcome, source drive, stand-alone install, registration (ENTER opens a
# field, DOWN moves to the next), then F2 on the registration screen and F2 on the
# directories screen. Waits are generous because the emulated CPU is slow.
send() {
  local t
  for t in "$@"; do
    case $t in
      key:*)  xdotool key --delay 100 "${t#key:}"; sleep 1 ;;
      type:*) xdotool type --delay 150 "${t#type:}"; sleep 1 ;;
      *)      sleep "$t" ;;
    esac
  done
}

echo "Running INSTALL.EXE in DOSBox-X (up to ${INSTALL_SECONDS}s) ..."
dosbox-x -conf install.conf -nopromptfolder -fastlaunch >dbx.log 2>&1 &
PID=$!
(
  sleep 5; xdotool mousemove 400 300
  send 3 key:Return 3 key:Return 3 key:Return 3 key:Return \
       2 type:user key:Return key:Down key:Return \
       2 type:user key:Return key:Down key:Return \
       2 "type:$SERIAL" key:Return 3 key:F2 8 key:F2
) &
KEYPID=$!
# CONFIG.DB is the last file INSTALL writes.
for ((i = 0; i < INSTALL_SECONDS; i++)); do
  kill -0 $PID 2>/dev/null || break
  [ -s c/DBASE/CONFIG.DB ] && { sleep 5; break; }
  sleep 1
done
kill $KEYPID $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
[ -s c/DBASE/DBASE.EXE ] && [ -s c/DBASE/CONFIG.DB ] && [ -s c/DBASE/DBASE.VMC ] || {
  echo "install failed: no C:\\DBASE\\DBASE.EXE (see $TARGET/dbx.log; raise INSTALL_SECONDS)" >&2
  exit 1
}

# Done with the installer and the floppy images.
rm -rf c/SRC install.conf download/x
echo "Installed to $TARGET/c/DBASE."
