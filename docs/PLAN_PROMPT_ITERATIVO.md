# Plan Prompt iterativo — Muse Image (vía fal.ai) + OpenCode Go/Zen + compositor

> Documento de especificación para implementación por otra IA. No ejecutar cambios; solo sirve de blueprint.
>
> **Objetivo:** la sección **Prompt** debe convertirse en un flujo visual iterativo completo:
> `referencias + texto → fal.ai → preview → análisis opcional OpenCode Go/Zen → corrección mínima → nueva iteración → aprobación de escena → diálogos (compositor propio / fal.ai / híbrido) → control opcional Go/Zen → iteraciones → resultado final`
> La decisión final (aprobar / iterar / cambiar método) siempre queda en manos del usuario.

**Decisiones cerradas con el usuario (2026-08-27):**
1. Generación **automática por API al tocar «generar»** (no copy-paste manual).
2. En **modelos** habrá un **cargador** de `endpoint + api key` por proveedor. Guardado en **usuario único local** (un solo usuario, sin multi-cuenta). Debe poder usar **cualquier modelo Go, incluidos los gratuitos de OpenCode Zen** con la misma API.
3. Del análisis se persiste solo `verdict + suggestion`.
4. `compositor propio` = editor actual de la viñeta (`PanelCanvas` + `StripEditor`) — ver §2.3.
5. Al aprobar se congela **solo la imagen generada**, no `panels[0]`.
6. **Máximo 5 versiones por viñeta**. Base de iteración **dentro del límite de 5** (1 base + ≤4 refs).

---

## 1. Estado actual — lo que la IA implementadora debe leer primero

### 1.1 Stack y convenciones de proyecto

* Electron + React 18 + Zustand + Vite. `package.json:13` dependencias solo `react`, `zustand`, `uuid`, `nspell`; no hay SDK de IA.
* Persistencia: 1 JSON por entidad en `~/Library/Application Support/dibuweb/data/<colección>/<id>.json` (`electron/main.js:114` `DATA_DIR`, `127` `ensureDataDirs`). Carpeta espejo `data/` en repo solo para portabilidad (`sync.sh`), nunca se sube con `push.sh` (`AGENTS.md`).
* **Verificación obligatoria:** `npm run build` tras cada fase (`AGENTS.md`).
* **Subida de código:** `./push.sh "mensaje"` (API GitHub via `electron/push-script.cjs`), no `git` local.
* **Leyes UI** (`AGENTS.md`, `src/index.css:1`):
  - Todo texto visible en minúsculas (excepciones: `ChatGPT/Gemini/Claude`, siglas `PNG/WebP`, atajos `Ctrl+Z`).
  - Escala tipográfica fija `.ui-h1 18px/700`, `.ui-h2 16px/700`, `.ui-h3 14px/600`, `.label 12px/600`, `.ui-muted 11px`.
  - Color: sin acento azul; `--color-accent` es gris `#6e6e73`. Botones `height:28px`, `background:transparent` (igual que el fondo donde están), sin variantes coloreadas. Inputs `.input`/`.time-pill`/`.radio-pill` también `28px`.
  - Navegación: toda vuelta con flecha `←` sola sin recuadro (`.back-arrow`) arriba-izq, `z-index>9999` para previews por encima de zona arrastre.

### 1.2 Modelo viñeta hoy

