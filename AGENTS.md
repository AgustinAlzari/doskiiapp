# AGENTS.md — Normas del proyecto

## Verificación de build

**Siempre** al finalizar cualquier cambio de código, ejecutar `npm run build` para verificar que compila. Si falla, reparar el error antes de dar por terminada la tarea.

```bash
export PATH="/Users/edicionesalz/.local/node-v20.18.0-darwin-x64/bin:$PATH" && npm run build
```

## Datos de usuario (`data/`)

La carpeta `data/` en la raíz del repo **NO es código**: es una copia de los datos de la app (proyectos, personajes, tiras, fondos, objetos e imágenes de referencia).

- **Ubicación original en disco:** `~/Library/Application Support/dibuweb/data/` (la ruta exacta la resuelve Electron con `app.getPath('appData')`).
- La app lee y escribe SIEMPRE en la ubicación de Electron (`DATA_DIR` en `electron/main.js`), **nunca** en `data/`.
- `data/` existe solo como respaldo/portabilidad para llevar los datos entre máquinas.

### Restaurar los datos en una máquina nueva

Si la ubicación de Electron está vacía o no existe, copiar el contenido de `data/` a la ubicación real para que la app vea los proyectos:

```bash
# Detener la app primero
APP_DATA="$HOME/Library/Application Support/dibuweb/data"
mkdir -p "$APP_DATA"
cp -R data/backgrounds "$APP_DATA/" 2>/dev/null
cp -R data/characters "$APP_DATA/" 2>/dev/null
cp -R data/objects "$APP_DATA/" 2>/dev/null
cp -R data/balloons "$APP_DATA/" 2>/dev/null
cp -R data/projects "$APP_DATA/" 2>/dev/null
cp -R data/references "$APP_DATA/" 2>/dev/null
cp -R data/strips "$APP_DATA/" 2>/dev/null
```

> Verificar siempre que los `.json` copiados existan tras la restauración (`ls "$APP_DATA/projects/"`).

### Mantener `data/` actualizada

- **Siempre** que se creen/modifiquen datos en la app (proyectos, personajes, fondos, objetos, globos, viñetas, resultados, referencias), **sincronizar `data/` en el mismo commit** que los cambios de código, antes de cada push:
  ```bash
  cp -R "$HOME/Library/Application Support/dibuweb/data/" data/
  rm -rf data/refs-usadas data/cache data/.DS_Store
  git add data/ && git commit -m "sync data"
  ```
- No subir `refs-usadas/` ni `cache/` (carpetas temporales).

### Descargar los datos desde el repo (para otra máquina)

`data/` está versionado en el repo y **siempre queda al día con el último commit**, así que en otra máquina se baja directo con el clon:

```bash
git clone https://github.com/AgustinAlzari/doskiiapp.git
# y luego restaurar en la máquina nueva:
bash -c 'APP_DATA="$HOME/Library/Application Support/dibuweb/data"; mkdir -p "$APP_DATA"; cd doskiiapp && cp -R data/backgrounds data/characters data/objects data/balloons data/projects data/references data/strips "$APP_DATA/"'
```

> Si solo se quieren los datos sin todo el repo, se puede descargar `data/` desde el navegador: https://github.com/AgustinAlzari/doskiiapp/tree/main/data

