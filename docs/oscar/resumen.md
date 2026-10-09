# galería "esto es cine" — resumen y manual

link: https://agustinalzari.github.io/doskiiapp/oscar/
repo: AgustinAlzari/doskiiapp → carpeta `docs/oscar/` (rama main)
commit galería: 1f08d13 ("galería privada oscar en docs/oscar, sin linkear")

## qué es

galería web estática, estética doski (IBM Plex Mono, grises, botones 28px,
todo en minúsculas), para mostrar tiras a una persona interesada.

- portada: una sola imagen por tira (luz · telas · oficio, 4 png c/u).
- entrar a la tira: visor a pantalla completa (fondo negro, imagen completa).
- navegación: flechas ‹ ›, swipe lateral en celu, clic = siguiente,
  filmstrip abajo, contador, hash compartible (#luz-2).
- salida rápida: ← arriba a la izquierda, ×, esc, o swipe hacia abajo.
- descargas: por imagen (↓), por tira en .zip (JSZip por CDN, con fallback),
  botón "descargar todo".
- menú: filtrar por tira + "agregar imágenes" (solo sesión, no se suben).
- `noindex`: google no la indexa. no está linkeada desde el index de la web.
- ojo: el repo es público, así que es "no listada", no privada de verdad.

## estructura

```
docs/oscar/
  index.html        # toda la galería (una sola página)
  img/luz/*.png     # 4 imágenes 1122×1402
  img/telas/*.png
  img/oficio/*.png
  resumen.md        # este archivo
```

para agregar una tira nueva: copiar los png a `img/<nombre>/` (nombres en
minúsculas, con número adelante para ordenar: `1-....png`) y agregar la
entrada en `BASE_TIRAS` al principio del `<script>` de index.html.

## ver en local

```bash
python3 -m http.server 8099 --directory ~/Desktop/oscar-web
# abrir http://localhost:8099/
```

en esta máquina la copia de trabajo está en `~/Desktop/oscar-web/`
(fuera del repo, a propósito: no ensucia el push ni `docs/` local).

## cómo subir (desde cualquier lado)

`push.sh` excluye `docs/`, así que la galería se sube con script aparte
por la API de GitHub. necesita node 20+ y un token con permiso repo.
el token vive en `~/.config/doski/gh-token` (fuera del repo, nunca se sube;
en otra máquina, poner el token ahí o usar la variable `TOKEN`).

guardar como `/tmp/upload-oscar.cjs` y correr con node:

```js
// Sube ~/Desktop/oscar-web/ a docs/oscar/ del repo vía API de GitHub.
// Aditivo: no toca ningún otro archivo del repo.
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN = fs.readFileSync(
  path.join(os.homedir(), '.config/doski/gh-token'), 'utf8').trim();
const REPO = 'AgustinAlzari/doskiiapp';
const BRANCH = 'main';
const LOCAL = path.join(os.homedir(), 'Desktop/oscar-web');
const REMOTE_BASE = 'docs/oscar';

const gh = async (url, opts = {}) => {
  const res = await fetch(`https://api.github.com/${url}`, {
    method: opts.method || 'GET',
    headers: { Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json', 'User-Agent': 'doski-oscar-upload',
      ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  return data;
};

function collect(dir, base) {
  const out = {};
  for (const name of fs.readdirSync(dir)) {
    if (name === '.DS_Store' || name.startsWith('._')) continue;
    const full = path.join(dir, name);
    const rel = path.posix.join(base, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) Object.assign(out, collect(full, rel));
    else out[rel] = full;
  }
  return out;
}

async function main() {
  const files = collect(LOCAL, '');
  const names = Object.keys(files).sort();
  console.log('archivos a subir:', names.length);
  const head = await gh(`repos/${REPO}/commits/${BRANCH}`);
  const baseTreeSha = head.commit.tree.sha;
  console.log('head:', head.sha);
  const entries = [];
  let i = 0;
  for (const rel of names) {
    i++;
    const content = fs.readFileSync(files[rel]);
    console.log(`[${i}/${names.length}] subiendo ${rel}…`);
    const blob = await gh(`repos/${REPO}/git/blobs`, {
      method: 'POST',
      body: { content: content.toString('base64'), encoding: 'base64' },
    });
    entries.push({ path: `${REMOTE_BASE}/${rel}`, mode: '100644',
      type: 'blob', sha: blob.sha });
  }
  const newTree = await gh(`repos/${REPO}/git/trees`, {
    method: 'POST',
    body: { base_tree: baseTreeSha, tree: entries },
  });
  const commit = await gh(`repos/${REPO}/git/commits`, {
    method: 'POST',
    body: { message: 'actualiza galería oscar', tree: newTree.sha,
      parents: [head.sha] },
  });
  await gh(`repos/${REPO}/git/refs/heads/${BRANCH}`,
    { method: 'PATCH', body: { sha: commit.sha, force: false } });
  console.log('DONE commit:', commit.sha);
  console.log('ver:', `https://github.com/${REPO}/commit/${commit.sha}`);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
```

```bash
export PATH="$HOME/.local/node-v20.18.0-darwin-x64/bin:$PATH"  # si aplica
node /tmp/upload-oscar.cjs
```

notas:

- para subir un solo archivo (ej. este resumen), alcanza con subir solo ese
  path al mismo `REMOTE_BASE` (el script sube todo lo que haya en LOCAL;
  si LOCAL solo tiene el archivo, solo sube ese).
- github pages tarda ~1 min en publicar. verificar:
  `curl -s -o /dev/null -w "%{http_code}\n" https://agustinalzari.github.io/doskiiapp/oscar/`
- no linkear la galería desde `docs/index.html` (la gracia es que sea un
  link aparte que solo se pasa a mano).
- si la máquina que maneja la web hace push de `docs/`, que no borre
  `docs/oscar/`.
