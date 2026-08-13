# AGENTS.md — Normas del proyecto

## Verificación de build

**Siempre** al finalizar cualquier cambio de código, ejecutar `npm run build` para verificar que compila. Si falla, reparar el error antes de dar por terminada la tarea.

```bash
export PATH="/Users/edicionesalz/.local/node-v20.18.0-darwin-x64/bin:$PATH" && npm run build
```

## Subir el código a GitHub (`push.sh`)

En esta máquina **git local NO funciona** (faltan las Xcode Command Line Tools), así que el push se hace **vía la API de GitHub** con el token guardado en `~/.config/doski/gh-token` (fuera del repo, nunca se sube). No instalar Xcode ni git: usar siempre `push.sh`.

```bash
./push.sh "mensaje del commit"
```

> **Sube SOLO código** (`src/`, `electron/`, raíz). **NUNCA sube `data/`**, `node_modules/`, `dist/` ni `release/`. Los datos se sincronizan por separado con `./sync.sh`. Si ya existe `dist/` y `release/` locales, no afectan el push (se excluyen por nombre).

Detrás de escena: `push.sh` llama a `node electron/push-script.cjs "<msg>"`, que arma el commit con la API (`git/trees`, `git/commits`, `git/refs/heads/main`) comparando contra el último commit remoto y subiendo solo blobs nuevos/cambiados.

## Textos de la interfaz (Ley de minúsculas)

Todos los textos visibles de la UI —menús del sidebar, encabezados (`h1`), botones, etiquetas, placeholders y mensajes— van **en minúsculas**, estilo de escritura en español (nunca Title Case ni CamelCase).

Excepciones permitidas:
- Nombres propios y marcas: `ChatGPT`, `Gemini`, `Claude`.
- Siglas y formatos de archivo: `PNG`, `JPEG`, `WebP`, `IA`.
- Atajos de teclado: `Ctrl+Z`, `⌘C`.

> Los nombres de los **modelos de IA** van en minúsculas (`chatgpt`, `gemini`, `claude`), como todo texto de la UI.

Ejemplos correctos: `viñetas`, `preview y export`, `modelo`, `nueva viñeta`, `exportar limpio`, `horizonte`, `grilla`.

## Jerarquía tipográfica (ley de importancia y tamaños)

Escala fija definida en `src/index.css`. Nunca usar tamaños ad-hoc fuera de esta escala; aplicar las clases en vez de estilos inline.

| Clase | Uso | Tamaño / peso |
| --- | --- | --- |
| `.ui-h1` | títulos de sección (viñetas, personajes, modelo...) | 18px / 700 |
| `.ui-h2` | encabezados de vista y de editor (prompts — título, modelo, título de la viñeta) | 16px / 700 |
| `.ui-h3` | títulos de tarjetas (viñeta, personaje, objeto en las grillas) | 14px / 600 |
| `.label` | etiquetas de campo | 12px / 600 |
| cuerpo | texto general (default) | 14px |
| `.ui-muted` | metadatos y ayudas | 11px / muted |

Colores por importancia: principal `var(--color-text)`, secundario `var(--color-text-2)`, atenuado `var(--color-text-muted)`. Los títulos usan SIEMPRE `var(--color-text)` (nunca `--color-title`).

## Navegación (ley de la flecha de retorno)

Toda acción de volver / cancelar / cerrar se representa con la flecha de retorno `←` (nunca con texto "volver", "cancelar", "cerrar"), colocada SIEMPRE **arriba a la izquierda** de la pantalla. Esto incluye los previews (galería "ver" y preview de imagen). Los previews se renderizan por encima de la zona de arrastre del título (`z-index` > 9999) para que la flecha sea clickeable. La flecha es **texto plano, sin recuadro** (clase `.back-arrow`: sin borde, sin fondo, sin caja) en ningún caso.

## Ley de color (sin acentos de color)

Eliminar todo uso de colores de acento (el azul `--color-accent` y cualquier otro acento) en la UI: **los botones van en gris neutro**, sin estados coloreados (primary, danger, selección, foco, indicadores, checkmarks). Único elemento que conserva color: el título (`--color-title`). Nada más debe tener color: bordes, selecciones, líneas de inserción y focos en gris/neutro. `--color-accent` se define como gris.

## Controles uniformes (botones, inputs y selects)

Todos los botones se ven igual —como "exportar todas"—: gris, borde, radio y **alto fijo de 28px**, sin variantes coloreadas (`btn-primary`, `btn-ghost` y `btn-danger` se ven igual que `btn`). Los inputs y selects (`.input`, `.time-pill`, `.radio-pill`) usan el **mismo alto de 28px** para que queden alineados junto a los botones en menús y barras. No agregar altos ad-hoc en controles de UI.

**El fondo del botón es SIEMPRE igual al fondo sobre el que está** (`.btn` usa `background: transparent`, así que sobre blanco el botón es blanco y sobre gris es gris); al pasar el mouse se oscurece levemente.



## Datos de usuario (`data/`)

La carpeta `data/` en la raíz del repo **NO es código**: es una copia de los datos de la app (autores, proyectos, personajes, tiras, fondos, objetos, globos, paletas e imágenes de referencia).

