#!/usr/bin/env bash
# sync.sh — sincroniza los datos de la app (@doski) con la copia `data/` del repo.
#
# Uso:
#   ./sync.sh pull    # repo → ubicación de Electron (para máquina nueva / recién clonado)
#   ./sync.sh push    # ubicación de Electron → repo (antes de subir cambios a GitHub)
#   ./sync.sh status  # muestra qué carpetas tienen diferencias
#
# Los datos REALES de la app viven en la ubicación que resuelve Electron:
#   ~/Library/Application Support/dibuweb/data   (macOS)
# `data/` en el repo es solo una copia portátil para viajar entre máquinas.

set -euo pipefail

REPO_DATA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/data"
APP_DATA="${APP_DATA:-$HOME/Library/Application Support/dibuweb/data}"
# Solo copiamos estas carpetas (excluye refs-usadas/, cache/, .DS_Store)
SUBDIRS="authors backgrounds balloons characters objects palettes projects references strips"

ensure_app_dirs() {
  mkdir -p "$APP_DATA"
  for d in $SUBDIRS; do
    mkdir -p "$APP_DATA/$d"
  done
}

cmd_pull() {
  ensure_app_dirs
  echo "pull: repo -> Electron"
  echo "  destino: $APP_DATA"
  for d in $SUBDIRS; do
    if [ -d "$REPO_DATA/$d" ]; then
      cp -R "$REPO_DATA/$d/." "$APP_DATA/$d/"
      echo "  ✓ $d"
    else
      echo "  - $d (no existe en repo)"
    fi
  done
  echo "Verifica: ls \"$APP_DATA/projects/\""
}

cmd_push() {
  ensure_app_dirs
  echo "push: Electron -> repo"
  echo "  origen: $APP_DATA"
  for d in $SUBDIRS; do
    mkdir -p "$REPO_DATA/$d"
    if [ -d "$APP_DATA/$d" ]; then
      cp -R "$APP_DATA/$d/." "$REPO_DATA/$d/"
      echo "  ✓ $d"
    else
      echo "  - $d (vacío)"
    fi
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
    a=$(find "$APP_DATA/$d" -type f 2>/dev/null | wc -l | tr -d ' ')
    b=$(find "$REPO_DATA/$d" -type f 2>/dev/null | wc -l | tr -d ' ')
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