* `src/store/stripStore.js:3` — `strip = { id, projectId, title, generalStyle, aspectRatio, panels:[Panel], createdAt, updatedAt, savedAt, position, results:[{id,fileName,path,observations,pasted}], resultCoverIndex }`. Un solo panel (`panels[0]`) (`src/components/editor/StripEditor.jsx:119`).
* `Panel` (`StripEditor.jsx:120` + `src/data/actionPresets.js:99`): `scene`, `characters:[PanelCharacter]`, `backgroundId+background{x,y,w,h 0..1}`, `objects`, `narration`, `sfx`, `globosX`, `connections`, `horizon`, `grid`, `signature`, `shotType/hatch/timeTransition`, `zCounter`. `PanelCharacter` trae `dialogue/dialogueType/balloonId/linked/extraDialogues` etc.
* `ASPECT_RATIOS`: `hd 16:9`, `square 1:1`, `vertical 9:16`, `portrait-hd 9:16`, `ig-45 4:5`, `ig-11 1:1`, `ig-916 9:16`, `ig-191 1.91:1`.
* `src/utils/stripCover.js:7` `coverOf(strip)` — regla única para preview/export (si `resultCoverIndex===-1` → `null`, si `null` → último).
* `src/services/promptGenerator.js:917,934,954` — builders de texto: `generateScenePrompt` (con `LETTERING LOCK`), `generateLetteringPrompt` (con `SCENE LOCK` + `BALLOON GRAPHICS`), `generatePanelPrompt` unificado. Coordenadas en `%`, `layoutPrompt`, `orderedPanelDialogues`.
* `src/services/layoutSvg.js:36` `generateLayoutSVG(panel,…,mode='scene'|'lettering')` → SVG `400×H` (ratio del aspecto) con rects + horizonte + líneas de conexión. En `PromptExporter` se rasteriza a JPG 800×800 (`svgToJPG`) y se guarda vía `references:saveFile`.
* `src/components/chat/ChatPanel.jsx:112` — `<webview src={model.url}>` (modelos en `src/store/chatStore.js:4` `chatgpt/gemini/claude`), sin SDK, `new-window` → `shell.openExternal`. `src/components/chat/ChatLayout.jsx` hace `marginRight:520` cuando abierto. `electron/main.js:79` `webviewTag:true`.
* Referencias/imágenes: todas en `DATA_DIR/references/` (`electron/main.js:183` `resolveRefPath`, `239` `readMany`, `871` `saveFile`, `901` `paste` desde clipboard, `914` `startDrag`). `references:read(path)→dataURL`.
* Flujo Prompt actual (`src/components/export/PromptExporter.jsx:15`, `MAX_RESULTS=2:12`): `generateVectors` + tarjetas `escena | diálogos` + `copiar escena/diálogos` + `pegar resultado` manual + `observations` + `✓` cover + `abrir carpeta` (`openUsedFolder`). Sin iteración encadenada, sin aprobación, sin visión.

### 1.3 IPC actual

`electron/preload.js:3` expone `window.api`: `characters/strips/tiras/backgrounds/objects/balloons/referenceDefs/palettes/authors/projects: list/save/delete…`, `references: choose/import/read/readMany/openFolder/openUsedFolder/saveSvg/saveFile/paste/startDrag`, `clipboard: write/writeImage/readImage`, `export: save/saveToDir`, `dialog: save/open/openDirectory`, `chat:openExternal`, `backup:*`. Nada `ai:*` aún.

---

## 2. Objetivo funcional — 13 requisitos del usuario

1. **Generación escena con fal.ai (rol de Muse Image):** prompt texto + **hasta 5 imágenes** de ref (personaje/estilo/composición/objeto/escenario/viñeta anterior). Imagen queda en sección Prompt para revisión.
2. **Control escena con OpenCode Go/Zen:** no generan imagen; analizan visualmente la generada (con visión si el modelo la tiene), comprueban fidelidad a prompt+refs, detectan errores de composición/personaje/objeto/estilo, sugieren corrección y ayudan a redactar siguiente prompt.
3. **Iteración escena:** tras recibir imagen → aprobar / corrección manual / pedir análisis Go que proponga corrección. Si itera, **última imagen vuelve como base dentro de las 5** + nuevas instrucciones. Debe poder conservar/reemplazar/agregar refs.
4. **Aprobación escena:** preview claro; escena aprobada queda como **versión estable** (solo imagen congelada, no bloquea `panels[0]`) separada de futuros diálogos.
5. **Diálogos segunda etapa opcional:** tras aprobar → elegir `compositor propio` vs `fal.ai` vs híbrido.
6. **Diálogos vía fal.ai:** escena aprobada re-enviada como base + refs de globo (`ubicación/formas globos, imaginación, pensamiento, narrador, grito, efectos…`) + texto exacto + instrucciones. Debe conservar escena y modificar principalmente diálogos.
7. **No limitar a globos tradicionales:** contemplar diálogo, pensamiento, imaginación, narrador, grito, texto integrado, efectos, secuencias imaginadas, etc — por eso siempre mantener opción fal.ai.
8. **Control diálogos con Go/Zen visión:** comprueba fidelidad texto, ubicación globos, legibilidad, alteración innecesaria de escena, tipo globo, composición original. Devuelve evaluación + propuesta corrección re-enviable a fal.
9. **Iteración diálogos:** preview tras cada generación; aprobar / reeditar prompt / pedir sugerencia Go; cada iteración puede usar última imagen completa como base.
10. **Compositor como alternativa/complemento:** para globos simples permite preview instantáneo. Usuario decide caso a caso: todo compositor, todo fal, base compositor→fal, fal→corrección manual.
11. **Roles:** `fal.ai`= generación/edición visual, `Go/Zen`= análisis/visión/control/instrucciones, `compositor`= edición precisa de textos/elementos simples (definición §2.3).
12. **Versionado:** mantener todas las versiones; distinguir `escena original / aprobada / actual / anteriores / con diálogos / final`; volver a cualquier versión sin perder trabajo; **máximo 5 versiones**.
13. **Objetivo general:** flujo `referencias+texto → fal → preview → análisis Go opcional → corrección → nueva iteración → aprobación → diálogos manuales o con fal → control Go opcional → iteraciones → final`, decisión siempre del usuario.

