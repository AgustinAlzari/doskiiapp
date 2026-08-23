// Markdown mínimo para el texto de globos: `**negrita**`, `*cursiva*` y saltos
// de línea. Se usa tanto para renderizar el backdrop del editor como para
// traducir el texto a instrucciones de lettering en el prompt.

const ALIGNS = [
  { id: 'left', label: 'izquierda', en: 'LEFT' },
  { id: 'center', label: 'centro', en: 'CENTER' },
  { id: 'right', label: 'derecha', en: 'RIGHT' },
  { id: 'justify', label: 'justificado', en: 'JUSTIFIED' },
]

export const DEFAULT_ALIGN = 'center'

export function alignLabel(id, lang = 'es') {
  const a = ALIGNS.find(x => x.id === id)
  if (!a) return DEFAULT_ALIGN
  return lang === 'en' ? a.en : a.label
}

// Parte el texto en segmentos { text, style: 'bold' | 'italic' | null }.
// Los saltos de línea se respetan como segmentos con text === '\n'.
export function parseMarkdown(str) {
  const s = String(str || '')
  const segments = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) pushText(segments, s.slice(last, m.index))
    if (m[1] != null) pushText(segments, m[1], 'bold')
    else if (m[2] != null) pushText(segments, m[2], 'italic')
    last = m.index + m[0].length
  }
  if (last < s.length) pushText(segments, s.slice(last))
  return segments
}

function pushText(arr, text, style = null) {
  const chunks = String(text).split('\n')
  chunks.forEach((c, i) => {
    if (i > 0) arr.push({ text: '\n', style: null })
    if (c) arr.push({ text: c, style })
  })
}

// Texto plano (sin asteriscos), respetando saltos de línea.
export function markdownPlain(str) {
  return parseMarkdown(str).map(seg => seg.text).join('')
}

// HTML para el backdrop del editor: negrita/cursiva + saltos de línea.
export function markdownToHtml(str) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return parseMarkdown(str).map(seg => {
    const t = esc(seg.text)
    if (seg.text === '\n') return '<br/>'
    if (seg.style === 'bold') return `<strong>${t}</strong>`
    if (seg.style === 'italic') return `<em>${t}</em>`
    return t
  }).join('')
}

// Traduce un texto con markdown a instrucciones de lettering para el prompt.
// Devuelve { literal, emphasis, lineBreaks, align } listos para concatenar.
export function markdownPromptParts(str, align = DEFAULT_ALIGN) {
  const segments = parseMarkdown(str)
  const lines = []
  let cur = ''
  for (const seg of segments) {
    if (seg.text === '\n') { lines.push(cur); cur = '' }
    else cur += seg.text
  }
  lines.push(cur)
  const nonEmpty = lines.map(l => l.trim()).filter(Boolean)
  const literal = lines.map(l => l.trim()).join(' ')
  const emphasis = segments
    .filter(s => s.style && s.text.trim())
    .map(s => `"${s.text.trim()}" in ${s.style === 'bold' ? 'bold' : 'italic'}`)
  const lineBreaks = nonEmpty.length > 1
    ? [`The text is lettered on ${nonEmpty.length} lines exactly as: ${nonEmpty.map(l => `"${l}"`).join(' / ')}.`]
    : []
  const alignId = ALIGNS.some(a => a.id === align) ? align : DEFAULT_ALIGN
  const alignText = `Text lines ${alignLabel(alignId, 'en')}-aligned within the balloon.`
  return { literal, emphasis, lineBreaks, align: alignText }
}

// Instrucciones de tamaño y posición del párrafo dentro del globo para el prompt.
export function layoutPrompt(fontSize = 1, textX = 0, textY = 0) {
  const parts = []
  if (fontSize != null && Math.abs(fontSize - 1) > 0.02) {
    parts.push(`lettering scaled to ${Math.round(fontSize * 100)}% of its default size`)
  }
  if (textX) parts.push(`text block shifted ${Math.round(textX * 100)}% horizontally within the balloon`)
  if (textY) parts.push(`text block shifted ${Math.round(textY * 100)}% vertically within the balloon`)
  return parts.length ? ` ${parts.join('; ')}.` : ''
}