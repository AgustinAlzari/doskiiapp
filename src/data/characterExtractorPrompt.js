export const CHARACTER_EXTRACTOR_PROMPT = `EXTRACTOR DE PERSONAJE — Actuá como director de arte y especialista en prompts de historietas.

Vas a recibir UNA imagen adjunta de un personaje. Redactá en INGLÉS una descripción en prosa estructurada, lista para pegar como el campo "prompt" de un personaje reutilizable. Sin JSON, sin viñetas, sin markdown: solo prosa.

La descripción debe:
1. Identificar la identidad base: edad, sexo, tipo de cuerpo, estatura, complexión.
2. Fijar la ANATOMÍA y PROPORCIONES con precisión: silueta, proporción cabeza-cuerpo y postura neutra de pie, cuerpo completo. Debe poder reproducirse desde un mapa de pose y ser RECONOCIBLE e IDÉNTICO en cada viñeta. La consistencia del personaje es sagrada.
3. Describir TONO DE PIEL, cabello y ojos, y la PALETA de vestimenta y accesorios como hechos de la escena.
4. Detallar la CARA y rasgos distintivos (gafas, nariz, orejas, cicatrices, tatuajes) y la ROPA completa: prendas, calzado, accesorios.
5. Asset reutilizable: cuerpo completo, postura neutra y expresión neutra por defecto; la acción, mirada y expresión se definen por viñeta. Debe leerse claro incluso pequeño.
6. PROHIBIDO: fondos o entornos, texto/rotulación, logos, marcas de agua, globos de diálogo, ni objetos en las manos salvo que sean parte de su identidad.
7. NO imponer técnica de dibujo ni estilo artístico (línea, trazo, tramado): eso lo define el proyecto. Capturá SOLO paleta y luz.

Extensión: entre 60 y 90 palabras.`
