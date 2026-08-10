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

### Sincronizar con el repo (`sync.sh`)

Hay un script `sync.sh` en la raíz que maneja la copia en ambas direcciones:

```bash
./sync.sh pull     # repo → ubicación de Electron (máquina nueva o recién clonado)
./sync.sh push     # Electron → repo (antes de subir a GitHub)
./sync.sh status   # compara qué carpetas difieren
```

> El script solo copia las carpetas de datos (`backgrounds`, `balloons`, `characters`, `objects`, `projects`, `references`, `strips`). Nunca copia `refs-usadas/`, `cache/` ni `.DS_Store`. Detener la app antes de `pull`.

### Restaurar los datos en una máquina nueva

```bash
./sync.sh pull
ls "$HOME/Library/Application Support/dibuweb/data/projects/"
```

### Mantener `data/` actualizada (antes de push)

```bash
./sync.sh push
git add data/ && git commit -m "sync data" && git push
```

### Descargar los datos desde el repo (para otra máquina)

```bash
git clone https://github.com/AgustinAlzari/doskiiapp.git
cd doskiiapp && ./sync.sh pull
```

> Si solo se quieren los datos sin todo el repo, se puede descargar `data/` desde el navegador: https://github.com/AgustinAlzari/doskiiapp/tree/main/data

