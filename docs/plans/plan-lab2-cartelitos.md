# Lab 2 — Cartelitos (editor post-aprobación)

> Instancia **post-aprobación** sobre la **imagen resultante única** (sea `manualPaste` de `PromptExporter.jsx:147` o `Generate via API` aprobada — mismo `panel.promptState.scene.approvedId`). Trae del SVG los carteles ya posicionados y edita vector → raster final.

## 1. Idea central

No duplica escena. `CartelitosEditor.jsx` renderiza `<img src=approvedScene>` + overlay SVG vectorial. Cada globo/narración/`globoX` hereda `x,y,w,h` del `layoutSvg.js:36` + `orderedPanelDialogues` (`promptGenerator.js:120`). Guardado en `panel.cartelitos` (ver §3). Export: `canvas.drawImage(approvedScene) + draw SVG → toDataURL('image/jpeg')` (patrón `PromptExporter.jsx:64` `svgToJPG` 800px).

Fuente **combinada** (aceptada): bundle 8 hand-lettering SIL (`src/assets/fonts/`) + Google Fonts dinámico (`services/fontService.js` lista `webfonts`/`css2`, cache 7d `data/cache/fonts.json`, descarga `woff2` a `data/fonts/` para offline). Sin red → fallback bundle (`Might Makes Right BB`).

## 2. Estado base

* `PanelCanvas.jsx:11` / `BalloonBlock.jsx:1` posicionamiento React/SVG ligero, `ConnectionArrows` + `linkSegments` dashed (`PanelCanvas.jsx:321`).
* `balloonLaws.js:54` `B1 organica-sutil`, `B2 grueso`, `D3 lectura`; `promptGenerator.js:285` `BALLOON GRAPHICS` + `:590` `linked dashed` (solo camino, ver §4).

## 3. Modelo

```json
panel.cartelitos = {
  "version": 1,
  "styleDefaults": { "typography": { "font":"Patrick Hand", "size": 1.0, "weight":400, "italic":false } },
  "balloons": [{
    "id":"", "kind":"speech|thought|shout|whisper|narration|other",
    "balloonId":"", "x":0,"y":0,"width":0,"height":0,
    "text":"", "typography":{"font":null,"size":1,"weight":400,"italic":null},
    "shape":{"invertH":false,"invertV":false,"tailSide":"auto|left|right|top|bottom","maya":{"lx":0,"ly":0,"rx":0,"ry":0,"warp":0}}
  }],
  "chains": [{ "balloonIds":[], "tube":{"width":0.02,"pattern":"dashed|solid","cap":"round"}, "bubbles":[{ "x":0,"y":0,"r":0.02 }] }],
  "legends": []
}
```
`project.styleDefaults.typography` default por proyecto; per-globo override (null = hereda).

## 4. Dashed en prompt = solo camino (corrección tuya)

`promptGenerator.js:590` `thin DASHED line` se mantiene como **indicación de camino** para Muse. En Cartelitos, ese dashed **es** el `tube.path` sobre el que se alinea el tubo real; no es el render final. Visual final §6.

## 5. Funciones

* **Reemplazar tipo globo:** selector cambia `balloonId`/`kind` y redibuja `path` según `BALLOON GRAPHICS`.
* **Tipografía:** dropdown fonts (bundle+Google) + size/weight/bold. Respeta `C1..C8`.
* **Tamaño + invertir:** resize handles (`BalloonBlock.jsx:69`) + `invertH/V` flip + `tailSide` recalcula `tailSegments` (`PanelCanvas.jsx:68`).
* **Deformar (maya):** 2 handles max control (aceptado). Cada handle mueve `Q` Bézier lateral del `path` (`M... Q hx hy ... Z`), curvatura `B1` sutil. Sin `Konva`, SVG path + `filter turbulence` opcional.
* **Cadena pensamiento 3 segmentos + patrón:** burbujas intermedias `ellipse rx/ry` fijas ratio; al alargar solo se estira **distancia entre centros** y `tube.length`, no la burbuja. Patrón `solid|dashed` marcable por chain.

## 6. Tubitos (“aire”) — por qué es complicadísimo y cómo se resuelve sin png roto

Problema: tubo sobre borde del globo de abajo debe **tapar exactamente** la línea, no transparentar. Si tubo es rect/line con alpha, se ve el borde inferior.

Solución vector con máscara:

* Orden z: `globoA(baixo)`, `globoB(alto)`, `tube` **encima** con `fill:white + stroke:black(B2)`.
* `tube` lleva `mask` donde intersecta bordes: `clipPath`/`mask` con `destination-out` (SVG `mask` o canvas `globalCompositeOperation='destination-out'`) recorta el `stroke` de los globos bajo el tubo. Tubo opaco tapa 100%, sin fantasma. Para `png` no hay atajo: debe ser vector antes de rasterizar.
* Cálculo `tube` entre centros (`PanelCanvas.jsx:59` `linkSegments`): `angle, length`, `cap round` para unión suave.

## 7. Viabilidad y phasing (recomendado)

* **MVP (1er PR Lab2):** traer posiciones, replace tipo, tipografía combinada, resize/invert, link 2 globos como `line dashed` actual (`PanelCanvas.jsx:321`). Sin maya ni tubo enmascarado. 80% valor, 20% complejidad, SVG puro.
* **V2 (2do PR):** maya 2 handles + cadena 3-seg + tubo con `mask` que tapa bordes + patrón. Requiere gestión `mask`/`clipPath` fina; evaluar `Konva` solo si handles SVG no alcanzan.

## 8. Archivos

* Nuevos `components/cartelitos/CartelitosEditor.jsx`, `CartelitosToolbar.jsx`, `TubeLayer.jsx`, `services/cartelitosRenderer.js`, `services/fontService.js`, `store/cartelitosStore.js`.
* Toca `PanelCanvas` solo para extraer `linkSegments/tailSegments` compartidos.

## 9. Criterios de aceptación Lab2

* Abrir Cartelitos sobre escena aprobada (manual o API) trae `n` globos posicionados.
* Cambiar font default proyecto refleja en todos (override conserva).
* Export JPG final incluye escena + carteles rasterizados sin blur.
* Invertir globo mueve tail correctamente.
* MVP sin regresión de `PanelCanvas`.
