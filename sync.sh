#!/usr/bin/env bash
# sync.sh — sincroniza los datos de la app (@doski) con la copia `data/` del repo.
#
# Uso:
#   ./sync.sh pull    # repo → Electron (máquina nueva / recién clonado)
#   ./sync.sh push    # Electron → repo (antes de subir cambios a GitHub)
#   ./sync.sh status  # muestra qué carpetas tienen diferencias
#
# Sincronización SEGURA: compara por fecha de modificación y NO pisa archivos
# más nuevos. Si el origen es más nuevo que el destino, primero respalda el
# destino en la carpeta específica `data/.sync-backup/` (un backup por archivo,
# se reemplaza en cada sync) y recién después lo reemplaza. Nada se pierde.

set -euo pipefail

REPO_DATA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/data"
APP_DATA="${APP_DATA:-$HOME/Library/Application Support/dibuweb/data}"
# Solo copiamos estas carpetas (excluye refs-usadas/, cache/, .DS_Store y .sync-backup)
SUBDIRS="authors backgrounds balloons characters objects palettes projects references strips tiras"
BACKUP_NAME=".sync-backup"

ensure_app_dirs() {
  mkdir -p "$APP_DATA"
  for d in $SUBDIRS; do
    mkdir -p "$APP_DATA/$d"
  done
}

# Copia archivos de $src a $dst comparando por fecha (más nuevo gana).
# Los archivos del destino que se van a pisar quedan respaldados en la carpeta
# específica <destino-raiz>/.sync-backup/ (un solo backup por archivo).
copy_newer() {
  local src="$1" dst="$2" label="$3"
  if [ ! -d "$src" ]; then
    echo "  $label: sin origen"
    return 0
  fi
  mkdir -p "$dst"
  local backup_dir="$(dirname "$dst")/$BACKUP_NAME"
  local copied=0 replaced=0 skipped=0
  while IFS= read -r -d '' f; do
    local rel="${f#"$src"/}"
    local target="$dst/$rel"
    if [ ! -e "$target" ]; then
      mkdir -p "$(dirname "$target")"
      cp -p "$f" "$target"
      copied=$((copied + 1))
    elif [ "$f" -nt "$target" ]; then
      # respaldo del destino antes de pisarlo (un solo backup por archivo)
      mkdir -p "$backup_dir/$(dirname "$rel")"
      cp -p "$target" "$backup_dir/$rel"
      cp -p "$f" "$target"
      replaced=$((replaced + 1))
    else
      skipped=$((skipped + 1))
    fi
  done < <(find "$src" -type f ! -path "*/$BACKUP_NAME/*" -print0)
  echo "  $label: +$copied nuevos · $replaced reemplazados (backup en .sync-backup) · $skipped sin cambios"
}

cmd_pull() {
  ensure_app_dirs
  echo "pull: repo -> Electron (más nuevo gana, no pisa lo nuevo)"
  echo "  destino: $APP_DATA"
  for d in $SUBDIRS; do
    copy_newer "$REPO_DATA/$d" "$APP_DATA/$d" "$d"
  done
  echo "Verifica: ls \"$APP_DATA/projects/\""
}

cmd_push() {
  ensure_app_dirs
  echo "push: Electron -> repo (más nuevo gana, no pisa lo nuevo)"
  echo "  origen: $APP_DATA"
  for d in $SUBDIRS; do
    copy_newer "$APP_DATA/$d" "$REPO_DATA/$d" "$d"
  done
  rm -rf "$REPO_DATA/refs-usadas" "$REPO_DATA/cache" "$REPO_DATA/.DS_Store" 2>/dev/null || true
  find "$REPO_DATA" -name ".DS_Store" -delete 2>/dev/null || true
  echo "Listo. Ahora: git add data/ && git commit -m 'sync data' && git push"
}

cmd_status() {
  echo "Ubicaciones:"
  echo "  Electron: $APP_DATA"
  echo "  Repo:     $REPO_DATA"
  echo
  for d in $SUBDIRS; do
    local a=0 b=0
    if [ -d "$APP_DATA/$d" ]; then a=$(find "$APP_DATA/$d" -type f ! -path "*/$BACKUP_NAME/*" 2>/dev/null | wc -l | tr -d ' '); fi
    if [ -d "$REPO_DATA/$d" ]; then b=$(find "$REPO_DATA/$d" -type f ! -path "*/$BACKUP_NAME/*" 2>/dev/null | wc -l | tr -d ' '); fi
    flag="="
    [ "$a" != "$b" ] && flag="≠"
    printf "  %s  %-14s Electron:%s  Repo:%s\n" "$flag" "$d" "$a" "$b"
  done
}

case "${1:-}" in
  pull)   cmd_pull ;;
  push)   cmd_push ;;
  status) cmd_status ;;
  *) echo "Uso: $0 {pull|push|status}"; exit 1 ;;
esac