---

## 2.3 Qué es «compositor propio»

No es motor de imagen. Es el **editor actual** `src/components/editor/PanelCanvas.jsx:733` + `src/components/editor/StripEditor.jsx:18` donde se arrastran personajes/objetos/fondo, se colocan `globo diálogo/pensamiento/grito/susurro` (`dialogueType`), `narración`, `globosX`, `sfx`, `horizon`, `firma`, etc. Genera vectores para `layoutSvg` y exporta PNG limpio vía `src/services/imageExport.js`. En este plan: para diálogos, el usuario puede resolver todo ahí, todo vía fal, o híbrido (exportar base del compositor a PNG y mandarla como `baseImage` a fal, o generar con fal y rematar manual). En la UI presentarlo como **«editor manual de la viñeta»**.

---

## 3. Decisiones cerradas — resumen

| # | Decisión |
|---|----------|
| D1 | Generación **automática por API** al tocar **«generar»** (no copy-paste manual). |
| D2 | Proveedor imagen = **fal.ai** con **una sola `FAL_KEY`** y elección de modelo por endpoint (`fal-ai/nano-banana/edit`, `fal-ai/nano-banana-2/edit`, `fal-ai/nano-banana-pro/edit`, `fal-ai/flux-2`, `fal-ai/z-image/turbo`, etc). Doc fal: `https://fal.run/<modelId>` + `Authorization: Key $FAL_KEY`. |
| D3 | Cargador `endpoint + api key` en **sección modelos** y guardado en **usuario único local**. Debe soportar **cualquier modelo Go, incluidos gratuitos de OpenCode Zen** (misma forma `endpoint/apiKey/model`). |
| D4 | Del análisis se persiste solo `verdict + suggestion`. |
| D5 | Al aprobar se congela **solo la imagen generada** (`lockedImage`), no `panels[0]`. |
| D6 | **Máximo 5 versiones** por viñeta. |
| D7 | **Base dentro de las 5**: micro-iteración envía `1 base + ≤4 refs = ≤5 URLs`. Primera generación sin base puede usar 5 refs. |
| D8 | Micro-iteración stateless: fal no guarda memoria, cada `generar` re-envía `image_urls` completas como `data URI` base64 leídas de `DATA_DIR/references/`. |

---

## 4. Investigación fal.ai — referencia rápida para el implementador

* **Unified API:** todos los modelos con mismo patrón (`fal.ai/docs/documentation/model-apis/overview`, `docs/model-api-reference`). `fal.config({credentials})` o `Authorization: Key $FAL_KEY`. Cliente JS `@fal-ai/client` hace `fal.subscribe(modelId, {input})` (cola `queue.fal.run` con `onQueueUpdate IN_PROGRESS`). Alternativa `curl POST https://queue.fal.run/<modelId>`.
* **Variantes:** `text-to-image` (`fal-ai/nano-banana`) y **`image-to-image/edit`** (`fal-ai/nano-banana/edit`, `fal-ai/nano-banana-2/edit`, `fal-ai/nano-banana-pro/edit`) — esta última recibe `image_urls: string[]` (URLs o `data:image/png;base64,...`). Para flujo iterativo usar siempre `…/edit` cuando haya base o refs; usar `…` (t2i) solo si 0 imágenes.
* **Parámetros por modelo:**
  - Comunes: `prompt`, `image_urls`, `num_images (1..4)`, `output_format (jpeg/png/webp)`, `seed`, `sync_mode`, `safety_tolerance` / `enable_safety_checker`.
  - Tamaño: unos usan `aspect_ratio ("1:1","16:9","9:16","4:3","3:4","4:5","21:9"…)` (ej `nano-banana-2`), otros `image_size (square_hd/landscape_4_3…)` o `{width,height}` (ej `flux`, `z-image`). Mapear desde `ASPECT_RATIOS` de app.
  - `z-image/turbo` añade `num_inference_steps 1..8`, `enable_prompt_expansion`.
