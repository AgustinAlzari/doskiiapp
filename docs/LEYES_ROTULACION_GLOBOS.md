# Leyes de rotulación de globos — referencias Blambot

Conjunto de leyes de uso para mejorar el prompt y la imagen de los globos (diálogo, pensamiento y narración) de @doski, extraídas de las infografías **"Better Letterer"** de **Nate Piekos** (Blambot).

- Fuente: https://blambot.com/es/pages/lettering-tips
- Cada ley tiene un identificador (`LEY-A1` … `LEY-D3`), su explicación, un ejemplo correcto/incorrecto y la traducción al prompt en inglés (lista para inyectar en `BALLOON GRAPHICS` / `DIALOGUE SEQUENCE`).
- Los identificadores están pensados para una futura configuración **por proyecto** (ver sección final): poder activar/desactivar o personalizar cada ley.

> No cubren: kerning de fuente (producción de tipografías), métodos de capas en Illustrator, paleta de color de efectos de sonido, puntos de tamaño tipográfico. Son aspectos irrelevantes para la generación de globos por IA.

---

## Sección A — Colas (tails)

### LEY-A1 — Las colas nunca se cruzan
**Ley:** ninguna cola de globo debe cruzarse con otra, ni siquiera de forma "implícita".

**Explicación:** cruzar colas es una de las señales más claras de rotulación amateur. Si dos personajes conversan y el que habla primero está a la derecha, hay que reacomodar los globos (más espacio arriba, o bajar un globo) para que las colas no se crucen. Si no hay otra solución, se superponen los **globos**, nunca las colas.

**Ejemplos:**
- ❌ INCORRECTO: el hablante 2 (derecha) habla primero y su cola cruza la del hablante 1 (izquierda). "Un delator inconfundible del nivel amateur."
- ⚠️ CASI INCORRECTO: las colas casi se tocan (cruce "implícito").
- ✅ CORRECTO: los globos se acomodan en el espacio disponible sin cruzar colas.
- ✅ ACEPTABLE: si no hay espacio arriba, un globo baja al nivel inferior, sin cruzar colas.
- Nota del autor: si se quiere sugerir que se pisan el discurso, superponer los globos, no las colas.

**Prompt EN:** `Balloon tails must NEVER cross or touch each other. If two speakers trade dialogue, rearrange balloon positions so no tail crosses another; when unavoidable, overlap balloon bodies instead — never the tails.`

