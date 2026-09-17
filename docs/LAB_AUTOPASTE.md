# lab autopaste — envío automático svg + prompt al chat embarcado

> blueprint para otra IA. No implementar hasta que el usuario diga. Repo ya tiene el panel prompt + chat en misma pantalla.
> **Objetivo:** dos botones por cuadro que pegan **todas las imágenes de la columna + prompt + Enter automático** en el `webview` de `chatgpt`/`gemini`. Dos envíos separados: escena y diálogos.

## 1. estado actual — leer primero

* `src/App.jsx:323-331` vista `prompts` renderiza `PromptExporter` izq + `ChatPanel` der fijo `520px` (`src/components/chat/ChatPanel.jsx:44-57`, `src/components/chat/ChatLayout.jsx:6`). `setChatOpen(true)` al entrar.
* `electron/main.js:79` `webviewTag:true`. `ChatPanel.jsx:112-117` `<webview src={model.url}>` modelos `chatgpt/gemini/claude` (`src/store/chatStore.js:4-8`).
* Drag manual hoy: `ReferenceThumbnail:onMouseDown` -> `window.api.references.startDrag` (`src/components/export/PromptExporter.jsx:584-589`) -> `electron/main.js:915-928` `startDrag({file,icon})`.
* Texto manual hoy: `window.api.clipboard.write` (`electron/main.js:887`, `src/components/export/PromptExporter.jsx:139-160`) + `Ctrl+V` en webview.
* Cada cuadro `strip.panels[i]` (`PromptExporter.jsx:425`):
  - escena: `scenePrompt = generateScenePrompt(...)` (`src/services/promptGenerator.js:917`, `PromptExporter.jsx:429`), visual `svgPaths[`${i}:scene`]` JPG 800x800 (`PromptExporter.jsx:93-104` + `111-136` + `src/services/layoutSvg.js:56-76`) + `panelSceneRefs(panel)` (`232-255`) chips refs personaje/objeto/fondo/firma.
  - diálogos: `letteringPrompt = generateLetteringPrompt(...)` (`934`, `430`), visual `svgPaths[`${i}:lettering`]` (`src/services/layoutSvg.js:77-97`) + `panelBalloonRefs(panel)` (`257-269`) globos.
  - `generateLayoutSVG` genera SVG `400xH` según `ASPECT_RATIOS` (`src/services/layoutSvg.js:36-40`), rasterizado a JPG vía `canvas.toDataURL` y guardado con `references:saveFile` (`electron/main.js:871`).
* IPC: `electron/preload.js:63-77` expone `references:read/readMany/saveFile`, `clipboard:write/writeImage`. Nada `chat:paste` aún.
* Leyes UI (`AGENTS.md`, `src/index.css`): minúsculas, `btn 28px` `background:transparent` gris, sin acento azul, flecha `←` sola sin recuadro.

## 2. objetivo funcional — lo que pidió el usuario

1. En columna **escena**, botón `enviar escena` hace **1 envío atómico** al chat: **todas** las imágenes de escena (`1 svg escena JPG + N refs escena`) + `scenePrompt` como texto, **todo en mismo mensaje**, luego `Enter` automático.
2. En columna **diálogos**, botón `enviar diálogos` hace **1 envío atómico** separado: **todas** las imágenes de diálogos (`1 svg diálogos JPG + M refs globos`) + `letteringPrompt`, mismo mensaje + `Enter`.
3. Iteración es manual por cuadro: usuario toca escena cuadro 1, luego escena cuadro 2... luego diálogos cuadro 1, etc. Cada botón es independiente, no bulk.
4. Debe funcionar en **chatgpt y gemini** (extensible a claude). Los `model.url` viven en `chatStore`.
5. `Enter` **siempre automático** (usuario confirmó).

## 3. arquitectura propuesta — interno, sin visión ni AppleScript

No usar `cliclick`/visión: todo está en misma `BrowserWindow`, controlable por `webview` APIs.

### 3.1 nuevo servicio `src/services/chatInjector.js`

