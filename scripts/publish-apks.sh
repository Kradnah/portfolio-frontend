#!/bin/bash
# Publica en el portfolio la última APK de pasajero y de conductor de rideapp.
#   Origen:  D:\Server\rideapp-apks (lo llena rideapp/scripts/build-apks.sh)
#   Destino: VPS ~/portfolio-files/downloads, montada en el contenedor del portfolio en /downloads/
#
# Uso (Git Bash):  scripts/publish-apks.sh
# Sube solo lo que cambió, deja únicamente la última versión de cada app y regenera apks.json.
# Usa como mucho tres conexiones SSH: muchas seguidas activan el bloqueo del servidor (fail2ban).
set -euo pipefail

SRC=${RIDEAPP_APKS_DIR:-/d/Server/rideapp-apks}
HOST=${PORTFOLIO_HOST:-admin@161.97.96.66}
DEST=portfolio-files/downloads

latest() { # latest <app>: archivo con la versión semver más alta
  ls "$SRC"/rideapp-"$1"-*.apk 2>/dev/null |
    sed -E "s/.*rideapp-$1-([0-9.]+)\.apk/\1 &/" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1 | cut -d' ' -f2
}

files=() names=() entries=()
for app in pasajero conductor; do
  file=$(latest "$app")
  [ -n "$file" ] || { echo "No hay APK de $app en $SRC" >&2; exit 1; }
  name=$(basename "$file")
  bytes=$(stat -c %s "$file")
  version=$(echo "$name" | sed -E 's/.*-([0-9.]+)\.apk/\1/')
  files+=("$file") names+=("$name")
  entries+=("{\"app\":\"$app\",\"version\":\"$version\",\"file\":\"$name\",\"bytes\":$bytes}")
done

# 1) Qué hay ya en el servidor (nombre y tamaño).
remote=$(ssh "$HOST" "mkdir -p $DEST && chmod 755 portfolio-files $DEST && cd $DEST && stat -c '%n %s' *.apk 2>/dev/null || true")

# 2) Sube en una sola llamada las que faltan o cambiaron (como .part, para no servir archivos a medias).
upload=()
for i in "${!files[@]}"; do
  if grep -qx "${names[$i]} $(stat -c %s "${files[$i]}")" <<<"$remote"; then
    echo "== ${names[$i]} ya publicada"
  else
    echo "== subiendo ${names[$i]} ($(($(stat -c %s "${files[$i]}") / 1000000)) MB)"
    upload+=("${files[$i]}")
  fi
done
if [ ${#upload[@]} -gt 0 ]; then
  tmp=$(mktemp -d)
  for f in "${upload[@]}"; do ln -s "$f" "$tmp/$(basename "$f").part" 2>/dev/null || cp "$f" "$tmp/$(basename "$f").part"; done
  scp -q "$tmp"/*.part "$HOST:$DEST/"
  rm -rf "$tmp"
fi

# 3) Activa las subidas, borra versiones viejas y escribe el manifiesto.
manifest="{\"apks\":[$(IFS=,; echo "${entries[*]}")]}"
keep=$(printf "! -name %s " "${names[@]}")
ssh "$HOST" "cd $DEST && for p in *.apk.part; do [ -e \"\$p\" ] && mv \"\$p\" \"\${p%.part}\"; done; \
  find . -maxdepth 1 -name 'rideapp-*.apk' $keep -delete; chmod 644 *.apk; \
  cat > apks.json.tmp && chmod 644 apks.json.tmp && mv apks.json.tmp apks.json && ls -la" <<<"$manifest"
echo "== manifiesto: $manifest"
