# CORRECCIONES PRIORITARIAS — tira "sigue su camino"

Dictamen de revisión del resultado generado (`52e3b3bf-layout-1.jpg`, prompts, referencias). Puntos urgentes y su ubicación en el código.

## Fix prioritario (resultado del panel)

1. **Eliminar el quinto globo.** "Ese microondas es mío, Carlos" aparece dos veces (junto a Paola y en un globo grande abajo al centro). Debe haber exactamente 4 globos, uno por diálogo.
2. **Intercambiar verticalmente los globos de Paola:** el globo 1 ("Ese microondas es mío, Carlos", y ≈ 9%) debe quedar ARRIBA; el globo 3 ("Sí, lo dejé ahí...", y ≈ 24%) debajo. El orden de lectura debe ser 1→2→3→4. Hoy se lee 2→3→4→1 y el remate absurdo llega antes que el reclamo.
3. **Corregir la cola punteada del globo 3.** La línea punteada solo está permitida para CONECTAR globos consecutivos del mismo hablante, nunca como cola. Las colas deben ser onduladas y temblorosas (Crumb), sólidas, apuntando al personaje.

## Errores moderados

4. **Falta la lauchita** en la nota del microondas (pedida explícitamente). El líquido chorreando tampoco se distingue.
5. **Horizonte alto:** está en ~52–55% de la altura; debe estar en 63% (más cielo, figuras más pequeñas).
6. **Mirada de Carlos ambigua:** debe mirar a Paola (no al frente ni al microondas). La de Paola al microondas se sostiene.

## Problemas del propio prompt (código, `src/services/promptGenerator.js`)

7. **Contradicción de zona:** dice "his balloon is placed in the lower area" pero las coordenadas (y 9–31%) son de la zona superior. Corregir el texto para no confundir al modelo.
8. **Contradicción en Paola:** la descripción dice "arms crossed" (y la referencia) pero la acción dice "manos en la cintura". Unificar.
9. **"His balloon" para todas las voces** → usar fórmula neutra (debe ser "her" cuando corresponda).
10. **Reforzar el orden físico de lectura por coordenadas:** el globo 1 de cada hablante debe estar por encima de sus siguientes globos, y el número de globos debe ser exacto (sin duplicados ni huérfanos).

## Menores

11. Línea demasiado segura y prolija; se pedía "líneas dudosas como de dibujante sin experiencia" (refuerzo en el prompt).
12. El "0:00" del display del microondas no se aprecia (verificable en el prompt).

## Errores de tipeo fuente (corregir en datos/personaje)

13. **"Paolla"** y **"mio"** se reproducen verbatim en el resultado (correcto técnicamente, pero si son errores de tipeo hay que corregirlos en la fuente).

## Guías visuales a ajustar (`PanelCanvas.jsx` y `PromptExporter.jsx`)

14. La cola hacia el personaje debe dibujarse como línea SÓLIDA; la línea punteada solo para unir globos consecutivos del mismo hablante. Hoy ambas se dibujan punteadas y el layout refuerza el error.
15. Evitar que el layout sugiera que una conexión punteada es una cola.

## Lo que ya está bien

Formato 1:1, B/N, lettering manual con peso variable, contornos gruesos de globo, posiciones de Carlos/Paola/microondas según coordenadas, Carlos sosteniendo el microondas con dificultad, moscas, flora detallada en esquinas, fidelidad al camino rural y a las referencias.
