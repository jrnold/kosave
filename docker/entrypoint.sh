#!/usr/bin/env bash
# entrypoint.sh [DOS command ...]   With no arguments, starts the Kursk database main menu.
# Each argument is one DOS command, run from C:\DBASE\KURSK (the Kursk database), with the
# host folder mounted at /work visible as C:\WORK.
# Environment:
#   START      menu to open: "main" (default, Kursk main menu) or "reports" (report menu)
#   KEYS       keystrokes to feed in after SKIP_WAIT seconds, as xdotool tokens: a number sleeps,
#              key:NAME presses a key, type:TEXT types text. e.g. '2 type:25 key:Return'
#   KEYS_WAIT  seconds to wait before the first key (default 8)
#   SHOT_AT    space-separated seconds after start at which to save /work/shot-<s>.png
#   GUI        set to 1 to serve the display at http://localhost:6080/vnc.html (publish -p 127.0.0.1:6080:6080)
#   TIMEOUT    kill DOSBox-X after this many seconds (default 120; 0 = never, the default with GUI)
set -euo pipefail
C=/opt/kosave/c
K=$C/DBASE/KURSK
rm -rf "$C/WORK" && ln -s /work "$C/WORK"   # DOSBox-X follows the symlink

# dBASE reads CONFIG.DB from the current directory first. COMMAND runs KOSAVE.PRG at start.
sed -E 's/^COMMAND .*/COMMAND              = DO KOSAVE/' "$C/DBASE/CONFIG.DB" > "$K/CONFIG.DB"
case "${START:-main}" in
  main)    MENU=krskmenu ;;
  reports) MENU=repmenu ;;
  *) echo "START must be main or reports" >&2; exit 1 ;;
esac
printf 'SET TALK OFF\r\nDO %s\r\nQUIT\r\n' "$MENU" > "$K/KOSAVE.PRG"

if [ "$#" -eq 0 ]; then set -- 'dbase'; fi
cat > /tmp/dosbox.conf <<CONF
[sdl]
autolock=false
[dosbox]
memsize=16
machine=svga_s3
quit warning=false
[cpu]
cycles=max
[dos]
files=99
[autoexec]
mount c "$C" -nocachedir
c:
set PATH=C:\\DBASE;%PATH%
cd \\DBASE\\KURSK
$(printf '%s\n' "$@")
exit
CONF

export DISPLAY=:99
Xvfb :99 -screen 0 800x600x24 >/dev/null 2>&1 &
sleep 1
if [ -n "${GUI:-}" ]; then
  # VNC listens on loopback inside the container and needs a random password.
  # Publish the port on loopback only: -p 127.0.0.1:6080:6080
  VNCPASS=$(head -c12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
  x11vnc -storepasswd "$VNCPASS" /tmp/vncpass >/dev/null 2>&1
  x11vnc -display :99 -forever -shared -localhost -rfbauth /tmp/vncpass -quiet -rfbport 5900 >/tmp/x11vnc.log 2>&1 &
  websockify --web /usr/share/novnc 6080 localhost:5900 >/tmp/ws.log 2>&1 &
  echo "Open http://localhost:6080/vnc.html?autoconnect=1&resize=scale  password: $VNCPASS" >&2
fi
dosbox-x -conf /tmp/dosbox.conf -nopromptfolder -fastlaunch >/tmp/dbx.log 2>&1 &
PID=$!
for s in ${SHOT_AT:-}; do
  ( sleep "$s"; import -display :99 -window root "/work/shot-$s.png" ) &
done
if [ -n "${KEYS:-}" ]; then
  (
    sleep "${KEYS_WAIT:-8}"; xdotool mousemove 400 300
    for t in $KEYS; do
      case $t in
        key:*)  xdotool key --delay 100 "${t#key:}"; sleep 1 ;;
        type:*) xdotool type --delay 150 "${t#type:}"; sleep 1 ;;
        *)      sleep "$t" ;;
      esac
    done
  ) &
fi
[ -n "${GUI:-}" ] && : "${TIMEOUT:=0}"   # an interactive session has no timeout
if [ "${TIMEOUT:-120}" != 0 ]; then ( sleep "${TIMEOUT:-120}"; kill $PID 2>/dev/null ) & fi
wait $PID || true
