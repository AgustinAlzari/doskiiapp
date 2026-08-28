# Lab 1 — Generación / Iteración Prompt con Muse Image + OpenCode Go

> Sección **Prompt** por viñeta: generación visual iterativa + control asistido. Soporta `Generate via API` y `Copiar para chatbot` en paralelo.

## 1. Objetivo (tu flujo 1–4 + 12–13)

`referencias(≤max) + texto → Muse Image → preview → análisis opcional OpenCode Go (visión) → corrección → nueva iteración → aprobación escena → diálogos → control → final`

* Muse Image = motor visual. Hasta `max` refs por iteración (configurable, default 5) de personaje/estilo/composición/objeto/escenario/viñeta anterior. Layout escena **siempre** como 1 ref (`src/services/layoutSvg.js:36` → JPG vía `src/services/promptGenerator.js:625` + `electron/main.js:566` `references:save-file`).
* OpenCode Go (Muse Spark visión) = análisis, no generador: respeta prompt+refs, detecta errores composición/personaje/objeto/estilo, propone instrucción corrección + ayuda redactar siguiente prompt. Requiere modelo visión.
* Cursor siempre del usuario: aprobar / corregir manual / pedir análisis.

## 2. Estado actual verificado

* `backup/src/services/promptGenerator.js:625` `generateScenePrompt` (LETTERING LOCK) + `:642` `generateLetteringPrompt` (SCENE LOCK) + `generatePanelPrompt`.
* `backup/src/services/layoutSvg.js:36` `generateLayoutSVG(panel,...,mode='scene'|'lettering')`.
* `backup/src/components/export/PromptExporter.jsx:36` columnas escena/diálogos, copia texto, junta refs (`panelSceneRefs`/`panelBalloonRefs` `:180`), `svgToJPG` `:64`, `results[≤3]` + `resultCoverIndex`, `refs-usadas`.
* Datos `Library/Application Support/dibuweb/data/{projects,characters,backgrounds,objects,balloons,strips,references}` (`backup/electron/main.js:97`). `backup.json:1` sync `rclone gdrive:doski-backup` + `git doskiiapp.git/data`.
* `backup/src/store/projectStore.js:37` `authorId` por proyecto, `backup/data/authors/*.json:1` base de usuario.

## 3. Investigación Muse Image (canónica)

* Endpoint: `POST https://api.meta.ai/v1/responses` vía OpenAI SDK `new OpenAI({baseURL:"https://api.meta.ai/v1", apiKey: MODEL_API_KEY})` (cookbook `05_muse_image/01_image_api_fundamentals/README.md`). Modelo `muse-image-1.0` razonador: `response.output = [reasoning, message, image_generation_call{result: base64}]`, `response.id/status/usage{input_tokens,output_tokens,reasoning_tokens}`.
* Conversacional: `client.responses.create({model,input})` T1; `previous_response_id: turn1.id` T2+ (server conserva imagen, enviás solo cambio). `store:true` default; `store:false` replay.
* Refs: `input:[{role:"user", content:[{type:"input_text",text},{type:"input_image",image_url:"data:image/...;base64,..."}, ...]}]` — bare list 400. Pricing `$0.01/image` (blog build-with-muse-Image 2026-08-26). Alternativa one-shot `POST /v1/images/edits` (OpenAI-compat `dev.meta.ai/docs/api-reference/images`).

## 4. Diseño Lab 1

### 4.1 Key por autor, portable, híbrida (aceptada)

`authors/{id}.json`:
```json
{ "apiKeys": [{ "id":"", "provider":"meta", "label":"Muse Image", "encryptedKey":"", "keyHint":"...abcd", "createdAt":"" }], "modelPrefs": { "defaultImageModel":"muse-image-1.0", "defaultVisionModel":"muse-spark-1.2" }, "budget": { "currency":"ARS", "monthlyLimit": 5000, "alertAt":0.8, "hardStop": true }, "usageLedger": { "totalImages":0, "byModel":{}, "costARS":0, "costUSD":0 } }
```
* Guardado: `preload → main` cifra con `safeStorage.encryptString` (keychain macOS). Archivo nunca guarda plain-text. Fallback passphrase AES-GCM para portabilidad.
* Sync: `authors/*.json` excluido de `git` (`.gitignore`), solo `rclone gdrive`. En máquina nueva, misma Mac descifra sola; otra Mac pide passphrase 1 vez.
* Export `.doski` (`electron/main.js:472` `projects:export`) checkbox “incluir credenciales cifradas”.
* UX: resolver key por `activeProject.authorId`; picker `window.api.authorSecrets.set(authorId, rawKey)`.