* **Respuesta:** `{ images:[{url, file_name, content_type}], description, has_nsfw_concepts }`. La URL es CDN `storage.googleapis.com/falserverless/...` — el backend debe descargarla y guardarla en `DATA_DIR/references/` vía `references:saveFile`.
* **Auth:** `fal.ai/dashboard/keys` → Create Key (scope `API` alcanza; `ADMIN` solo para deploy Serverless). Setear `FAL_KEY` env o `fal.config`.
* **Subida:** se puede pasar `data URI` directo o subir antes vía `fal.storage.upload` (no necesario si ya tenemos `data URI` local).

Fuentes: `fal.ai/docs/model-apis/overview`, `docs/documentation/model-apis/authentication`, `docs/model-api-reference/image-generation-api/nano-banana`, `nano-banana-2/edit`, `z-image/turbo`, `flux-2/api`.

---

## 5. Arquitectura propuesta

### 5.1 Nuevo — usuario único + config IA

Hoy no existe usuario (`electron/main.js:122`, `src/store/*`). Añadir:

* **Físico:** `DATA_DIR/users/<id>.json` (viaja con `backup.js`) + espejo cifrado opcional `APP_DATA_DIR/ai-config.json` para keys. Carpeta `users` creada en `ensureDataDirs`.
* **`src/store/userStore.js`** (patrón `stripStore.js:3`):
  ```js
  // Zustand
  state: { users:[], currentUserId, loaded }
  user: {
    id, name,
    createdAt, updatedAt,
    falKey: string|null,                 // una sola key fal.ai
    falDefaultModel: string,             // ej "fal-ai/nano-banana-2/edit"
    opencode: { endpoint:string, apiKey:string, defaultModel:string } | null
  }
  methods: load(), save(user), getCurrent(), setCurrent(id)
  ```
  `currentUserId` en `localStorage doski:currentUser`. Keys cifradas con `safeStorage.encryptString` si `app.isPackaged` (nunca en claro en `data/` ni git).
* **IPC nuevos** (`electron/main.js:929`, `electron/preload.js:114` `api.ai.*`):
  ```
  ai:getConfig          → { falKey: "****", falDefaultModel, opencode:{endpoint,maskedKey,defaultModel} }
  ai:setConfig { falKey, falDefaultModel, opencode } → persist + return masked
  ai:testConnection { provider:'fal'|'opencode', endpoint?, model? } → { ok, error? }
  ai:generateImage { providerId, modelId, promptText, referencePaths[], baseImagePath?, aspectRatio, stripId, panelIndex }
  ai:analyzeImage  { imagePath, promptText, stage:'scene'|'dialogue', providerId, modelId }
  ```
  `ai:generateImage` y `ai:analyzeImage` viven en **main** (usan `net.request`/`fetch` y `fs`) para evitar CORS del renderer.

### 5.2 Sección modelos — cargador

Editar `src/components/ModelList.jsx:1` (hoy `name+url` webview):

* **Bloque fal.ai:**
  - `FAL Key` (input password, placeholder `fal_...`) + `modelo por defecto` (select curado: `fal-ai/nano-banana/edit`, `fal-ai/nano-banana-2/edit`, `fal-ai/nano-banana-pro/edit`, `fal-ai/flux-2/edit`, `fal-ai/z-image/turbo`, + `otro — escribir endpoint ID`). También `probar conexión` → `ai:testConnection`.
* **Bloque OpenCode Go / Zen:**
  - `endpoint` (ej `https://api.opencode.dev` o Zen `https://zen.opencode...`) + `api key` + `modelo` (select cargado vía `GET {endpoint}/models` si hay key, o input libre). `probar conexión` idem. Info: Zen gratuitos usan misma API.
* Mantener `DEFAULT_MODELS` webview (`chatStore.js:4`) intacto en su propio bloque. Nuevos inputs respetan leyes: `label 12px`, `input 28px`, `btn 28px` gris, minúsculas.

### 5.3 Servicio fal.ai — `src/services/falService.js` (nuevo)