**Fuente:** [#004](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl004.jpg?1883)

### LEY-A2 — La cola apunta a la cabeza
**Ley:** la cola de un globo debe apuntar hacia la **cabeza** del personaje que habla (o en dirección a ella), no hacia el pecho o el cuerpo.

**Explicación:** la cola es el ancla visual que conecta la voz con su emisor; apuntar al cuerpo o al aire rompe esa conexión y genera ambigüedad.

**Prompt EN:** `Each balloon tail must point toward the head of the character who is speaking, never toward their chest or body.`

**Fuente:** [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

### LEY-A3 — Ancho constante en la base de la cola
**Ley:** el ancho de la cola **donde se une al globo** debe ser el mismo en todos los globos de la página, sin importar el tamaño del globo ni el largo de la cola.

**Explicación:** es un punto de armonía gráfica frecuentemente ignorado. Si un globo se redimensiona, no hay que estirar/agrandar/achicar la cola desincronizándola del resto.

**Prompt EN:** `All balloon tails must have the SAME width where they meet the balloon, regardless of tail length or balloon size.`

**Fuente:** [#006](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl006.jpg?1883)

### LEY-A4 — La cola se afina gradualmente, nunca termina en aguja
**Ley:** la cola debe estrecharse de manera pareja (espacio negativo decreciente constante) hasta la punta. Nunca terminar en una punta de aguja filosa.

**Explicación:** las colas puntiagudas se pierden en el arte y se ven mal. El estrechamiento debe ser gradual y parejo.

**Prompt EN:** `Tails must taper evenly to the point (gradually decreasing width); never sharpen to a needle point.`

**Fuente:** [#006](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl006.jpg?1883)

### LEY-A5 — Colas económicas
**Ley:** las colas deben ser tan cortas y económicas como sea posible. Evitar colas ridículamente largas.

**Explicación:** una cola larga y sin necesidad ensucia la composición y puede chocar con otros elementos o colas (ver A1).

**Prompt EN:** `Tails must be as short and economical as possible; avoid unnecessarily long tails.`

**Fuente:** [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

---

## Sección B — Forma del globo

### LEY-B1 — Orgánica y sutil, no un óvalo perfecto
**Ley:** los globos deben tener forma orgánica, ligeramente imperfecta. No óvalos perfectos y "estériles". El efecto debe ser **sutil**.

**Explicación:** los globos simétricos (trazados con la herramienta elipse) resultan estériles. La alternativa es dibujarlos a mano alzada con variaciones sutiles. Si el temblor es excesivo, parecen globos "monstruo" o "borrachos" y distraen.

**Ejemplos:**
- ❌ INCORRECTO: globo de elipse perfecta (estéril, poco artesanal).
- ❌ INCORRECTO: globo orgánico demasiado movido/tembloroso (parece monstruo o globo de borracho).
- ✅ CORRECTO: globo a mano alzada con imperfecciones **sutiles**.

**Prompt EN:** `Balloons must have an organic, slightly imperfect hand-drawn shape — NOT a sterile perfect ellipse. Keep the imperfection subtle: too much wobble reads as a "monster" or "drunk" balloon and becomes a distraction.`

**Fuente:** [#019](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl019.jpg?v=1615305833)

### LEY-B2 — Contorno grueso
**Ley:** el contorno del globo debe ser grueso y pesado, claramente visible, de tinta negra.

**Explicación:** un trazo fino hace que el globo compita mal con el arte y se perciba débil.

**Prompt EN:** `The balloon outline stroke must be thick and heavy (visibly bold), drawn in black ink — never thin.`

**Fuente:** [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

### LEY-B3 — Se superponen los globos, nunca las colas
**Ley:** los globos pueden superponerse entre sí (por efecto o por falta de espacio), pero las **colas** nunca deben superponerse ni cruzarse.

**Explicación:** al apilar globos de una conversación, se "reparten como cartas": el globo que se lee primero va arriba. La superposición de cuerpos de globo es aceptada; la de colas, no.

**Prompt EN:** `Balloons may overlap each other (stack their bodies if needed), but their tails must NEVER overlap or cross. When stacking, the balloon read earlier sits on top.`

**Fuente:** [#013](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl013.jpg?1883) y [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

### LEY-B4 — No tapar caras ni figuras
**Ley:** evitar cubrir figuras (sobre todo caras) con los globos. Si es inevitable, cubrir lo mínimo posible.

**Explicación:** el globo es texto; tapar el arte clave (expresión facial, gesto, reacción) daña el gag y la lectura.

**Prompt EN:** `Do not cover faces or important figure details with balloons. If a balloon must cover artwork, cover as little as possible.`

**Fuente:** [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

### LEY-B5 — Fuera de la línea de mirada
**Ley:** evitar colocar globos en la línea de mirada de los personajes, sobre todo cuando dos personajes se miran frente a frente.

**Explicación:** un globo interpuesto entre dos miradas corta la conexión visual y distrae. No siempre es posible por espacio.

**Prompt EN:** `Do not place balloons inside a character's line-of-sight, especially between two characters facing each other in conversation.`

**Fuente:** [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

### LEY-B6 — Recortar contra el borde del panel
**Ley:** recortar los globos contra el borde del panel (butt/crop against the border) siempre que sea posible.

**Explicación:** además de ahorrar espacio, permite líneas de texto más anchas y una composición más natural. Es la excepción a la forma ovoide (ver C1).

**Prompt EN:** `Crop balloons against the panel border whenever possible (balloon edge touching the panel frame).`

**Fuente:** [#005](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl005.jpg?1883) y [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

---

## Sección C — Texto dentro del globo

### LEY-C1 — Apilado ovoide
**Ley:** las líneas de texto deben apilarse rellenando el espacio del globo en forma de **ovoide**: cortas arriba y abajo, más anchas en el medio.

**Explicación:** es la forma natural del globo de diálogo. La excepción es cuando el globo está recortado contra un borde.

**Ejemplos (de [#005](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl005.jpg?1883)):**
- ❌ INCORRECTO: la línea del medio demasiado ancha, el resto corto → "la línea del medio es demasiado ancha".
- ❌ INCORRECTO: una palabra diminuta arriba y líneas anchas por todas partes → "una palabra diminuta arriba y demasiado ancho en el resto".
- ✅ CORRECTO: `JIM IS SELLING / ENCYCLOPEDIAS / TO RAISE MONEY / FOR SCHOOL.` (ancho parejo, ovoide).

**Prompt EN:** `Stack the text inside each balloon in an ovoid shape: shorter lines at top and bottom, wider lines in the middle, filling the balloon evenly. Do not leave a lone tiny word on the top line.`

**Fuente:** [#005](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl005.jpg?1883) y [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

### LEY-C2 — La palabra larga va al centro
**Ley:** la palabra más larga de la frase debe colocarse en la línea más ancha (el medio del globo). Evitar partir palabras con guiones y evitar líneas con una sola palabra diminuta.

**Explicación:** ubicar la palabra larga en la parte más ancha del globo evita "huecos" raros de espacio negativo.

**Ejemplos:**
- ✅ CORRECTO: `ENCYCLOPEDIAS` en la línea central.
- ❌ INCORRECTO: la palabra larga al inicio del diálogo (arriba) o al final (abajo), deformando el ovoide.

**Prompt EN:** `Place the longest word of the dialogue on the widest (middle) line of the balloon. Do not hyphenate words, and never leave a line with a single tiny word.`

**Fuente:** [#005](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl005.jpg?1883)

### LEY-C3 — Margen interno e interlineado cómodo
**Ley:** dejar aproximadamente el ancho de **una letra mayúscula** de espacio entre el texto y el borde del globo, y un interlineado cómodo (que el texto "respire" sin aire de más).

**Explicación:** poco margen "ahoga" el texto; mucho margen lo hace flotar. El interlineado ideal permite que las líneas contiguas de texto grueso no se toquen pero queden juntas.

**Ejemplos (de [#007](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl007.jpg?1883)):**
- ❌ INCORRECTO: interlineado tan apretado que las líneas casi se tocan.
- ✅ CORRECTO: interlineado cómodo.
- ❌ INCORRECTO: interlineado demasiado suelto.
- ✅ CORRECTO: espacio entre texto y borde ≈ ancho de una letra mayúscula (consistente en todo el cómic).

**Prompt EN:** `Leave roughly one capital-letter-width of empty space between the text and the balloon outline, and comfortable line spacing: lines must not touch but must not float apart. Keep this padding consistent.`

**Fuente:** [#007](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl007.jpg?1883)

### LEY-C4 — Espacio negativo equilibrado (regla del 94%)
**Ley:** el espacio negativo dentro del globo debe verse uniforme y equilibrado. Si una línea es muy larga, se comprime horizontalmente como máximo al **94%** del ancho.

**Explicación:** comprimir una línea larga al 94% gana algo de aire sin que se note el "aplastado", uniformando el espacio negativo del globo.

**Prompt EN:** `Keep the negative space inside each balloon visually balanced. If a line is too long, you may compress it horizontally to at most 94% of its width — never more.`

**Fuente:** [#012](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl012.jpg?1883)

### LEY-C5 — Siempre mayúsculas; la "I" pronombre con serif
**Ley:** el texto de los globos se rotula en **mayúsculas**. La "I" como pronombre personal (o en siglas) lleva serif/barra; la "I" común es simple, de un solo trazo.

**Explicación:** es una convención tradicional del cómic. Confundir la "I" con barra para todo es indicador de rotulación amateur.

**Prompt EN:** `Letter all dialogue in UPPERCASE hand-lettering. The personal pronoun "I" and acronyms use a serif/barred capital I; other "I" letters use a plain single-stroke capital I.`

**Fuente:** [#001](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl001.jpg?v=1610463747)

### LEY-C6 — Cursiva según el tipo de diálogo
**Ley:** usar **cursiva** para: globos de pensamiento, susurros, palabras extranjeras, transmisiones de radio/telefonía, nombres de barcos, títulos de libros/películas/canciones, vocalizaciones no verbales y cantos. Diálogo gritado: más grande y más negra.

**Explicación:** la cursiva es un código visual que diferencia el canal de la voz. En @doski mapea directamente a `thought` y `whisper`; el grito (`shout`) se marca con peso/tamaño.

**Prompt EN:** `Use italic lettering for: thought-balloon text, whispered dialogue, foreign words, radio/phone transmissions, ship names, book/movie/song titles, non-word vocalizations, and sung dialogue. Shouted dialogue should be larger and bolder.`

**Fuente:** [#010](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl010.jpg?v=1610724302)

### LEY-C7 — Comillas dobles dentro del globo
**Ley:** cuando un personaje cita a alguien dentro de un globo de diálogo, se usan **comillas dobles** (nunca simples, que son incorrectas en globos). Comillas tipográficas curvas, no rectas.

**Explicación:** en el medio visual del cómic, el globo ya representa el habla; por eso la cita dentro de diálogo usa comillas dobles. Las simples quedan solo para citas dentro de leyendas/cartelas.

**Prompt EN:** `When dialogue quotes another person inside a balloon, use double quotation marks (never single quotes inside balloons). Use curly/typographic quotes, not straight ones.`

**Fuente:** [#009](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl009.jpg?1883) y [#023](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl023.jpg?v=1713276454)

### LEY-C8 — Elipsis y doble guion
**Ley:** `…` (elipsis) indica voz que se apaga; `--` (doble guion) indica interrupción o reemplaza al punto y coma. **Sin espacios** alrededor ni en medio. Si el diálogo continúa en un globo encadenado, el siguiente globo empieza con el mismo signo.

**Explicación:** son dos signos con funciones distintas que suelen usarse mal. El texto en cursiva/prompts debe respetarlos verbatim (el modelo no debe "corregirlos").

**Prompt EN:** `Preserve ellipses (…) as speech trailing off and double dashes (--) as interruptions exactly as written, with NO spaces around or between them. If speech continues into a following balloon of the same speaker, that balloon must begin with the same ellipsis or double dash.`

**Fuente:** [#011](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl011.jpg?1883) y [#023](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl023.jpg?v=1713276454)

---

## Sección D — Consistencia y lectura

### LEY-D1 — Globos de pensamiento consistentes
**Ley:** los bultos/burbujas de la nube de pensamiento deben ser consistentes en tamaño y separación, tanto dentro del globo como entre globos de la página. El globo se dibuja del tamaño justo para el texto — jamás estirar un mismo globo para llenar más texto.

**Explicación:** copiar el mismo globo y estirarlo para acomodar textos distintos produce burbujas con separaciones dispares. Se necesita un repertorio de tamaños y formas que se adapte a la cantidad de texto.

**Ejemplos (de [#016](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl016.jpg?v=1588685741)):**
- ❌ INCORRECTO: el mismo globo estirado en toda la página; separación entre bultos dispar.
- ✅ CORRECTO: globos de distintos tamaños con bultos de tamaño y frecuencia casi iguales.

**Prompt EN:** `Thought-balloon cloud bulges must be consistent in size and spacing within each balloon and across balloons. Draw each thought balloon sized proportionally to its text — never stretch one balloon to fit more or less text.`

**Fuente:** [#016](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl016.jpg?v=1588685741)

### LEY-D2 — Estilo consistente en toda la página
**Ley:** todos los globos de la página deben compartir el mismo estilo: mismo grosor de contorno, mismo ancho de cola en la base, misma cantidad de espacio interno.

**Explicación:** la coherencia visual es la base del "look" profesional; la inconsistencia delata al letrista improvisado.

**Prompt EN:** `Keep balloon style fully consistent across the whole page: same outline weight, same tail width at the base, same internal padding.`

**Fuente:** [#006](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl006.jpg?1883) y [#016](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl016.jpg?v=1588685741)

### LEY-D3 — Orden de lectura nunca ambiguo
**Ley:** el orden de lectura debe quedar siempre claro: de arriba hacia abajo y de izquierda a derecha. Si el primer hablante está a la derecha, se reacomodan los globos — nunca se cruzan colas (A1).

**Explicación:** si el globo del personaje que habla segundo queda más arriba o a la izquierda del primero, el remate del gag llega antes que el planteo. El lector debe poder seguir la conversación sin dudas.

**Prompt EN:** `Reading order must never be ambiguous: balloons read top-to-bottom, then left-to-right. If the character speaking first sits on the right, rearrange balloon positions so reading order is still clear — never cross tails to fix it.`

**Fuente:** [#004](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl004.jpg?1883) y [#014](https://cdn.shopify.com/s/files/1/0152/5779/6662/files/bl014.jpg?v=1611089342)

---

## Diseño propuesto para edición por proyecto (futuro)

Este documento es la base para una configuración por proyecto que se puede implementar luego:

```js
// Ejemplo de esquema en project (projectStore.js / makeDefaultProject)
balloonLaws: {
  enabled: ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'D1', 'D2', 'D3'],
  overrides: {
    // Ejemplo de personalización por ley:
    'C6': { italicTypes: ['thought', 'whisper'], shoutWeight: 'heavier' },
    'B1': { wobble: 'subtle' },
  },
}
```

- **`enabled`**: lista de ids de leyes activas. Solo las activas se inyectan en el prompt.
- **`overrides`**: personalizaciones opcionales por ley (qué tipos van en cursiva, nivel de temblor, etc.).
- **UI**: en `ProjectForm.jsx` (sección "globos por tipo"), un listado con checkbox por ley + un campo libre de override por ley, con el texto de la ley (este documento) como ayuda.
- **Prompt**: en `promptGenerator.js`, `BALLOON_LETTERING_RULES` pasaría a construirse filtrando `balloonLaws.enabled` y aplicando los overrides.

Las leyes A1–D3 son las que hoy reemplazarían/ampliarían las reglas fijas actuales del bloque `COMMON RULES` y los refuerzos de `DIALOGUE SEQUENCE`.
