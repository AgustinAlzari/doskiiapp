# doskii — compositor de prompts para historietas

herramienta creativa open source que pone la dirección creativa humana en el centro de la narrativa visual con IA.

> creada por [@legutix](https://instagram.com/legutix) — proyecto ejemplo incluido: **ansiedad**.

## qué es

doskii es una app de escritorio (Electron + Vite + React) para componer historietas por viñetas. cada viñeta es un panel con personajes, fondos, objetos, globos y referencias visuales. la app genera prompts estructurados para modelos de imagen (`muse-image-1.0` y compatibles) manteniendo estilo, composición y continuidad.

- editor visual con grilla, guías de composición y flechas de mirada/conexión
- prompts scene + lettering separados, con estilos globales y por viñeta
- exportación de imágenes limpias con metadatos (autor, título) y por lotes
- gestión de proyectos, personajes, fondos, objetos, globos, paletas y referencias
- chat IA embebido y generación iterativa

## requisitos

- Node.js 20+ (probado con v20.18.0)
- npm 10+
- macOS (Electron). para distribuir: `npm run dist` genera `.dmg` y `.zip` en `release/`.

## instalación

```bash
git clone https://github.com/AgustinAlzari/doskiiapp.git
cd doskiiapp
npm install
npm run dev      # vite en http://localhost:5173 + Electron
npm run build    # compila a dist/ (verificar siempre tras cambios)
npm run dist     # vite build + electron-builder --mac
```

## datos de usuario (`data/`)

`data/` en el repo es una copia de ejemplo/portabilidad de los datos de la app. la app lee y escribe en `~/Library/Application Support/dibuweb/data/` (resuelto por `app.getPath('appData')` en `electron/main.js`), nunca en `data/` directamente.

```bash
./sync.sh status   # compara Electron vs repo
./sync.sh pull     # repo → Electron (máquina nueva, app cerrada)
./sync.sh push     # Electron → repo (copia local, no hace commit)
```

el backup automático a la nube es vía `rclone` a `gdrive:doski-backup` (`electron/backup.js`), configurable en `~/Library/Application Support/dibuweb/backup.json`. ver `AGENTS.md` para detalles.

## proyecto de ejemplo

el repo incluye un único proyecto de ejemplo **ansiedad** (género absurdo, adultos, irónico, extraño) con 6 viñetas, 3 personajes, 3 fondos, etc. sin menciones a autores/estilos específicos — listo para usar como base.

## configuración de modelos

la app usa `muse-image-1.0` (image_generation) por defecto. configurá tu `MODEL_API_KEY` en la vista `modelos` → `muse api`. la key se guarda en `localStorage` (`museSecrets.js`) para el MVP; a futuro se migrará a `safeStorage` de Electron.

## scripts

- `npm run dev` — desarrollo con HMR
- `npm run build` — build de producción
- `npm run preview` — preview del build
- `npm run dist` — build + empaquetado macOS

## licencia

MIT — ver `LICENSE`. el código propio de doskii está bajo MIT.

las obras que crees **con** doskii (historietas, imágenes, prompts, textos) son tuyas y no quedan alcanzadas por esta licencia: podés usarlas y publicarlas como quieras.

componentes de terceros conservan sus licencias: `react`, `electron`, `vite`, `nspell`, `zustand`, `uuid` (MIT); `openai` (Apache-2.0); diccionarios hunspell de español en `src/assets/dictionaries/` (MPL/GPL/LGPL, origen LibreOffice); fuente IBM Plex Mono vía Google Fonts (OFL). el contenido de ejemplo en `data/` y `docs/assets/` es de autoría propia del proyecto y se publica bajo MIT.