```js
// Interfaz usada por PromptExporter
export async function generateImage({
  promptText,            // string
  referencePaths,        // string[] (≤4 si hay base, ≤5 si no)
  baseImagePath,         // string|null
  aspectRatio,           // "hd"|"square"|...
  modelId,               // "fal-ai/nano-banana-2/edit"
  falKey                 // desde userStore
}) {
  // 1. Resolver refs a dataURI via window.api.references.readMany(referencePaths)
  //    + baseImagePath si existe (ocupa 1 slot del total 5)
  // 2. Mapear aspectRatio app → fal param:
  //    - si modelo usa aspect_ratio → "16:9"/"1:1"/"9:16"/"4:5"/"3:4"…
  //    - si usa image_size → "landscape_4_3"/"square_hd"…
  // 3. Armar input:
  //    { prompt: promptText,
  //      image_urls: [...dataURIs], // ≤5, base primero
  //      num_images: 1,
  //      output_format: "png",
  //      aspect_ratio|image_size: mapped }
  // 4. POST https://queue.fal.run/<modelId> H Authorization: Key <falKey>
  //    → poll request_id (GET https://queue.fal.run/<modelId>/requests/<id>/status cada 500ms) hasta COMPLETED
  //    o usar fal.subscribe equivalente en Node.
  // 5. Descargar images[0].url (fetch) → Buffer → window.api.references.saveFile({fileName,data:base64})
  // 6. return { fileName, path }
}
```

* Si `referencePaths+base` está vacío y modelo es `…/edit` (requiere `image_urls`), forzar fallback a variante `t2i` sin `…/edit`.
* Comprimir refs a `jpeg 0.92` si `dataURI > 4MB` (evitar payload grande).
* Errores 401/429/timeout → throw con `code` para toast y no crear `Version` con `image:null`.

### 5.4 Servicio OpenCode — `src/services/opencodeService.js` (nuevo)

```js
export async function analyzeImage({ imagePath, promptText, stage, modelId }) {
  // main lee imagePath → dataURI, POST {endpoint}/chat/completions (OpenAI-compat)
  // system: "Eres auditor visual de viñetas. Devuelve JSON {verdict:'ok'|'issues', suggestion:string}"
  // user: promptText + refs list + image_url
  // checks escena: fidelidad prompt+refs, composición, personaje/objeto/estilo
  // checks diálogo: fidelidad texto, ubicación globos, legibilidad, alteración escena, tipo globo
  // return { verdict, suggestion }
}
```

Persiste solo esos dos campos en `Version.analysis`. Si modelo sin visión, envía solo texto con aviso.

### 5.5 Datos viñeta — `promptState` + tope 5 + solo imagen aprobada

Extender `strip` (retro-compatible, migración en `stripStore.load` `src/store/stripStore.js:7`):

```js
strip = {
  // ...campos existentes (id, projectId, title, generalStyle, aspectRatio, panels, results, resultCoverIndex…)
  promptState: {
    scene: {
      status: 'draft'|'approved',
      approvedVersionId: string|null,
      lockedImage: { fileName, path }|null, // copia congelada de la imagen aprobada
      lockedAt: ISO|null
    },
    dialogue: {
      mode: 'none'|'compositor'|'ai'|'hybrid',
      status: 'idle'|'draft'|'approved',
      approvedVersionId: string|null
    },
    versions: Version[],        // max 5, orden cronológico
    activeVersionId: string|null
  }
}

Version = {
  id,                           // uuid
  stage: 'scene'|'dialogue',
  parentId: string|null,        // de qué versión itera
  createdAt: ISO,
  promptText: string,           // prompt enviado a fal
  references: [{ fileName, path, kind }], // kind: personaje|estilo|composición|objeto|escenario|viñeta anterior|globo
  layoutFileName: string|null,  // sceneLayoutFileNameFor / letteringLayoutFileNameFor
  image: { fileName, path }|null,
  analysis: { modelId, verdict:'ok'|'issues', suggestion }|null,
  observations: string,         // nota manual (compat con results[].observations)
  meta: { source:'fal'|'opencode'|'manual', modelId }
}
```

**Reglas:**

