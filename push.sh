#!/usr/bin/env bash
# push.sh — sube el CÓDIGO del repo a GitHub sin usar git local.
#
# En esta máquina git no funciona (faltan las Xcode Command Line Tools), así que
# se hace el push vía la API de GitHub con el token guardado en
# ~/.config/doski/gh-token (fuera del repo, nunca se sube).
#
# Uso:
#   ./push.sh "mensaje del commit"
#
# IMPORTANTE: solo sube código (src/, electron/, etc.). NUNCA sube data/,
# node_modules/, dist/ ni release/. Los datos se sincronizan con ./sync.sh.

set -euo pipefail

TOKEN_FILE="$HOME/.config/doski/gh-token"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "no hay token: $TOKEN_FILE" >&2
  exit 1
fi
TOKEN="$(cat "$TOKEN_FILE")"

REPO="AgustinAlzari/doskiiapp"
BRANCH="main"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export PATH="/Users/edicionesalz/.local/node-v20.18.0-darwin-x64/bin:$PATH"

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "falta el mensaje del commit: ./push.sh \"mensaje\"" >&2
  exit 1
fi

GIT_API_TOKEN="$TOKEN" GIT_API_REPO="$REPO" GIT_API_BRANCH="$BRANCH" GIT_API_ROOT="$ROOT" \
  node "$ROOT/electron/push-script.cjs" "$MSG"