- **Ubicación original en disco:** `~/Library/Application Support/dibuweb/data/` (la ruta exacta la resuelve Electron con `app.getPath('appData')`).
- La app lee y escribe SIEMPRE en la ubicación de Electron (`DATA_DIR` en `electron/main.js`), **nunca** en `data/`.
- `data/` existe solo como respaldo/portabilidad para llevar los datos entre máquinas.

### Sincronizar con el repo (`sync.sh`)

Hay un script `sync.sh` en la raíz que maneja la copia en ambas direcciones:

```bash
./sync.sh pull     # repo → ubicación de Electron (máquina nueva o recién clonado)
./sync.sh push     # Electron → repo (antes de subir a GitHub)
./sync.sh status   # compara qué carpetas difieren
```

> El script solo copia las carpetas de datos (`authors`, `backgrounds`, `balloons`, `characters`, `objects`, `palettes`, `projects`, `references`, `strips`). Nunca copia `refs-usadas/`, `cache/`, `.sync-backup/` ni `.DS_Store`. Detener la app antes de `pull`.

> **Sync seguro:** `sync.sh` compara por fecha de modificación (más nuevo gana) y **no pisa archivos más nuevos** en el destino. Si el origen es más nuevo, respalda primero el destino en `data/.sync-backup/` (un solo backup por archivo) y recién después reemplaza. `data/.sync-backup/` está en `.gitignore`.

### Restaurar los datos en una máquina nueva

```bash
./sync.sh pull
ls "$HOME/Library/Application Support/dibuweb/data/projects/"
```

### Mantener `data/` sincronizada

Los datos **no se suben con `push.sh`** (que solo sube código). `data/` se respalda en la nube con el autobackup (`electron/backup.js` → Drive) y, si se quiere portabilidad por repo, se copia con:

```bash
./sync.sh push     # Electron → repo (copia local en data/)
./sync.sh status   # compara qué carpetas difieren
```

> `sync.sh push` copia los datos a `data/` local; eso no genera un commit de GitHub (el repo de la app solo recibe código vía `push.sh`).

### Descargar los datos desde el repo (para otra máquina)

```bash
git clone https://github.com/AgustinAlzari/doskiiapp.git
cd doskiiapp && ./sync.sh pull
```

> Si solo se quieren los datos sin todo el repo, se puede descargar `data/` desde el navegador: https://github.com/AgustinAlzari/doskiiapp/tree/main/data

## Backup automático en la nube (`electron/backup.js`)

El backup automático **no usa git**: sube los datos a **Google Drive vía rclone** (`gdrive:doski-backup`, carpeta única). Config en `~/Library/Application Support/dibuweb/backup.json`:

```json
{ "enabled": true, "mode": "online", "provider": "rclone", "rclone": { "remote": "gdrive:doski-backup" } }
```

- **Sin menú de inicio**: no se pregunta nada al abrir. El **switch maestro** está en el sidebar (sincronizar / no sincronizar) y por defecto **encendido (en línea)**. Apagar el switch = modo local (autobackup apagado, nada toca la nube).
- **Regla del autobackup**: ON ⇔ `enabled` Y modo = en línea Y **proyecto activo no es "solo local"**.
- **Sincronización bidireccional segura** (modo en línea): sube en cada cambio y **descarga antes de abrir un proyecto** (`rclone copy --update`, más nuevo gana, **nunca pisa un archivo más actual**). La descarga lista la nube, excluye tombstones y proyectos "solo local", y los archivos locales que la nube reemplaza quedan respaldados en `.sync-backup/cloud` (nada se pierde en silencio).
- **Borrados con tombstone**: al borrar algo que está en la nube avisa *"se pierde para siempre"*; registra el borrado en `.tombstones.json` (en la nube) para que no reviva en otra máquina. Si el trabajo local es más nuevo que el borrado, gana lo local.
- Solo sube el "conjunto nube" (excluye proyectos con `cloudBackup: false`). Los proyectos tienen un switch **"solo local / local + nube"**.
- `rclone copy` es **aditivo**: nunca borra nada en la nube (salvo borrados confirmados con tombstone).
- **Configuración una sola vez:** `brew install rclone` y `rclone config` (remoto `gdrive`, OAuth en el navegador). El usuario final no ve nada de esto.
- El provider `git` queda como respaldo pero no es el default. Los commits "backup" ya no tocan el repo de la app.
- Cada entidad guarda `savedAt` (fecha de guardado local) y `id` uuid robusto (validado al migrar).

### Máquina nueva / restauración segura

1. **No abrir la app todavía** (si no hay datos, crearía un "proyecto principal" por defecto; y una versión vieja con backup git ensuciaría el repo).
2. `git clone https://github.com/AgustinAlzari/doskiiapp.git` y `cd doskiiapp && npm install`.
3. (Opcional, sin Drive) `./sync.sh pull` para traer `data/` del repo.
4. `brew install rclone && rclone config` (remoto `gdrive`, una sola vez).
5. Abrir la app → por defecto está **en línea**, descarga lo más nuevo de Drive antes de abrir (baja todo si la máquina está limpia).

**Garantías al arrancar en modo en línea:** nunca pisa un archivo local más nuevo (`--update`), no borra archivos locales salvo tombstones con fecha más vieja, excluye proyectos "solo local", y lo que la nube reemplaza queda respaldado en `.sync-backup/cloud`.