* **Migración:** si `strip.promptState==null && strip.results?.length` → crear 1 `Version` por cada `result` (`stage:'scene'`, `image:result`, `observations:result.observations`), `coverOf` → `activeVersionId`, `resultCoverIndex` espejado.
* **Espejo legacy:** en cada `stripStore.save` si `promptState` existe, reconstruir `results` y `resultCoverIndex` desde `versions` para no romper `PreviewExport.jsx:94`, `StripCard.jsx:18`, `TiraView`.
* **Tope 5:** al guardar si `versions.length>5` evicción FIFO del más antiguo que **no sea** ningún `approvedVersionId` (scene ni dialogue). Si todos aprobados, rechazar nuevo con toast «alcanzaste 5 versiones, aprobá o descartá una». Avisar cuando se descarte.
* **Aprobar solo imagen:** `approveScene(versionId)` copia `image` a `scene.lockedImage` y setea `approvedVersionId+status='approved'+lockedAt`. `panels[0]` sigue editable en `StripEditor`.
* **Base dentro de 5:** en UI de iteración, contador `n/5` incluye base. Primera generación 0..5 refs; micro-iteración `1 base + ≤4 refs`.

### 5.6 UI Prompt — reemplazo de `PromptExporter.jsx`

Archivo principal a reescribir: `src/components/export/PromptExporter.jsx:15` (hoy tarjetas `escena|diálogos` + `generateVectors` + `MAX_RESULTS 2`).

**Estructura nueva:**

* **Header** (`section-header`): `←` (`back-arrow`) | `prompts — {strip.title}` (`ui-h2`) | stepper `escena → revisión → aprobada → diálogos → final` (`ui-muted`) | `modelo fal: {falDefaultModel}` (select) | `versiones n/5` | `abrir carpeta` | `copiar` (todo `btn 28px` gris).
* **Fase escena:**
  - Izquierda (360px): `textarea` prompt escena (pre-llenada `generateScenePrompt(panel,…,sceneLayoutFileNameFor)` editable, `prompt-output` style) + `ReferencePicker` (chips tipados, `0/5` → `5/5`, drag `references:startDrag`) + `layout escena` thumb + `generar` (primary `28px`, deshabilitado sin `falKey`).
  - Centro (flex): **preview grande** (`ImagePreview` `z-index>9999`, zoom) de `activeVersion.image` o placeholder `layout`. Acciones: `aprobar` (congela), `editar corrección`, `pedir análisis`.
  - Derecha (360px): `AnalysisPanel` (select modelo Go/Zen, `analizar imagen` → badge `verdict` + `suggestion` textarea + `usar como siguiente prompt`).
  - Debajo: `VersionTimeline` (5 thumbs `references:readMany`, click=activar, badge `original/aprobada/actual/anterior`, `volver a esta versión` solo cambia `activeVersionId`, sin perder trabajo).
  - Chips iteración: `conservar refs [✓]` + `usar última imagen como base [✓]` (por defecto ON, ocupa 1 slot). Botón `iterar corrección` no resetea refs ni layout.
* **Fase aprobación:** preview `lockedImage` grande, label `escena aprobada`, botón `desaprobar` (opcional) y selector diálogo `compositor | fal.ai | híbrido` (`radio-pill 28px`).
* **Fase diálogos:**
  - Gate `scene.status==='approved'` (sin aprobar no deja generar diálogos vía fal).
  - Si `mode==='compositor'|'hybrid'`: link `abrir en editor` → `StripEditor` (edita `panels[0]`), `exportar base a fal` (render `PanelCanvas` + `generateLayoutSVG` `lettering` → PNG → `references:saveFile` → `baseImage`).
  - Si `mode==='ai'|'hybrid'`: textarea diálogos (pre-llenado `generateLetteringPrompt` con `SCENE LOCK` + `BALLOON GRAPHICS`, editable) + picker refs globo (`ubicación/forma globo, imaginación, pensamiento, narrador, grito, efecto` — surge de `balloonStore` `kind` `speech/thought/narration/other/image` `promptGenerator.js:126`) + `texto exacto + instrucciones` + `generar diálogos` (siempre con `baseImage=lockedImage`, `image_urls ≤5`).
  - `AnalysisPanel` diálogos chequea: fidelidad texto, ubicación globos, legibilidad, alteración escena, tipo globo, composición.
  - Timeline diálogos filtrado `stage==='dialogue'`.

**Nuevos componentes (carpeta `src/components/prompt/`):**

* `ReferencePicker.jsx` — grid tipado, `0/5` contador incluye base, drag nativo, validación.
* `SceneIterationPanel.jsx` — prompt + refs + generar escena.
* `DialogueStagePanel.jsx` — selector modo + prompt diálogos + generar.
* `AnalysisPanel.jsx` — verdict/suggestion + usar sugerencia.
* `VersionTimeline.jsx` — thumbs, badges, volver, descartar.
* `src/services/promptIterationService.js` — helpers puros `createSceneVersion`, `createDialogueVersion`, `approveScene`, `evictIfNeeded`.

