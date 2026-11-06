#!/usr/bin/env bash
# Rebuild the image and recreate the Project Hub container.
#
# `docker compose up -d --build` already stops+recreates on image change, but
# it silently no-ops if the build fails midway without `set -e`-equivalent
# checking here, so we check the build step explicitly before touching the
# running container — same reasoning as mission-control's restart.sh, which
# learned the hard way not to trust "it probably built fine".
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

HOST="${PH_HOST:-100.113.25.42}"
PORT="${PH_PORT:-3001}"

echo "building project-hub image…"
if ! docker compose build 2>&1 | tee /tmp/project-hub-build.log | tail -40; then
  echo "build failed — see /tmp/project-hub-build.log"
  exit 1
fi

echo "recreating container…"
docker compose up -d --force-recreate

for _ in $(seq 1 30); do
  sleep 0.5
  if curl -sf -o /dev/null "http://$HOST:$PORT/"; then
    echo "up: http://$HOST:$PORT/"
    exit 0
  fi
done

echo "server did not come up — recent logs:"
docker compose logs --tail 30 project-hub
exit 1
