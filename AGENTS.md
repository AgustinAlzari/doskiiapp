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
cp -R data/projects "$APP_DATA/" 2>/dev/null
cp -R data/references "$APP_DATA/" 2>/dev/null
cp -R data/strips "$APP_DATA/" 2>/dev/null
```

> Verificar siempre que los `.json` copiados existan tras la restauración (`ls "$APP_DATA/projects/"`).

### Mantener `data/` actualizada

- Antes de cada push, si se crearon/modificaron datos en la app, sincronizar: `cp -R "$HOME/Library/Application Support/dibuweb/data/" data/` y eliminar `data/refs-usadas`, `data/cache` y `data/.DS_Store` si aparecen.
- No subir `refs-usadas/` ni `cache/` (carpetas temporales).