**Leyes UI a respetar:**

* Títulos `.ui-h2`, labels `.label`, muted `.ui-muted`, botones `btn btn-sm` `28px` `background:transparent`, sin azul. Flecha `←` sola sin borde. `ChatPanel` sigue `width:520` a la derecha (`marginRight:520` cuando `chatOpen`).

### 5.7 IPC detallado — `electron/main.js` + `preload.js`

En `electron/main.js:114-929` añadir tras `backup:*`:

```js
ipcMain.handle('ai:getConfig', async () => { /* lee APP_DATA_DIR/ai-config.json, decrypt */ })
ipcMain.handle('ai:setConfig', async (_, cfg) => { /* encrypt falKey/opencode.apiKey, write, return masked */ })
ipcMain.handle('ai:testConnection', async (_, { provider }) => { /* fal: POST queue.fal.run/<modelId> dummy, opencode: GET /models */ })
ipcMain.handle('ai:generateImage', async (_, payload) => {
  // lee falKey/opencode key descifrada, valida, llama falService (queue.fal.run), descarga url, saveFile, return {fileName,path}
})
ipcMain.handle('ai:analyzeImage', async (_, payload) => {
  // lee opencode key, lee imagePath→dataURI, POST OpenAI-compat /chat/completions, parse JSON verdict/suggestion
})
```

En `electron/preload.js:87` exponer `api.ai: { getConfig, setConfig, testConnection, generateImage, analyzeImage }`.

### 5.8 Flujo completo paso a paso (para testear)

1. Usuario carga `FAL Key` y elige `fal-ai/nano-banana-2/edit` en **modelos** + `opencode Zen` `endpoint+key+modelo` → `probar conexión` OK.
2. Abre viñeta → `editor` → `prompts`. Ve `ReferencePicker` `0/5` + prompt escena pre-llenado. Agrega 3 refs (personaje+estilo+composición) → `generar` → `ai:generateImage` con `image_urls=[3 dataURIs]`, `prompt`, `aspect_ratio` mapeado → poll → guarda `versions[0]` → preview grande.
3. Quiere corrección mínima: ve mano mal → quita ref mano, agrega ref correcta, edita prompt «corrige solo mano izquierda» → `generar` → payload `image_urls=[baseImage dataURI + 3 refs conservadas + 1 nueva =5]`, `prompt` editado → `versions[1]` con `parentId=versions[0].id` → preview compara.
4. Opcional: `analizar con Go/Zen` → `ai:analyzeImage` con `images[0]` → `verdict:'issues', suggestion:'añade “mano en primer plano”'` → `usar como siguiente prompt` → `generar` → `versions[2]`.
5. Satisfecho → `aprobar escena` → `scene.lockedImage=versions[2].image`, `status='approved'`.
6. Elige diálogos `hybrid`: edita `globosX` en compositor (`PanelCanvas`) → `exportar base` → vuelve a prompts diálogos, añade ref globo `pensamiento`, escribe texto exacto → `generar diálogos` → `image_urls=[lockedImage + refs globo ≤4]`, `prompt=generateLetteringPrompt` + instrucciones → `versions[3]` `stage='dialogue'`.
7. `analizar diálogos` (chequea legibilidad/ubicación/tipo globo) → `verdict/suggestion` → itera o `aprobar diálogos`.
8. `VersionTimeline` muestra `original(0)/aprobada(2)/actual(3)/anteriores`. Puede `volver a 1` sin perder 2/3 (solo cambia `activeVersionId`). Si crea 6ª versión, se evicta la más antigua no aprobada.
9. `preview y export` (`PreviewExport.jsx:94`) muestra `coverOf` (espejado a `lockedImage` si aprobada). `galleryOrder` + `position` inalterados.

---

## 6. Archivos a crear / modificar — checklist para implementadora

**Crear:**
* `src/store/userStore.js`
* `src/services/falService.js`
* `src/services/opencodeService.js`
* `src/services/promptIterationService.js`
* `src/components/prompt/ReferencePicker.jsx`
* `src/components/prompt/SceneIterationPanel.jsx`
* `src/components/prompt/DialogueStagePanel.jsx`
* `src/components/prompt/AnalysisPanel.jsx`
* `src/components/prompt/VersionTimeline.jsx`