### 4.2 Catálogo modelos

`services/modelCatalog.js` + IPC `models:list` → `GET /v1/models` con key del autor activo, filtra `capabilities: image_generation|image_edit|vision|text`, flags `free|paid`. Cache `data/cache/models.json` 24h + fallback `data/modelCatalog.json`. UI `components/models/ModelPicker.jsx` con filtros texto/visión/imagen y badge costo.

### 4.3 Config refs + layout siempre

`project.settings = { maxRefs: 5, alwaysIncludeLayout: true }` (1..8). Validación UI+backend. Layout JPG cuenta en max. `max` editable por proyecto.

### 4.4 Servicio Muse Image

`services/museImageService.js` + IPC `museImage:generate|refine` en `electron/main.js`:
* Lee refs → `data_url`, arma `input` con `buildMuseImageRequest(panel,mode,refs,layoutFileName)` (reusa `promptGenerator`).
* Escena: `scenePrompt + refs≤max + layout`.
* Iteración escena: `previous_response_id = lastResponseId` + `correctionPrompt` (manual o `vision:analyze`).
* Diálogos vía Muse: `letteringPrompt + escena aprobada` (via `previous_response_id` o `input_image` si cambió) + refs globo.
* Decodifica `image_generation_call.result` → `data/references/<strip8>-scene-iterN.webp`, retorna `{fileName,path,responseId,usage}`.
* Fallback `/v1/images/edits`.

### 4.5 OpenCode Go visión

`services/visionAnalysisService.js` + IPC `vision:analyze` → `model: muse-spark-1.2` (fallback 1.1) con `input_text checklist + input_image data_url resultado + prompt+refs`. Salida JSON `{fidelity, compositionErrors[], styleOk, suggestion, nextPromptDraft}`. Checklists escena vs diálogos (tu spec 2 y 8). Botón “Analizar con OpenCode Go” en preview escena y diálogos.

### 4.6 Contabilidad moneda configurable + por proyecto (aceptada)

`project.budget.currency = ARS|USD|EUR` (usuario dijo Muse cobra ARS). Si moneda=ARS nativa, precio por imagen en ARS (sin FX). Si USD→ARS, `services/fxService.js` (Bluelytics/BCRA cache diario). Ledger por autor **y** por proyecto (`project.usageLedger` filtrado por `projectId` de `usageLedger.byPanel[]`). UI:
* `Sección Modelos` global: tabla por autor `imágenes | ARS | USD | tope | restante`.
* `Header Proyecto` + `Prompt > Cartelitos`: `este proyecto: 12 imgs · $148 ARS`.
No suma si vía `Copiar para chatbot`; solo `Generate via API` (`response.usage`).

### 4.7 Compat paralela + versionado

`PromptWorkspace.jsx` toggle por panel `[Generate via API] [Copiar para chatbot]` — mismo `promptGenerator`. Nuevo `panel.promptState = { scene:{iterations:[{id,turnId,promptText,refs,image,analysis}], approvedId, currentId}, dialogs:{mode,iterations,sourceSceneId,currentId,approvedId}, museConversation:{firstResponseId,lastResponseId,usageTotals}, versions[] }`. Cada iteración archivo nuevo; restaurar no borra. Mantener `strip.results/resultCoverIndex` legado migrado.

## 5. Archivos a tocar

* `electron/main.js` + `preload.js` — `authorSecrets`, `museImage:*`, `vision:analyze`, `models:list`, `fx`.
* `services/promptGenerator.js` — `buildMuseImageRequest`.
* Nuevos `services/museImageService.js`, `visionAnalysisService.js`, `modelCatalog.js`, `fxService.js`, `imageEncoding.js`.
* `store/promptIterationStore.js` o `stripStore.js` + migrador.
* UI `components/prompt/PromptWorkspace.jsx`, `SceneIterationPanel.jsx`, `VersionTimeline.jsx`, `VisionAnalysisCard.jsx`, `components/models/ModelPicker.jsx`.
* `.gitignore` `authors/*.json` o `authors.secrets.json`.

## 6. Secuencia build (reversible, sin pisar flujo manual)

1. `authorSecrets` + `modelCatalog` + `maxRefs/alwaysLayout`
2. Workspace escena generate/refine/approve/versionado + ledger ARS
3. Diálogos + vision + Modelos con topes

## 7. Riesgos

* Tokens por ref (+2-3k) → mostrar `usage` y bloquear >max.
* Drift escena en fase diálogos → `SCENE LOCK` + `previous_response_id` + check visión.
* FX sin red → usar último cache + aviso.
* `500 dev.meta.ai` → cookbook como fuente, backoff + fallback `images/edits`.
