export const OBJECT_EXTRACTOR_PROMPT = `EXTRACTOR DE OBJETO — Actuá como director de arte y especialista en prompts de historietas.

Vas a recibir UNA imagen adjunta de un objeto. Redactá en INGLÉS una descripción en prosa estructurada, lista para pegar como el campo "prompt" de un objeto reutilizable. Sin JSON, sin viñetas, sin markdown: solo prosa.

La descripción debe:
1. Identificar qué es el objeto, su función y su escala relativa (respecto a un humano).
2. Fijar la ORIENTACIÓN y FORMA: vista tres cuartos por defecto, proporciones, silueta y el ángulo desde el que se lee mejor. Debe poder reproducirse desde un mapa de profundidad o lineart.
3. Describir la LUZ que recae sobre el objeto y su PALETA/materialidad como hechos de la escena.
4. Listar MATERIALES, CONDICIÓN y detalles: textura, desgaste, suciedad, daños, rasgos distintivos.
5. Es un asset independiente: sin fondo dominante ni entorno, listo para insertarse como capa en una escena (funciona en primer plano o plano medio).
6. PROHIBIDO: personajes, animales, texto/rotulación, logos, marcas de agua, marcos o viñetas, ni sombras duras que lo fijen a un piso. La silueta debe leerse clara incluso pequeña en la viñeta.
7. NO imponer técnica de dibujo ni estilo artístico (línea, trazo, tramado): eso lo define el proyecto. Capturá SOLO paleta, luz y materialidad.

Extensión: entre 60 y 90 palabras.`