```js
export function getWebview() { return document.querySelector('webview') }
export async function ensureReady(webview) {
  // espera webview dom-ready (ChatPanel.jsx:13-22), model?.url (ChatPanel.jsx:110), y !generating (PromptExporter.jsx:108)
}
export async function injectBatch({ filePaths, text }) {
  const wv = getWebview(); await ensureReady(wv); wv.focus();
  // 1) imágenes secuenciales (ChatGPT/Gemini colapsan pastes simultáneos)
  for (const p of filePaths.filter(Boolean)) {
    const dataUrl = await window.api.references.read(p); // electron/main.js:231
    if (!dataUrl) continue;
    const base64 = dataUrl.split(',')[1];
    await window.api.clipboard.writeImage(base64); // electron/main.js:893
    // paste agnóstico al DOM: enfoca webview y simula Cmd+V
    wv.focus();
    // Electron <webview> expone sendInputEvent en el elemento
    wv.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['meta'] });
    wv.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['meta'] });
    // fallback si sendInputEvent no dispara: wv.executeJavaScript(`document.execCommand('paste')`)
    await new Promise(r => setTimeout(r, 900));
    // opcional poll: await wv.executeJavaScript(`document.querySelector('[data-testid="composer"]')?.innerHTML.length`)
  }
  // 2) texto en mismo composer (queda junto a las imgs adjuntas)
  await window.api.clipboard.write(String(text||'')); // electron/main.js:887
  wv.focus();
  wv.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['meta'] });
  wv.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['meta'] });
  await new Promise(r => setTimeout(r, 400));
  // 3) Enter automático
  wv.sendInputEvent({ type: 'keyDown', keyCode: 'Enter', modifiers: [] });
  wv.sendInputEvent({ type: 'char', keyCode: '\r' });
  wv.sendInputEvent({ type: 'keyUp', keyCode: 'Enter', modifiers: [] });
}
```

Notas:
* `sendInputEvent` es la vía más robusta cross-modelo (no depende de selector `div#prompt-textarea` que cambia). Alternativa `executeJavaScript` con `querySelector('[contenteditable="true"]')` solo como fallback para escribir `innerText`.
* `chatgpt` y `gemini` usan `Enter` para enviar, `Shift+Enter` para salto — enviar solo `Enter` sin `shift`.
* Si `filePaths.length > 10`, dividir en 2 envíos con aviso (límite ChatGPT).
* Gemini a veces muestra `rich-textarea` `div.ql-editor`; el paste por clipboard igual funciona si el webview tiene foco.

### 3.2 UI `src/components/export/PromptExporter.jsx`

* Col escena `448-483`: al lado de `copiar escena` (`451-456`) añadir `<button className="btn btn-sm" onClick={()=>send('scene',i)} disabled={generating||!svgPaths[`${i}:scene`]||sending===`scene-${i}`}>` texto `enviar escena` / `enviando...` / `enviado ✓`.
* Col diálogos `489-500`: al lado de `copiar diálogos` añadir `enviar diálogos` análogo `sending===`lettering-${i}``.
* Handler:
```js
const [sending, setSending] = useState(null)
const send = async (kind, idx) => {
  const label = kind==='scene' ? `scene-${idx}` : `lettering-${idx}`
  if (sending) return
  setSending(label)
  try {
    if (!chatOpen) useChatStore.getState().setOpen(true) // src/App.jsx:319
    // esperar svg si aún genera
    if (generating) await new Promise(r=>setTimeout(r,800))
    const panel = strip.panels[idx]
    const filePaths = kind==='scene'
      ? [svgPaths[`${idx}:scene`], ...panelSceneRefs(panel).map(r=>r.path)]
      : [svgPaths[`${idx}:lettering`], ...panelBalloonRefs(panel).map(r=>r.path)]
    const text = kind==='scene'
      ? generateScenePrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, idx, strip, project, sceneLayoutFileNameFor(strip,idx), resolvedPalette, author)
      : generateLetteringPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, idx, strip, project, letteringLayoutFileNameFor(strip,idx), balloons, resolvedPalette)
    const { injectBatch } = await import('../../services/chatInjector')
    await injectBatch({ filePaths, text })
  } finally { setSending(label); setTimeout(()=>setSending(null),1500) }
}
```
* Deshabilitar si `!model?.url` (`ChatPanel.jsx:110` muestra placeholder `agregá un modelo`).
* Respetar leyes: `btn 28px`, `ui-h2 16px/700`, minúsculas, sin color acento.

