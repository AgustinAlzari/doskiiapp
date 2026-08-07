# RESUMEN DEL PROYECTO — @doski (DibuWeb)

Documento para re-crear el entorno en otra máquina. Pegar esta sección en la IA de casa como contexto.

---

## 1. Repositorio

- **URL:** `https://github.com/AgustinAlzari/doskiiapp`
- **Rama:** `main` (tiene 3 commits: código base, estado actual, datos de usuario)
- Clonar: `git clone https://github.com/AgustinAlzari/doskiiapp.git`

---

## 2. Requisitos / Instalación

- **Node.js:** v20.18.0 (se usa una copia local: `~/.local/node-v20.18.0-darwin-x64/bin`). En casa usar cualquier Node 20+ (LTS). Verificar con `node --version`.
- **npm** 10.x (viene con Node).
- Instalar dependencias: `npm install`
- **Xcode Command Line Tools:** en esta máquina NO funcionan y no se pudieron instalar (por eso se usa la API de GitHub con token en vez de git). En casa, si git no funciona, aplicar la solución documentada en la sección 7.

---

## 3. Cómo correr la app

```bash
npm install
npm run dev        # abre Electron con Vite (port 5173)
npm run build      # compila a dist/ (verificar siempre tras cambios)
```

Stack: **Electron + Vite + React 18 + Zustand + Tailwind CSS 3**. App desktop local (Electron maneja archivos, ventanas y datos).

Estructura clave:
- `electron/main.js` — proceso principal, IPC, directorio de datos (`DATA_DIR`)
- `electron/preload.js` — bridge seguro entre React y Electron
- `src/App.jsx` — raíz de la UI
- `src/store/*.js` — stores Zustand (project, character, strip, background, object)
- `src/components/projects/` — gestión de proyectos (Form, List, PaletteEditor)
- `src/components/editor/` — editor de tiras (PanelCanvas, BalloonBlock, StripEditor, etc.)
- `src/services/promptGenerator.js` — genera el prompt para el modelo

---

## 4. Los datos de usuario (`data/`)

La carpeta `data/` en la raíz del repo es una **copia de seguridad** de los datos de la app. **NO es donde la app lee/escribe.**

- **Ubicación real (Electron):** `~/Library/Application Support/dibuweb/data/` (la resuelve `app.getPath('appData')` en `electron/main.js`).
- La app lee/escribe SIEMPRE ahí, nunca en `data/`.
- `data/` existe solo para portabilidad entre máquinas.

### Restaurar los datos en la máquina de casa

Con la app **cerrada**, ejecutar:

```bash
APP_DATA="$HOME/Library/Application Support/dibuweb/data"
mkdir -p "$APP_DATA"
cp -R data/backgrounds "$APP_DATA/" 2>/dev/null
cp -R data/characters "$APP_DATA/" 2>/dev/null
cp -R data/objects "$APP_DATA/" 2>/dev/null
cp -R data/projects "$APP_DATA/" 2>/dev/null
cp -R data/references "$APP_DATA/" 2>/dev/null
cp -R data/strips "$APP_DATA/" 2>/dev/null
```

Verificar: `ls "$APP_DATA/projects/"` → debe aparecer `6448d0d0-...json`.

### Contenido actual de los datos

- **1 proyecto:** "Ansiedad" (género absurdo nórdico, adultos, irónico, extraño; estilo "Sempé pero con líneas dudosas"; B/N, formato cuadrado, 1 panel)
- **2 personajes:** Carlos, Paola
- **2 fondos**
- **1 objeto:** microondas abandonado
- **3 tiras** (incluye "sigue su camino", el foco de las correcciones)
- **Imágenes de referencia:** bosque, camino_rural, carlos, paola, microondas_abandonado + layouts SVG/JPG

### Sincronizar de vuelta al repo (antes de push)

```bash
cp -R "$HOME/Library/Application Support/dibuweb/data/" data/
rm -rf data/refs-usadas data/cache data/.DS_Store
```

---

## 5. Pendientes (CORRECCIONES_PRIORITARIAS.md)

Revisión de la tira "sigue su camino" (`52e3b3bf-layout-1.jpg`). Lo urgente:

1. **Eliminar el quinto globo** — "Ese microondas es mío, Carlos" aparece 2 veces; deben ser exactamente 4 globos.
2. **Intercambiar verticalmente globos de Paola** — el globo 1 (y≈9%) arriba, el globo 3 (y≈24%) abajo; orden de lectura 1→2→3→4.
3. **Cola punteada del globo 3** → debe ser cola sólida ondulada (la punteada solo une globos del mismo hablante).
4. **Falta la lauchita** en la nota del microondas y el líquido chorreando no se distingue.
5. **Horizonte a 63%** de la altura (hoy ~52–55%).
6. **Carlos debe mirar a Paola.**
7. Varias correcciones al prompt en `src/services/promptGenerator.js` (zona "lower" vs y 9–31%, "arms crossed" vs "manos en la cintura", "his balloon" → neutro/género correcto, orden de lectura por coordenadas).
8. `PanelCanvas.jsx` / `PromptExporter.jsx`: dibujar la cola SÓLIDA y la conexión entre globos punteada.
9. Tipeos en datos: "Paolla" y "mio" se reproducen verbatim (corregir en la fuente de datos si son errores).

---

## 6. Datos de acceso al repo (importante)

- Usar un token de GitHub personal (classic) con permiso `repo`. **No escribirlo en archivos del repositorio** (GitHub los bloquea por secret scanning); guardarlo en el entorno o en un lugar seguro fuera del repo.
- Regenerar el token en https://github.com/settings/tokens cuando sea necesario.

---

## 7. Push sin git local (workaround por falta de Command Line Tools)

En esta máquina git no funciona (faltan Xcode Command Line Tools y no se pudieron instalar). Se usó la **API de GitHub v3** con curl. El script de push vive en `/tmp/push_to_github.py` (en casa conviene guardarlo en el repo).

Cómo funciona:
1. `GET /repos/{owner}/{repo}/git/refs/heads/main` → SHA del commit actual
2. Por cada archivo: `POST /git/blobs` (texto utf-8 o base64 si es binario)
3. `POST /git/trees` con todos los blobs
4. `POST /git/commits` con `parents: [sha_actual]`
5. `PATCH /git/refs/heads/main` con el nuevo SHA

Datos clave del script:
- Repo: `AgustinAlzari/doskiiapp`
- Auth: header `Authorization: token <TOKEN>`
- Payloads grandes → escribir a archivo temp y usar `curl -d @archivo` (evita "Argument list too long")
- Ignora: `node_modules/`, `dist/`, `.git/`, `refs-usadas/`, `cache/`, `.DS_Store`

---

## 8. Notas generales

- **AGENTS.md** del repo documenta todo esto (build, datos, restauración) y ya está subido.
- La app se llama **@doski** y es un "Compositor de prompts para historietas estilo nórdico/Sempé".
- Último commit subido: `78fbbe8a` "Add user data folder and restoration docs" (67 archivos).
