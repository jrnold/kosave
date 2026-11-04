# dBASE IV 2.0 for DOS under DOSBox-X, running the Kursk database (KOSAVE II) and its reports.
#
#   docker build -f docker/Dockerfile --build-arg DBASE4_URL=<url> -t kosave .  # from the repo root
#   docker run --rm -e GUI=1 -p 127.0.0.1:6080:6080 kosave  # then open http://localhost:6080/vnc.html
#
# The build downloads dBASE IV from DBASE4_URL, so the image contains copyrighted software:
# keep it local and never push it to a public registry.
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl 7zip dosbox-x xvfb xauth xdotool imagemagick \
    && ln -s /usr/bin/7z /usr/local/bin/7zz \
    && rm -rf /var/lib/apt/lists/*

ARG DBASE4_URL
ARG DBASE4_SHA256
COPY docker/setup.sh /opt/kosave/
# setup.sh runs the installer under DOSBox-X, which needs a display.
RUN cd /opt/kosave && xvfb-run -a ./setup.sh /opt/kosave/emu \
    && mv emu/c /opt/kosave/c && rm -rf emu

# The Kursk database. KURSK.EXE is a self-extracting archive of the 146 database files; 7-Zip
# unpacks it, so no DOS is needed.
COPY data/raw/kosave/DATABASE/KURSK.EXE /tmp/KURSK.EXE
RUN mkdir -p /opt/kosave/c/DBASE/KURSK \
    && 7zz x -y -o/opt/kosave/c/DBASE/KURSK /tmp/KURSK.EXE >/dev/null \
    && rm /tmp/KURSK.EXE

# For GUI=1: serve the display in a browser through VNC and noVNC.
RUN apt-get update && apt-get install -y --no-install-recommends x11vnc novnc websockify \
    && rm -rf /var/lib/apt/lists/*

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
WORKDIR /work
ENTRYPOINT ["entrypoint.sh"]