### 3.3 IPC — reusar existente

* Ya expuestos `references:read` (`electron/main.js:231`, `preload.js:71`), `clipboard:write/writeImage` (`887/893`, `preload.js:64`). No hace falta nuevo handler si todo se hace en renderer con `sendInputEvent`.
* Opcional añadir `chat:focusWebview` si se quiere enfocar desde main, pero no bloqueante.

### 3.4 colección de filePaths — detalle

```js
const sceneFiles = (panel, idx) => {
  const svg = svgPaths[`${idx}:scene`] // PromptExporter.jsx:437
  const refs = panelSceneRefs(panel) // 232-255 dedup por Set, incluye signature
  return [svg, ...refs.map(r=>r.path)].filter(Boolean)
}
const letteringFiles = (panel, idx) => {
  const svg = svgPaths[`${idx}:lettering`]
  const refs = panelBalloonRefs(panel) // 257-269
  return [svg, ...refs.map(r=>r.path)].filter(Boolean)
}
```
`panelSceneRefs` ya evita duplicados por `fileName`/`path`. `resolveRefPath` (`electron/main.js:183`) resuelve `basename` en otra máquina.

## 4. pasos de implementación para la IA que sigue

1. Crear `src/services/chatInjector.js` con `injectBatch` + `ensureReady` + `getWebview`.
2. Editar `src/components/export/PromptExporter.jsx` para importar `chatInjector`, `sceneLayoutFileNameFor`/`letteringLayoutFileNameFor` ya importados, añadir estados `sending`, y los 2 botones por cuadro.
3. (Opcional) Exponer `webviewRef` en `ChatPanel.jsx` vía `window.__chatWebview` o `useChatStore` si `querySelector` no encuentra por shadow.
4. Probar con `chatgpt` y `gemini` (cambiar modelo en `ChatPanel.jsx:74-89`).
5. `export PATH="/Users/edicionesalz/.local/node-v20.18.0-darwin-x64/bin:$PATH" && npm run build` (`AGENTS.md`).
6. `./push.sh "lab autopaste: blueprint"` — no `git` local.

## 5. edge cases y mitigaciones

* `generating===true` o `svgPaths[key]==null`: botón disabled, tooltip `generando vectores...`, o trigger `generateVectors()` (`93-108`) on-demand.
* `filePaths` vacío y `text` vacío: no enviar.
* `webview` no cargado o `model.url==null`: toast `elegí un modelo en la sección modelo` y `setOpen(true)`.
* Payload gigante (5 refs 800px base64 ~ 4MB): `writeImage` maneja buffer nativo (`nativeImage.createFromBuffer` `main.js:895`), no hay límite `dataUrl` si se va por clipboard.
* Rate: si `injectBatch` se llama 2 veces seguidas, bloquear con `sending` para no solapar clipboards (clipboard es global).
* Foco perdido: siempre `wv.focus()` antes de cada `sendInputEvent`.

## 6. no tocar

* `data/`, `sync.sh`, `push.sh`, `electron/backup.js`.
* `PromptExporter` no debe romper `copiar todos` (`294`), `exportar .txt` (`297`), `regenerar vectores` (`300`), `sumar referencia` (`303`), `results` (`308-422`), `copyCoverResult`, `pasteResult`.

## 7. verificación manual

1. Abrir proyecto -> viñeta -> `prompts`, esperar `generando vectores...` termine.
2. Cuadro 1: click `enviar escena` -> ver en `ChatPanel` `chatgpt` N-thumbs adjuntos + `scenePrompt` pegado + mensaje enviado.
3. Cambiar modelo a `gemini` en `ChatPanel` header, repetir cuadro 1 `enviar diálogos` -> verificar mismo.
4. Cuadro 2: repetir ambos, verificar que cada envío es independiente y no mezcla paneles.
5. `npm run build` pasa sin errores.

---
*Lab: `docs/LAB_AUTOPASTE.md` — poner en repo y referenciar por nombre. No ejecutar hasta aprobación.*
