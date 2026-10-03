#!/bin/bash
# Publica en el portfolio la última APK de pasajero y de conductor de rideapp.
#   Origen:  D:\Server\rideapp-apks (lo llena rideapp/scripts/build-apks.sh)
#   Destino: VPS ~/portfolio-files/downloads, montada en el contenedor del portfolio en /downloads/
#
# Uso (Git Bash):  scripts/publish-apks.sh
# Sube solo lo que cambió, deja únicamente la última versión de cada app y regenera apks.json.
set -euo pipefail

SRC=${RIDEAPP_APKS_DIR:-/d/Server/rideapp-apks}
HOST=${PORTFOLIO_HOST:-admin@161.97.96.66}
DEST=portfolio-files/downloads

# Una sola conexión SSH reutilizada: muchas conexiones seguidas activan el bloqueo del servidor.
CTL="$(mktemp -u)"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=120)
ssh() { command ssh "${SSH_OPTS[@]}" "$@"; }
scp() { command scp "${SSH_OPTS[@]}" "$@"; }
trap 'command ssh -o ControlPath="$CTL" -O exit "$HOST" 2>/dev/null || true' EXIT

latest() { # latest <app>: archivo con la versión semver más alta
  ls "$SRC"/rideapp-"$1"-*.apk 2>/dev/null |
    sed -E "s/.*rideapp-$1-([0-9.]+)\.apk/\1 &/" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1 | cut -d' ' -f2
}

ssh "$HOST" "mkdir -p $DEST && chmod 755 portfolio-files $DEST"

entries=()
for app in pasajero conductor; do
  file=$(latest "$app")
  [ -n "$file" ] || { echo "No hay APK de $app en $SRC" >&2; exit 1; }
  name=$(basename "$file")
  version=$(echo "$name" | sed -E 's/.*-([0-9.]+)\.apk/\1/')
  bytes=$(stat -c %s "$file")
  if ssh "$HOST" "[ \"\$(stat -c %s $DEST/$name 2>/dev/null)\" = $bytes ]"; then
    echo "== $name ya publicada"
  else
    echo "== subiendo $name ($((bytes / 1000000)) MB)"
    scp -q "$file" "$HOST:$DEST/$name.part"
    ssh "$HOST" "mv $DEST/$name.part $DEST/$name && chmod 644 $DEST/$name"
  fi
  # Borra versiones anteriores de esta app.
  ssh "$HOST" "find $DEST -name 'rideapp-$app-*.apk' ! -name '$name' -delete"
  entries+=("{\"app\":\"$app\",\"version\":\"$version\",\"file\":\"$name\",\"bytes\":$bytes}")
done

manifest="{\"apks\":[$(IFS=,; echo "${entries[*]}")]}"
ssh "$HOST" "cat > $DEST/apks.json.tmp && chmod 644 $DEST/apks.json.tmp && mv $DEST/apks.json.tmp $DEST/apks.json" <<<"$manifest"
echo "== manifiesto: $manifest"