**Modificar:**
* `src/components/export/PromptExporter.jsx:15` — rewrite completo a stepper + fases + preview + timeline.
* `src/store/stripStore.js:3,7,25` — `load` con migración `results→promptState`, `save` con espejo legacy + evicción 5.
* `src/utils/stripCover.js:7` — añadir helper `approvedCoverOf` opcional o respetar `coverOf` espejado.
* `electron/main.js:114,122,127,929` — `ensureDataDirs` con `users`, handlers `ai:*`, helpers `encrypt/decrypt`, lógica `falService` server-side.
* `electron/preload.js:1,80` — puente `api.ai`.
* `src/components/ModelList.jsx:1` — cargador `falKey/endpoint + modelo` + `opencode Zen` + `probar conexión`.
* `src/App.jsx:323` — mantener `←` y caso `prompts` (solo título/stepper).
* Opcional: `src/services/promptGenerator.js:917` exportar `aspectRatioToFalParam` helper.
* No tocar aún: `PanelCanvas.jsx`, `PreviewExport.jsx:26` (solo espejo), `Layout.jsx`, `Sidebar.jsx` salvo labels.

**No tocar:** `data/*`, `sync.sh`, `push.sh`.

---

## 7. Criterios de aceptación (qué debe pasar para dar por hecho)

* [ ] Usuario único guarda `falKey` y `opencode endpoint+key` en modelos, `probar conexión` funciona, key nunca en claro en disco ni git.
* [ ] Generar escena con `0..5` refs (fal `…/edit` o `t2i` según tenga imágenes) al tocar `generar` crea `Version stage:'scene'` y preview grande inmediato.
* [ ] Micro-iteración: cambiar 1 ref + editar prompt mínimo + `generar` envía `baseImage+refs ≤5` y crea nueva versión con `parentId`, sin borrar anteriores.
* [ ] `analizar con Go/Zen` devuelve `verdict+suggestion` y `usar como siguiente prompt` pre-llena textarea.
* [ ] `aprobar escena` congela **solo imagen** (`lockedImage`), deja `panels[0]` editable, habilita diálogos.
* [ ] Diálogos: `compositor` (todo en `PanelCanvas` + preview instantáneo), `fal.ai` (base=lockedImage+refs globo+texto exacto), `híbrido` (exportar base compositor→fal). Análisis diálogos chequea texto/ubicación/legibilidad/tipo globo.
* [ ] Versionado: se ven `original/aprobada/actual/anteriores/con diálogos/final`; volver a cualquier versión sin perder trabajo; máximo 5 (evicción FIFO draft más antiguo).
* [ ] `PreviewExport` sigue mostrando `cover` correcta (aprobada si hay).
* [ ] `npm run build` pasa (`AGENTS.md`). Código nuevo respeta leyes minúsculas/`28px` gris/`←`/`z>9999`.

---

## 8. Riesgos y mitigaciones

* **Payload grande (5 refs 800px base64):** comprimir a `jpeg 0.92` antes de `data URI`; fal acepta `data URI` pero puede impactar performance (doc fal `Files`).
* **Modelo `…/edit` sin `image_urls` falla:** fallback a `t2i` endpoint sin `…/edit` si payload vacío.
* **Límite 5 incluye base:** UI debe bloquear 6ª y avisar; servicio trunca a 5 más recientes si llega 6 por carrera.
* **Zen gratuitos con límite rate:** `ai:analyzeImage` con retry/backoff y degradación a análisis textual.
* **Seguridad keys:** `safeStorage` + `ai:getConfig` devuelve `****` masked; nunca loggear.

---

## 9. Referencias

* `AGENTS.md` (build, push.sh, leyes minúsculas/tipografía/flecha/color/controles 28px, datos `data/`).
* `electron/main.js:114` `DATA_DIR`, `183` `resolveRefPath`, `239` `readMany`, `871` `saveFile`, `901` `paste`, `914` `startDrag`, `122` `ensureDataDirs`.
* `src/store/stripStore.js:3`, `src/utils/stripCover.js:7`, `src/components/export/PromptExporter.jsx:15`, `src/services/promptGenerator.js:917`, `src/services/layoutSvg.js:36`, `src/components/chat/ChatPanel.jsx:112`, `src/store/chatStore.js:4`.
* `fal.ai/docs/documentation/model-apis/overview`, `authentication`, `model-api-reference/image-generation-api/*`, `pricing`.

---

*Documento: `docs/PLAN_PROMPT_ITERATIVO.md` — poner en repo y referenciar por nombre en futuros prompts. No ejecutar implementación hasta aprobación.*
